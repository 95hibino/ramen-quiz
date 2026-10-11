# Cloud Vision SafeSearch セットアップ

写真クイズ投稿時に、Google Cloud Vision SafeSearch API で不適切コンテンツを
自動判定するための設定手順です。

## 概要

- **保護対象**: 投稿写真の `adult` / `violence` / `racy` を機械判定
- **判定タイミング**: 投稿時。ブラウザが Storage に置いた画像を `api/submit-photo-question.ts` が取得して判定し、通ったものだけ DB に登録する (docs/SUPABASE_SETUP.md §26)
- **拒否時挙動**: エラーメッセージを表示、投稿は中止
- **未設定時挙動**: 審査せず `moderation_status = 'pending'` (非公開) で受け付け、社長が確認して公開する

## コスト

| 月間検査枚数 | 単価 | 想定月額 |
|---|---|---|
| 最初の 1,000 枚 | **無料** | ¥0 |
| 1,001 〜 5,000,000 枚 | $1.50 / 1,000 枚 | 10,000 枚投稿で ~¥2,000 |
| 5,000,001 枚以上 | $0.60 / 1,000 枚 | ほぼ現実的でない規模 |

現状の投稿ペース (数枚/日) では **完全無料枠に収まります**。

コスト暴走リスクは以下で抑制 (docs/SUPABASE_SETUP.md §26):
1. 審査 API はログイン必須。Vision を呼ぶ前に DB の `reserve_photo_moderation` で回数を確保する
   (1 人 1 分に 1 回・1 日 10 回、投稿の 5 分制限中は審査しない)
2. 全体で 1 日 100 回を超えたら審査せず pending で受け付ける
3. 取得する画像は 600KB まで
4. GCP 側でも API の 1 日あたり割り当て上限と予算アラートを設定しておく (最後の歯止め)

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
3. 通常のラーメン写真で投稿 → 「画像を確認して送信中...」 → 「投稿しました」
   (「運営の確認後に公開されます」と出たら審査できていない。Function Logs を確認)
4. (テスト用) 明らかに不適切な画像で投稿 → 「画像に成人向けコンテンツが検出されたため投稿できません」
5. Google Cloud Console → **Cloud Vision API** → **指標** で呼び出し回数を確認

## しきい値の設計

`api/submit-photo-question.ts` の `judge()` 関数で判定ロジックを定義:

| カテゴリ | 判定 | 理由 |
|---|---|---|
| `adult` | `LIKELY` / `VERY_LIKELY` で拒否 | 明確にアウト |
| `violence` | `LIKELY` / `VERY_LIKELY` で拒否 | 明確にアウト |
| `racy` | `LIKELY` / `VERY_LIKELY` で拒否 | 露出度が高いもの |
| `medical` | 無視 | ラーメン写真で赤系トッピングが誤検知するため |
| `spoof` | 無視 | ミーム・加工画像は許容 |

`POSSIBLE` は誤検知が多いためスルー。しきい値を厳しくしたい場合は
`judge()` 内の `isBad` を `POSSIBLE` も含めるように変更してください。

## 審査できなかったときの扱い (保留)

以下の状況では投稿を拒否せず、**非公開 (`moderation_status = 'pending'`) で受け付けます**:

- `GOOGLE_VISION_API_KEY` 未設定
- Vision API 到達失敗 (ネットワーク・Google 障害)
- Vision API 401/403 (API キー期限切れ・権限不足)
- Vision API 応答パース失敗、判定結果が空
- 全体の 1 日上限 (100 回) 超過

投稿者には「運営の確認後に公開されます」と表示されます。
社長は docs/SUPABASE_SETUP.md §26「社長の運用 SQL」で確認待ちの投稿を見て、公開か非表示を決めます。

以前は Fail-Open (審査できなければそのまま公開) でしたが、2026-10 の脆弱性監査で
「審査を素通りした画像が即出題される」ことが AdSense ポリシー上のリスクと判断し、保留に変えました。

## トラブルシューティング

### 「審査できなかったため非公開で受け付けます」というログが常に出る
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
