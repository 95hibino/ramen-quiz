# Sentry セットアップ手順

本番でユーザー環境のエラーを検知するために Sentry を組み込んでいます。
コード側はすでに埋め込み済みで、`VITE_SENTRY_DSN` を設定すればイベント送信が有効になります。

## 目的

- **本番でだけ起きるエラーの検知** — ユーザー環境（特定ブラウザ、特定 OS、通信不安定）でのみ壊れるパターンを拾う
- **ホワイトスクリーン防止** — 未捕捉例外は `ErrorFallback` 画面で受け止め、Sentry に自動送信
- **リグレッション検知** — デプロイ後にエラー率が急増したら通知（Sentry 側で設定）

## Step 1: Sentry アカウント作成 + プロジェクト作成

1. https://sentry.io にアクセスして無料アカウントを作成（Developer プラン: エラー 5,000/月・トランザクション 10,000/月まで無料）
2. 新規プロジェクト作成:
   - Platform: **React**
   - Alert frequency: **On every new issue**（デフォルト）
   - Project name: `ramen-quiz`（任意）
   - Team: 個人アカウントなら Default team のまま

3. 作成完了画面で表示される DSN をコピー:
   ```
   https://xxxxxxxxxxxxxxxx@xxxxx.ingest.us.sentry.io/xxxxxxx
   ```

## Step 2: Vercel の環境変数を設定

1. Vercel Dashboard → Project → **Settings** → **Environment Variables**
2. 追加:
   - Key: `VITE_SENTRY_DSN`
   - Value: Step 1 でコピーした DSN
   - Environment: **Production**、**Preview** の両方にチェック（Development は不要）
3. **Save**

## Step 3: 再デプロイ

環境変数の変更は既存デプロイに反映されないため、手動再デプロイが必要:

- Vercel Dashboard → Deployments → 最新デプロイの `⋯` → **Redeploy**
- または、次回の git push で自動反映

## Step 4: 動作確認

### A. コンソールで意図的にエラーを発生させる

1. 本番サイトを開く
2. ブラウザの DevTools コンソールで以下を実行:
   ```js
   throw new Error('Sentry test error');
   ```
3. Sentry Dashboard の Issues タブに数秒〜1 分で「Sentry test error」が現れる

### B. ErrorBoundary 発火をテストしたい場合

1. `src/pages/Home.tsx` などに一時的に以下を書く:
   ```tsx
   if (new URL(window.location.href).searchParams.has('crash')) {
     throw new Error('Sentry ErrorBoundary test');
   }
   ```
2. `https://ramen-quiz-ten.vercel.app/?crash=1` を開く
3. `ErrorFallback` 画面が表示される + Sentry に記録される
4. 確認後、コードを戻す

## 運用ヒント

### 無料枠を守るための設定

- **tracesSampleRate = 0.1**: パフォーマンス計測を 10% に絞っている（`src/lib/sentry.ts`）
- **ignoreErrors**: ResizeObserver / ChunkLoadError 等の既知ノイズを送信前に破棄
- **denyUrls**: Chrome 拡張・Safari 拡張から発生するエラーを無視

トラフィックが伸びて枠を超えそうになったら `tracesSampleRate` を 0.05 (5%) に下げる。

### アラート設定（Sentry ダッシュボード側）

デフォルトの「新規 issue で通知」以外に、実運用で入れたいアラート:

1. **エラー率スパイク検知**:
   - Alerts → Create Alert Rule → **Number of errors** > 20 in 1 hour → Slack / Email 通知
2. **特定エラーの再発**:
   - 一度 resolve した issue が再発したら通知（デフォルト有効）
3. **リリース比較**:
   - デプロイ後 24h のエラー数を前回比較（Sentry の Releases 機能）

### リリース追跡（オプション）

Vercel は `VERCEL_GIT_COMMIT_SHA` を自動で環境変数に入れるので、これを Sentry の `release` として使うと「どのコミットで発生したエラーか」がダッシュボードで追える。

追加設定:
- Vercel の Environment Variables に `VITE_VERCEL_GIT_COMMIT_SHA` を追加（値は `$VERCEL_GIT_COMMIT_SHA`）— Vercel はこの参照構文をサポート

## トラブルシューティング

| 症状 | 原因と対処 |
|---|---|
| Sentry に何も届かない | `VITE_SENTRY_DSN` が本番環境変数に設定されていない or 再デプロイしていない |
| ローカルでも動作させたい | `.env.local` に `VITE_SENTRY_DSN=...` を追加。ただしローカルテストのイベントも枠を消費するので注意 |
| 送信されるエラーが多すぎる | `ignoreErrors` / `denyUrls` を追加 (`src/lib/sentry.ts`) |
| ソースマップが最小化されて読めない | 別途 Sentry CLI での source map upload が必要 (現状未対応。ミニファイ済みスタックでも十分読める場合が多いのでスキップ) |

## コード配置

| ファイル | 役割 |
|---|---|
| `src/lib/sentry.ts` | `initSentry()` 関数。DSN 判定 + 初期化 |
| `src/main.tsx` | ReactDOM.render の前に `initSentry()` 呼び出し |
| `src/App.tsx` | `Sentry.ErrorBoundary` で `AppContent` をラップ |
| `src/components/common/ErrorFallback.tsx` | ErrorBoundary の fallback UI |
