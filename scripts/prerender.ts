/**
 * 静的プリレンダラ。
 *
 * `vite build`（クライアント）と `vite build --ssr`（サーバ）の後に実行し、
 * 公開ページ 1 件ごとに HTML を生成して `dist/` に書き出す。
 *
 * ## 目的
 *
 * 本アプリは SPA のため、クローラが取得する HTML は `<div id="root"></div>`
 * だけで本文が空だった。AdSense はページ内容を読んで配信判断をするため、
 * 内容が読めないページには広告を返さない (`data-ad-status="unfilled"`)。
 * ビルド時に本文入りの HTML を出しておくことで、JavaScript を実行しない
 * クローラにもコンテンツを見せる。SEO と OGP にも同時に効く。
 *
 * ## 出力
 *
 * ```
 * dist/index.html            ← `/` のプリレンダ結果（元のシェルは spa-shell.html へ退避）
 * dist/about/index.html      ← `/about`
 * dist/regions/hokkaido/...  ← `/regions/:prefectureSlug`
 * dist/spa-shell.html        ← 本文が空のままの SPA フォールバック
 * ```
 *
 * `spa-shell.html` は、プリレンダ対象外のルート（`/mypage` `/login` など
 * ユーザー固有ページ）向けのフォールバック。`vercel.json` の rewrites 先を
 * これにすることで、`/mypage` に直接アクセスしたときトップページの内容が
 * 一瞬映ってから差し替わる、という不自然な挙動を避ける。
 *
 * ## 実行
 *
 * ```
 * npx tsx scripts/prerender.ts
 * ```
 *
 * 失敗しても `vite build` の成果物（素の SPA）はそのまま残るため、
 * 最悪プリレンダ無しで配信できる。ただしビルドは失敗させる（黙って
 * プリレンダが止まっていることに気付けなくなるのを避けるため）。
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildPublicRoutes } from './publicRoutes';

/** クライアントビルドの出力先。 */
const DIST_DIR = resolve(process.cwd(), 'dist');
/** SSR ビルドの出力先。 */
const SSR_DIR = resolve(process.cwd(), 'dist-ssr');
/** プリレンダ対象外ルート向けの、本文が空のフォールバック HTML。 */
const SPA_SHELL_NAME = 'spa-shell.html';

/** `index.html` 内の、react-helmet 出力で差し替えるブロックの開始/終了マーカー。 */
const HEAD_MARKER_START = '<!--seo-defaults-->';
const HEAD_MARKER_END = '<!--/seo-defaults-->';

/** React がマウントするコンテナ。ここに本文を流し込む。 */
const ROOT_PLACEHOLDER = '<div id="root"></div>';

/**
 * `dist-ssr/entry-server.js` から受け取る値の形。
 *
 * 実体は `src/entry-server.tsx` の `RenderResult` だが、そちらは DOM/JSX を
 * 前提とする app 側の tsconfig 配下にある。本スクリプトは Node 側の tsconfig で
 * 型検査するため、直接 import せず消費する形だけをここに書き写している。
 * `entry-server.tsx` 側を変更したらこの型も合わせること。
 */
interface RenderResult {
  /** `<div id="root">` に流し込む HTML 本文。 */
  html: string;
  /** react-helmet-async が収集した head 要素。未描画時は undefined。 */
  helmet:
    | {
        title: { toString(): string };
        meta: { toString(): string };
        link: { toString(): string };
      }
    | undefined;
  /** 描画中に発生したエラー（ErrorBoundary で回復したものを含む）。 */
  errors: Error[];
}

/** `entry-server.js` が公開する render 関数の型。 */
type RenderFn = (url: string) => Promise<RenderResult>;

/**
 * ルート相対パスから出力先ファイルパスを決める。
 *
 * - `/`            → `dist/index.html`
 * - `/about`       → `dist/about/index.html`
 * - `/regions/xxx` → `dist/regions/xxx/index.html`
 */
function outputPathFor(routePath: string): string {
  if (routePath === '/') return resolve(DIST_DIR, 'index.html');
  const relative = routePath.replace(/^\/+/, '').replace(/\/+$/, '');
  return resolve(DIST_DIR, relative, 'index.html');
}

/**
 * react-helmet-async が収集した head 要素を HTML 文字列に落とす。
 *
 * `Seo.tsx` が出力するのは title / meta / link(canonical) の 3 種類のみ。
 * それ以外（script 等）は使っていないので変換対象に含めない。
 */
function renderHelmetToHtml(helmet: RenderResult['helmet']): string {
  if (!helmet) return '';
  return [helmet.title.toString(), helmet.meta.toString(), helmet.link.toString()]
    .filter((part) => part.length > 0)
    .join('\n    ');
}

/**
 * テンプレートの head と本文を、レンダリング結果で置き換える。
 *
 * head 側はマーカー間をまるごと差し替える。マーカーが見つからない場合は
 * デフォルトの meta が残ったまま helmet の出力が加わり `<title>` が
 * 重複するため、黙って続行せずエラーにする。
 */
function injectIntoTemplate(template: string, result: RenderResult): string {
  const startIndex = template.indexOf(HEAD_MARKER_START);
  const endIndex = template.indexOf(HEAD_MARKER_END);
  if (startIndex === -1 || endIndex === -1) {
    throw new Error(
      `[prerender] index.html に ${HEAD_MARKER_START} / ${HEAD_MARKER_END} が見つかりません。`,
    );
  }

  const headHtml = renderHelmetToHtml(result.helmet);
  const withHead =
    template.slice(0, startIndex) + headHtml + template.slice(endIndex + HEAD_MARKER_END.length);

  if (!withHead.includes(ROOT_PLACEHOLDER)) {
    throw new Error(`[prerender] index.html に ${ROOT_PLACEHOLDER} が見つかりません。`);
  }
  return withHead.replace(ROOT_PLACEHOLDER, `<div id="root">${result.html}</div>`);
}

/** メイン処理。全公開ルートを順に描画して書き出す。 */
async function main(): Promise<void> {
  const templatePath = resolve(DIST_DIR, 'index.html');
  const template = readFileSync(templatePath, 'utf8');

  // プリレンダ対象外ルート用に、素のシェルを先に退避しておく。
  writeFileSync(resolve(DIST_DIR, SPA_SHELL_NAME), template, 'utf8');

  const entryUrl = pathToFileURL(resolve(SSR_DIR, 'entry-server.js')).href;
  const { render } = (await import(entryUrl)) as { render: RenderFn };

  // `prerender: false` のルート (クイズのプレイ画面など) は spa-shell.html に任せる。
  const routes = buildPublicRoutes().filter((route) => route.prerender !== false);
  let renderedCount = 0;
  let missingCanonicalCount = 0;
  const failures: Array<{ path: string; error: unknown }> = [];

  for (const route of routes) {
    try {
      const result = await render(route.path);

      // 描画自体は成功しても中身が空なら、プリレンダする意味がないので失敗扱いにする。
      // (lazy の解決漏れや ErrorBoundary へのフォールバックを検知する)
      const textLength = result.html.replace(/<[^>]*>/g, '').trim().length;
      if (textLength < 100) {
        throw new Error(`本文が短すぎます (テキスト ${textLength} 文字)`);
      }

      // title が空のまま公開すると既定の meta ごと失われ、素の SPA より悪化する。
      // ページが早期 return で <Seo /> を描画しない分岐に入ったときに起きるため、
      // 黙って通さず失敗させる (publicRoutes.ts で prerender: false にするのが対処)。
      const titleHtml = result.helmet?.title.toString() ?? '';
      if (/<title[^>]*>\s*<\/title>/.test(titleHtml) || titleHtml.length === 0) {
        throw new Error('<title> が空です。<Seo /> を描画しない分岐に入っている可能性があります');
      }

      // canonical は VITE_SITE_URL が無いと空になる (Node 側には window が無いため)。
      // 静かに欠けるとページ全体が正規 URL 無しで公開されるので、件数を数えて後で警告する。
      if (!(result.helmet?.link.toString() ?? '').includes('canonical')) {
        missingCanonicalCount += 1;
      }

      const html = injectIntoTemplate(template, result);
      const outPath = outputPathFor(route.path);
      mkdirSync(dirname(outPath), { recursive: true });
      writeFileSync(outPath, html, 'utf8');
      renderedCount += 1;

      if (result.errors.length > 0) {
        console.warn(
          `[prerender] ${route.path}: 描画中に ${result.errors.length} 件のエラー ` +
            `(ErrorBoundary で回復): ${result.errors[0]?.message ?? ''}`,
        );
      }
    } catch (err) {
      failures.push({ path: route.path, error: err });
      console.error(`[prerender] FAILED ${route.path}:`, err instanceof Error ? err.message : err);
    }
  }

  console.log(`[prerender] rendered=${renderedCount}/${routes.length} (対象外は spa-shell.html)`);
  console.log(`[prerender] fallback=${SPA_SHELL_NAME}`);

  if (missingCanonicalCount > 0) {
    console.warn(
      `[prerender] WARNING: ${missingCanonicalCount} 件のページに canonical / og:url がありません。`,
    );
    console.warn('[prerender]          環境変数 VITE_SITE_URL が未設定です。');
    console.warn(
      '[prerender]          Vercel の Environment Variables に本番 URL を登録してください ' +
        '(docs/PRERENDER.md 参照)。',
    );
  }

  if (failures.length > 0) {
    console.error(`[prerender] ${failures.length} 件のルートが失敗しました。`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('[prerender] 致命的エラー:', err);
  process.exitCode = 1;
});
