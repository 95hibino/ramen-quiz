# SEO 運用ガイド (社長向け)

ラーメンクイズ Web アプリの SEO 対策と運用手順をまとめたドキュメントです。

最終更新: 2026-06-24 / 担当: エンジニアリングエージェント

---

## 1. 実装済み SEO 対策の概要

### 1.1 基本 SEO (従来の Google 検索向け)

| 項目 | 実装場所 | 内容 |
|------|---------|------|
| canonical URL | `src/components/common/Seo.tsx` | 各ページに正規 URL を出力 |
| robots メタタグ | `src/components/common/Seo.tsx` | 公開ページ `index, follow` / ユーザー固有ページ `noindex, nofollow` |
| description メタタグ | 各 `pages/*.tsx` | ページごとに SEO 最適化した固有 description |
| keywords メタタグ | 各 `pages/*.tsx` | 主要公開ページのみキーワード設定 (効果は薄いが AI クローラーが参照する場合あり) |
| OGP / Twitter Card | `src/components/common/Seo.tsx` | SNS シェア時の表示最適化 |
| sitemap.xml | `scripts/generate-sitemap.ts` | ビルド時に自動生成 (`dist/sitemap.xml`) |
| robots.txt | `public/robots.txt` | sitemap 場所の宣言 + AI クローラー明示許可 |

### 1.2 AI SEO (生成 AI 検索エンジン向け)

| 項目 | 実装場所 | 内容 |
|------|---------|------|
| llms.txt | `public/llms.txt` | LLM 向けサイト案内 ([llmstxt.org 仕様](https://llmstxt.org/)) |
| AI クローラー許可 | `public/robots.txt` | GPTBot / Google-Extended / Claude-Web / PerplexityBot / CCBot / anthropic-ai / Applebot-Extended |
| Schema.org JSON-LD | `src/components/common/StructuredData.tsx` | 構造化データを各ページに出力 |

### 1.3 ページ別 Schema.org 適用状況

| ページ | スキーマ |
|--------|---------|
| `/` (Home) | WebSite + Organization |
| `/quiz/knowledge` | Quiz + ItemList (3 カテゴリ) |
| `/quiz/photo` | (Phase 2 で QAPage 追加検討) |
| `/result` | BreadcrumbList |
| `/about` | AboutPage |
| `/privacy`, `/terms`, `/contact` | 未設定 (シンプルな WebPage は省略) |

### 1.4 sitemap.xml 生成スクリプトの動作

`scripts/generate-sitemap.ts` は `package.json` の `build` スクリプトで自動実行されます。

```text
npm run build
   ↓
1. tsc -b                  (型チェック)
2. vite build              (dist/ に静的ファイル出力)
3. tsx scripts/generate-sitemap.ts
   → dist/sitemap.xml を生成
```

**含めるパス**: `/`, `/quiz/knowledge`, `/quiz/knowledge/basic`, `/quiz/knowledge/regional`, `/quiz/knowledge/expert`, `/quiz/photo`, `/ranking`, `/about`, `/privacy`, `/terms`, `/contact`

**除外するパス**: `/mypage`, `/result`, `/login`, `/signup`, `/quiz/photo/play`, `/quiz/photo/submit` (ユーザー固有 or 状態依存)

**ベース URL**: `VITE_SITE_URL` 環境変数優先、未設定時は `https://ramen-quiz-ten.vercel.app`

---

## 2. 検索エンジンへの登録手順

### 2.1 Google Search Console

1. <https://search.google.com/search-console> にアクセス (Google アカウント `omorishoji2025@gmail.com` でログイン推奨)
2. 「プロパティを追加」→「URL プレフィックス」を選択
3. `https://ramen-quiz-ten.vercel.app` を入力
4. 所有権確認 (HTML タグ方式が手軽):
   - 表示されたメタタグを `index.html` の `<head>` 内にコピペ
   - デプロイ後「確認」ボタンをクリック
   - **既に Vercel ホスティングのドメイン所有者として認識される場合あり** (その場合はワンクリック)
5. 「サイトマップ」メニュー → `sitemap.xml` を入力して送信
6. 「URL 検査」で `https://ramen-quiz-ten.vercel.app/` を入力 → 「インデックス登録をリクエスト」

### 2.2 Bing Webmaster Tools

1. <https://www.bing.com/webmasters> にアクセス
2. 「サイトを追加」→ `https://ramen-quiz-ten.vercel.app` を入力
3. **Google Search Console と連携する方法が最も楽** (所有権確認・サイトマップを自動インポート)
4. 「サイトマップ」→ `https://ramen-quiz-ten.vercel.app/sitemap.xml` を送信

### 2.3 (任意) IndexNow による即時通知

Bing / Yandex / Naver は IndexNow プロトコルで URL 更新を即時通知できます。Vercel 公式 Integration があるので必要に応じて導入検討。

---

## 3. 構造化データの検証

公開後、以下の URL で構造化データが正しく認識されるか確認してください。

### 3.1 Google Rich Results Test

<https://search.google.com/test/rich-results>

確認すべきページ:
- `https://ramen-quiz-ten.vercel.app/` → WebSite + Organization
- `https://ramen-quiz-ten.vercel.app/quiz/knowledge` → Quiz + ItemList
- `https://ramen-quiz-ten.vercel.app/about` → AboutPage

### 3.2 Schema.org Validator

<https://validator.schema.org/>

汎用的な Schema.org の妥当性を確認できます。

---

## 4. llms.txt の更新タイミング

`public/llms.txt` は LLM (ChatGPT / Claude / Perplexity 等) がサイト構造を把握するためのファイルです。以下のタイミングで更新してください。

- **新しいページを追加したとき** (主要ページ一覧に追記)
- **問題数が大幅に増えたとき** (現在「150 問」と記載)
- **運営者情報・連絡先が変わったとき**
- **データ取得ポリシー (Supabase Storage、EXIF 削除等) が変わったとき**

更新後はビルド・デプロイで `dist/llms.txt` として配信されます。

---

## 5. 今後の SEO 強化候補 (第二弾以降)

### 5.1 短期 (1〜2 週間)

- [ ] FAQ ページの新設 + FAQPage スキーマ (「ラーメンの〇〇とは？」を 5〜10 件)
- [ ] 各クイズカテゴリページに `Quiz` スキーマを個別適用 (basic / regional / expert)
- [ ] 写真当てクイズに `QAPage` スキーマ
- [ ] Open Graph 画像を SVG → PNG/JPG に変更 (Twitter Card 表示の確実性向上)

### 5.2 中期 (1〜2 か月)

- [ ] コンテンツマーケティング: 「〇〇ラーメンとは？」解説記事を `/blog/` 配下に追加
- [ ] パンくずリストの UI 実装 + BreadcrumbList スキーマを全ページに展開
- [ ] hreflang 対応 (英語版を作るなら)
- [ ] Core Web Vitals 改善 (LCP / CLS / INP) を Lighthouse でモニタリング

### 5.3 長期 (3 か月以上)

- [ ] 個別の問題ページ (`/quiz/knowledge/q/:id`) を SEO 用に静的生成 (各問題に固有 URL を持たせる)
- [ ] 検索 (sitelinks searchbox) 機能の実装 + WebSite スキーマに `potentialAction` 追加
- [ ] AMP 対応 (今後の必要性は要検討)

---

## 6. メンテナンス時の注意

### 6.1 新しいページを追加する場合

1. `src/pages/NewPage.tsx` を作成
2. `<Seo>` を必ず付ける (title / description / url / 公開ページなら keywords)
3. ユーザー固有ページなら `noIndex` を `true` に
4. `scripts/generate-sitemap.ts` の `ENTRIES` に追加 (公開ページのみ)
5. 必要に応じて `<StructuredData>` で Schema.org を出力
6. `public/llms.txt` の主要ページ一覧にも追記

### 6.2 ドメインを変更する場合

1. `VITE_SITE_URL` を Vercel の環境変数で設定 (例: `https://example.com`)
2. `public/robots.txt` の `Sitemap:` 行を新ドメインに書き換え
3. `public/llms.txt` 内の URL を一括置換
4. `scripts/generate-sitemap.ts` の `DEFAULT_SITE_URL` も書き換え (環境変数を必ず設定するならフォールバックなので任意)
5. Google Search Console で新ドメインのプロパティを作成し、旧ドメインから「アドレス変更」を申請

---

## 7. 参考リンク

- [llms.txt 仕様](https://llmstxt.org/)
- [Google 検索セントラル: 構造化データ](https://developers.google.com/search/docs/appearance/structured-data)
- [Schema.org Quiz 型](https://schema.org/Quiz)
- [sitemaps.org プロトコル](https://www.sitemaps.org/protocol.html)
- [OpenAI GPTBot ドキュメント](https://platform.openai.com/docs/gptbot)
- [Google-Extended ドキュメント](https://blog.google/technology/ai/an-update-on-web-publisher-controls/)
