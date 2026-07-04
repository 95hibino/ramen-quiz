# 動的 OG 画像 (SNS シェアカード) ガイド

`api/og.tsx` が Vercel Edge Runtime 上で動作する Serverless Function として、
SNS シェア時のカード画像 (og:image) を動的に生成する。

- ライブラリ: [@vercel/og](https://vercel.com/docs/functions/og-image-generation) (内部で Satori / React JSX → SVG → PNG)
- 出力: 1200 x 630 PNG
- ランタイム: Vercel Edge (`export const config = { runtime: 'edge' }`)

## URL 仕様

```
GET /api/og?score=<number>&max=<number>&category=<string>&username=<string>&type=<knowledge|photo>
```

### クエリパラメータ

| パラメータ | 必須 | 型      | 既定値              | 説明                                                             |
| ---------- | ---- | ------- | ------------------- | ---------------------------------------------------------------- |
| `score`    | 任意 | integer | `0`                 | 獲得スコア。 `0..999` に clamp、整数化                            |
| `max`      | 任意 | integer | `100`               | 最大スコア。 `1..999` に clamp                                    |
| `category` | 任意 | string  | `ラーメンクイズ`    | カテゴリラベル (例: `初級` `中級` `上級` `写真当てクイズ`)。20 文字で打ち切り |
| `username` | 任意 | string  | (非表示)            | プレイヤー名。空文字なら描画しない。20 文字で打ち切り            |
| `type`     | 任意 | string  | `knowledge`         | クイズ種別。 `photo` の場合フッターを「写真当てクイズ」にする    |

### 使用例

- 基本: `https://ramen-quiz-ten.vercel.app/api/og?score=87&max=100&category=中級`
- ユーザー名付き: `https://ramen-quiz-ten.vercel.app/api/og?score=87&max=100&category=中級&username=大森商事`
- 写真クイズ: `https://ramen-quiz-ten.vercel.app/api/og?score=50&max=100&category=写真当てクイズ&type=photo`

日本語文字は URL エンコード必須。 `URLSearchParams` を通す `buildOgImageUrl()`
(`src/lib/shareUrls.ts`) を経由することで自動的にエンコードされる。

## Result 画面での組み込み

`src/pages/Result.tsx` は `buildOgImageUrl` で URL を生成し、
`<Seo ogImage={...} />` に渡している。 `Seo` は `og:image` / `twitter:image`
メタタグを差し込むため、SNS のクローラーはこの URL を取得してカード画像として使う。

結果画面自体は `noIndex` (検索エンジンにはインデックスさせない) だが、
SNS のクローラーは `robots` メタタグを尊重しないため OG 画像は取得される。

## ローカル動作確認

Vite の開発サーバー (`npm run dev`) は Vercel Serverless Function を提供しない。
`vercel dev` を使うことで、ローカルで `/api/og` エンドポイントを動作させられる。

```bash
# 初回のみ (グローバルインストール)
npm install -g vercel

# プロジェクトディレクトリで:
vercel link      # プロジェクトを Vercel に紐付け (初回のみ)
vercel dev       # http://localhost:3000 で SPA + api/ が起動する

# ブラウザで確認
# http://localhost:3000/api/og?score=87&max=100&category=中級&username=大森商事
```

`vercel dev` 起動中はホットリロードが効き、 `api/og.tsx` を編集すると
次回リクエストから反映される。

## 本番デプロイ後の確認

Vercel に push すると `api/og.tsx` は自動的にデプロイされる。

```
https://ramen-quiz-ten.vercel.app/api/og?score=50&max=100&category=初級
```

にアクセスして PNG が表示されればデプロイ成功。

X (Twitter) のシェアカード確認は [Card Validator](https://cards-dev.twitter.com/validator)、
Facebook は [Sharing Debugger](https://developers.facebook.com/tools/debug/) を使う。

## カスタマイズ

### 色・レイアウト

`api/og.tsx` の JSX (`<div style={{ ... }}>`) を編集する。
背景グラデーションは `og-default.svg` と揃えて orange → red 系にしている。

```tsx
background: 'linear-gradient(135deg, #f97316 0%, #dc2626 100%)',
```

ブランドカラーを変える場合は `tailwind.config.js` の `ramen-*` カラーと合わせる。

### 文字サイズ

Satori の制約により `font-size` は数値 (単位なし = px) を推奨。
1200 x 630 の画像上でメインスコアは 96px、カテゴリは 44px にしている。

### 表示項目の追加

`api/og.tsx` の `handler` 関数で `searchParams` を新しく取り出し、
JSX に `<div>` を追加する。 URL 生成側は `src/lib/shareUrls.ts` の
`OgImageParams` インターフェース + `buildOgImageUrl` を更新する。

## 日本語フォントの追加 (将来的な改善)

現在は Vercel Edge Runtime のデフォルトフォント `sans-serif` を使っている。
Satori はデフォルトで日本語グリフも一定描画するが、細かいカーニングや
特殊な漢字で崩れるケースがある。より品質を上げたい場合は
Noto Sans JP などのサブセット TTF を読み込む。

### 手順の概要

1. Noto Sans JP のサブセット TTF/OTF (例: 500KB 以下) を準備し
   `public/fonts/NotoSansJP-Bold.ttf` に配置。
2. `api/og.tsx` で fetch して `ImageResponse` の `fonts` オプションに渡す。

```tsx
export default async function handler(request: Request) {
  const font = await fetch(new URL('/fonts/NotoSansJP-Bold.ttf', request.url))
    .then((r) => r.arrayBuffer());

  return new ImageResponse(
    (<div style={{ fontFamily: 'Noto Sans JP', ... }}>...</div>),
    {
      width: 1200,
      height: 630,
      fonts: [
        { name: 'Noto Sans JP', data: font, weight: 700, style: 'normal' },
      ],
    },
  );
}
```

**注意**: Edge Function のバンドルサイズ上限は 1MB (無料プラン) / 4MB (Pro)。
フル版 Noto Sans JP は 5MB 超になるため、必ずサブセット化する。
[fonttools](https://fonttools.readthedocs.io/) やオンラインサブセッタで
「常用漢字 + ひらがな + カタカナ + ASCII」に絞ると 200-400KB 程度に収まる。

## トラブルシューティング

### `/api/og` にアクセスすると `index.html` が返ってくる

`vercel.json` の `rewrites` の `source` パターンから `api/` が除外されていない。
現在の設定は次のとおり (api/ が negative lookahead に含まれている必要がある):

```json
"source": "/((?!ads\\.txt|robots\\.txt|sitemap\\.xml|llms\\.txt|og-default\\.svg|assets/|photo_quiz/|api/).*)"
```

### `npm run build` (Vite) が api/og.tsx を型エラーにする

`tsconfig.app.json` は `include: ["src"]` のため通常は問題ないが、
IDE が `api/` を Vite プロジェクトの一部として認識するとエラーになる。
`api/tsconfig.json` を配置してあるので、通常はそちらが優先される。

### 日本語が文字化けする

Vercel Edge Runtime のデフォルトフォントで想定外の文字化けが出た場合は、
上記「日本語フォントの追加」手順で Noto Sans JP サブセットを組み込む。

### PNG が生成されず 500 エラー

Vercel のダッシュボード → Functions → Logs でスタックトレースを確認。
よくある原因:

- `@vercel/og` が `dependencies` に入っていない (`devDependencies` は不可)
- `export const config = { runtime: 'edge' }` の記述漏れ
- JSX 内で Satori が対応しない CSS プロパティ (例: `box-shadow` 一部) を使用
