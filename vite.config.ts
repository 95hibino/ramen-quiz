import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // ================================================================
    // PWA プラグイン設定 (Phase 3: オフライン対応 + ホーム画面追加)
    // ================================================================
    // - registerType: 'autoUpdate' → Service Worker が背景で更新をチェックし、
    //   新バージョンが見つかったら次回リロード時に自動反映される
    // - manifest: Web App Manifest を build 時に自動生成
    // - workbox: Service Worker のキャッシュ戦略。SPA なので index.html は
    //   NetworkFirst、静的アセットは StaleWhileRevalidate を使う
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['og-default.svg', 'pwa-icon.svg', 'pwa-icon-maskable.svg', 'robots.txt'],
      manifest: {
        name: 'ラーメンクイズ',
        short_name: 'ラーメンクイズ',
        description:
          'ラーメンの歴史・地域・文化・製麺まで、奥深いラーメン知識を 4 択クイズで楽しく学ぼう。',
        theme_color: '#d2452f',
        background_color: '#fef6e4',
        display: 'standalone',
        orientation: 'portrait-primary',
        scope: '/',
        start_url: '/',
        lang: 'ja',
        categories: ['games', 'education', 'food'],
        icons: [
          {
            src: '/pwa-icon.svg',
            sizes: '192x192 512x512 any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: '/pwa-icon-maskable.svg',
            sizes: '512x512 any',
            type: 'image/svg+xml',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // SPA の全ルートを index.html にフォールバック (React Router 用)
        navigateFallback: '/index.html',
        // Supabase / Vercel API / OG 生成はキャッシュ対象外 (常にネットワーク)
        navigateFallbackDenylist: [
          /^\/api\//,
          /^\/sitemap\.xml$/,
          /^\/robots\.txt$/,
          /^\/llms\.txt$/,
          /^\/ads\.txt$/,
        ],
        // プレキャッシュ対象: JS / CSS / SVG / フォントなどの静的アセット
        globPatterns: ['**/*.{js,css,html,svg,png,jpg,jpeg,webp,woff2,ico}'],
        // 大きすぎるアセット (5MB 超) はプレキャッシュしない (Supabase 由来の写真等)
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        runtimeCaching: [
          // Google Fonts (stylesheet)
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*$/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-fonts-stylesheets',
            },
          },
          // Google Fonts (font files)
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 年
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          // Supabase Storage の写真クイズ画像
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/v1\/object\/public\/.*$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'supabase-storage-images',
              expiration: {
                maxEntries: 60,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 日
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          // Supabase API (認証 / DB) はキャッシュしない (リアルタイム性)
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/(auth|rest)\/.*$/,
            handler: 'NetworkOnly',
          },
        ],
      },
      // 開発時 (npm run dev) では SW を無効化。ビルド時のみ生成する。
      devOptions: {
        enabled: false,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
  esbuild: {
    // 本番ビルドでは console.log / debugger を除去 (エラーログ console.error は残す)
    // ビルドタイム時のみ適用され、開発サーバー (npm run dev) では影響しない
    drop: ['debugger'],
    pure: ['console.log', 'console.debug', 'console.info'],
  },
  build: {
    // Route-based code splitting + vendor 分割で 500KB 警告を回避
    // chunk サイズ超過警告の閾値 (単位 kB)。分割後もライブラリ単体で超える場合の余裕
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          // React 本体 + Router: ほぼ全ページで必要。長期キャッシュしやすいよう分離
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          // Supabase は認証・ランキング系ページのみで使用。個別 chunk 化で初回ロードを軽く
          supabase: ['@supabase/supabase-js'],
          // SEO 用 meta 管理。全ページで使うが更新頻度は低い
          helmet: ['react-helmet-async'],
          // グローバルストア (小さいが独立させることで頻繁な更新の影響を局所化)
          zustand: ['zustand'],
        },
      },
    },
  },
});
