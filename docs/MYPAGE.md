# マイページ機能仕様

`/mypage` はログイン中のユーザーが自分の戦績・お気に入り・投稿履歴を確認するためのプライベートページです。
Seo は `noIndex` で検索エンジンから除外しています。

## 画面構成

```
◆ ユーザー情報カード
◆ スコア推移グラフ (最近 30 プレイ)
◆ お気に入り問題 (登録数バッジ)
◆ 投稿履歴 (Supabase 接続時のみ)
◆ プレイ履歴 (全期間、テーブル形式)
◆ 危険な操作 (ログアウト / お気に入り全削除 / アカウント削除)
```

## お気に入り機能

### データストア

- 保存先: ブラウザの localStorage
- キー: `ramen-quiz:favorites:v1`
- 保存形式: `FavoriteEntry[]`

```typescript
interface FavoriteEntry {
  quizType: 'knowledge' | 'photo';
  questionId: string;
  addedAt: string; // ISO8601
}
```

### 実装

- リポジトリ: `src/lib/favoritesRepository.ts` (`localFavoritesRepository`)
- ストア: `src/stores/favoritesStore.ts` (`useFavoritesStore`)
- UI: `src/components/quiz/FavoriteButton.tsx` を `QuizCard` と `PhotoQuizCard` の回答後表示エリアに配置
- マイページ表示: `src/components/mypage/FavoritesSection.tsx`

### 制約

- **端末間で同期されません**。localStorage 完結のため、別のブラウザ・別デバイスで開くと空になります。
- **未ログインでも利用可能**。ユーザー ID には紐付かず、その端末に保存されるだけです。
- 元の問題データベースから該当 ID が削除された場合、その項目は一覧から除外されます (件数表示のみ差分メッセージで案内)。

### 復習モード

- 初期スコープでは「復習」ボタンで問題文・正解・解説を静的に展開表示するのみ (アコーディオン)。
- 将来: 単一問題を実際にプレイできる復習モード / お気に入りのみを対象としたセッションを想定。

## スコア推移グラフ

### 実装

- ライブラリ: `recharts` (^2.15.0) — 依存追加時に約 100KB 増
- コンポーネント: `src/components/mypage/ScoreTrendChart.tsx`
- ページ側で `React.lazy` + `Suspense` で遅延ロード (初期バンドルには含めない)

### 表示仕様

- X 軸: プレイ日時 (MM/DD HH:mm)
- Y 軸: 獲得スコア (pt)
- 系列: `basic` (青) / `regional` (緑) / `expert` (赤) / `photo` (黄)
- 対象: 最近 30 プレイ (デフォルト)
- `ResponsiveContainer` でモバイル幅に自動リサイズ
- 履歴が 0 件のときは空状態メッセージを表示

### データソース

- `useScoreStore.myScores` (`localScoreRepository.listScoresByUser`)
- Phase 3 で Supabase 実装 (`supabaseScoreRepository`) に差し替えても同じ props で動作

## 投稿履歴

### データソース

- Supabase の `user_photo_questions` テーブル
- 取得メソッド: `PhotoQuestionRepository.findBySubmitterId(submitterId)` (`compositePhotoQuestionRepository` 経由)
- `submitterId` は `currentUser.username` (Phase 2 の localStorage 認証で採番)

### 表示仕様

- Supabase 未接続時: 「投稿履歴は Supabase 未接続のため表示できません」を表示
- 投稿ゼロ時: 「まだ投稿はありません」+ `/quiz/photo/submit` へのリンク
- 一覧: サムネイル画像 (or `imageUrl`)、店名、エリア、正解の選択肢
- 件数はセクション見出しの右にバッジ表示

### 制約

- 現時点では `PhotoQuestion` ドメイン型に `createdAt` を含まないため、投稿日時は表示していません。
  将来必要になったら `findBySubmitterId` の戻り値に `submittedAt` を追加します。

## 危険な操作

- **ログアウト**: 既存 `useAuthStore.logout()` を呼ぶだけ。
- **お気に入り全削除**: `favoritesStore.clearAll()`。件数 0 のときはボタンを無効化。
- **アカウント削除**: モーダルでユーザー名を再入力させ、一致した場合のみ以下を削除:
  - `ramen-quiz:users` から自分の行
  - `ramen-quiz:credentials` から自分の行
  - `ramen-quiz:scores` から自分の行
  - `ramen-quiz:favorites:v1` は全削除 (端末単位)
  - `useAuthStore.logout()` を呼び、`/` へリダイレクト

Supabase 側に投稿している写真クイズ問題は削除されません (他ユーザーからも参照されているため)。

## 将来の拡張候補

- お気に入り問題のみを対象にした復習モード (10 問セッション)
- お気に入りのクラウド同期 (Supabase Auth 移行後)
- スコア推移のフィルタ (カテゴリ切り替え / 期間指定)
- 投稿履歴に `createdAt` 表示 / 統計 (総投稿数 / 平均難易度)
- アカウント削除時に投稿写真も削除するオプション (Supabase 側の削除 API と RLS の整合)
