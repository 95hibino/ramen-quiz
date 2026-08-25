/**
 * フォーム入力のバリデーション関数群。
 *
 * 戻り値は `null` で成功、文字列でエラーメッセージとする。
 * UI 側 (Signup/Login) はこのモジュールを単一のソースオブトゥルースとして利用する。
 */
import { isValidPrefecture } from '@/data/prefectures';

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;
export const PASSWORD_MIN = 8;
export const FAVORITE_SHOP_MIN = 1;
export const FAVORITE_SHOP_MAX = 50;

/**
 * ユーザー名として保存する形に整える (前後空白の除去 + NFKC 正規化)。
 *
 * NFKC を通すことで、見た目が同じでコードポイントが違う入力を 1 つに畳む:
 * - 全角英数 `ＲＡＭＥＮ` → `RAMEN`
 * - 半角カナ `ﾗｰﾒﾝ` → `ラーメン`
 * - 互換文字 `①` → `1`
 *
 * これを行わないと「同じ名前に見えるのに別アカウント」を量産できてしまう。
 * **保存する値そのもの**をこの関数で正規化し、表示もこの値を使う。
 */
export function normalizeUsername(value: string): string {
  return value.trim().normalize('NFKC');
}

/**
 * ユーザー名の一意性を判定するためのキー (正規化 + 小文字化)。
 *
 * 大文字小文字を区別しないため `Ramen` と `ramen` は同一人物とみなす。
 * このキーは以下の 3 か所すべてで同じ値になっている必要がある:
 * - `fakeEmail.usernameToFakeEmail` が作る Supabase Auth 用メール (実質の一意制約)
 * - `public_profiles` の一意インデックス `lower(normalize(username, NFKC))`
 * - フロントの重複事前チェック `isUsernameTaken`
 */
export function usernameKey(value: string): string {
  return normalizeUsername(value).toLowerCase();
}

/**
 * ユーザー名に使える文字。**NFKC 正規化後**の文字列に対して適用する。
 * - 半角英数字 / アンダースコア / ハイフン
 * - ひらがな (ぁ-ゟ) / カタカナ (ァ-ヿ: 長音符ーやヶを含む) / CJK 統合漢字
 * - 繰り返し記号など日本語の人名で使う記号: 々 〆 〇
 *
 * 空白・絵文字・その他の記号は不可。半角カナは NFKC で全角カナに畳まれるため
 * 入力自体は受け付けられる (保存値は全角になる)。
 */
const USERNAME_PATTERN = /^[A-Za-z0-9_\-ぁ-ゟァ-ヿ々〆〇一-鿿]+$/u;

/**
 * 予約語。運営・システムを騙る名前を一般ユーザーに取らせない。
 * 判定は `usernameKey` (NFKC + 小文字) 同士で行う。
 * `_shacho` は写真投稿のレート制限をバイパスする管理者 ID なので必須
 * (docs/SUPABASE_SETUP.md §9)。
 */
const RESERVED_USERNAMES: readonly string[] = [
  '_shacho',
  'admin',
  'administrator',
  'root',
  'support',
  'official',
  'system',
  '運営',
  '管理者',
];

export function validateUsername(value: string): string | null {
  const normalized = normalizeUsername(value);
  if (normalized.length === 0) return 'ユーザー名を入力してください。';
  // 長さは NFKC 正規化後で数える (全角英数で上限を回避されないように)
  if (normalized.length < USERNAME_MIN) return `ユーザー名は ${USERNAME_MIN} 文字以上にしてください。`;
  if (normalized.length > USERNAME_MAX) return `ユーザー名は ${USERNAME_MAX} 文字以内にしてください。`;
  if (!USERNAME_PATTERN.test(normalized)) {
    return 'ユーザー名に使えるのは、英数字・ひらがな・カタカナ・漢字と _ - のみです。';
  }
  if (RESERVED_USERNAMES.includes(usernameKey(normalized))) {
    return 'このユーザー名は予約されているため使用できません。';
  }
  return null;
}

export function validatePassword(value: string): string | null {
  if (value.length === 0) return 'パスワードを入力してください。';
  if (value.length < PASSWORD_MIN) return `パスワードは ${PASSWORD_MIN} 文字以上にしてください。`;
  return null;
}

export function validatePrefecture(value: string): string | null {
  if (value.length === 0) return '都道府県を選択してください。';
  if (!isValidPrefecture(value)) return '都道府県の選択が不正です。';
  return null;
}

export function validateFavoriteShop(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length < FAVORITE_SHOP_MIN) return '好きなラーメン店を入力してください。';
  if (trimmed.length > FAVORITE_SHOP_MAX) {
    return `好きなラーメン店は ${FAVORITE_SHOP_MAX} 文字以内にしてください。`;
  }
  return null;
}

// ============================================================
// お問い合わせフォーム / 通報フォーム用 (Phase 2 法務ページ追加)
// ============================================================

export const CONTACT_NAME_MAX = 30;
export const CONTACT_EMAIL_MAX = 100;
export const CONTACT_BODY_MIN = 10;
export const CONTACT_BODY_MAX = 2000;
export const REPORT_BODY_MAX = 500;

/**
 * お問い合わせ種別。DB の CHECK 制約と一致させる。
 * - bug: バグ報告
 * - feature: 機能要望
 * - copyright: 著作権・削除依頼
 * - other: その他
 */
export type ContactCategory = 'bug' | 'feature' | 'copyright' | 'other';

export const CONTACT_CATEGORIES: readonly ContactCategory[] = [
  'bug',
  'feature',
  'copyright',
  'other',
] as const;

export const CONTACT_CATEGORY_LABELS: Record<ContactCategory, string> = {
  bug: 'バグ報告',
  feature: '機能要望',
  copyright: '著作権・削除依頼',
  other: 'その他',
};

/**
 * 通報理由。DB の CHECK 制約と一致させる。
 * - inappropriate: 不適切画像
 * - copyright: 著作権侵害
 * - privacy: 個人情報写り込み
 * - misinfo: 偽情報・誤った店舗情報
 * - other: その他
 */
export type ReportReason = 'inappropriate' | 'copyright' | 'privacy' | 'misinfo' | 'other';

export const REPORT_REASONS: readonly ReportReason[] = [
  'inappropriate',
  'copyright',
  'privacy',
  'misinfo',
  'other',
] as const;

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  inappropriate: '不適切画像',
  copyright: '著作権侵害',
  privacy: '個人情報の写り込み',
  misinfo: '偽情報・誤った店舗情報',
  other: 'その他',
};

/** SQL の email CHECK 制約と整合させた、必要十分なメール形式チェック。 */
const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function validateContactName(value: string): string | null {
  // 任意項目: 空欄は OK
  if (value.length === 0) return null;
  if (value.length > CONTACT_NAME_MAX) {
    return `お名前は ${CONTACT_NAME_MAX} 文字以内で入力してください。`;
  }
  return null;
}

export function validateContactEmail(value: string): string | null {
  // 任意項目: 空欄は OK (返信不要時)
  if (value.length === 0) return null;
  if (value.length > CONTACT_EMAIL_MAX) {
    return `メールアドレスは ${CONTACT_EMAIL_MAX} 文字以内で入力してください。`;
  }
  if (!EMAIL_PATTERN.test(value)) {
    return 'メールアドレスの形式が正しくありません。';
  }
  return null;
}

export function validateContactBody(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length < CONTACT_BODY_MIN) {
    return `お問い合わせ内容は ${CONTACT_BODY_MIN} 文字以上で入力してください。`;
  }
  if (trimmed.length > CONTACT_BODY_MAX) {
    return `お問い合わせ内容は ${CONTACT_BODY_MAX} 文字以内で入力してください。`;
  }
  return null;
}

export function isContactCategory(value: string): value is ContactCategory {
  return (CONTACT_CATEGORIES as readonly string[]).includes(value);
}

export function validateReportBody(value: string): string | null {
  // 任意項目: 空欄は OK
  if (value.length === 0) return null;
  if (value.length > REPORT_BODY_MAX) {
    return `補足は ${REPORT_BODY_MAX} 文字以内で入力してください。`;
  }
  return null;
}

export function isReportReason(value: string): value is ReportReason {
  return (REPORT_REASONS as readonly string[]).includes(value);
}
