# ラーメンクイズ Web アプリ (Phase 1 MVP)

ラーメンの知識を学べる 4 択クイズ Web アプリ。設計書
`shacho/engineering/ramen_quiz_app_design.md` の Phase 1 (MVP) 実装。

## ドキュメント索引

| 用途                        | 参照ドキュメント               |
| --------------------------- | ------------------------------ |
| 本番デプロイ (Vercel)       | [`docs/DEPLOY.md`](docs/DEPLOY.md) |
| Supabase 設定 (DB / Storage)| [`docs/SUPABASE_SETUP.md`](docs/SUPABASE_SETUP.md) |
| AdSense 設定 (広告ユニット) | [`docs/ADSENSE_SETUP.md`](docs/ADSENSE_SETUP.md) |
| 環境変数の一覧              | [`.env.example`](.env.example) |

## 技術スタック

- React 18 + TypeScript
- Vite 5
- Tailwind CSS 3
- Zustand 4 (状態管理)
- React Router v6 (ルーティング)

## ローカル開発

```bash
cd shacho/engineering/output/ramen_quiz
npm install
npm run dev      # http://localhost:5173
```

### 本番ビルド

```bash
npm run build    # 型チェック + dist/ 出力
npm run preview  # dist/ の確認
```

## ディレクトリ構成 (主要)

```
src/
├── components/
│   ├── common/   (Header, Footer, AdBanner, Timer)
│   └── quiz/     (QuizCard, PhotoQuizCard, OptionButton, ResultScreen, ScoreBar)
├── pages/        (Home, KnowledgeQuiz, KnowledgeQuizPlay, PhotoQuiz, PhotoQuizPlay, Result, About, NotFound)
├── stores/       (Zustand quizStore, photoQuizStore, authStore, scoreStore)
├── hooks/        (useTimer)
├── lib/          (questionRepository, mockQuestionRepository, photoQuestionRepository, mockPhotoQuestionRepository, supabase, score)
├── data/         (questions.json, photoQuestions.json — モック問題データ)
├── config/       (quizConfig — セッション設定値)
├── types/        (quiz, photoQuestion, account — ドメイン型)
└── styles/       (index.css — Tailwind ベース)

public/
└── photo_quiz/
    └── placeholder.svg   # 写真当てクイズの仮素材 (全問共通参照)
```

## Phase 1 スコープ調整事項

社長判断により、初回はローカルで完結する最小構成としている:

| 領域 | Phase 1 実装 | Phase 2 以降 |
|---|---|---|
| 問題データ | `src/data/questions.json` (15問) | Supabase `quiz_questions` テーブル |
| データ取得 | `mockQuestionRepository` | `supabaseQuestionRepository` (`src/lib/supabase.ts` に雛形) |
| 画像 | なし | Cloudinary |
| 広告 | プレースホルダ `<div>` (`AdBanner` コンポーネント、CLS 対策の固定枠) | Google AdSense ユニット差し替え |
| ホスティング | `npm run dev` ローカル | Vercel |

### 問題数の制約

- 設計書では 1 セッション 10 問固定だが、Phase 1 ではカテゴリあたり 5 問のサンプルのみ収録。
- `mockQuestionRepository` は要求数より少なければ持っている分だけ返すため、Phase 1 では実質「1 セッション最大 5 問」で動作する。
- Phase 2 で問題データを各カテゴリ 50 問以上に拡充することで設計通りの 10 問運用に戻る。

## 広告枠の配置 (design §3.3 準拠)

| 場所 | サイズ | スロット名 |
|---|---|---|
| ヘッダー下 (Home / KnowledgeQuiz) | 728 × 90 | `home-top` / `knowledge-top` |
| 問題プレイ中 (5問ごと) | レスポンシブ | `in-feed` |
| 結果画面 | 300 × 250 | `result` |
| フッター | 320 × 50 | `footer` |

すべて `<AdBanner>` で固定サイズの `<div>` を確保し CLS を抑止。AdSense スクリプトの埋め込みは行っていない。

## スコアロジック (design §3.1 準拠)

- 正解 1 問 = 10 点
- 残り時間ボーナス: `round(残り秒 / 制限秒 × 5)`
- 制限時間: 1 問 20 秒 (超過で 0 点 + 自動的に時間切れ扱い)

## 写真当てクイズ (機能②)

### 概要

- 開始画面 `/quiz/photo` で 5 軸 (ラーメンの種類 / 都道府県 / 写真の種類 / 難易度 / 麺の太さ) を絞り込み
- プレイ画面 `/quiz/photo/play` で 1 セッション 10 問・各 30 秒で出題
- 同軸内は OR、異なる軸間は AND で評価
- 何も選択しなければ全問題からランダム出題
- 絞り込み条件にマッチする問題数を「○問利用可能」とリアルタイム表示

### 仮素材で動作中

現在は実画像未提供のため、すべての問題が `public/photo_quiz/placeholder.svg` を共通参照しています。
モックデータ `src/data/photoQuestions.json` の `shopInfo` には「（仮データ）」と明記しています。

### 実画像素材投入時の差し替え手順

1. **画像ファイルを配置**: `public/photo_quiz/` 配下に画像を置く
   - 推奨形式: `.jpg` (写真) または `.webp`、推奨サイズ 800×600px 前後
   - ファイル名は分かりやすく (例: `tokyo-jiro-mita-storefront.jpg`)
2. **モックデータを更新**: `src/data/photoQuestions.json` の各エントリで:
   - `imageUrl` を `/photo_quiz/<ファイル名>` に書き換え
   - `shopInfo.name` / `area` / `description` の「（仮データ）」表記を実際の店舗情報に置換
   - 必要なら `thumbnailUrl` も追加
3. **新規問題を追加する場合**: 既存エントリと同じスキーマ (`src/types/photoQuestion.ts` の `PhotoQuestion`) で JSON 配列末尾に追記
4. **動作確認**: `npm run dev` → `/quiz/photo` で対象条件を選択 → 「○問利用可能」が増えていることと、プレイ画面で実画像が表示されることを確認

新しい軸 (タグ等) を増やしたい場合は、型 (`src/types/photoQuestion.ts`) と
フィルタ判定 (`src/lib/photoQuestionRepository.ts` の `matchesFilter`)、
開始画面 (`src/pages/PhotoQuiz.tsx`) の 3 箇所を同時に編集する。

## ユーザー写真投稿機能 (Phase 2)

ログイン中のユーザーは `/quiz/photo/submit` から写真クイズを投稿できます。投稿先は Supabase (Storage + Postgres) で、画像はクライアントサイドで WebP 化・長辺 800px リサイズ・EXIF 削除されてからアップロードされます。

**有効化するには `docs/SUPABASE_SETUP.md` を参照してください**。環境変数が未設定でもアプリは起動し、投稿フォームは表示できますが送信ボタンは無効化されます。

## 本番デプロイ

Vercel への切り出しデプロイ手順は **[`docs/DEPLOY.md`](docs/DEPLOY.md)** にまとめてあります。

- 公開禁止の本リポジトリから別の公開リポジトリに切り出して Vercel と連携
- 環境変数の雛形は `.env.example` に集約済み
- `vercel.json` が SPA リライト・セキュリティヘッダ・キャッシュ戦略を定義
- AdSense は `VITE_ADSENSE_CLIENT_ID` 未設定なら完全 no-op で従来の動作を維持

## 残課題 / Phase 2 以降

- Supabase クライアント実装と RLS 設計
- 問題データ 50 問/カテゴリへの拡充と CMS フロー
- 写真当てクイズの実画像素材投入 (社長撮影分の差し替え)
- AdSense アカウント取得・審査通過・広告ユニット ID 取得 → `.env.local` / Vercel に設定 (社長作業)
- `public/ads.txt` のパブリッシャー ID プレースホルダ置換 (社長作業)
- 切り出しリポジトリ作成 + Vercel プロジェクト作成 (社長作業)
- ユニットテスト (Vitest 等)
