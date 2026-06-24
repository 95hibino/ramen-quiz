import { Helmet } from 'react-helmet-async';
import {
  DEFAULT_OG_IMAGE_PATH,
  SITE_DEFAULT_DESCRIPTION,
  SITE_NAME,
  buildSiteUrl,
} from '@/config/site';

/**
 * Seo (OGP / Twitter Card / canonical / robots) コンポーネント。
 *
 * 各ページから呼ぶことで、共通の og:* / twitter:* メタタグを動的に差し替える。
 * react-helmet-async は React 18 + Strict Mode 対応のため採用 (react-helmet は警告が出る)。
 *
 * 追加機能:
 * - `canonical` (link rel="canonical") の出力
 * - `robots` メタタグ (デフォルト index, follow) - インデックスさせたくないページは `noIndex` を渡す
 * - `keywords` メタタグ (任意) - 効果は薄いが AI クローラーが参考にする場合あり
 * - `ogType` で WebSite / Article などを切り替え可能
 *
 * design §Phase 2 SNS シェア機能 + SEO 強化第一弾 (2026/06)。
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
  /**
   * OGP のページ種別。デフォルト `website`。
   * 個別の解説記事を持つようになれば `article` を指定する。
   */
  ogType?: 'website' | 'article';
  /**
   * 検索エンジンにインデックスさせたくない場合は true。
   * デフォルト false (= index, follow を出力)。
   * 例: 結果画面・マイページなどユーザー固有ページで使う。
   */
  noIndex?: boolean;
  /**
   * SEO 用キーワード (カンマ区切り or 配列)。
   * 主要検索エンジンの順位には影響しないが、Bing / 一部 AI クローラーは参考にする。
   * 設定しない場合は keywords メタタグ自体を出力しない。
   */
  keywords?: string | ReadonlyArray<string>;
}

export function Seo({
  title,
  description = SITE_DEFAULT_DESCRIPTION,
  url,
  ogImage,
  ogType = 'website',
  noIndex = false,
  keywords,
}: SeoProps): JSX.Element {
  const pageTitle = `${title} | ${SITE_NAME}`;

  // SSR を行わない構成のため、url 省略時はブラウザのロケーションを参照する。
  const resolvedUrl = resolveCanonicalUrl(url);
  const resolvedImage = resolveAbsoluteUrl(ogImage ?? DEFAULT_OG_IMAGE_PATH);
  const robotsContent = noIndex ? 'noindex, nofollow' : 'index, follow';
  const keywordsContent = normalizeKeywords(keywords);

  return (
    <Helmet>
      <title>{pageTitle}</title>
      <meta name="description" content={description} />
      <meta name="robots" content={robotsContent} />
      {keywordsContent ? <meta name="keywords" content={keywordsContent} /> : null}
      {resolvedUrl ? <link rel="canonical" href={resolvedUrl} /> : null}

      {/* Open Graph */}
      <meta property="og:type" content={ogType} />
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

/**
 * `keywords` prop を `meta[name="keywords"]` 用のカンマ区切り文字列に正規化する。
 * - 文字列ならトリムしてそのまま返す (空文字なら未指定として扱う)。
 * - 配列なら空要素を除いて `, ` で結合する。
 */
function normalizeKeywords(keywords: string | ReadonlyArray<string> | undefined): string | null {
  if (!keywords) return null;
  if (typeof keywords === 'string') {
    const trimmed = keywords.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  const joined = keywords
    .map((k) => k.trim())
    .filter((k) => k.length > 0)
    .join(', ');
  return joined.length > 0 ? joined : null;
}
