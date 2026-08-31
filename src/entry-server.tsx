/**
 * プリレンダリング用の SSR エントリ。
 *
 * ブラウザ用の `main.tsx` と対になるサーバ側の入口で、`scripts/prerender.tsx`
 * からのみ呼ばれる（本番のクライアントバンドルには含まれない）。
 *
 * ## なぜ必要か
 *
 * 本アプリは Vite の SPA なので、クローラが取得する HTML は
 * `<div id="root"></div>` だけで本文が空だった。AdSense はページ内容を読んで
 * 配信判断をするため、内容が読めないページには広告を返さない
 * (`data-ad-status="unfilled"`)。ビルド時に各ルートの HTML を生成しておくことで、
 * JavaScript を実行しないクローラにも本文を見せる。
 *
 * ## renderToString ではなく renderToPipeableStream を使う理由
 *
 * `App.tsx` は全ページを `React.lazy` で分割している。`renderToString` は
 * Suspense の解決を待てないため、どのルートを描画しても
 * `<LoadingFallback />` だけが出力されてしまう。
 * `renderToPipeableStream` の `onAllReady` は全 Suspense 境界が解決してから
 * 発火するので、実際のページ本文が得られる。
 */
import { Writable } from 'node:stream';
import { renderToPipeableStream } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import { HelmetProvider, type HelmetServerState } from 'react-helmet-async';
import App from './App';

/** 1 ルート分のレンダリング結果。 */
export interface RenderResult {
  /** `<div id="root">` に流し込む HTML 本文。 */
  html: string;
  /** react-helmet-async が収集した head 要素（title / meta / link 等）。 */
  helmet: HelmetServerState | undefined;
  /**
   * 描画中に発生したエラー。
   *
   * Suspense 境界や ErrorBoundary で回復した場合も記録されるため、
   * ここが空でなくても HTML 自体は使えることがある。呼び出し側で報告する。
   */
  errors: Error[];
}

/** 1 ルートあたりのレンダリング上限。無限待ちでビルドが固まるのを防ぐ。 */
const RENDER_TIMEOUT_MS = 20_000;

/**
 * 指定 URL のページを HTML 文字列に描画する。
 *
 * @param url ルート相対パス（例: `/regions/hokkaido`）
 */
export function render(url: string): Promise<RenderResult> {
  return new Promise<RenderResult>((resolve, reject) => {
    const helmetContext: { helmet?: HelmetServerState } = {};
    const errors: Error[] = [];
    const chunks: Buffer[] = [];
    let timer: NodeJS.Timeout | undefined;

    const sink = new Writable({
      write(chunk, _encoding, callback) {
        chunks.push(Buffer.from(chunk));
        callback();
      },
    });

    sink.on('finish', () => {
      if (timer) clearTimeout(timer);
      resolve({
        html: Buffer.concat(chunks).toString('utf8'),
        helmet: helmetContext.helmet,
        errors,
      });
    });

    const { pipe, abort } = renderToPipeableStream(
      <HelmetProvider context={helmetContext}>
        <StaticRouter location={url}>
          <App />
        </StaticRouter>
      </HelmetProvider>,
      {
        // 全 Suspense 境界（= 全 lazy ページ）の解決を待ってから書き出す。
        onAllReady() {
          pipe(sink);
        },
        // 回復可能なエラーもここに来る。握り潰さず呼び出し側へ渡す。
        onError(error) {
          errors.push(error instanceof Error ? error : new Error(String(error)));
        },
        // シェル自体が描画できなかった場合は復旧不能なので reject する。
        onShellError(error) {
          if (timer) clearTimeout(timer);
          abort();
          reject(error instanceof Error ? error : new Error(String(error)));
        },
      },
    );

    timer = setTimeout(() => {
      abort();
      reject(new Error(`[prerender] render timeout (${RENDER_TIMEOUT_MS}ms): ${url}`));
    }, RENDER_TIMEOUT_MS);
  });
}
