/**
 * サイト全体の定数 (URL / 名称 / 説明 / OGP デフォルト画像)。
 *
 * シェア URL や OGP の絶対 URL 構築に使用する。本番ドメインは
 * `VITE_SITE_URL` 環境変数で上書き可能。未設定時はクライアント側で
 * `window.location.origin` をフォールバックする。
 *
 * design §Phase 2 SNS シェア機能。
 */

/** サイト名 (OGP の og:site_name / <title> サフィックス等に使用)。 */
export const SITE_NAME = 'ラーメンクイズ';

/** デフォルト OGP 説明文 (ページ未指定時用)。 */
export const SITE_DEFAULT_DESCRIPTION =
  'ラーメンの歴史・地域・文化・製麺まで、奥深いラーメン知識を 4 択クイズで楽しく学ぼう。';

/**
 * デフォルト OGP 画像 (ルート相対パス)。
 *
 * `/api/og?mode=hero` は Vercel Edge Function (`api/og.tsx`) が返す動的 PNG。
 * 従来の `/og-default.svg` は SVG のため、一部の SNS クローラー (LINE 等) で正しく
 * レンダリングされない懸念があった。PNG に統一することで X / Facebook / LINE /
 * Discord など主要プラットフォームで安定表示される。
 *
 * 個別ページ (Result 等) はそれぞれ `<Seo ogImage="/api/og?score=..&type=.." />`
 * で上書きするため、この値はページ側で指定しなかった時のフォールバックとなる。
 */
export const DEFAULT_OG_IMAGE_PATH = '/api/og?mode=hero';

/**
 * 本番ドメインを含むサイトの絶対 URL。
 *
 * 優先順位:
 *   1. `VITE_SITE_URL` 環境変数 (`.env` / `.env.production` / Vercel 等)
 *   2. クライアント実行時の `window.location.origin`
 *   3. ビルド時 / SSR 時の空文字 (シェア URL のフォールバックは呼び出し側)
 */
const ENV_SITE_URL =
  typeof import.meta !== 'undefined' && import.meta.env
    ? (import.meta.env.VITE_SITE_URL as string | undefined)
    : undefined;

/**
 * 末尾スラッシュを取り除いた origin を返す。
 * 例: `https://example.com/` → `https://example.com`
 */
function normalizeOrigin(url: string): string {
  return url.replace(/\/$/, '');
}

/**
 * クライアント・サーバ両対応のサイト URL ベース。
 *
 * - 環境変数で本番ドメインが指定されていればそれを採用 (CI/CD 推奨)
 * - 未指定時、ブラウザでは `window.location.origin` を採用
 * - SSR/CLI ビルド時は空文字を返す (呼び出し側でガード)
 */
export function getSiteUrl(): string {
  if (ENV_SITE_URL && ENV_SITE_URL.length > 0) {
    return normalizeOrigin(ENV_SITE_URL);
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    return normalizeOrigin(window.location.origin);
  }
  return '';
}

/**
 * パス (例: `/result`) からサイト絶対 URL を組み立てる。
 * 既に絶対 URL の場合はそのまま返す。
 */
export function buildSiteUrl(path = '/'): string {
  if (/^https?:\/\//i.test(path)) return path;
  const base = getSiteUrl();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}
