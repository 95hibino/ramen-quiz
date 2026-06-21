/**
 * 法務ページ (プライバシーポリシー / 利用規約 / お問い合わせ) で共通利用する
 * メタ情報 (運営者・連絡先・最終更新日)。
 *
 * 運営者名と連絡先は社長が後で埋めるプレースホルダ。
 * 環境変数 `VITE_OPERATOR_NAME` / `VITE_OPERATOR_CONTACT` が設定されていれば
 * そちらを優先する (CI/CD で安全に注入できるように)。
 */

const ENV_OPERATOR_NAME =
  typeof import.meta !== 'undefined' && import.meta.env
    ? (import.meta.env.VITE_OPERATOR_NAME as string | undefined)
    : undefined;

const ENV_OPERATOR_CONTACT =
  typeof import.meta !== 'undefined' && import.meta.env
    ? (import.meta.env.VITE_OPERATOR_CONTACT as string | undefined)
    : undefined;

/** 運営者名 (社長が後で確定)。 */
export const OPERATOR_NAME: string =
  ENV_OPERATOR_NAME && ENV_OPERATOR_NAME.length > 0 ? ENV_OPERATOR_NAME : '（運営者名）';

/** 運営者連絡先 (社長が後で確定)。 */
export const OPERATOR_CONTACT: string =
  ENV_OPERATOR_CONTACT && ENV_OPERATOR_CONTACT.length > 0
    ? ENV_OPERATOR_CONTACT
    : '（連絡先メールアドレス）';

/**
 * 法務ページの最終更新日 (YYYY-MM-DD)。
 * 変更があるたびに手動で更新する。
 */
export const LEGAL_LAST_UPDATED = '2026-06-15';
