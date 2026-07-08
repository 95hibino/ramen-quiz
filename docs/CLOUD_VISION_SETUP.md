# Cloud Vision SafeSearch セットアップ

写真クイズ投稿時に、Google Cloud Vision SafeSearch API で不適切コンテンツを
自動判定するための設定手順です。

## 概要

- **保護対象**: 投稿写真の `adult` / `violence` / `racy` を機械判定
- **判定タイミング**: 投稿ボタン押下時 → Supabase Storage への PUT 前
- **拒否時挙動**: エラーメッセージを表示、投稿は中止
- **未設定時挙動**: 完全にスキップ (既存挙動と同じ) → 段階的に有効化可能

## コスト

| 月間検査枚数 | 単価 | 想定月額 |
|---|---|---|
| 最初の 1,000 枚 | **無料** | ¥0 |
| 1,001 〜 5,000,000 枚 | $1.50 / 1,000 枚 | 10,000 枚投稿で ~¥2,000 |
| 5,000,001 枚以上 | $0.60 / 1,000 枚 | ほぼ現実的でない規模 |

現状の投稿ペース (数枚/日) では **完全無料枠に収まります**。

コスト暴走リスクは以下で二重に抑制:
1. 既存の投稿レート制限 (同一ユーザーから 5 分に 1 投稿、docs/SUPABASE_SETUP.md §7)
2. 本 Serverless Function 側で画像サイズ上限 (base64 15MB)

## 手順

### 1. GCP プロジェクトを作成
1. https://console.cloud.google.com/ にアクセス
2. 上部プロジェクトドロップダウン → **新しいプロジェクト**
3. 名前: `ramen-quiz` など任意
4. 作成完了後、プロジェクトを選択

### 2. 請求先を有効化
GCP は無料枠の利用でも請求先アカウントの登録が必要です。
1. 左サイドバー → **お支払い** → **請求先アカウントをリンク**
2. クレジットカード情報を入力 (無料枠内の間は課金されません)

### 3. Cloud Vision API を有効化
1. 左サイドバー → **API とサービス** → **ライブラリ**
2. 検索: `Cloud Vision API` → **有効にする**

### 4. API キーを発行
1. 左サイドバー → **API とサービス** → **認証情報**
2. **+ 認証情報を作成** → **API キー**
3. 発行された API キーをコピー
4. **キーを制限** をクリックし、以下を設定 (推奨):
   - **アプリケーションの制限**: なし
     (Vercel Serverless Function からの呼び出しは動的 IP のため。
      API 制限で十分抑制できるためこれで OK)
   - **API の制限**: **キーを制限** → `Cloud Vision API` のみ選択

### 5. Vercel に環境変数を登録
1. https://vercel.com/ にログイン → プロジェクト → **Settings** → **Environment Variables**
2. 新規追加:
   - **Key**: `GOOGLE_VISION_API_KEY`
   - **Value**: 手順 4 でコピーした API キー
   - **Environment**: `Production`, `Preview`, `Development` すべて
3. 保存
4. **Deployments** → 最新デプロイの **Redeploy** を実行 (環境変数を反映させるため)

### 6. 動作確認

1. サイトを開いてログイン
2. `/quiz/photo/submit` にアクセス
3. 通常のラーメン写真で投稿 → 「画像を検査中...」 → 「送信中...」 → 「投稿しました」
4. (テスト用) 明らかに不適切な画像で投稿 → 「画像に成人向けコンテンツが検出されたため投稿できません」
5. Google Cloud Console → **Cloud Vision API** → **指標** で呼び出し回数を確認

## しきい値の設計

`api/moderate-image.ts` の `judge()` 関数で判定ロジックを定義:

| カテゴリ | 判定 | 理由 |
|---|---|---|
| `adult` | `LIKELY` / `VERY_LIKELY` で拒否 | 明確にアウト |
| `violence` | `LIKELY` / `VERY_LIKELY` で拒否 | 明確にアウト |
| `racy` | `LIKELY` / `VERY_LIKELY` で拒否 | 露出度が高いもの |
| `medical` | 無視 | ラーメン写真で赤系トッピングが誤検知するため |
| `spoof` | 無視 | ミーム・加工画像は許容 |

`POSSIBLE` は誤検知が多いためスルー。しきい値を厳しくしたい場合は
`isBadLikelihood()` を `POSSIBLE` も含めるように変更してください。

## Fail-Open 設計

以下の状況では投稿を **通す** 設計です:

- `GOOGLE_VISION_API_KEY` 未設定 (社長が未セットアップ)
- Vision API 到達失敗 (ネットワーク・Google 障害)
- Vision API 401/403 (API キー期限切れ・権限不足)
- Vision API 応答パース失敗

理由: Google 側の障害でサイト全体の投稿機能を止めるのはユーザー体験を害するため。
不適切投稿が万一通っても、既存の **通報機能** (docs/SUPABASE_SETUP.md §9) と
**社長による削除運用** (`scripts/admin/delete_user_question.ts`) で事後対応可能。

Fail-Closed に変更したい場合は `api/moderate-image.ts` の
「Fail-Open」コメント箇所を `{ safe: false, reason: '...' }` に変更してください。

## トラブルシューティング

### 「投稿は許可」というログが常に出る
- Vercel Environment Variables に `GOOGLE_VISION_API_KEY` が入っていない、または typo
- Redeploy を実行しているか確認
- Vercel Functions のログ (Deployments → Function Logs) で警告メッセージを確認

### `PERMISSION_DENIED` エラー
- Cloud Vision API が有効化されていない
- API キーの API 制限で Vision API が選ばれていない
- 請求先が未リンク (無料枠でもリンク必須)

### 予想外の課金
- Google Cloud Console → **お支払い** → **予算とアラート**
- 月 $10 の予算アラートを設定推奨 (通常は無料枠内)
- 攻撃者による大量呼び出しが疑われる場合は Vercel Function 側にレート制限を追加

## 変更履歴

- 2026-07-08: 初版
