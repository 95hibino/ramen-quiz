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
 *   fake email = `<sha256_hex_32>@example.com`
 *
 * - 入力は `username.trim().normalize('NFKC').toLowerCase()` を経て安定化
 * - SHA-256 の先頭 32 文字 (128 bit) を local part に使用 → 衝突確率は事実上 0
 * - ドメイン部は `example.com` (IANA 予約、RFC 2606) を使用
 *   - 実在するが「documentation only」で誰にも配送されない特殊ドメイン
 *   - Supabase の email validator が `.internal` `.test` `.local` 等の
 *     「配送不可 TLD」を弾く仕様に対応済みのため、より安全な `example.com` を採用
 *
 * このメールは Supabase ダッシュボードでは可視だが、外部への送信は行わない
 * (Confirm email OFF を前提。SUPABASE_SETUP.md §11 参照)。
 * 万一 Confirm email が有効になっていても、`example.com` は IANA が保有し
 * どこにも配送されないため、実ユーザーに迷惑メールが届くリスクはない。
 */

const FAKE_EMAIL_DOMAIN = 'example.com';

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
