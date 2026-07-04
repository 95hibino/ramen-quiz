import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
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
