# 静的プリレンダリング

公開ページの HTML をビルド時に生成し、JavaScript を実行しないクローラにも
本文を見せるための仕組み。

## なぜ入れたか

本アプリは Vite の SPA なので、クローラが取得する HTML はこれだけだった。

```html
<body class="bg-ramen-noodle">
  <div id="root"></div>
</body>
```

本文テキスト 1 バイト。AdSense はページ内容を読んで配信判断をするため、
内容が読めないページには広告を返さない。実際に全広告枠が
`data-ad-status="unfilled"` のままで、寸法修正（`AdBanner.tsx`）後も解消しなかった。

導入後はトップで約 1,600 文字、用語集で約 17,000 文字がクローラに見える。
AdSense だけでなく SEO と OGP にも効く。

## 構成

| ファイル | 役割 |
| --- | --- |
| `src/entry-server.tsx` | SSR エントリ。`render(url)` で 1 ルートを HTML 化 |
| `scripts/prerender.ts` | 全公開ルートを描画して `dist/` に書き出す |
| `scripts/publicRoutes.ts` | 公開ルート定義。sitemap 生成と共有。`prerender: false` で対象外にできる |
| `index.html` | `<!--seo-defaults-->` マーカーで head 差し替え位置を指定 |

## ビルドの流れ

```
tsc -b
  → vite build                                   (クライアント: dist/)
  → vite build --ssr src/entry-server.tsx        (サーバ:     dist-ssr/)
  → tsx scripts/prerender.ts                     (HTML 生成)
  → tsx scripts/generate-sitemap.ts              (sitemap.xml)
```

## 出力

```
dist/index.html               ← `/` のプリレンダ結果
dist/about/index.html         ← `/about`
dist/regions/hokkaido/…       ← `/regions/:prefectureSlug`
dist/spa-shell.html           ← 本文が空の SPA フォールバック
```

`spa-shell.html` はプリレンダ対象外ルート（`/mypage` `/login` `/result` など
ユーザー固有ページ）用。`vercel.json` の rewrites 先をこれにしてある。
`dist/index.html`（トップの内容入り）を落とし先にすると、`/mypage` に直接
アクセスしたときトップの内容が一瞬映ってから差し替わるため。

Vercel はリクエストに対して **先に実ファイルを探し、無いときだけ rewrites を適用する**。
そのため `/about` は `dist/about/index.html` が返り、`/mypage` だけが
`spa-shell.html` に落ちる。

## 設計上の判断

### なぜ renderToString ではないのか

`App.tsx` は全ページを `React.lazy` で分割している。`renderToString` は Suspense の
解決を待てず、どのルートでも `<LoadingFallback />` しか出力されない。
`renderToPipeableStream` の `onAllReady` は全 Suspense 境界の解決後に発火するため、
実際のページ本文が得られる。

### なぜ hydrateRoot ではなく createRoot のままなのか

認証状態を localStorage から読む UI があり、サーバ側（localStorage 無し）と
クライアント側で描画結果が食い違って hydration mismatch を起こす。
`createRoot` は既存の子要素を破棄して描画し直すのでこの不一致が問題にならない。
プリレンダ済み HTML の役割は「クローラ向け」と「JS 到達までの初期表示」であり、
描画後は通常の SPA として動く。

### ssr.noExternal に react-helmet-async を入れている理由

このパッケージは CJS のみを配布しており、Node の ESM 相互運用では名前付き export を
静的に検出できず `does not provide an export named 'HelmetProvider'` で落ちる。
external にせず SSR バンドルへ取り込むことで回避している。

### manualChunks を SSR ビルドで無効化している理由

SSR ビルドでは react などが external になり、
`"react" cannot be included in manualChunks` でビルドが失敗する。
`vite.config.ts` の `isSsrBuild` で分岐している。

## プリレンダしないページ

`scripts/publicRoutes.ts` で `prerender: false` を指定したルートは対象外になり、
`spa-shell.html` にフォールバックする。現在の対象外は 3 件。

| ルート | 理由 |
| --- | --- |
| `/quiz/knowledge/basic` | 出題データを実行時に読むため、サーバ側では `問題を読み込み中...` しか出ない |
| `/quiz/knowledge/regional` | 同上 |
| `/quiz/knowledge/expert` | 同上 |

これらは早期 return で `<Seo />` を描画しない分岐に入るため、プリレンダすると
`<title></title>` の空タグになり、既定の meta ごと失われて素の SPA より悪化する。

そのため `scripts/prerender.ts` は **`<title>` が空なら失敗させる**。
新しいページで同じことが起きたら、まず「そのページは本当にビルド時に
描画できるのか」を確認し、できないなら `prerender: false` を付けること。

なお sitemap にはこれら 3 件も載る（`prerender` フラグは sitemap 生成には影響しない）。
ただし 3 件とも `noIndex` 指定なので、sitemap に載せていること自体が
以前からの矛盾ではある。整理する場合は `publicRoutes.ts` 側で判断すること。

## ルートを追加したとき

`scripts/publicRoutes.ts` に足すだけでよい。sitemap とプリレンダの両方が
同じ定義を読むため、片方だけ更新して食い違うことがない。

`/regions/:prefectureSlug` は `src/data/regionalRamen.ts` から slug を読むので、
データを足せば自動的に対象が広がる。

## 環境変数

`VITE_SITE_URL` が必要。プリレンダは Node 上で動くため `window.location.origin`
が使えず、この値が無いと `canonical` / `og:url` / `og:image` が
`/glossary` のような相対パスのまま出力される。canonical は相対でも一応解決されるが、
**og:url は絶対 URL でないと OGP が成立しない**（SNS クローラが解決できない）。

そのためリポジトリに `.env.production` を置き、Vite が本番ビルド時に
自動で読むようにしてある。Vercel Dashboard の設定に依存せずビルドが自己完結する。

```
VITE_SITE_URL=https://ramen-quiz-ten.vercel.app
```

Vercel Dashboard に同名の変数があればそちらが優先される。
**カスタムドメインに移行したら `.env.production` の値を差し替えること。**

`.env.production` は機密を置く場所ではない。ビルド成果物の JS に埋め込まれ、
Git にも入る。機密は Vercel Dashboard 側で管理する。

`scripts/prerender.ts` は、canonical が絶対 URL になっていないページ数を数えて
ビルドログに警告を出す。

## 失敗時の挙動

プリレンダが失敗すると `npm run build` は非ゼロ終了し、Vercel のデプロイも失敗する。
黙ってプリレンダだけ止まっていることに気付けない状態を避けるため意図的にそうしている。

各ルートについて、描画後の本文テキストが 100 文字未満なら失敗として扱う。
lazy の解決漏れや ErrorBoundary へのフォールバックを検知するため。

## 確認方法

```bash
# クローラから見える本文量（1 に近ければプリレンダが効いていない）
curl -s -A "Mediapartners-Google" https://ramen-quiz-ten.vercel.app/ \
  | sed -n '/<body/,/<\/body>/p' | sed 's/<[^>]*>//g' | tr -s ' \n' ' ' | wc -c

# ルートごとに固有の title が返るか
curl -s https://ramen-quiz-ten.vercel.app/glossary | grep -ao '<title[^>]*>[^<]*'
```

> `<title>` は react-helmet が `data-rh="true"` を付けるため、
> `grep '<title>'` では一致しない。`'<title[^>]*>'` で検索すること。
