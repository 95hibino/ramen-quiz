import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import App from './App';
import { injectAdsenseScript } from './lib/adsense';
import { initSentry } from './lib/sentry';
import './styles/index.css';

// Sentry は最上部で初期化する (未捕捉例外を最初から拾えるように)。
// VITE_SENTRY_DSN 未設定なら no-op なのでローカルでは何も起きない。
initSentry();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root not found');
}

// AdSense 連携時のみ adsbygoogle.js を head に注入する (未設定なら no-op)。
// AdBanner マウント時の pushAdsByGoogle() より前にスクリプト要素を入れておく。
injectAdsenseScript();

// createRoot であって hydrateRoot ではない点に注意。
//
// scripts/prerender.ts により、公開ページの #root にはビルド時の HTML が
// 既に入っている。しかし hydrateRoot は使わない:
// 認証状態を localStorage から読む UI があるため、サーバ側 (localStorage 無し) と
// クライアント側で描画結果が食い違い、hydration mismatch を起こす。
// createRoot は既存の子要素を破棄して描画し直すので、この不一致が問題にならない。
// プリレンダされた内容は「クローラ向け」と「JS 到達までの初期表示」が役割で、
// 描画後は通常の SPA として動く。
ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <HelmetProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </HelmetProvider>
  </React.StrictMode>,
);
