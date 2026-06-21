/**
 * Google AdSense ヘルパー。
 *
 * 設計方針:
 * - 環境変数 `VITE_ADSENSE_CLIENT_ID` が設定されているときだけ実 AdSense と連携する。
 * - 未設定なら `AdBanner` 側でプレースホルダ表示を維持し、`<script>` も注入しない。
 * - スクリプトはアプリ起動時に 1 度だけ document.head に追加する（重複注入防止）。
 * - `pushAdsByGoogle()` は SSR 安全のため `typeof window` で短絡する。
 *
 * 本ファイルは React に依存しないユーティリティ層。
 */

const ADSENSE_SCRIPT_SRC_BASE = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js';
/** 注入済み判定および重複注入防止用の data 属性。 */
const ADSENSE_SCRIPT_DATA_ATTR = 'data-adsense-injected';

/**
 * AdSense パブリッシャー ID。
 * `ca-pub-` プレフィックス付き文字列を返す。未設定なら空文字。
 */
export function getAdsenseClientId(): string {
  return import.meta.env.VITE_ADSENSE_CLIENT_ID ?? '';
}

/** AdSense 連携が設定済みか (=パブリッシャー ID が指定されているか)。 */
export function isAdsenseConfigured(): boolean {
  return getAdsenseClientId().trim().length > 0;
}

/**
 * AdSense スクリプトを `document.head` に動的注入する。
 *
 * - `isAdsenseConfigured()` が false なら何もしない。
 * - 既に注入済み（同一 client ID）の場合も何もしない。
 * - SSR 環境では `document` 未定義のため早期 return。
 */
export function injectAdsenseScript(): void {
  if (typeof document === 'undefined') return;
  if (!isAdsenseConfigured()) return;

  const clientId = getAdsenseClientId();
  const existing = document.querySelector<HTMLScriptElement>(
    `script[${ADSENSE_SCRIPT_DATA_ATTR}="${clientId}"]`,
  );
  if (existing) return;

  const script = document.createElement('script');
  script.async = true;
  script.crossOrigin = 'anonymous';
  script.src = `${ADSENSE_SCRIPT_SRC_BASE}?client=${encodeURIComponent(clientId)}`;
  script.setAttribute(ADSENSE_SCRIPT_DATA_ATTR, clientId);
  document.head.appendChild(script);
}

/**
 * AdSense の広告ロードを 1 枠分要求する。
 *
 * `<ins class="adsbygoogle">` を DOM に挿入した直後に呼び出す想定。
 * ロードに失敗しても他の枠やアプリ動作を止めないよう、例外はログ出力で握り潰す。
 */
export function pushAdsByGoogle(): void {
  if (typeof window === 'undefined') return;
  if (!isAdsenseConfigured()) return;

  try {
    window.adsbygoogle = window.adsbygoogle || [];
    window.adsbygoogle.push({});
  } catch (err) {
    // 広告ロード失敗はアプリの動作に影響させない。
    // 開発時の調査用に warn のみ残す。
    // eslint-disable-next-line no-console
    console.warn('[adsense] pushAdsByGoogle failed', err);
  }
}
