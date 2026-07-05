/**
 * ユーザー名 → 内部専用の "fake email" 変換ユーティリティ。
 *
 * 背景:
 * - Supabase Auth は Email + Password ベースの認証を前提とする。
 * - 本サービスは個人情報 (メールアドレス含む) を扱わない方針。
 * - ゆえに、ユーザー名から決定的に生成した "内部専用メール" を Auth 用の
 *   ダミー email として使う。
 *
 * 変換規則:
 *   fake email = `<sha256_hex_32>@ramen-quiz.internal`
 *
 * - 入力は `username.trim().normalize('NFKC').toLowerCase()` を経て安定化
 * - SHA-256 の先頭 32 文字 (128 bit) を local part に使用 → 衝突確率は事実上 0
 * - `.internal` TLD は IANA 予約 (RFC 6761) で公開ドメインとして使用不可 →
 *   実在ドメインとの衝突リスクなし
 *
 * このメールは Supabase ダッシュボードでは可視だが、外部への送信は行わない。
 * Supabase Auth 側で "confirm email" は無効化する必要がある (SUPABASE_SETUP.md §11)。
 */

const FAKE_EMAIL_DOMAIN = 'ramen-quiz.internal';

function bufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

/**
 * ユーザー名から fake email を生成する (決定的、非同期)。
 * 同じユーザー名からは常に同じメールが得られる。
 */
export async function usernameToFakeEmail(username: string): Promise<string> {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error('Web Crypto API が利用できません。HTTPS または localhost で実行してください。');
  }
  const normalized = username.trim().normalize('NFKC').toLowerCase();
  const encoder = new TextEncoder();
  const data = encoder.encode(`ramen-quiz-auth:v1:${normalized}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const hex = bufferToHex(digest).slice(0, 32);
  return `${hex}@${FAKE_EMAIL_DOMAIN}`;
}
