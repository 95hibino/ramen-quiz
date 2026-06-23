# アフィリエイト導線 セットアップガイド

ラーメンクイズに「もしもアフィリエイト」「A8.net」「楽天アフィリエイト」「Amazon アソシエイト」の
アフィリエイトリンクを差し込む手順をまとめます。

**コード側の実装は完了済み**です。本ドキュメントは社長が各サービスに登録し、案件 URL を取得して
環境変数に流し込むだけで配信を有効化できるようにすることが目的です。

---

## 全体の流れ

```
A. 各アフィリエイトサービスに登録（社長作業）
B. 案件を選定し、案件 URL を取得
C. 取得した URL を `.env.local` に設定（ローカル動作確認用）
D. Vercel Dashboard にも同じ環境変数を設定（本番反映）
E. デプロイ → 該当箇所にカードが表示されることを確認
F. 必要に応じて `src/config/affiliate.ts` で案件を追加・差し替え
```

---

## A. 各アフィリエイトサービスへの登録

| サービス             | 申込窓口                                   | 特徴                                                              |
| -------------------- | ------------------------------------------ | ----------------------------------------------------------------- |
| もしもアフィリエイト | <https://af.moshimo.com/>                  | Amazon・楽天・Yahoo のリンクを一元管理可能。W報酬制度あり          |
| A8.net               | <https://www.a8.net/>                      | 国内最大手。食べログ予約・各種ECに広い案件                        |
| 楽天アフィリエイト   | <https://affiliate.rakuten.co.jp/>         | 楽天市場の全商品。楽天会員ならすぐ開始可能                        |
| Amazon アソシエイト  | <https://affiliate.amazon.co.jp/>          | Amazon.co.jp の全商品。180 日以内に 3 件の成果が必要（審査あり）  |

> **登録の優先順位 (推奨)**: もしも（登録済） → 楽天 → A8 → Amazon
> 楽天は審査が緩く即時開始可能。Amazon は 3 件成果が必要なため、サイトに訪問者が一定数集まってから申請するのが安全。

---

## B. 案件 URL の取得方法

### B-1. 楽天アフィリエイト

1. <https://affiliate.rakuten.co.jp/> にログイン
2. 「商品リンク」→ キーワード検索（例: 「お取り寄せ ラーメン」「ご当地ラーメン セット」）
3. 検索結果 or 商品ページから「リンクを作成」を押下
4. 表示された **HTML タグ内の `href` 属性の URL**（`https://hb.afl.rakuten.co.jp/...` 形式）をコピー
5. または「ジャンルランキング」→ ラーメン関連カテゴリの URL を使用すると流動的に売れ筋を表示できる

→ `.env.local` の `VITE_AFF_RAKUTEN_RAMEN_RANKING` に貼り付け

### B-2. A8.net（食べログ予約など）

1. <https://www.a8.net/> にログイン
2. 「プログラム検索」で `食べログ` を検索 → 提携申請 → 承認後にリンク発行可能
3. 「広告リンク」→「テキスト広告」のソース内 `<a href="...">` の URL をコピー
4. `https://px.a8.net/svt/ejp?a8mat=...` 形式

→ `.env.local` の `VITE_AFF_A8_TABELOG` に貼り付け

> A8 はバナー型・テキスト型・メール型などリンクの種類が複数あります。本サービスでは**テキストリンク**を選択してください
> （`AffiliateBanner` は独自のカードデザインで表示するため、バナー画像は使いません）。

### B-3. もしもアフィリエイト

1. <https://af.moshimo.com/> にログイン
2. プログラム検索（例: 「ラーメン本」「書籍 食」）→ 提携申請 → 承認後にリンク発行
3. 「広告リンク取得」→「シンプルリンク」の URL をコピー
4. `https://af.moshimo.com/af/c/click?a_id=...` 形式

→ `.env.local` の `VITE_AFF_MOSHIMO_RAMEN` に貼り付け

### B-4. Amazon アソシエイト

1. <https://affiliate.amazon.co.jp/> にログイン
2. ヘッダーの SiteStripe（または商品ページの URL 短縮ツール）から **テキストリンク**を取得
3. `https://amzn.to/...` または `https://www.amazon.co.jp/dp/.../?tag=（アソシエイトID）-22` 形式

→ `.env.local` の `VITE_AFF_AMAZON_RAMEN_BOOKS` に貼り付け

> **重要**: Amazon アソシエイトには「Amazon.co.jp を宣伝しリンクすることによって…」の固定文言を
> サイト内に表記する義務があります。本サービスでは `src/content/privacyPolicy.tsx` の
> 「5. Cookie・広告」セクションに記載済みなので追加対応は不要です。

---

## C. `.env.local` への設定

プロジェクトルート `.env.local`（Git 管理外）に以下を追記します。

```bash
# アフィリエイトリンク
VITE_AFF_RAKUTEN_RAMEN_RANKING=https://hb.afl.rakuten.co.jp/hgc/xxxxxxxx
VITE_AFF_A8_TABELOG=https://px.a8.net/svt/ejp?a8mat=xxxxxxxx
VITE_AFF_MOSHIMO_RAMEN=https://af.moshimo.com/af/c/click?a_id=xxxxxxxx
VITE_AFF_AMAZON_RAMEN_BOOKS=https://amzn.to/xxxxxxxx
```

設定後 `npm run dev` で起動し、以下の画面で該当カードが表示されるかを確認します。

| 環境変数                              | 表示される画面 / 配置                       |
| ------------------------------------- | ------------------------------------------- |
| `VITE_AFF_RAKUTEN_RAMEN_RANKING`      | ホーム下部 / 結果画面の下部                 |
| `VITE_AFF_A8_TABELOG`                 | 写真当てクイズの正解後、店舗情報の直下      |
| `VITE_AFF_MOSHIMO_RAMEN`              | フッター                                    |
| `VITE_AFF_AMAZON_RAMEN_BOOKS`         | 結果画面の下部                              |

**動作分岐:**

- いずれの環境変数も未設定 → 全アフィリエイト枠が非表示（既存挙動を破壊しない）
- 一部のみ設定 → 設定済みの案件だけが表示される（未設定の案件は同じスロット内でもスキップ）
- 全部設定 → 全スロットでカードが表示される

---

## D. Vercel Dashboard への環境変数設定

ローカル `.env.local` は Git に含めないため、本番反映には Vercel 側にも設定が必要です。

1. Vercel Dashboard → 該当プロジェクト → **Settings → Environment Variables**
2. 上記 C の全項目をひとつずつ追加
3. スコープは Production / Preview / Development の **3 つすべて** にチェック
4. 保存後、Deployments タブから最新コミットを **Redeploy**（環境変数は再デプロイで反映）

---

## E. 表示・非表示の動作確認

| 確認内容                              | 期待動作                                                                                |
| ------------------------------------- | --------------------------------------------------------------------------------------- |
| 環境変数が空 (`.env.local` ファイル無し可) | すべてのアフィリエイトカードが非表示。`AdBanner` は従来どおり動作                     |
| ダミー URL（例: `https://example.com`）を全部設定 | ホーム下部・結果画面下部・写真クイズ正解後・フッターでカードが表示される          |
| カード上の「PR」バッジ + プロバイダ名 | 必ず表示される（ステマ規制対応）                                                       |
| リンククリック                        | 新規タブで開く（`target="_blank"` + `rel="noopener noreferrer sponsored"`）            |
| プライバシーポリシー (`/privacy`)     | 「4. 第三者提供・委託」と「5. Cookie・広告」にアフィリエイトプロバイダの記載がある     |

DOM インスペクタで確認する場合は、`<aside data-affiliate-slot="...">` 要素を探してください。

---

## F. 案件の追加・差し替え

### 案件のテキスト・サブテキストを変える

`src/config/affiliate.ts` の `AFFILIATE_ITEMS[<slot>]` 配列内の該当案件オブジェクトの
`text` / `subText` を編集します。

### 同一スロットに案件を追加する

例: 結果画面下部に「Amazon の麺料理レシピ本」を追加したい場合

1. `.env.example` に新しい環境変数を追加（例: `VITE_AFF_AMAZON_NOODLE_RECIPE=`）
2. `src/vite-env.d.ts` の `ImportMetaEnv` に同名のプロパティを追加
3. `src/config/affiliate.ts` の `AFFILIATE_ITEMS['result-bottom']` 配列に案件を追記:
   ```ts
   {
     provider: 'amazon',
     text: '麺料理レシピ本',
     url: import.meta.env.VITE_AFF_AMAZON_NOODLE_RECIPE ?? '',
   }
   ```
4. `.env.local` と Vercel Dashboard に URL を設定

### 新しいスロット（配置場所）を追加する

1. `src/config/affiliate.ts` の `AffiliateSlot` ユニオン型に新しい識別子を追加
2. `AFFILIATE_ITEMS` に同じキーで案件配列を定義
3. 表示したいコンポーネントで `<AffiliateBanner slot="新しいスロット名" />` を配置

---

## ステマ規制対応の方針

景品表示法のステルスマーケティング規制（2023 年 10 月 1 日施行）に基づき、
本サービスのアフィリエイトリンクには以下の対応を徹底しています。

1. **各カードに「PR」バッジを常時表示**（赤いアクセントで明示）
2. **広告主名（楽天アフィリエイト / A8.net / もしもアフィリエイト / Amazonアソシエイト）を併記**
3. **複数案件のグループ上部に「広告・提携リンクを含みます」と明記**
4. **`<a>` タグに `rel="noopener noreferrer sponsored"` を付与**（Google が広告リンクに推奨）
5. **プライバシーポリシーの第三者提供セクションに各プロバイダを明記**

> 新しいアフィリエイト案件を追加する際も、`AffiliateBanner` 経由で表示する限り
> 上記 1〜4 は自動的に適用されます。コンポーネントを介さず直接 `<a>` を書く場合は
> 必ず手動で「PR」表記と `rel="sponsored"` を追加してください。

---

## 関連ファイル

- `src/config/affiliate.ts` — 案件定義（編集はここ）
- `src/components/common/AffiliateBanner.tsx` — 広告枠コンポーネント
- `src/pages/Home.tsx` — ホーム下部に配置
- `src/pages/Result.tsx` / `src/components/quiz/ResultScreen.tsx` — 結果画面下部に配置
- `src/components/quiz/PhotoQuizCard.tsx` — 写真クイズ正解後の店舗情報下に配置
- `src/components/common/Footer.tsx` — フッター内に配置
- `src/content/privacyPolicy.tsx` — プライバシーポリシーへの記載
- `src/vite-env.d.ts` — 環境変数の型定義
- `.env.example` — 環境変数の雛形

---

## トラブルシューティング

| 症状                              | 確認事項                                                                  |
| --------------------------------- | ------------------------------------------------------------------------- |
| カードが全く表示されない          | `.env.local` の `VITE_AFF_*` が空文字でないか / 開発サーバを再起動したか |
| 一部の枠だけ表示されない          | 該当スロットの全案件 URL が未設定。`AFFILIATE_ITEMS` を確認              |
| 本番だけ表示されない              | Vercel Dashboard に環境変数が登録済みか / Redeploy したか                |
| クリックしても遷移しない          | 案件 URL が正しい形式かを `.env.local` で再確認                          |
| `[PR]` バッジが表示されない       | `AffiliateBanner` 経由で表示しているか（独自 `<a>` を書いていないか）  |
