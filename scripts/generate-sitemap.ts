/**
 * sitemap.xml ジェネレータ。
 *
 * ビルド後 (`vite build` の後) に `dist/sitemap.xml` を生成する。
 *
 * 使い方:
 *   npx tsx scripts/generate-sitemap.ts
 *
 * 環境変数:
 *   - VITE_SITE_URL (任意): 本番ドメインを上書きしたい場合に指定。
 *                            未設定時は `https://ramen-quiz-ten.vercel.app` をフォールバック。
 *   - SITEMAP_OUTPUT_DIR (任意): 出力先ディレクトリ。未設定時は `dist`。
 *
 * 含めるパス (公開しても良い静的ページのみ):
 *   - `/`, `/quiz/knowledge`, `/quiz/knowledge/basic`, `/quiz/knowledge/regional`,
 *     `/quiz/knowledge/expert`, `/quiz/photo`, `/ranking`, `/about`, `/faq`,
 *     `/privacy`, `/terms`, `/contact`, `/glossary`, `/regions`, `/regions/:prefectureSlug`
 *
 * 除外するパス (ユーザー固有 or 状態依存で意味のあるコンテンツを持たない):
 *   - `/mypage`, `/result`, `/login`, `/signup`, `/quiz/photo/play`, `/quiz/photo/submit`
 *
 * `<lastmod>` は本スクリプト実行時刻 (ビルド時刻と同等)、`<priority>` はトップ系を高めに設定。
 *
 * 都道府県別詳細ページ (`/regions/:prefectureSlug`) は `src/data/regionalRamen.ts` から
 * slug を動的に読み込むことで、データ追加時にスクリプト側の修正なしでカバレッジが広がる。
 *
 * パス定義そのものは `scripts/publicRoutes.ts` に集約し、プリレンダリングと共有する。
 */
import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildPublicRoutes, type PublicRoute } from './publicRoutes';

/** 既定ドメイン: Vercel 本番 URL。`VITE_SITE_URL` で上書き可能。 */
const DEFAULT_SITE_URL = 'https://ramen-quiz-ten.vercel.app';

/**
 * sitemap に載せる URL 一覧。
 *
 * 定義の実体は `scripts/publicRoutes.ts` にあり、プリレンダリング
 * (`scripts/prerender.tsx`) と同じソースを共有する。片方だけ更新して
 * 「sitemap には載るがプリレンダされていない」状態になるのを防ぐため。
 */
function buildEntries(): ReadonlyArray<PublicRoute> {
  return buildPublicRoutes();
}

/**
 * 末尾スラッシュを取り除いた origin を返す。
 * 例: `https://example.com/` → `https://example.com`
 */
function normalizeOrigin(url: string): string {
  return url.replace(/\/+$/, '');
}

/**
 * 環境変数からサイト URL を解決する。
 * `VITE_SITE_URL` が空 or 未設定なら `DEFAULT_SITE_URL` を返す。
 */
function resolveSiteUrl(): string {
  const env = process.env.VITE_SITE_URL;
  if (env && env.trim().length > 0) {
    return normalizeOrigin(env.trim());
  }
  return DEFAULT_SITE_URL;
}

/** XML テキスト中に出現すると壊れる 5 文字をエスケープする (URL に & が入る場合の保険)。 */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * `PublicRoute[]` から sitemap.xml の本文文字列を組み立てる。
 *
 * - `<lastmod>` は ISO 8601 日付 (YYYY-MM-DD) で揃える。
 * - URL は `baseUrl + path` を XML エスケープして埋め込む。
 */
function buildSitemapXml(baseUrl: string, entries: ReadonlyArray<PublicRoute>): string {
  const lastmod = new Date().toISOString().slice(0, 10);
  const urlBlocks = entries
    .map((entry) => {
      const loc = escapeXml(`${baseUrl}${entry.path}`);
      return [
        '  <url>',
        `    <loc>${loc}</loc>`,
        `    <lastmod>${lastmod}</lastmod>`,
        `    <changefreq>${entry.changefreq}</changefreq>`,
        `    <priority>${entry.priority.toFixed(1)}</priority>`,
        '  </url>',
      ].join('\n');
    })
    .join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    urlBlocks,
    '</urlset>',
    '',
  ].join('\n');
}

/**
 * メイン処理: sitemap.xml を生成して `dist/sitemap.xml` に書き出す。
 * 出力先ディレクトリが無い場合は再帰的に作成する (vite build を後で行うケースに対応)。
 */
function main(): void {
  const baseUrl = resolveSiteUrl();
  const outDir = resolve(process.cwd(), process.env.SITEMAP_OUTPUT_DIR ?? 'dist');
  const outPath = resolve(outDir, 'sitemap.xml');

  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
  }

  const entries = buildEntries();
  const xml = buildSitemapXml(baseUrl, entries);
  writeFileSync(outPath, xml, 'utf8');

  console.log(`[generate-sitemap] base=${baseUrl}`);
  console.log(`[generate-sitemap] urls=${entries.length}`);
  console.log(`[generate-sitemap] output=${outPath}`);
}

main();
