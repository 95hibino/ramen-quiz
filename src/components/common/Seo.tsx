import { Helmet } from 'react-helmet-async';
import {
  DEFAULT_OG_IMAGE_PATH,
  SITE_DEFAULT_DESCRIPTION,
  SITE_NAME,
  buildSiteUrl,
} from '@/config/site';

/**
 * Seo (OGP / Twitter Card) コンポーネント。
 *
 * 各ページから呼ぶことで、共通の og:* / twitter:* メタタグを動的に差し替える。
 * react-helmet-async は React 18 + Strict Mode 対応のため採用 (react-helmet は警告が出る)。
 *
 * design §Phase 2 SNS シェア機能。
 */
export interface SeoProps {
  /** ページ固有タイトル。`{title} | ラーメンクイズ` の形式で <title> に出力する。 */
  title: string;
  /** ページ固有の説明文。省略時はサイト共通の説明文を使う。 */
  description?: string;
  /**
   * ページの正規 URL またはルート相対パス。
   * 絶対 URL でも `/result` のような相対パスでも可。
   * 省略時はクライアントの location.href を採用する。
   */
  url?: string;
  /** OGP 画像の絶対 URL またはルート相対パス。省略時は `/og-default.svg`。 */
  ogImage?: string;
}

export function Seo({
  title,
  description = SITE_DEFAULT_DESCRIPTION,
  url,
  ogImage,
}: SeoProps): JSX.Element {
  const pageTitle = `${title} | ${SITE_NAME}`;

  // SSR を行わない構成のため、url 省略時はブラウザのロケーションを参照する。
  const resolvedUrl = resolveCanonicalUrl(url);
  const resolvedImage = resolveAbsoluteUrl(ogImage ?? DEFAULT_OG_IMAGE_PATH);

  return (
    <Helmet>
      <title>{pageTitle}</title>
      <meta name="description" content={description} />
      {resolvedUrl ? <link rel="canonical" href={resolvedUrl} /> : null}

      {/* Open Graph */}
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:title" content={pageTitle} />
      <meta property="og:description" content={description} />
      {resolvedUrl ? <meta property="og:url" content={resolvedUrl} /> : null}
      <meta property="og:image" content={resolvedImage} />
      <meta property="og:locale" content="ja_JP" />

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={pageTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={resolvedImage} />
    </Helmet>
  );
}

/**
 * `url` propを正規化して canonical / og:url 用の絶対 URL を返す。
 * - 絶対 URL → そのまま
 * - 相対パス → SITE_URL ベースで結合
 * - 未指定 → ブラウザの location.href (SSR 時は空文字)
 */
function resolveCanonicalUrl(url: string | undefined): string {
  if (url) {
    if (/^https?:\/\//i.test(url)) return url;
    return buildSiteUrl(url);
  }
  if (typeof window !== 'undefined') return window.location.href;
  return '';
}

/**
 * ルート相対パスを絶対 URL に正規化する (OGP 画像用)。
 * SITE_URL 設定があればそれを使い、なければ window.location.origin を使う。
 */
function resolveAbsoluteUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const built = buildSiteUrl(pathOrUrl);
  // ビルド時など origin が空のフォールバック: 相対パスのまま返す。
  return built.startsWith('http') ? built : pathOrUrl;
}
