/**
 * 写真クイズ通報用 Supabase リポジトリ。
 *
 * `content_reports` テーブルへ INSERT する薄いラッパー。
 *
 * - Supabase 未接続時 (`getSupabaseClient()` が null) は呼び出し側が
 *   `isReportRepositoryReady()` を見て通報ボタン自体を非表示にする。
 *   このリポジトリで `submit` が呼ばれた場合は例外を投げる。
 * - 同じ画像への重複通報は許容 (UNIQUE 制約なし)。複数集まれば社長が優先対応判断に使える。
 */
import { getSupabaseClient } from './supabaseClient';
import type { ReportReason } from './validation';

/** 通報用テーブル名。 */
export const CONTENT_REPORTS_TABLE = 'content_reports';

/** 通報送信ペイロード (DB スキーマと整合)。 */
export interface ReportSubmission {
  /** 対象問題の UUID (`user_photo_questions.id`)。 */
  questionId: string;
  /** 必須。`inappropriate` / `copyright` / `privacy` / `misinfo` / `other`。 */
  reason: ReportReason;
  /** 任意。最大 500 字。 */
  body?: string;
}

/** Supabase が利用可能かを返す。UI 側は通報ボタンの表示制御に使う。 */
export function isReportRepositoryReady(): boolean {
  return getSupabaseClient() !== null;
}

/**
 * 通報を送信する。
 *
 * @throws Supabase 未接続の場合 / DB エラーの場合
 */
export async function submitReport(payload: ReportSubmission): Promise<void> {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error('Supabase が未接続のため通報できません。');
  }

  const trimmedBody = payload.body?.trim();
  const insertPayload = {
    question_id: payload.questionId,
    reason: payload.reason,
    body: trimmedBody && trimmedBody.length > 0 ? trimmedBody : null,
  };

  const { error } = await client.from(CONTENT_REPORTS_TABLE).insert(insertPayload);
  if (error) {
    throw new Error(`通報の送信に失敗しました: ${error.message}`);
  }
}
