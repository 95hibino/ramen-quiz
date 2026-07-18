/**
 * Sentry (エラー監視 + パフォーマンス計測) の初期化ラッパー。
 *
 * 環境変数 `VITE_SENTRY_DSN` が設定されている場合のみ init する。
 * 未設定なら no-op なので、ローカル開発・DSN未取得の間は費用ゼロで動く。
 *
 * `@sentry/react` は初期化しなくてもバンドルには含まれる (Sentry.ErrorBoundary を
 * 使いたいため)。DSN 未設定時は SDK が inert 状態で動くだけでイベント送信はしない。
 *
 * セットアップ手順は `docs/SENTRY_SETUP.md` を参照。
 */
import * as Sentry from '@sentry/react';

/**
 * Sentry を初期化する。`main.tsx` から ReactDOM.render の前に 1 度だけ呼ぶ。
 *
 * - DSN 未設定 → 何もせず return (SDK は inert)
 * - DSN あり → イベント送信有効化、パフォーマンス 10% サンプリング
 */
export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn || dsn.trim().length === 0) {
    return;
  }

  Sentry.init({
    dsn,
    // Vercel が VITE_VERCEL_ENV を露出させている場合 (production / preview / development) を優先。
    // それ以外は Vite の mode (production / development) を採用。
    environment:
      (import.meta.env.VITE_VERCEL_ENV as string | undefined) || import.meta.env.MODE,
    // リリース識別。Vercel の VITE_VERCEL_GIT_COMMIT_SHA を採用すると
    // Sentry ダッシュボードで「どのコミットの不具合か」が追跡できる。
    release: import.meta.env.VITE_VERCEL_GIT_COMMIT_SHA as string | undefined,
    // パフォーマンス計測: 10% サンプル。
    // 無料枠 (Sentry: エラー 5,000/月・トランザクション 10,000/月) を過剰消費しないための保守設定。
    // トラフィックが伸びたら 0.05 (5%) に絞る。
    tracesSampleRate: 0.1,
    integrations: [Sentry.browserTracingIntegration()],
    // 送信前フィルタ: 既知ノイズを弾く。
    ignoreErrors: [
      // ResizeObserver の内部エラー (実害なし、Chromium の既知バグ)。
      /ResizeObserver loop /,
      // Chrome 拡張や iOS Safari の Promise キャンセルノイズ。
      'Non-Error promise rejection captured',
      // 広告ブロッカー等でスクリプト読み込みが止められた場合。
      'ChunkLoadError',
      // Vite の HMR / モジュールプリロード失敗 (ユーザー影響なし、リロードで解決)。
      'Failed to fetch dynamically imported module',
      'Importing a module script failed',
    ],
    denyUrls: [
      // Chrome / Edge 拡張。
      /^chrome-extension:\/\//i,
      /^chrome:\/\//i,
      /extensions?\//i,
      // Safari 拡張。
      /safari-web-extension:\/\//i,
      // Firefox 拡張。
      /moz-extension:\/\//i,
    ],
  });
}
