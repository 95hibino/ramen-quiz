/**
 * お問い合わせフォーム送信用 Supabase リポジトリ。
 *
 * `contact_submissions` テーブルへ INSERT する薄いラッパー。
 *
 * - Supabase 未接続時 (`getSupabaseClient()` が null) は呼び出し側で
 *   `isContactRepositoryReady()` を見て送信ボタンを無効化する
 *   ※ このリポジトリでは未接続時に `submit` を呼ぶと例外を投げる (UI 側の責任分離)。
 * - レート制限トリガー (`enforce_contact_rate_limit`) は同じメールアドレスからの
 *   送信を 1 時間に 1 件に制限する。発火時は `rate_limit_exceeded:<残り秒数>` 形式の
 *   エラーメッセージを返すため、`ContactRateLimitError` に変換して UI に渡す。
 */
import { getSupabaseClient } from './supabaseClient';
import type { ContactCategory } from './validation';

/** お問い合わせ用テーブル名。 */
export const CONTACT_SUBMISSIONS_TABLE = 'contact_submissions';

/** お問い合わせ送信ペイロード (DB スキーマと整合)。 */
export interface ContactSubmission {
  /** 任意。最大 30 字 (UI 側でバリデーション済み前提)。 */
  name?: string;
  /** 任意。返信希望時のみ。空欄なら undefined を渡す。 */
  email?: string;
  /** 必須。`bug`/`feature`/`copyright`/`other` のいずれか。 */
  category: ContactCategory;
  /** 必須。10〜2000 字 (UI 側でバリデーション済み前提)。 */
  body: string;
}

/**
 * メールアドレス指定時のレート制限 (1 時間に 1 件) に引っかかったときに投げる例外。
 * UI 側でこの型を catch してフレンドリーな文言に変換する。
 */
export class ContactRateLimitError extends Error {
  /** 再送信可能になるまでの残り秒数 (最低 1)。 */
  public readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    super(`rate_limit_exceeded:${retryAfterSeconds}`);
    this.name = 'ContactRateLimitError';
    this.retryAfterSeconds = Math.max(1, Math.floor(retryAfterSeconds));
    // ES5 ターゲットでも instanceof が機能するように prototype を復元
    Object.setPrototypeOf(this, ContactRateLimitError.prototype);
  }
}

/**
 * Supabase の PostgrestError メッセージから `rate_limit_exceeded:<秒数>` を検出する。
 * 該当しない場合は `null`。
 */
function parseRateLimitMessage(message: string | undefined | null): number | null {
  if (!message) return null;
  const match = message.match(/rate_limit_exceeded:(\d+)/);
  if (!match) return null;
  const seconds = Number.parseInt(match[1], 10);
  if (!Number.isFinite(seconds) || seconds < 0) return null;
  return seconds;
}

/**
 * Supabase が利用可能かを返す。
 * UI 側はこれを見て送信ボタンの活性化を制御する。
 */
export function isContactRepositoryReady(): boolean {
  return getSupabaseClient() !== null;
}

/**
 * お問い合わせを送信する。
 *
 * @throws `ContactRateLimitError` レート制限に引っかかった場合
 * @throws `Error` 上記以外の失敗 (ネットワーク / DB エラー等)
 */
export async function submitContact(payload: ContactSubmission): Promise<void> {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error('Supabase が未接続のため送信できません。');
  }

  // email は空文字を許容しない CHECK 制約があるため、空文字なら明示的に null を入れる
  const trimmedName = payload.name?.trim();
  const trimmedEmail = payload.email?.trim();
  const insertPayload = {
    name: trimmedName && trimmedName.length > 0 ? trimmedName : null,
    email: trimmedEmail && trimmedEmail.length > 0 ? trimmedEmail : null,
    category: payload.category,
    body: payload.body.trim(),
  };

  const { error } = await client.from(CONTACT_SUBMISSIONS_TABLE).insert(insertPayload);
  if (error) {
    const composite = [error.message, error.details, error.hint]
      .filter((s): s is string => typeof s === 'string')
      .join(' | ');
    const retryAfter = parseRateLimitMessage(composite);
    if (retryAfter !== null) {
      throw new ContactRateLimitError(retryAfter);
    }
    throw new Error(`お問い合わせの送信に失敗しました: ${error.message}`);
  }
}
