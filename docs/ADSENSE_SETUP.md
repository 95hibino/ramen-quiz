# Google AdSense 設定ガイド

ラーメンクイズに Google AdSense を導入する手順をまとめます。
**コード側の実装基盤はすでに入っています**。本ドキュメントは AdSense アカウント取得後、
ID を環境変数に流し込むだけで広告配信を有効化できるようにすることが目的です。

---

## 全体の流れ

```
A. AdSense アカウント開設
B. サイト登録 → 審査
C. (審査通過後) 広告ユニットを 5 種類作成
D. 取得した ID を .env.local に設定
E. public/ads.txt のプレースホルダ ID を実 ID に置換
F. Vercel Dashboard にも同じ環境変数を設定
G. デプロイ → /ads.txt と広告表示を確認
```

---

## A. AdSense アカウント開設

1. <https://www.google.com/adsense/> へアクセスし、Google アカウントでログイン
2. 「ご利用開始」→ サイト URL（本番デプロイ先）と支払国を入力
3. 支払い情報（住所・銀行口座）を登録

---

## B. サイト登録 → 審査

1. AdSense 管理画面の「サイト」→「サイトを追加」で本番ドメイン (例: `ramen-quiz.example.com`) を登録
2. 表示される「AdSense コードをサイトに追加」は本実装では自動化済み
   （`VITE_ADSENSE_CLIENT_ID` を設定すれば `src/lib/adsense.ts` が `<script>` を `<head>` に注入する）
3. `index.html` への手動追記は不要
4. 「審査をリクエスト」→ 数日〜数週間で結果通知メールが届く

> 審査中も `VITE_ADSENSE_CLIENT_ID` を本番に設定して構いません（プレースホルダのままだと審査に通らないため、本ステップで設定するのが標準）。

---

## C. 広告ユニットを 5 種類作成

審査通過後、AdSense 管理画面の「広告 > 広告ユニットごと」から下表の 5 ユニットを作成し、それぞれのスロット ID（数字列）を控えます。

| 環境変数キー                          | 配置場所                          | 推奨ユニットタイプ | 推奨サイズ          |
| ------------------------------------- | --------------------------------- | ------------------ | ------------------- |
| `VITE_ADSENSE_SLOT_HOME_TOP`          | ホーム上部                        | ディスプレイ広告   | 728×90 / 自動       |
| `VITE_ADSENSE_SLOT_KNOWLEDGE_TOP`     | 知識クイズカテゴリ画面上部        | ディスプレイ広告   | 728×90 / 自動       |
| `VITE_ADSENSE_SLOT_RESULT`            | 結果画面                          | ディスプレイ広告   | 300×250 (固定推奨)  |
| `VITE_ADSENSE_SLOT_FOOTER`            | フッター                          | ディスプレイ広告   | 320×50              |
| `VITE_ADSENSE_SLOT_IN_FEED`           | クイズプレイ中 5 問ごと           | インフィード広告   | レスポンシブ        |

**ポイント:**

- 本実装の `<ins data-ad-format="auto" data-full-width-responsive="true">` で自動最適化が効くため、AdSense 側のサイズは「自動 (Responsive)」でも OK
- CLS 抑止のため外側 `<div>` で固定サイズを与えているので、AdSense 側もできる限り表記サイズに近いユニットを作成すると見た目の不一致が起きにくい
- インフィード枠のみ「インフィード広告」テンプレートを推奨（記事中に馴染むスタイル）

---

## D. 取得した ID を `.env.local` に設定

プロジェクトルート `.env.local` (Git 管理外) に以下を追記します。

```bash
# Google AdSense
VITE_ADSENSE_CLIENT_ID=ca-pub-1234567890123456
VITE_ADSENSE_SLOT_HOME_TOP=1111111111
VITE_ADSENSE_SLOT_KNOWLEDGE_TOP=2222222222
VITE_ADSENSE_SLOT_RESULT=3333333333
VITE_ADSENSE_SLOT_FOOTER=4444444444
VITE_ADSENSE_SLOT_IN_FEED=5555555555
```

設定後、`npm run dev` で起動し、ブラウザの開発者ツール「Network」タブで `adsbygoogle.js` が読み込まれていれば連携成功です。
（テスト ID では実広告は表示されません。実 ID + 本番ドメインでのみ表示されます。）

**動作分岐:**

- `VITE_ADSENSE_CLIENT_ID` 自体が未設定 → スクリプト注入なし。全枠プレースホルダ表示
- `VITE_ADSENSE_CLIENT_ID` のみ設定 + 一部 slot 未設定 → スクリプトは注入、未設定 slot だけプレースホルダ
- 全部設定 → 全枠 `<ins class="adsbygoogle">` でレンダリング

---

## E. `public/ads.txt` のパブリッシャー ID 置換

`public/ads.txt` に以下が書かれています。

```
google.com, ca-pub-XXXXXXXXXXXXXXXX, DIRECT, f08c47fec0942fa0
```

`XXXXXXXXXXXXXXXX` の部分を、上記 D で取得した **`ca-pub-` を除いた数字列**（16 桁）に置き換えます。

例: パブリッシャー ID が `ca-pub-1234567890123456` なら

```
google.com, ca-pub-1234567890123456, DIRECT, f08c47fec0942fa0
```

`ads.txt` は Vite の `public/` 配下に置かれているので、ビルド後は `dist/ads.txt` として自動コピーされ、本番ドメインの `/ads.txt` で配信されます。

---

## F. Vercel Dashboard への環境変数設定

ローカル `.env.local` は Git に含めないため、Vercel 側にも同じ値を設定する必要があります。

1. Vercel Dashboard → 該当プロジェクト → **Settings → Environment Variables**
2. 上記 D の全項目をひとつずつ追加
3. スコープは Production / Preview / Development の **3 つすべて** にチェック
4. 保存後、Deployments タブから最新コミットを **Redeploy**（環境変数は再デプロイで反映）

---

## G. デプロイ後の確認

1. `https://<本番ドメイン>/ads.txt` にアクセスし、置換後の内容が表示されることを確認
2. ホーム / 結果画面 / フッターで `<ins class="adsbygoogle">` が描画されていることを DOM インスペクタで確認
3. 数時間〜数日後、AdSense 管理画面の「サイト」が「準備完了」になり、収益化レポートに数値が流れ始める

---

## トラブルシューティング

| 症状                                    | 確認事項                                                                                       |
| --------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 広告枠がプレースホルダのまま            | `.env.local` (本番は Vercel) の `VITE_ADSENSE_CLIENT_ID` が `ca-pub-` 付きで設定されているか     |
| 一部の枠だけプレースホルダ              | 該当 `VITE_ADSENSE_SLOT_*` が未設定。Vercel 側にも設定済みか確認                                |
| `ads.txt` が 404                        | `public/ads.txt` がコミットされているか / Vercel デプロイが最新か                               |
| AdSense 管理画面で「ads.txt エラー」表示 | `XXXXXXXXXXXXXXXX` のままになっていないか / パブリッシャー ID の数字列が正しいか              |
| 実広告が出ない                          | テスト ID では出ない仕様。実 ID + 本番ドメインで数時間待つ。コンソールに `AdSense head tag doesn't support data-ad-client` などの警告がないか |
| `adsbygoogle - asynchronous load` 警告  | 開発時のホットリロードで起きうる無害な警告。本番では発生しない                                 |

---

## 関連ファイル

- `src/lib/adsense.ts` — スクリプト注入・push ヘルパー
- `src/components/common/AdBanner.tsx` — 広告枠コンポーネント (環境変数連携の分岐)
- `src/main.tsx` — 起動時の `injectAdsenseScript()` 呼び出し
- `src/vite-env.d.ts` — 環境変数の型定義
- `public/ads.txt` — Authorized Digital Sellers ファイル
- `.env.example` — 環境変数の雛形
