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

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <HelmetProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </HelmetProvider>
  </React.StrictMode>,
);
