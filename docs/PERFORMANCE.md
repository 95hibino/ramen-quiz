# パフォーマンス最適化ガイド

ラーメンクイズ Web アプリ (SPA / Vite + React 18) のパフォーマンス最適化まとめ。

## 実施済みの最適化

### 1. Route-based code splitting (React.lazy + Suspense)

`src/App.tsx` にて全ページを `React.lazy` で分割。ルート遷移時に必要なページの chunk のみをフェッチする構成。

- Suspense のフォールバックには `src/components/common/LoadingFallback.tsx` を使用
- CLS (Cumulative Layout Shift) を防ぐため `min-h-[60vh]` を確保
- 既存ページの export 形式 (named export) を維持したまま `.then((m) => ({ default: m.Xxx }))` で default export に橋渡し

### 2. Vendor 分割 (Vite `manualChunks`)

`vite.config.ts` に以下の chunk を定義。

| Chunk 名 | 内容 | 目的 |
|----------|------|------|
| `react-vendor` | react, react-dom, react-router-dom | ほぼ全ページで必要。長期キャッシュ |
| `supabase` | @supabase/supabase-js | 認証・ランキング系のみ。初回ロード軽量化 |
| `helmet` | react-helmet-async | SEO meta 管理。更新頻度低 |
| `zustand` | zustand | グローバルストア |

### 3. console.log の除去 (`esbuild.pure`)

本番ビルドで `console.log` / `console.debug` / `console.info` を pure 関数扱いにして dead code elimination で除去。`console.error` / `console.warn` は残す (エラー追跡に必要)。

### 4. chunk サイズ警告閾値の調整

`build.chunkSizeWarningLimit: 600` で警告閾値を 600kB に。分割後に個別 chunk が大きくなるケースへの緩衝材。実 chunk が小さければ実質未使用。

## 期待される効果 (before / after)

| 指標 | Before | After (想定) |
|------|--------|-------------|
| `index-XXXX.js` | 500KB 超 (全依存 + 全ページ) | ~50-100KB (App shell + router のみ) |
| `react-vendor-XXXX.js` | - | ~130-150KB (react-dom が支配的) |
| `supabase-XXXX.js` | - | ~100-130KB |
| 各ページ chunk | - | ~5-30KB / ページ |
| 初回ロード合計 | 500KB+ | ~250-300KB (Home 到達まで) |
| Lighthouse Performance | 未計測 | 目標 90+ |

初回訪問時は「App shell + react-vendor + Home chunk」しかロードされないため、初回 TTI (Time to Interactive) が大きく改善する見込み。

## Lighthouse スコア目標

Vercel の本番 URL に対して Lighthouse (Mobile, Slow 4G) で計測:

| カテゴリ | 目標 |
|----------|------|
| Performance | **90+** |
| Accessibility | **90+** |
| Best Practices | **90+** |
| SEO | **90+** |

計測方法:
1. Chrome DevTools → Lighthouse タブ
2. Mode: Navigation, Device: Mobile, Categories 全選択
3. 「Analyze page load」

## Vercel Analytics 連携 (推奨)

無料枠 (Hobby プラン) で Web Vitals の実測が可能。

### セットアップ

1. Vercel Dashboard → プロジェクト → Analytics タブから有効化
2. `npm i @vercel/analytics`
3. `src/main.tsx` (もしくは `App.tsx`) に:
   ```tsx
   import { Analytics } from '@vercel/analytics/react';
   // <App /> の隣に <Analytics />
   ```
4. Speed Insights も並行導入可能 (`@vercel/speed-insights`)

これで実ユーザーの LCP / INP / CLS を計測でき、Lighthouse (合成) と実測 (RUM) の両輪で改善サイクルを回せる。

## 将来の改善候補

優先度の高い順:

### A. 画像最適化 (photo_quiz 系で効果大)
- 写真クイズの JPEG を WebP or AVIF に変換 (30-50% サイズ削減)
- `<img loading="lazy">` の徹底
- Vercel の Image Optimization (`/_vercel/image?url=...&w=...&q=...`) を薄いラッパー経由で利用

### B. 大きなデータの遅延ロード
- `questions.json` / `regionalRamen.ts` / `glossary.ts` などの静的データが肥大化したら、ページ内で dynamic `import()` して chunk を分離
- 現状は各ページ chunk に同梱されるため、ページ chunk が大きくなり始めたら対応

### C. フォント最適化
- 現状はシステムフォント (`Noto Sans JP` を font-family 指定するが CDN 読込は無し) のため対応不要
- 独自 Web フォント導入時は `<link rel="preload" as="font" crossorigin>` を index.html に追加

### D. Preload / Prefetch の粒度調整
- Home のリンクホバー時に `KnowledgeQuiz` chunk を先読みする手法 (`import('./pages/KnowledgeQuiz')` の即時実行)
- Route-based ではなく Feature-based に細分化 (Play 系のロジックだけ更に分割)

### E. React 18 の Concurrent Features
- `useTransition` / `useDeferredValue` を大きなリスト描画で使う (Regions / Glossary 一覧)
- 現状の規模では過剰最適化なので、体感遅延が出たら着手

## 動作確認コマンド

```bash
# TypeScript 型チェック
npm run lint

# 本番ビルド (sitemap 生成含む)
npm run build

# ビルド後のプレビュー (chunk 分割の確認)
npm run preview

# dist/assets/ の中身を確認
ls -lh dist/assets/
```

ビルド出力で以下を確認:
- `react-vendor-XXXX.js`, `supabase-XXXX.js`, `helmet-XXXX.js` が個別 chunk として存在
- 各ページ (`Home-XXXX.js`, `KnowledgeQuiz-XXXX.js` など) が個別 chunk として存在
- `index-XXXX.js` が 300KB 以下
- 500KB 超警告が出ていない (or `chunkSizeWarningLimit` の範囲内)
