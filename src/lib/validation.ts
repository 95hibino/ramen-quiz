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

/** ユーザー名: 3-20 字、英数字 / 日本語 (ひらがな・カタカナ・漢字) / アンダースコア・ハイフン。 */
const USERNAME_PATTERN =
  /^[A-Za-z0-9_\-぀-ゟ゠-ヿ一-鿿ｦ-ﾝ]+$/u;

const RESERVED_USERNAMES: readonly string[] = ['_shacho'];

export function validateUsername(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) return 'ユーザー名を入力してください。';
  if (trimmed.length < USERNAME_MIN) return `ユーザー名は ${USERNAME_MIN} 文字以上にしてください。`;
  if (trimmed.length > USERNAME_MAX) return `ユーザー名は ${USERNAME_MAX} 文字以内にしてください。`;
  if (!USERNAME_PATTERN.test(trimmed)) {
    return 'ユーザー名に使用できない文字が含まれています。';
  }
  if (RESERVED_USERNAMES.includes(trimmed.toLowerCase())) {
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
