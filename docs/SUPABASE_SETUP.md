# Supabase セットアップ手順

ユーザー写真投稿機能 (`/quiz/photo/submit`) を有効化するには、Supabase プロジェクトを作成して環境変数を設定する必要があります。

未設定の状態でも `npm run dev` は起動でき、投稿フォームは表示されますが、送信ボタンは無効化され「Supabase 未接続。社長作業待ち」と表示されます。

## 0. 前提

- Supabase の無料プランで動作確認可能
- 所要時間: 約 15 分
- 必要なもの: GitHub アカウント (Supabase へのサインアップに使用)

## 1. アカウント作成

1. https://supabase.com/ にアクセス
2. 「Start your project」または「Sign in」から GitHub アカウントでサインアップ

## 2. プロジェクト作成

1. ダッシュボードの「New project」をクリック
2. 以下を入力
   - **Project Name**: `ramen-quiz`
   - **Database Password**: 強固なパスワード (パスワードマネージャに保管)
   - **Region**: `Northeast Asia (Tokyo) ap-northeast-1` を推奨
3. 「Create new project」 → DB 構築完了まで 1〜2 分待機

## 3. データベース migration

1. 左メニューの「SQL Editor」を開き、「New query」をクリック
2. 以下の SQL を貼り付けて「Run」

> `gen_random_uuid()` を使うため、最初に `CREATE EXTENSION IF NOT EXISTS pgcrypto;` を実行しておいてください。

```sql
-- ==========================================
-- 拡張 (UUID 生成用)
-- ==========================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ==========================================
-- テーブル定義 + 入力 validation (CHECK 制約)
-- ==========================================
CREATE TABLE user_photo_questions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submitter_id TEXT NOT NULL
    CHECK (char_length(submitter_id) BETWEEN 3 AND 20),
  image_path   TEXT NOT NULL
    CHECK (char_length(image_path) BETWEEN 1 AND 500),
  ramen_type   TEXT NOT NULL
    CHECK (ramen_type IN ('shoyu','shio','miso','tonkotsu','iekei','jiro','tsukemen','tantanmen','other')),
  prefecture   TEXT NOT NULL
    CHECK (char_length(prefecture) BETWEEN 1 AND 10),
  photo_type   TEXT NOT NULL
    CHECK (photo_type IN ('storefront','interior','ticketMachine','ramen','other')),
  difficulty   TEXT NOT NULL
    CHECK (difficulty IN ('high','mid','low')),
  noodle_thickness TEXT
    CHECK (noodle_thickness IS NULL
           OR noodle_thickness IN ('thin','mediumThin','mediumThick','thick','wavy','straight')),
  -- 問題文は全問共通の固定文字列で統一 (ユーザー入力させない)
  question     TEXT NOT NULL
    CHECK (question = 'この画像はどこの店のものですか？'),
  options      JSONB NOT NULL
    CHECK (jsonb_typeof(options) = 'array' AND jsonb_array_length(options) = 4),
  answer_idx   INT NOT NULL
    CHECK (answer_idx BETWEEN 0 AND 3),
  explanation  TEXT
    CHECK (explanation IS NULL OR char_length(explanation) <= 200),
  -- shop_info は必須、name フィールドは 1〜100 字必須 (問題文が「どこの店?」なので店名なしは成立しない)
  shop_info    JSONB NOT NULL
    CHECK (
      jsonb_typeof(shop_info) = 'object'
      AND (shop_info ->> 'name') IS NOT NULL
      AND char_length(shop_info ->> 'name') BETWEEN 1 AND 100
    ),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 投稿者ごとの最新投稿時刻ルックアップを高速化 (レート制限トリガーで利用)
CREATE INDEX idx_user_photo_questions_submitter
  ON user_photo_questions (submitter_id, created_at DESC);

-- ==========================================
-- レート制限トリガー (同じ submitter_id から 5 分に 1 件)
--   ※ 管理者バイパス: submitter_id = '_shacho' のときは制限をかけない
-- ==========================================
CREATE OR REPLACE FUNCTION enforce_submit_rate_limit()
RETURNS TRIGGER AS $$
DECLARE
  last_submission TIMESTAMPTZ;
  wait_seconds    INT;
BEGIN
  -- 管理者 (社長) は無制限。フロント側 validation で予約語化済みのため、
  -- 一般ユーザーがこの username で signup することはできない。
  IF NEW.submitter_id = '_shacho' THEN
    RETURN NEW;
  END IF;

  SELECT MAX(created_at) INTO last_submission
  FROM user_photo_questions
  WHERE submitter_id = NEW.submitter_id;

  IF last_submission IS NOT NULL
     AND last_submission > NOW() - INTERVAL '5 minutes' THEN
    -- フロントが正規表現でパースしやすいよう "rate_limit_exceeded:<残り秒数>" 形式で返す
    wait_seconds := GREATEST(
      1,
      CEIL(EXTRACT(EPOCH FROM (last_submission + INTERVAL '5 minutes' - NOW())))::INT
    );
    RAISE EXCEPTION 'rate_limit_exceeded:%', wait_seconds
      USING HINT = 'Please wait before submitting again';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_enforce_submit_rate_limit
BEFORE INSERT ON user_photo_questions
FOR EACH ROW EXECUTE FUNCTION enforce_submit_rate_limit();

-- ==========================================
-- RLS ポリシー
--   - SELECT: anon 全公開
--   - INSERT: anon 許可 (CHECK 制約 + レート制限トリガーで防御)
--   - UPDATE / DELETE: 一般ユーザー不可 (ポリシー未作成 = 拒否)
--     不適切投稿の削除は Service Role Key を持つ社長専用スクリプトから実施
-- ==========================================
ALTER TABLE user_photo_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_select" ON user_photo_questions
  FOR SELECT TO anon USING (true);

CREATE POLICY "anon_insert" ON user_photo_questions
  FOR INSERT TO anon WITH CHECK (true);
```

実行後、「Table Editor」で `user_photo_questions` テーブルが空で作成されていることを確認します。

> **メモ**: PostgreSQL の RLS は「ポリシーが無い操作はすべて拒否」が既定です。
> UPDATE / DELETE ポリシーを敢えて作らないことで一般ユーザーからの変更・削除を明示的に禁止しています。
> 社長が削除したいときは Supabase Dashboard (Service Role Key 相当の権限で操作) か、§10 の管理スクリプトを使用してください。

## 4. Storage バケット作成

1. 左メニューの「Storage」を開き、「New bucket」をクリック
2. 以下を設定
   - **Name**: `photo-quiz-user`
   - **Public bucket**: **ON** (画像公開 URL でクイズに表示するため必須)
   - **File size limit**: `500 KB` (最適化後の WebP は通常 100KB 以下)
   - **Allowed MIME types**: `image/webp` のみ (フロントが必ず WebP 変換するため)
3. 「Save」

### Storage の RLS ポリシー

「Storage」 → 該当バケット → 「Policies」タブで以下のポリシーを追加します。SQL Editor から直接設定する場合は次のスニペットをそのまま実行してください。

```sql
-- 公開閲覧
CREATE POLICY "anon_storage_select" ON storage.objects
  FOR SELECT TO anon USING (bucket_id = 'photo-quiz-user');

-- 匿名アップロード (CHECK 制約 + バケット側 MIME / サイズ制限で防御)
CREATE POLICY "anon_storage_insert" ON storage.objects
  FOR INSERT TO anon WITH CHECK (bucket_id = 'photo-quiz-user');

-- UPDATE / DELETE は明示的にポリシーを作らない
-- → 一般ユーザーからの上書き・削除は拒否される。
--   管理は Service Role Key (社長のみ保持) で行う。
```

Dashboard UI から設定する場合は次の 2 つだけ作成し、UPDATE / DELETE は作らない (作らない＝拒否) ことが重要です。

| 操作 | ターゲット | 条件 |
|---|---|---|
| SELECT (公開閲覧) | `anon` | `bucket_id = 'photo-quiz-user'` |
| INSERT (匿名アップロード) | `anon` | `bucket_id = 'photo-quiz-user'` |

> **再確認**: バケット作成時の **File size limit = 500KB** と **Allowed MIME types = image/webp** は必ず両方設定してください。これがないと大容量画像や非 WebP がアップロードされる余地が残ります。

Phase 3 で Supabase Auth に切り替える際は `auth.role() = 'authenticated'` に厳格化します。

## 5. 環境変数設定

1. 左メニュー下部の「Project Settings」 → 「API」を開く
2. 以下の値をコピー
   - **Project URL** (`https://xxxxxxxxxxx.supabase.co`)
   - **anon public key** (`eyJ...` で始まる JWT)
3. プロジェクトルート (`shacho/engineering/output/ramen_quiz/`) に `.env.local` を作成

```bash
VITE_SUPABASE_URL=https://xxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
# 任意。デフォルトは photo-quiz-user
# VITE_SUPABASE_STORAGE_BUCKET=photo-quiz-user
```

> **注意**: `.env.local` は Git にコミットしないこと (Vite は `.env.local` を自動で gitignore 対象にします)。

## 6. 動作確認

```bash
npm run dev
```

1. ブラウザで `http://localhost:5173/` を開く
2. アカウントを作成 (`/signup`) してログイン
3. ヘッダーの「投稿する」リンク、もしくは `/quiz/photo/submit` にアクセス
4. 画像を選択し、必須項目 (5 軸メタ + 4 つの選択肢 + 正解 + **店名**) を入力 → 「投稿する」
   - 問題文は「この画像はどこの店のものですか？」で固定 (編集不可)
   - 店名は必須 (空だと送信ボタンが無効化)
5. 「投稿しました」トーストが出て `/quiz/photo` に遷移すれば成功
6. Supabase ダッシュボードの「Table Editor」 → `user_photo_questions` に行が増えていることを確認
7. 「Storage」 → `photo-quiz-user` → `submissions/...` に画像ファイルがあることを確認
8. `/quiz/photo` の「○問利用可能」件数に投稿分が反映されていることを確認
9. **レート制限の確認**: 同一ユーザーで連続投稿を試み、「投稿のレート制限により、あと N 分 M 秒お待ちください」と表示されることを確認

## 7. セキュリティモデル (現状の理解)

### 何が安全か

- **Supabase Anon Key** は公開前提の鍵で、JS バンドルに含めて問題ありません (RLS と CHECK 制約で守る前提の設計)。
- **Service Role Key** (管理鍵) は絶対にフロントに含めない。Vercel などホスティング側にも置かない (社長のローカル `.env` のみ)。本リポジトリにはコミットされません。

### 何にリスクがあるか

1. **localStorage のアプリ認証情報**: XSS で盗まれる可能性があります。
2. **`submitter_id` の詐称**: localStorage を直接書き換えれば任意の username を名乗って投稿できます。
3. **不適切投稿の自動検出なし**: 画像内容のモデレーションは未実装です。

### 講じている対策 (このセットアップで有効化)

| 対策 | 実装場所 | 何を防ぐか |
|---|---|---|
| レート制限 (同 `submitter_id` から 5 分に 1 件) | DB トリガー `enforce_submit_rate_limit` | スパム連投 |
| 入力 validation (文字数・選択肢数・列挙値) | CHECK 制約 | 不正な巨大ペイロード / 想定外列挙値 |
| 一般ユーザーからの UPDATE / DELETE 不可 | RLS ポリシー未作成 (= 拒否) | 他人の投稿改ざん・削除 |
| Storage: WebP 限定 / 500KB 上限 | バケット設定 | 非画像ファイル投入・帯域圧迫 |
| Storage: UPDATE / DELETE 不可 | RLS ポリシー未作成 (= 拒否) | アップロード済み画像の改ざん |
| 画像の EXIF 削除・WebP 化 | フロント (`imageOptimizer.ts`) | 位置情報漏洩・容量肥大 |

> レート制限エラーは `rate_limit_exceeded:<残り秒数>` 形式で返却されます。フロント (`supabasePhotoQuestionRepository.submit`) はこのパターンを検出して `RateLimitError` に変換し、UI で「あと N 分 M 秒お待ちください」と表示します。

### Phase 3 で予定する強化

- Supabase Auth (Email Magic Link or 匿名サインイン) への移行
- `submitter_id` を `auth.uid()` に置換し詐称不可に
- RLS を `auth.role() = 'authenticated'` に厳格化、`auth.uid() = submitter_id` で投稿者本人のみ自分の投稿を削除可に
- 不適切投稿の通報フォーム + 運営削除フロー
- 画像モデレーション API (例: Google Cloud Vision SafeSearch) の検討

### 当面の運用方針

- 投稿数が少ないうちは社長が定期的に Supabase Table Editor で確認 & 手動削除
- 急増した場合は `anon_insert` ポリシーを一旦 `DROP` して投稿停止
- 個人情報を含む画像 (氏名入り表札・他人の顔がはっきり写った写真等) は投稿ガイドラインで禁止する旨をフォーム文言に追記検討

## 8. トラブルシューティング

| 症状 | 原因 / 対処 |
|---|---|
| 「Supabase 未接続。社長作業待ち」が消えない | `.env.local` に typo がないか確認。`VITE_` プレフィックス必須。`npm run dev` を再起動。 |
| 投稿時に「画像アップロードに失敗しました」 | バケット名が `photo-quiz-user` か、ファイルサイズ上限が 500KB 以上か、Allowed MIME types が `image/webp` を含むか確認。 |
| 投稿は成功するが `/quiz/photo` の件数が増えない | Supabase の SELECT ポリシー (`anon_select`) が抜けている。手順 3 の SQL を再実行。 |
| `gen_random_uuid()` が無いと言われる | プロジェクトが古い場合は `CREATE EXTENSION IF NOT EXISTS pgcrypto;` を先に実行 (手順 3 冒頭に含まれています)。 |
| 連続投稿すると「あと N 分 M 秒お待ちください」と出る | 仕様どおりのレート制限。5 分待ってから再投稿してください。テスト用に一時的に解除したいときは `DROP TRIGGER trg_enforce_submit_rate_limit ON user_photo_questions;`。 |

## 8.5. 差分マイグレーション: 問題文統一 + 店名必須化 (既に SQL 実行済みの場合)

2026-06-15 の仕様変更により、写真クイズは:

- 問題文を「**この画像はどこの店のものですか？**」で全問統一 (ユーザー入力させない)
- `shop_info.name` を必須化 (店名なしでは問題が成立しないため)

既に手順 3 の SQL を実行済みのプロジェクトでは、SQL Editor で次の差分マイグレーションを実行してください。

```sql
-- =====================================================
-- 1. 既存レコードの question を統一文字列に更新
-- =====================================================
UPDATE user_photo_questions
SET question = 'この画像はどこの店のものですか？'
WHERE question <> 'この画像はどこの店のものですか？';

-- =====================================================
-- 2. shop_info.name が未設定のレコードがあるかチェック
--    (あれば事前に手動で UPDATE か DELETE する必要がある)
-- =====================================================
SELECT id, submitter_id, shop_info
FROM user_photo_questions
WHERE shop_info IS NULL
   OR jsonb_typeof(shop_info) <> 'object'
   OR (shop_info ->> 'name') IS NULL
   OR char_length(shop_info ->> 'name') = 0;
-- ↑ 行が返るならその id について shop_info.name を埋めるか行を削除してから次へ

-- =====================================================
-- 3. CHECK 制約を差し替え
-- =====================================================
-- question
ALTER TABLE user_photo_questions
  DROP CONSTRAINT IF EXISTS user_photo_questions_question_check;
ALTER TABLE user_photo_questions
  ADD CONSTRAINT user_photo_questions_question_check
  CHECK (question = 'この画像はどこの店のものですか？');

-- shop_info: NULL 許容を外して NOT NULL に
ALTER TABLE user_photo_questions
  DROP CONSTRAINT IF EXISTS user_photo_questions_shop_info_check;
ALTER TABLE user_photo_questions
  ALTER COLUMN shop_info SET NOT NULL;
ALTER TABLE user_photo_questions
  ADD CONSTRAINT user_photo_questions_shop_info_check
  CHECK (
    jsonb_typeof(shop_info) = 'object'
    AND (shop_info ->> 'name') IS NOT NULL
    AND char_length(shop_info ->> 'name') BETWEEN 1 AND 100
  );
```

> **注意**: 手順 2 のチェックで行が返った場合は、それらを先に `UPDATE user_photo_questions SET shop_info = jsonb_set(shop_info, '{name}', '"店名"') WHERE id = '...'` などで埋めるか、`DELETE FROM user_photo_questions WHERE id = '...'` で削除してから手順 3 を実行してください。NOT NULL / CHECK 制約は既存データが違反していると ALTER に失敗します。

### よくあるエラー

#### `ERROR: 23502: column "shop_info" of relation "user_photo_questions" contains null values`

手順 2 の事前チェックを飛ばして手順 3 を実行した場合に発生します。**`shop_info IS NULL` の既存行が `SET NOT NULL` に違反**するためです。

##### 対処手順

1. **NULL 行の中身を確認**:

   ```sql
   SELECT id, submitter_id, image_path, shop_info, created_at
   FROM user_photo_questions
   WHERE shop_info IS NULL
      OR jsonb_typeof(shop_info) <> 'object'
      OR (shop_info ->> 'name') IS NULL
      OR char_length(shop_info ->> 'name') = 0;
   ```

2. **テスト投稿のみなら一括削除**:

   ```sql
   -- DB の行を削除
   DELETE FROM user_photo_questions
   WHERE shop_info IS NULL
      OR jsonb_typeof(shop_info) <> 'object'
      OR (shop_info ->> 'name') IS NULL
      OR char_length(shop_info ->> 'name') = 0;
   ```

   > 削除した行に紐付く Storage 画像 (`photo-quiz-user` バケット内) は別途 Dashboard か `scripts/admin/delete_user_question.ts` で消してください。残しても害はないですが、未参照画像として溜まり続けます。

3. **本番運用中で削除したくないなら、name を後から埋める**:

   ```sql
   UPDATE user_photo_questions
   SET shop_info = COALESCE(shop_info, '{}'::jsonb) || jsonb_build_object('name', '不明')
   WHERE shop_info IS NULL
      OR (shop_info ->> 'name') IS NULL
      OR char_length(shop_info ->> 'name') = 0;
   ```

   ※ `'不明'` をあとから個別に正しい店名で UPDATE する運用。

4. 上記が終わったら、手順 3 の `ALTER TABLE ... SET NOT NULL` を再度実行。

## 9. 管理者バイパス (`_shacho` ユーザー)

レート制限 (5分1件) は **`submitter_id = '_shacho'`** からの投稿には適用されません。社長が運営素材を一気に投入したい場合や、テスト投稿を連続したい場合に使用します。

### 仕組み

- フロントの `validateUsername` で `_shacho` は予約語として登録不可
  → 一般ユーザーが `_shacho` を名乗って詐称することはできない (signup 時点で拒否)
- SQL トリガー `enforce_submit_rate_limit` の冒頭で `submitter_id = '_shacho'` をスキップ
  → DB 側でもレート制限が発火しない

### 既に SQL を実行済みの場合の差分マイグレーション

手順 3 の SQL を既に流した後でこのバイパスを有効化するには、SQL Editor で以下を実行してください (関数の `CREATE OR REPLACE` だけで上書きされます):

```sql
CREATE OR REPLACE FUNCTION enforce_submit_rate_limit()
RETURNS TRIGGER AS $$
DECLARE
  last_submission TIMESTAMPTZ;
  wait_seconds    INT;
BEGIN
  IF NEW.submitter_id = '_shacho' THEN
    RETURN NEW;
  END IF;

  SELECT MAX(created_at) INTO last_submission
  FROM user_photo_questions
  WHERE submitter_id = NEW.submitter_id;

  IF last_submission IS NOT NULL
     AND last_submission > NOW() - INTERVAL '5 minutes' THEN
    wait_seconds := GREATEST(
      1,
      CEIL(EXTRACT(EPOCH FROM (last_submission + INTERVAL '5 minutes' - NOW())))::INT
    );
    RAISE EXCEPTION 'rate_limit_exceeded:%', wait_seconds
      USING HINT = 'Please wait before submitting again';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### `_shacho` アカウントの作り方

予約語のため通常の signup フォームからは作成できません。次のどちらかで作成してください:

1. **Supabase Dashboard から手動投入**: DB を経由しないので、フロントの `localStorage` に直接 `_shacho` の `currentUser` レコードを書き込む方法。具体的には DevTools コンソールで:
   ```js
   // パスワードハッシュは別途生成が必要。後述の CLI を推奨
   ```
2. **CLI スクリプト (推奨)**: 既存の `scripts/admin/` 配下に `create_admin_user.ts` を追加すれば、ローカル DB / localStorage に依存しない、SQL 直接投入も可能。必要なら別途依頼してください。

> **当面の運用**: 社長が UI から大量投稿する場面が来たらこの管理者アカウント作成を実装します。それまでは一般 username でテスト + 5 分制限内で運用 → 大量投入は Supabase Dashboard で `DROP TRIGGER ... ; INSERT ... ; CREATE TRIGGER ... ;` で一時解除する方法も使えます。

### username を変更したい場合

`_shacho` 以外にしたい場合は次の 2 ヶ所を同じ文字列に書き換えてください:

| 場所 | 何を書き換えるか |
|---|---|
| `src/lib/validation.ts` の `RESERVED_USERNAMES` 配列 | 予約語リスト |
| SQL トリガー関数 `enforce_submit_rate_limit` の `IF NEW.submitter_id = '...'` | バイパス対象 |

両方を揃えないと、フロント側で予約だけされてバイパスされない (またはその逆) という不整合が起きます。

## 10. 不適切投稿の削除 (社長専用スクリプト)

一般ユーザーは DELETE 不可なので、社長が削除する場合は次のいずれかで対応します。

### 9.1 Supabase Dashboard から

1. Supabase Dashboard → Table Editor → `user_photo_questions`
2. 該当行を選択して削除 (Dashboard は Service Role 権限で動作するため RLS をバイパス可能)
3. Storage → `photo-quiz-user` → 対応する `image_path` のオブジェクトも削除

### 9.2 CLI スクリプトから (`scripts/admin/delete_user_question.ts`)

`SUPABASE_SERVICE_ROLE_KEY` 環境変数を設定したうえで実行します。Service Role Key は **絶対にフロントや Git にコミットしない** こと。

```bash
cd shacho/engineering/output/ramen_quiz

# .env.admin (Git 管理外) に SUPABASE_SERVICE_ROLE_KEY と SUPABASE_URL を記載するか、
# シェルで export してから実行する
export SUPABASE_URL=https://xxxxxxxxxxx.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=ey...

# 単発削除 (DB 行 + Storage 画像を同時に削除)
npx tsx scripts/admin/delete_user_question.ts <question-id>
```

詳細は `scripts/admin/README.md` を参照してください。

## 11. 法務ページ・運用フォーム用テーブル

`/contact` (お問い合わせフォーム) と各写真クイズの「⚠ この問題を通報」ボタンを動かすために、
`contact_submissions` と `content_reports` の 2 テーブルを追加します。

未設定でも `/privacy` `/terms` ページは表示できますが、`/contact` のフォームは「準備中です」表示になり、
写真クイズの通報ボタンは非表示になります。

> **前提**: §3 と同じく `CREATE EXTENSION IF NOT EXISTS pgcrypto;` を先に実行しておいてください。
> `user_photo_questions` テーブル (§3) も既に存在している必要があります (通報テーブルが FK で参照するため)。

SQL Editor で以下を実行してください。

```sql
-- ==========================================
-- お問い合わせ (contact_submissions)
-- ==========================================
CREATE TABLE contact_submissions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT CHECK (name IS NULL OR char_length(name) <= 30),
  email       TEXT CHECK (
    email IS NULL OR (
      char_length(email) <= 100
      AND email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
    )
  ),
  category    TEXT NOT NULL CHECK (category IN ('bug','feature','copyright','other')),
  body        TEXT NOT NULL CHECK (char_length(body) BETWEEN 10 AND 2000),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- メールアドレス指定時のレート制限ルックアップを高速化
CREATE INDEX idx_contact_submissions_email_created
  ON contact_submissions (email, created_at DESC)
  WHERE email IS NOT NULL;

-- メールアドレス指定時は同アドレスから 1 時間 1 件
-- (メールアドレス無しの場合はこのトリガーをスキップ。IP 制限は今後検討)
CREATE OR REPLACE FUNCTION enforce_contact_rate_limit()
RETURNS TRIGGER AS $$
DECLARE
  last_ts      TIMESTAMPTZ;
  wait_seconds INT;
BEGIN
  IF NEW.email IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT MAX(created_at) INTO last_ts
  FROM contact_submissions
  WHERE email = NEW.email;

  IF last_ts IS NOT NULL AND last_ts > NOW() - INTERVAL '1 hour' THEN
    wait_seconds := GREATEST(
      1,
      CEIL(EXTRACT(EPOCH FROM (last_ts + INTERVAL '1 hour' - NOW())))::INT
    );
    RAISE EXCEPTION 'rate_limit_exceeded:%', wait_seconds
      USING HINT = 'Please wait before sending another contact';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_enforce_contact_rate_limit
  BEFORE INSERT ON contact_submissions
  FOR EACH ROW EXECUTE FUNCTION enforce_contact_rate_limit();

-- RLS: anon は INSERT のみ。SELECT は社長 (Service Role Key) のみ
ALTER TABLE contact_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_contact_insert" ON contact_submissions
  FOR INSERT TO anon WITH CHECK (true);

-- ==========================================
-- 通報 (content_reports)
-- ==========================================
CREATE TABLE content_reports (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id  UUID NOT NULL REFERENCES user_photo_questions(id) ON DELETE CASCADE,
  reason       TEXT NOT NULL CHECK (reason IN ('inappropriate','copyright','privacy','misinfo','other')),
  body         TEXT CHECK (body IS NULL OR char_length(body) <= 500),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_content_reports_question
  ON content_reports (question_id, created_at DESC);

-- RLS: anon は INSERT のみ。SELECT は社長 (Service Role Key) のみ
-- 重複通報は許容 (UNIQUE 制約なし) → 多く集まれば優先対応の判断材料に使う
ALTER TABLE content_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_reports_insert" ON content_reports
  FOR INSERT TO anon WITH CHECK (true);
```

### 確認方法

1. `npm run dev` を再起動 (環境変数を読み直すため)
2. `/contact` を開き、必須項目を入力 → 「送信する」 → 「お問い合わせを受け付けました」トーストが表示されること
3. Supabase Dashboard → Table Editor → `contact_submissions` に行が追加されていること
4. 同じメールアドレスで再送信を試みると「あと N 分 M 秒お待ちください」と表示されること
5. `/quiz/photo/play` で写真クイズに 1 問回答 → カード右下「⚠ この問題を通報」ボタンが表示されること
6. ボタンクリック → モーダルで理由を選んで送信 → トースト表示
7. Supabase Dashboard → Table Editor → `content_reports` に行が追加されていること

### 社長による中身の確認 (Service Role Key 必須)

`contact_submissions` / `content_reports` の SELECT は社長専用です。Dashboard の Table Editor から確認するか、
将来的に `scripts/admin/` 配下に閲覧用スクリプトを追加してください。

| やりたいこと | 方法 |
|---|---|
| お問い合わせを一覧する | Dashboard → Table Editor → `contact_submissions` (新着順) |
| 通報の多い問題を抽出する | SQL: `SELECT question_id, COUNT(*) FROM content_reports GROUP BY question_id ORDER BY COUNT(*) DESC;` |
| 通報された問題を確認する | Dashboard → Table Editor → `content_reports` → `question_id` で `user_photo_questions` を JOIN |
| 通報対応で問題を削除する | §10 の `delete_user_question.ts` を実行 (ON DELETE CASCADE で `content_reports` の関連行も自動削除) |

### バリデーション設計のメモ

フロント (`src/lib/validation.ts`) と DB CHECK 制約は同等のルールを持たせています:

| 項目 | フロント | DB CHECK |
|---|---|---|
| `contact.name` | 任意 / 最大 30 字 | NULL 可 / `char_length(name) <= 30` |
| `contact.email` | 任意 / 最大 100 字 / 簡易形式 | NULL 可 / 最大 100 字 / `~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'` |
| `contact.category` | `bug` / `feature` / `copyright` / `other` のみ | 同上 (IN リスト) |
| `contact.body` | 必須 / 10〜2000 字 | NOT NULL / `BETWEEN 10 AND 2000` |
| `report.reason` | 5 種類のみ | 同上 (IN リスト) |
| `report.body` | 任意 / 最大 500 字 | NULL 可 / `char_length(body) <= 500` |

フロントは UX のため、DB は最終防御として配置しています。文言・上限を変えるときは両側を必ず揃えてください。

---

## §10 世界ランキング (public_profiles + quiz_scores)

ランキング機能を「各ブラウザ内 localStorage」から「Supabase 経由の全プレイヤー共有」に切り替えるためのテーブル一式です。既存の localStorage 認証はそのまま維持します (Phase 3 の Auth 移行は別途)。

### 目的

- ログイン中ユーザー同士がランキング画面で相互にスコアを見られるようにする
- 別端末での再ログイン時にもプロフィールを維持する
- Supabase 未接続時は自動で localStorage 集計にフォールバック (既存挙動保護)

### 実行 SQL (初回のみ、Supabase SQL Editor で 1 度だけ)

```sql
-- ==========================================
-- 公開プロフィール (public_profiles)
-- ==========================================
-- ランキング表示のために各ユーザーの最小情報を保存する。
-- Phase 2: localStorage 認証のまま、Supabase 側は「公開情報の共有先」として使う。
-- Phase 3+ で Supabase Auth に移行する場合、id を auth.uid() に載せ替える設計。
CREATE TABLE public_profiles (
  id            TEXT PRIMARY KEY,       -- クライアント生成の UUID (localStorage の User.id)
  username      TEXT NOT NULL CHECK (char_length(username) BETWEEN 1 AND 40),
  prefecture    TEXT NOT NULL CHECK (char_length(prefecture) BETWEEN 2 AND 8),
  favorite_shop TEXT NOT NULL CHECK (char_length(favorite_shop) BETWEEN 1 AND 100),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ユーザー名検索の高速化 (将来重複検知にも使える)
CREATE INDEX idx_public_profiles_username_lower
  ON public_profiles ((lower(username)));

-- RLS: 誰でも SELECT (ランキング表示用)、INSERT/UPDATE は anon に許可
-- 注: Phase 2 は Supabase Auth を使わないため、匿名クライアントが自由に upsert 可。
-- 詐称対策は Phase 3 の Auth 移行で強化する。当面はレート制限で抑える。
ALTER TABLE public_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_profiles_select" ON public_profiles
  FOR SELECT TO anon USING (true);
CREATE POLICY "anon_profiles_insert" ON public_profiles
  FOR INSERT TO anon WITH CHECK (id IS NOT NULL AND username IS NOT NULL);
CREATE POLICY "anon_profiles_update" ON public_profiles
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- ==========================================
-- クイズスコア (quiz_scores)
-- ==========================================
-- 1 プレイ = 1 行。ランキングは quiz_ranking ビュー経由で集計する。
CREATE TABLE quiz_scores (
  id            TEXT PRIMARY KEY,       -- クライアント生成
  user_id       TEXT NOT NULL REFERENCES public_profiles(id) ON DELETE CASCADE,
  quiz_type     TEXT NOT NULL CHECK (quiz_type IN ('knowledge','photo')),
  category      TEXT CHECK (category IS NULL OR category IN ('basic','regional','expert')),
  score         INTEGER NOT NULL CHECK (score >= 0 AND score <= 100000),
  correct_count INTEGER NOT NULL CHECK (correct_count >= 0),
  total_count   INTEGER NOT NULL CHECK (total_count > 0 AND total_count <= 100),
  played_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT correct_le_total CHECK (correct_count <= total_count)
);

CREATE INDEX idx_quiz_scores_user_played
  ON quiz_scores (user_id, played_at DESC);
CREATE INDEX idx_quiz_scores_score_desc
  ON quiz_scores (score DESC);

ALTER TABLE quiz_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_scores_select" ON quiz_scores
  FOR SELECT TO anon USING (true);
CREATE POLICY "anon_scores_insert" ON quiz_scores
  FOR INSERT TO anon WITH CHECK (user_id IS NOT NULL AND score IS NOT NULL);

-- ==========================================
-- レート制限トリガー (連投抑制)
-- ==========================================
-- 同一 user_id から 3 秒以内の連投を弾く。1 プレイ 20 秒 × 10 問 = 約 3 分かかるため
-- 正規プレイでは絶対に引っかからない値だが、ボット・スクリプト対策として設ける。
-- `_shacho` (管理者) はスキップ。
CREATE OR REPLACE FUNCTION enforce_quiz_score_rate_limit()
RETURNS TRIGGER AS $$
DECLARE
  last_played TIMESTAMPTZ;
  seconds_since NUMERIC;
BEGIN
  IF NEW.user_id = '_shacho' THEN
    RETURN NEW;
  END IF;

  SELECT MAX(played_at) INTO last_played
  FROM quiz_scores
  WHERE user_id = NEW.user_id;

  IF last_played IS NOT NULL THEN
    seconds_since := EXTRACT(EPOCH FROM (NOW() - last_played));
    IF seconds_since < 3 THEN
      RAISE EXCEPTION 'rate_limit_exceeded:%', CEIL(3 - seconds_since);
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER quiz_scores_rate_limit
  BEFORE INSERT ON quiz_scores
  FOR EACH ROW EXECUTE FUNCTION enforce_quiz_score_rate_limit();

-- ==========================================
-- ランキング集計ビュー (quiz_ranking)
-- ==========================================
-- プロフィール全件を LEFT JOIN しているので、スコア未記録の新規ユーザーも
-- 0 pt / 0 プレイで並ぶ。フロント側で totalScore=0 を弾く/弾かないは表示調整。
CREATE OR REPLACE VIEW quiz_ranking AS
SELECT
  p.id            AS user_id,
  p.username,
  p.prefecture,
  p.favorite_shop,
  p.created_at,
  COALESCE(SUM(s.score), 0)::INTEGER AS total_score,
  COUNT(s.id)::INTEGER              AS play_count
FROM public_profiles p
LEFT JOIN quiz_scores s ON s.user_id = p.id
GROUP BY p.id, p.username, p.prefecture, p.favorite_shop, p.created_at
ORDER BY total_score DESC, play_count ASC;
```

### 確認方法

1. Vercel Environment Variables に `VITE_SUPABASE_URL` と `VITE_SUPABASE_ANON_KEY` が既に設定済みであること (Phase 2 で設定済のはず)
2. 上記 SQL を Supabase Dashboard → SQL Editor で 1 度だけ実行
3. サイトを開いて、既存アカウントで再ログイン → Table Editor → `public_profiles` に 1 行入っていること
4. クイズを 1 回プレイして結果画面に到達 → `quiz_scores` に 1 行入っていること
5. `/ranking` を開いて、自分の順位が表示されること
6. 別ブラウザ (シークレットウィンドウ等) で別ユーザーを作成 → プレイ → 双方の `/ranking` に両ユーザーが表示されること

### 既存 localStorage スコアの扱い

移行前に貯めた localStorage のスコアは **サーバに転送されません** (新規に累積開始)。以下の理由で意図的な設計です:

- 移行前スコアには他ユーザーとの整合性を保証できない (時刻ずれ・改竄不明)
- 移行タイミングでリーダーボードをリセットする方が公平

必要になれば `scripts/admin/` に localStorage → Supabase の一括インポート CLI を追加する余地はあります。

### 詐称対策 (Phase 2 の限界と将来設計)

現在の RLS は `anon` が自由に INSERT できるため、以下の攻撃は理論上可能です:

- 存在するプロフィール ID (公開されている user_id) を借りて偽スコアを投入
- 3 秒 のレート制限に従いつつ、bot でスコアを積み上げる

対策の優先度と方法:

| 優先度 | 対策 | 実装工数 |
|---|---|---|
| 中 | `_shacho` から怪しい行を目視削除 (`scripts/admin/`) | 30 分 |
| 高 | Supabase Auth (匿名サインイン) に移行し、`auth.uid() = user_id` を RLS で強制 | 4〜6 時間 |
| 参考 | Cloudflare Turnstile / hCaptcha でクライアント検証 | 2〜3 時間 |

Phase 2 での運用中に不正が観測されたら、上表の高優先度案に移行してください。

---

## §11 Phase 3: Supabase Auth 移行 (スコア詐称完全対策)

`§10` の匿名クライアントによる anon INSERT は詐称可能でしたが、本セクションで
**Supabase Auth のセッションに紐付いた `auth.uid()` を強制**し、詐称を完全遮断します。

### 何が変わるか

| 項目 | Before (§10) | After (§11) |
|---|---|---|
| 認証 | localStorage 完結 (SHA-256) | Supabase Auth (Email+Password、内部は fake email 変換) |
| ユーザー ID | クライアント生成 UUID | サーバ発行 `auth.uid()` |
| `public_profiles` INSERT | 誰でも可 (id 自由) | `authenticated` のみ、`id = auth.uid()` 強制 |
| `quiz_scores` INSERT | 誰でも可 (user_id 自由) | `authenticated` のみ、`user_id = auth.uid()` 強制 |
| 詐称可否 | 可 | 不可 (署名済み JWT ベース) |
| セッション永続化 | Zustand persist | Supabase Auth SDK (`ramen-quiz:supabase-auth`) |
| ログイン UX | ユーザー名+パスワード | 変更なし (見た目は同じ) |

### fake email 変換について

Supabase Auth は Email 必須ですが、本サービスは個人情報を扱わない方針のため、
ユーザー名から `sha256(username)` を計算して `<hex32>@example.com` を生成し、
Supabase Auth の Email として使います。

**ドメインに `example.com` を使う理由**: 
- IANA が保有し RFC 2606 で「documentation only」に予約された特殊ドメイン
- 誰にも配送されない (万一 Confirm email が誤って ON になっても実害なし)
- Supabase の recent email validator が `.internal` `.test` `.local` などの
  「配送不可 TLD」を "invalid" として弾く仕様に対応するための選択

### 社長作業 1: Supabase ダッシュボード設定

1. Supabase Dashboard → **Authentication** → **Providers** → **Email**
2. **「Confirm email」を OFF** にする (fake email には送信できないため必須)
3. 「Enable Sign ups」は ON のまま
4. **Authentication** → **URL Configuration** → Site URL は本番ドメイン
   (例: `https://ramen-quiz-ten.vercel.app`) を設定 (未設定でも Auth は動くが警告が出る)
5. **Authentication** → **Rate Limits** はデフォルトのままで OK

### 社長作業 2: SQL 実行 (RLS 強化)

Supabase SQL Editor で以下を 1 度だけ実行:

```sql
-- ==========================================
-- §10 の緩い anon ポリシーを削除
-- ==========================================
DROP POLICY IF EXISTS "anon_profiles_insert" ON public_profiles;
DROP POLICY IF EXISTS "anon_profiles_update" ON public_profiles;
DROP POLICY IF EXISTS "anon_scores_insert" ON quiz_scores;

-- ==========================================
-- §11 の厳格な authenticated 専用ポリシー
-- ==========================================
-- public_profiles: authenticated のみが INSERT/UPDATE 可能。
-- id は必ず auth.uid() と一致すること (詐称防止の要)。
CREATE POLICY "auth_profiles_insert" ON public_profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid()::text = id);

CREATE POLICY "auth_profiles_update" ON public_profiles
  FOR UPDATE TO authenticated
  USING (auth.uid()::text = id)
  WITH CHECK (auth.uid()::text = id);

-- quiz_scores: authenticated のみが INSERT 可能。
-- user_id は必ず auth.uid() と一致すること。
CREATE POLICY "auth_scores_insert" ON quiz_scores
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid()::text = user_id);

-- SELECT ポリシーは §10 のまま (誰でも閲覧可、ランキング表示のため)。
-- DELETE / UPDATE を quiz_scores に対して定義しないため、
-- ユーザーが過去のスコアを改ざん・削除することも不可能。

-- ==========================================
-- §10 で登録された「認証なしプロフィール/スコア」の掃除 (任意)
-- ==========================================
-- Phase 3 移行前に §10 の緩い RLS で登録されたレガシー行がある場合、
-- auth.users に対応する行が無いはずなので削除する。
-- 本番運用開始前の空 DB なら不要。既にデータがあるなら影響を確認してから実行:
--
-- 削除される行数を先に確認:
--   SELECT COUNT(*) FROM quiz_scores WHERE user_id NOT IN (SELECT id::text FROM auth.users);
--   SELECT COUNT(*) FROM public_profiles WHERE id NOT IN (SELECT id::text FROM auth.users);
--
-- 問題なければ削除:
--   DELETE FROM quiz_scores WHERE user_id NOT IN (SELECT id::text FROM auth.users);
--   DELETE FROM public_profiles WHERE id NOT IN (SELECT id::text FROM auth.users);
```

### 移行時のユーザー影響

- **旧 localStorage で登録済みだったユーザー**: 次回サイト訪問時に自動でログアウトされ、
  再サインアップが必要になります。フロント側 (`authStore.syncFromSession`) が
  レガシーセッションを検出してクリアします。
- **旧ランキングデータ**: `§10` 時代に貯まった `quiz_scores` と `public_profiles` は、
  上の「任意クリーンアップ SQL」を実行すると消えます。実行しなければ残ります (ただし
  誰もログインできない孤児行のまま)。
- **お気に入り / 間違えた問題**: localStorage 完結なので影響なし。
- **写真クイズ投稿 (user_photo_questions)**: `submitter_id` 参照は変更していない
  ため、既存投稿はそのまま閲覧・回答可能。ただし新規投稿の `submitter_id` は
  `auth.uid()` になります。

### 確認方法

1. `.env.local` / Vercel Environment Variables を再確認 (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY が正しいこと)
2. サイトを開いて、旧ユーザーが自動ログアウトされていること
3. **新規サインアップ**: ユーザー名 / パスワード / 都道府県 / 好きな店を入れて登録 → 成功
4. Supabase Dashboard → **Authentication** → **Users** に `<hex>@example.com` の
   ユーザーが 1 行追加されていること
5. Table Editor → `public_profiles` に対応する行が入っていること (id は auth.users.id と一致)
6. クイズを 1 回プレイ → Table Editor → `quiz_scores` に user_id = auth.uid() の行が入ること
7. **試行: 別ユーザーで登録 → ログイン → プレイ → ランキングに 2 人並ぶこと**
8. **試行: 開発者コンソールで無関係な user_id を混ぜて INSERT を叩く → RLS ポリシー違反で拒否されること (詐称遮断確認)**

### 詐称試行のテスト例 (ブラウザ Console)

```javascript
// 認証済みユーザーとして、自分ではない user_id でスコア INSERT を試みる
// 期待: RLS ポリシーで REJECT される
const client = /* Supabase client を取得 */;
await client.from('quiz_scores').insert({
  id: 'test-forge',
  user_id: 'someone-elses-uuid',
  quiz_type: 'knowledge',
  category: 'basic',
  score: 999999,
  correct_count: 10,
  total_count: 10,
});
// → error: new row violates row-level security policy for table "quiz_scores"
```

### まとめ: Phase 3 で何を防げるか

- ✅ 他ユーザーの user_id で偽スコアを投入すること
- ✅ 他ユーザーのプロフィールを勝手に書き換えること
- ✅ 誰も見張っていない裏口 INSERT
- ⚠️ 一方で「自分自身の user_id でボットが繰り返しプレイ」は防げない
  (これは §10 のレート制限トリガーがカバー、必要なら Turnstile 等を追加)

---

## §12 SELECT ポリシー修正 (Phase 3 デプロイ後の必須パッチ)

§10 で作った SELECT ポリシーは `TO anon` に限定されており、Phase G で全ユーザーが
`authenticated` ロールになった後は SELECT が全て弾かれてランキングが空表示になる問題があります。

**症状**:
- ログイン後に `/ranking` を開くと「まだスコアの記録がありません」と表示され、
  Supabase Dashboard 上では `public_profiles` / `quiz_scores` に行があるのに反映されない
- ブラウザの Network タブで `quiz_ranking` の SELECT が空配列を返している
- Supabase の Logs で `permission denied` は出ないが、RLS でフィルタされて 0 件になっている

**修正 SQL** (SQL Editor で 1 度だけ実行):

```sql
-- ==========================================
-- §12 patch: SELECT を authenticated ユーザーにも許可
-- ==========================================
-- Postgres RLS では anon と authenticated は別ロールで、
-- TO anon ポリシーは authenticated ユーザーには適用されない。
-- INSERT/UPDATE の詐称対策 (auth.uid() = user_id) は §11 のまま維持。
DROP POLICY IF EXISTS "anon_profiles_select" ON public_profiles;
DROP POLICY IF EXISTS "anon_scores_select" ON quiz_scores;

CREATE POLICY "public_profiles_select" ON public_profiles
  FOR SELECT TO public USING (true);

CREATE POLICY "public_scores_select" ON quiz_scores
  FOR SELECT TO public USING (true);
```

`TO public` は Postgres の擬似ロールで「全てのロール」を意味します
(anon + authenticated + service_role 等)。ランキング画面は誰でも見えるべきなので、
SELECT のみ全開放が適切です。INSERT/UPDATE は §11 の厳格ポリシー
(`auth.uid()::text = id/user_id`) が引き続き有効なので詐称は防がれます。

---

## §13 SECURITY DEFINER 関数によるプロフィール作成 (RLS race condition 対策)

Supabase JS の signUp/signInWithPassword 完了直後、内部のトークンキャッシュに
新セッションが完全に反映される前に PostgREST への upsert リクエストが発生すると、
JWT が中途半端に付与された状態で INSERT され、RLS の
`WITH CHECK (auth.uid()::text = id)` が失敗する race condition が発生する。

これを回避するため、**サーバ側関数**内で `auth.uid()` を直接使って
INSERT する方式に切り替える。関数は SECURITY DEFINER で作成し、RLS を bypass する。
呼び出し側 (フロント) は関数に profile 情報だけを渡し、id はサーバが決める。

### 実行 SQL (SQL Editor で 1 度だけ実行)

```sql
CREATE OR REPLACE FUNCTION public.create_public_profile(
  p_username TEXT,
  p_prefecture TEXT,
  p_favorite_shop TEXT
) RETURNS public_profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid TEXT;
  new_row public_profiles;
BEGIN
  -- JWT から呼び出し元の user id を取得。未認証ならエラー。
  v_uid := auth.uid()::text;
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING HINT = 'JWT が付与されていません';
  END IF;

  -- 引数バリデーション (フロント側と多重防御)
  IF p_username IS NULL OR char_length(trim(p_username)) < 1 OR char_length(p_username) > 40 THEN
    RAISE EXCEPTION 'invalid_username: length must be 1-40';
  END IF;
  IF p_prefecture IS NULL OR char_length(p_prefecture) < 2 OR char_length(p_prefecture) > 8 THEN
    RAISE EXCEPTION 'invalid_prefecture: length must be 2-8';
  END IF;
  IF p_favorite_shop IS NULL
     OR char_length(trim(p_favorite_shop)) < 1
     OR char_length(p_favorite_shop) > 100 THEN
    RAISE EXCEPTION 'invalid_favorite_shop: length must be 1-100';
  END IF;

  -- auth.uid() を id に使って upsert。SECURITY DEFINER なので RLS bypass。
  INSERT INTO public_profiles (id, username, prefecture, favorite_shop)
  VALUES (v_uid, trim(p_username), p_prefecture, trim(p_favorite_shop))
  ON CONFLICT (id) DO UPDATE
    SET username = EXCLUDED.username,
        prefecture = EXCLUDED.prefecture,
        favorite_shop = EXCLUDED.favorite_shop,
        updated_at = NOW()
  RETURNING * INTO new_row;

  RETURN new_row;
END;
$$;

-- デフォルトで PUBLIC (全ロール) に EXECUTE 権が付くのを剥がし、
-- authenticated (ログイン中ユーザー) のみに絞る。
REVOKE ALL ON FUNCTION public.create_public_profile(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_public_profile(TEXT, TEXT, TEXT) TO authenticated;
```

### なぜこれで race を防げるか

- **id はサーバ側で `auth.uid()` から確定**されるので、クライアントから id を渡さない。
  つまり「クライアントが持つ id とサーバが認識する auth.uid() がずれる」問題が起きない。
- **SECURITY DEFINER なので INSERT が RLS を通過**する必要がなくなる (関数の owner 権限で INSERT)。
  RLS ポリシー §11 は残しつつ、正規のプロフィール作成はこの関数だけを経路にする。
- **JWT が未付与なら関数の最初で `not_authenticated` を投げる**ので、
  「原因不明の RLS violation」ではなく「明示的な未認証エラー」で早期失敗する。
- **INSERT/UPDATE の RLS ポリシー (§11) は削除しない**。関数を経由しない直 INSERT を
  引き続き authenticated のみに限定し、詐称対策も維持される。

---

## §14 4 カテゴリ別ベストスコアランキング (quiz_best_scores)

これまでのランキングは `quiz_scores` の SUM (総合スコア) で並べていたが、以下に変更:

- **カテゴリ別ベストスコア** で並べる (プレイ回数の多い人が有利にならない)
- **4 種類のランキング**: 知識初級 / 知識中級 / 知識上級 / 写真当て
- **新記録が出た時だけ更新** される (updated_at で達成日時を保持)
- **フロント UI はドロップダウン**で 4 種類を切り替え

### 実行 SQL (SQL Editor で 1 度だけ実行)

```sql
-- ==========================================
-- ベストスコアテーブル
-- ==========================================
CREATE TABLE IF NOT EXISTS quiz_best_scores (
  user_id          TEXT NOT NULL REFERENCES public_profiles(id) ON DELETE CASCADE,
  ranking_category TEXT NOT NULL CHECK (ranking_category IN ('basic','regional','expert','photo')),
  best_score       INTEGER NOT NULL CHECK (best_score >= 0 AND best_score <= 10000),
  correct_count    INTEGER NOT NULL CHECK (correct_count >= 0),
  total_count      INTEGER NOT NULL CHECK (total_count > 0 AND total_count <= 100),
  achieved_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, ranking_category),
  CONSTRAINT correct_le_total_best CHECK (correct_count <= total_count)
);

CREATE INDEX IF NOT EXISTS idx_quiz_best_scores_category_score
  ON quiz_best_scores (ranking_category, best_score DESC, achieved_at ASC);

ALTER TABLE quiz_best_scores ENABLE ROW LEVEL SECURITY;

-- SELECT: 誰でも閲覧可 (ランキング表示のため)
CREATE POLICY "public_best_scores_select" ON quiz_best_scores
  FOR SELECT TO public USING (true);
-- INSERT / UPDATE は RPC 関数のみを経路にする (直接クライアントからは行わない)

-- ==========================================
-- ベストスコア upsert 関数 (新記録時のみ更新)
-- ==========================================
CREATE OR REPLACE FUNCTION public.record_best_score(
  p_ranking_category TEXT,
  p_score            INTEGER,
  p_correct_count    INTEGER,
  p_total_count      INTEGER
) RETURNS quiz_best_scores
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid   TEXT;
  new_row quiz_best_scores;
BEGIN
  v_uid := auth.uid()::text;
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING HINT = 'JWT が付与されていません';
  END IF;

  IF p_ranking_category NOT IN ('basic','regional','expert','photo') THEN
    RAISE EXCEPTION 'invalid_ranking_category';
  END IF;
  IF p_score IS NULL OR p_score < 0 OR p_score > 10000 THEN
    RAISE EXCEPTION 'invalid_score';
  END IF;
  IF p_correct_count IS NULL OR p_correct_count < 0 THEN
    RAISE EXCEPTION 'invalid_correct_count';
  END IF;
  IF p_total_count IS NULL OR p_total_count <= 0 OR p_total_count > 100 THEN
    RAISE EXCEPTION 'invalid_total_count';
  END IF;
  IF p_correct_count > p_total_count THEN
    RAISE EXCEPTION 'correct_count exceeds total_count';
  END IF;

  -- 新スコアが既存ベストより大きい時のみ UPDATE。等しい/低い時は WHERE 句で弾く。
  INSERT INTO quiz_best_scores (user_id, ranking_category, best_score, correct_count, total_count, achieved_at)
  VALUES (v_uid, p_ranking_category, p_score, p_correct_count, p_total_count, NOW())
  ON CONFLICT (user_id, ranking_category) DO UPDATE
    SET best_score    = EXCLUDED.best_score,
        correct_count = EXCLUDED.correct_count,
        total_count   = EXCLUDED.total_count,
        achieved_at   = EXCLUDED.achieved_at
    WHERE quiz_best_scores.best_score < EXCLUDED.best_score
  RETURNING * INTO new_row;

  -- 新記録が出なかった場合、UPDATE がスキップされ new_row が NULL に。
  -- そのときは既存のベストスコア行を返す (呼び出し側は自分のベストを常に知れる)。
  IF new_row IS NULL THEN
    SELECT * INTO new_row
    FROM quiz_best_scores
    WHERE user_id = v_uid AND ranking_category = p_ranking_category;
  END IF;

  RETURN new_row;
END;
$$;

REVOKE ALL ON FUNCTION public.record_best_score(TEXT, INTEGER, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_best_score(TEXT, INTEGER, INTEGER, INTEGER) TO authenticated;

-- ==========================================
-- ランキング取得ビュー (public_profiles JOIN 済み)
-- ==========================================
CREATE OR REPLACE VIEW quiz_ranking_by_category AS
SELECT
  p.id            AS user_id,
  p.username,
  p.prefecture,
  p.favorite_shop,
  bs.ranking_category,
  bs.best_score,
  bs.correct_count,
  bs.total_count,
  bs.achieved_at
FROM quiz_best_scores bs
INNER JOIN public_profiles p ON p.id = bs.user_id;
```

### フロント側での使い方

- クイズ結果画面到達時に `record_quiz_score(...)` RPC (§15) を呼ぶ
- ランキング画面は `quiz_ranking_by_category` から `ranking_category = 'xxx'` で
  絞ってサーバ側ソート済みで取得 (`ORDER BY best_score DESC, achieved_at ASC` は
  インデックス `idx_quiz_best_scores_category_score` を活用)

---

## §15 スコア記録 RPC (§13 と同じ RLS race 対策)

`quiz_scores` への直 INSERT は §11 の RLS `WITH CHECK (auth.uid()::text = user_id)`
を通過する必要があるが、public_profiles と同様に JWT の伝播タイミング race で
INSERT が RLS で弾かれる問題が発生する。

そのため、プレイ履歴とベストスコア更新をまとめて行う SECURITY DEFINER 関数
`record_quiz_score` を作成し、クライアントは常にこの関数を経由して記録する。

### 実行 SQL (SQL Editor で 1 度だけ実行)

```sql
CREATE OR REPLACE FUNCTION public.record_quiz_score(
  p_quiz_type        TEXT,
  p_category         TEXT,      -- NULL for photo quiz
  p_score            INTEGER,
  p_correct_count    INTEGER,
  p_total_count      INTEGER,
  p_ranking_category TEXT       -- NULL でランキング更新スキップ (復習セッション等)
) RETURNS TEXT                  -- 挿入した quiz_scores.id を返す
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid       TEXT;
  v_score_id  TEXT;
BEGIN
  v_uid := auth.uid()::text;
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING HINT = 'JWT が付与されていません';
  END IF;

  -- validation (フロント側と多重防御)
  IF p_quiz_type NOT IN ('knowledge','photo') THEN
    RAISE EXCEPTION 'invalid_quiz_type';
  END IF;
  IF p_category IS NOT NULL AND p_category NOT IN ('basic','regional','expert') THEN
    RAISE EXCEPTION 'invalid_category';
  END IF;
  IF p_score IS NULL OR p_score < 0 OR p_score > 100000 THEN
    RAISE EXCEPTION 'invalid_score';
  END IF;
  IF p_correct_count IS NULL OR p_correct_count < 0 THEN
    RAISE EXCEPTION 'invalid_correct_count';
  END IF;
  IF p_total_count IS NULL OR p_total_count <= 0 OR p_total_count > 100 THEN
    RAISE EXCEPTION 'invalid_total_count';
  END IF;
  IF p_correct_count > p_total_count THEN
    RAISE EXCEPTION 'correct_count exceeds total_count';
  END IF;
  IF p_ranking_category IS NOT NULL
     AND p_ranking_category NOT IN ('basic','regional','expert','photo') THEN
    RAISE EXCEPTION 'invalid_ranking_category';
  END IF;

  -- 1) プレイ履歴を quiz_scores に INSERT (rate limit トリガーが発火する)
  v_score_id := gen_random_uuid()::text;
  INSERT INTO quiz_scores (
    id, user_id, quiz_type, category, score, correct_count, total_count, played_at
  )
  VALUES (
    v_score_id, v_uid, p_quiz_type, p_category, p_score, p_correct_count, p_total_count, NOW()
  );

  -- 2) rankingCategory 指定時はベストスコアも更新 (新記録時のみ更新)
  IF p_ranking_category IS NOT NULL THEN
    PERFORM public.record_best_score(
      p_ranking_category, p_score, p_correct_count, p_total_count
    );
  END IF;

  RETURN v_score_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_quiz_score(TEXT, TEXT, INTEGER, INTEGER, INTEGER, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_quiz_score(TEXT, TEXT, INTEGER, INTEGER, INTEGER, TEXT) TO authenticated;
```

### 効果

- クライアントから見ると 1 回の RPC で「プレイ履歴保存 + ベストスコア更新」が完結
- INSERT は SECURITY DEFINER なので RLS を bypass → race condition が原理的に発生しない
- JWT 未付与時は `not_authenticated` で明示的に失敗 → 原因が特定できる
- レート制限トリガー (`enforce_quiz_score_rate_limit`) は引き続き作動 (Bot 対策維持)
- §11 の RLS ポリシー (直 INSERT 用) は残しつつ、クライアントは関数経路のみ利用

---

## §16 自分の順位取得 RPC (100 位以下でも末尾表示するため)

ランキング上位 100 位を fetch した結果に自分が含まれていない (= 101 位以下) 場合、
「自分の順位と点数」を末尾に表示するため、サーバ側で順位を計算する RPC を追加。

順位計算ロジック:
- 「自分の best_score より高いスコアを持つ人の数」+「同点だが自分より先に達成した人の数」+ 1
- ORDER BY best_score DESC, achieved_at ASC のタイブレークと同じ

### 実行 SQL (SQL Editor で 1 度だけ実行)

```sql
CREATE OR REPLACE FUNCTION public.get_my_ranking(
  p_ranking_category TEXT
) RETURNS TABLE (
  my_rank       INTEGER,
  username      TEXT,
  prefecture    TEXT,
  favorite_shop TEXT,
  best_score    INTEGER,
  correct_count INTEGER,
  total_count   INTEGER,
  achieved_at   TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid TEXT;
BEGIN
  v_uid := auth.uid()::text;
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING HINT = 'JWT が付与されていません';
  END IF;
  IF p_ranking_category NOT IN ('basic','regional','expert','photo') THEN
    RAISE EXCEPTION 'invalid_ranking_category';
  END IF;

  RETURN QUERY
  SELECT
    -- 自分より上位の人数 + 1 = 自分の順位
    (
      SELECT COUNT(*)::INTEGER + 1
      FROM quiz_best_scores AS other
      WHERE other.ranking_category = p_ranking_category
        AND (
          other.best_score > my.best_score
          OR (other.best_score = my.best_score AND other.achieved_at < my.achieved_at)
        )
    ) AS my_rank,
    p.username,
    p.prefecture,
    p.favorite_shop,
    my.best_score,
    my.correct_count,
    my.total_count,
    my.achieved_at
  FROM quiz_best_scores AS my
  INNER JOIN public_profiles p ON p.id = my.user_id
  WHERE my.user_id = v_uid AND my.ranking_category = p_ranking_category;
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_ranking(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_ranking(TEXT) TO authenticated;
```

### 返却値

- 該当カテゴリで一度もプレイしていない場合: 0 行 (フロント側で null 扱い)
- 一度でもプレイして quiz_best_scores に行がある場合: 1 行 (my_rank + プロフィール情報 + ベストスコア詳細)

---

## §17 写真投稿の RLS を authenticated 対応に (§12 と同じパッチ)

§3〜§4 で作った `user_photo_questions` と `storage.objects` (photo-quiz-user バケット)
の RLS ポリシーは `TO anon` に限定されていた。Phase G (§11) で全ユーザーが
`authenticated` ロールになった後、これらのポリシーは適用されず、写真投稿時に
「new row violates row-level security policy」エラーが発生する。

§12 で `public_profiles` / `quiz_scores` の SELECT を修正したのと同じパターン。

### 実行 SQL (SQL Editor で 1 度だけ実行)

```sql
-- ==========================================
-- user_photo_questions テーブル
-- ==========================================
DROP POLICY IF EXISTS "anon_select" ON user_photo_questions;
DROP POLICY IF EXISTS "anon_insert" ON user_photo_questions;

CREATE POLICY "public_photo_questions_select" ON user_photo_questions
  FOR SELECT TO public USING (true);

CREATE POLICY "public_photo_questions_insert" ON user_photo_questions
  FOR INSERT TO public WITH CHECK (true);

-- ==========================================
-- Storage: photo-quiz-user バケット
-- ==========================================
DROP POLICY IF EXISTS "anon_storage_select" ON storage.objects;
DROP POLICY IF EXISTS "anon_storage_insert" ON storage.objects;

CREATE POLICY "public_storage_select" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'photo-quiz-user');

CREATE POLICY "public_storage_insert" ON storage.objects
  FOR INSERT TO public WITH CHECK (bucket_id = 'photo-quiz-user');
```

### 効果

- ログイン中ユーザー (`authenticated`) からの Storage アップロード + DB INSERT が通る
- 未ログインユーザー (`anon`) も引き続きアップロード可能 (元設計と互換)
- UPDATE / DELETE ポリシーは未作成のままなので改ざん・削除は不可
- 既存の CHECK 制約 (バケット MIME・サイズ、DB CHECK) とレート制限トリガーは維持
- ~~詳細な詐称対策 (submitter_id = auth.uid() 強制など) は将来 SECURITY DEFINER 関数化して
  §13 / §15 と同じ方式に統一する予定 (現状はフロント検証 + レート制限で抑制)~~
  → **§24 で解消済み**。INSERT ポリシー側で `submitter_id = auth.uid() のユーザー名` を
  強制する方式を採り、関数化は不要になった。この節の `WITH CHECK (true)` は §24 で破棄される

## §18 通報機能の RLS を authenticated 対応に (§17 と同じパッチ)

§11 で作った `content_reports` テーブルの INSERT ポリシーは `TO anon` に限定されていた。
Phase G 以降のログイン中ユーザーは `authenticated` ロールなので、そのままだと
通報ボタンから送信しても「new row violates row-level security policy」で失敗する。

写真クイズカード右下の「⚠ この問題を通報」から通報を成立させるために必要なパッチ。

### 前提: §11 の `content_reports` テーブルが未作成なら、先に §11 の SQL を実行すること

`SELECT to_regclass('public.content_reports');` が NULL を返す場合は §11 未実行。

### 実行 SQL (SQL Editor で 1 度だけ実行)

```sql
-- ==========================================
-- content_reports の INSERT を public に開放
-- ==========================================
DROP POLICY IF EXISTS "anon_reports_insert" ON content_reports;

CREATE POLICY "public_reports_insert" ON content_reports
  FOR INSERT TO public WITH CHECK (true);
```

### 効果

- ログイン中ユーザー / 未ログインユーザー双方から通報 INSERT が通る
- SELECT ポリシーは未作成のままなので、通報一覧の閲覧は Service Role Key 必須 (社長専用) を維持
- 重複通報 (UNIQUE 制約なし) の設計は §11 のまま。集計で優先対応判断に使う

### 動作確認

1. `/quiz/photo/play` で 1 問プレイ (回答済み or 未回答どちらでも通報ボタンは出る)
2. カード右下「⚠ この問題を通報」→ モーダルが開く
3. 理由を選び (任意で補足)、「通報する」→ トースト「通報を受け付けました...」
4. Supabase Dashboard → Table Editor → `content_reports` に行が追加されていること

### 通報集計 SQL (社長用)

```sql
-- 通報が多い問題 TOP 10
SELECT
  cr.question_id,
  q.shop_info->>'name' AS shop_name,
  COUNT(*) AS report_count,
  ARRAY_AGG(DISTINCT cr.reason) AS reasons,
  MAX(cr.created_at) AS latest_report
FROM content_reports cr
LEFT JOIN user_photo_questions q ON q.id = cr.question_id
GROUP BY cr.question_id, q.shop_info->>'name'
ORDER BY report_count DESC, latest_report DESC
LIMIT 10;
```

## §19 通報 N 件超えた問題の自動非表示化 【廃止 — §20 に置換】

**⚠️ このセクションは §20 で置換されました。§20 の SQL を実行すればトリガーは自動削除されます。**

理由: 3 件の通報 (同一人物が 3 回クリックしても発火) で即非表示になる設計は乱用リスクが高く、
「すぐには非表示にせず、管理者が判断する」方針に変更しました。

is_hidden カラム自体は §20 でも引き続き使用します (社長判断で手動 UPDATE)。

---

`content_reports` に一定数以上の通報が集まった写真クイズを自動的に非表示にする仕組み。
フロント側 (`supabasePhotoQuestionRepository`) は全取得系メソッド (findByFilter / findByIds /
findBySubmitterId) で `is_hidden = false` を条件に加える。DB 側はトリガーで自動更新するので
アプリからは何も操作しなくて良い。

### 前提

- §11 で `content_reports` テーブルが作成済みであること
- §18 で `content_reports` の INSERT が `TO public` に開放済みであること

### 閾値

- **N = 3 件** (SQL 関数内の定数 `hide_threshold` で変更可能)
- 通報理由 (`privacy` / `copyright` など) による差別化はしない (MVP 方針)
  - 深刻な違反は 1 件目でも即座に社長判断で `is_hidden = true` に手動更新可能
  - 将来的に「privacy / copyright は 1 件で非表示」といった段階的しきい値を導入する余地あり

### 実行 SQL (SQL Editor で 1 度だけ実行)

```sql
-- ==========================================
-- 1. is_hidden カラムを追加
-- ==========================================
ALTER TABLE user_photo_questions
  ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN NOT NULL DEFAULT false;

-- 表示中の問題を高速取得するための部分インデックス
CREATE INDEX IF NOT EXISTS idx_user_photo_questions_visible
  ON user_photo_questions (created_at DESC)
  WHERE is_hidden = false;

-- ==========================================
-- 2. トリガー関数: 通報が閾値超えたら自動非表示
-- ==========================================
-- SECURITY DEFINER: content_reports の INSERT を実行する権限しか持たない
-- ロール (anon / authenticated) からトリガーが起動されるため、UPDATE 権限を
-- 関数オーナー (postgres) の権限で実行する必要がある。
CREATE OR REPLACE FUNCTION auto_hide_reported_photo_question()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  -- 通報 N 件で自動非表示。調整するならここを変える。
  hide_threshold INT := 3;
  current_count INT;
BEGIN
  SELECT COUNT(*) INTO current_count
    FROM content_reports
    WHERE question_id = NEW.question_id;

  IF current_count >= hide_threshold THEN
    -- 既に is_hidden = true なら UPDATE をスキップ (行ロック削減)
    UPDATE user_photo_questions
      SET is_hidden = true
      WHERE id = NEW.question_id AND is_hidden = false;
  END IF;

  RETURN NEW;
END;
$$;

-- ==========================================
-- 3. トリガー: content_reports の AFTER INSERT で発火
-- ==========================================
DROP TRIGGER IF EXISTS trg_auto_hide_reported_photo_question ON content_reports;
CREATE TRIGGER trg_auto_hide_reported_photo_question
  AFTER INSERT ON content_reports
  FOR EACH ROW
  EXECUTE FUNCTION auto_hide_reported_photo_question();
```

### 効果

- 通報が 3 件集まった問題は次のクエリから自動的に消える
- クエリ側 (フロント): `.eq('is_hidden', false)` を全取得メソッドで指定済み
- 通報者側の UI 挙動は変わらない (トーストで受付通知)
- 投稿者の My Page からも消える (「なぜ消えたか」の通知は将来課題)
- DB 上には行が残るので、社長判断で復活可能 (下記コマンド)

### 社長判断で復活・削除する

```sql
-- 特定問題を復活 (非表示解除)
UPDATE user_photo_questions SET is_hidden = false WHERE id = '<question_uuid>';

-- 特定問題を完全削除 (§10 の delete_user_question.ts と同じ効果、SQL で直接)
DELETE FROM user_photo_questions WHERE id = '<question_uuid>';

-- 現在自動非表示になっている問題一覧
SELECT
  q.id,
  q.shop_info->>'name' AS shop_name,
  q.created_at AS submitted_at,
  COUNT(cr.id) AS report_count,
  ARRAY_AGG(DISTINCT cr.reason) AS reasons
FROM user_photo_questions q
LEFT JOIN content_reports cr ON cr.question_id = q.id
WHERE q.is_hidden = true
GROUP BY q.id, q.shop_info->>'name', q.created_at
ORDER BY q.created_at DESC;

-- 特定問題を 1 件目の通報でも非表示化したい場合 (privacy / copyright 等)
UPDATE user_photo_questions SET is_hidden = true WHERE id = '<question_uuid>';
```

### 動作確認

1. 何か 1 問投稿する (`_shacho` 以外のユーザーで)
2. 別ブラウザ (シークレット) で 3 つの異なるアカウントを作って、同じ問題に通報を 3 回入れる
   - あるいは SQL Editor で直接 3 行 INSERT: `INSERT INTO content_reports (question_id, reason) VALUES ('<uuid>', 'other'), ('<uuid>', 'other'), ('<uuid>', 'other');`
3. `SELECT is_hidden FROM user_photo_questions WHERE id = '<uuid>';` → `true` になっている
4. `/quiz/photo/play` にアクセス → 該当問題が表示ローテーションから消えている
5. 社長判断で復活: `UPDATE user_photo_questions SET is_hidden = false WHERE id = '<uuid>';`
6. 再度 `/quiz/photo/play` → 復活している

### 制限事項 (MVP スコープ外)

- 通報者の重複チェックなし (`content_reports` に `reporter_id` カラムがないため) — 悪意ある同一ユーザーによる連投で不当に非表示化される可能性
- 通報理由による段階的しきい値の差別化なし (privacy / copyright も一律 3 件)
- 投稿者への非表示化通知なし
- 一定期間経過後の自動復活なし

これらは実運用で問題が起きた時点で追加検討する。

## §20 通報者の識別・重複防止・レート制限ブロック (§19 を置換)

§19 の自動非表示トリガーを廃止し、代わりに以下を導入する:

1. **通報にはログイン必須** — `content_reports.reporter_id` を必須化 (auth.uid())
2. **重複通報の防止** — 同じ人が同じ問題を複数回通報しても DB 上は 1 件のみ (UNIQUE)
3. **通報者レート制限** — 24 時間で 5 件以上通報したユーザーを `reporter_blocks` に登録
4. **ブロック効果**:
   - RLS で通報 INSERT を拒否
   - フロントで写真クイズ画面自体をブロック (プレイ不可)
5. **自動非表示は廃止** — 通報は蓄積されるだけ。社長が下記 SQL でレビューして手動で `is_hidden = true` にする

### 前提

- §18 で `content_reports` テーブルが存在すること
- (§19 未実施でも OK。この §20 の SQL は is_hidden カラム作成も含めて自己完結)

### 実行 SQL (SQL Editor で 1 度だけ実行)

```sql
-- ==========================================
-- 0. is_hidden カラム (§19 で紹介したもの)。§20 でも「管理者が手動で非表示化」
--    する用途で使い続ける。§19 未実施の環境でも動くよう §20 内で作成する。
-- ==========================================
ALTER TABLE user_photo_questions
  ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_user_photo_questions_visible
  ON user_photo_questions (created_at DESC)
  WHERE is_hidden = false;

-- ==========================================
-- 1. §19 の自動非表示トリガーを削除 (存在しない環境では NO-OP)
-- ==========================================
DROP TRIGGER IF EXISTS trg_auto_hide_reported_photo_question ON content_reports;
DROP FUNCTION IF EXISTS auto_hide_reported_photo_question();

-- ==========================================
-- 2. content_reports に reporter_id を追加
-- ==========================================
-- auth.users への FK。ユーザー削除時は SET NULL (通報履歴は残す)。
ALTER TABLE content_reports
  ADD COLUMN IF NOT EXISTS reporter_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 同じ人が同じ問題を複数回通報するのを DB 側で拒否 (UNIQUE 制約)
-- reporter_id が NULL の既存レガシー行 (もしあれば) は複数許容 (NULL != NULL の PG 仕様)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_content_reports_reporter_question
  ON content_reports (reporter_id, question_id);

-- ==========================================
-- 3. 通報者ブロックテーブル
-- ==========================================
CREATE TABLE IF NOT EXISTS reporter_blocks (
  reporter_id       UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reason            TEXT,
  auto_report_count INT
);

ALTER TABLE reporter_blocks ENABLE ROW LEVEL SECURITY;

-- 自分のブロック状態のみ SELECT 可 (フロントで判定するため)。
-- 他人のブロック状態は見えない。管理者は Service Role Key で閲覧。
DROP POLICY IF EXISTS "self_read_own_block" ON reporter_blocks;
CREATE POLICY "self_read_own_block" ON reporter_blocks
  FOR SELECT TO authenticated
  USING (reporter_id = auth.uid());

-- ==========================================
-- 4. content_reports の INSERT ポリシー差し替え
--    自分の auth.uid() でしか INSERT できず、ブロック中は拒否される。
-- ==========================================
DROP POLICY IF EXISTS "public_reports_insert" ON content_reports;
DROP POLICY IF EXISTS "anon_reports_insert" ON content_reports;
DROP POLICY IF EXISTS "authenticated_reports_insert" ON content_reports;

CREATE POLICY "authenticated_reports_insert" ON content_reports
  FOR INSERT TO authenticated
  WITH CHECK (
    reporter_id = auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM reporter_blocks
        WHERE reporter_id = auth.uid()
    )
  );

-- ==========================================
-- 5. レート制限トリガー: 24h で 5 件以上通報 → 自動ブロック
--    (この値は関数内定数で調整可能)
-- ==========================================
CREATE OR REPLACE FUNCTION check_reporter_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  -- チューニング可能な閾値。運用で調整するならここを変える。
  window_hours INT := 24;
  max_reports  INT := 5;
  recent_count INT;
BEGIN
  -- 匿名通報 (万一混入した場合) はスキップ
  IF NEW.reporter_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- 過去 window_hours 時間の同一 reporter からの通報数を数える
  -- (この関数は AFTER INSERT なので今回の行も含まれる)
  SELECT COUNT(*) INTO recent_count
    FROM content_reports
    WHERE reporter_id = NEW.reporter_id
      AND created_at >= NOW() - (window_hours || ' hours')::interval;

  IF recent_count >= max_reports THEN
    INSERT INTO reporter_blocks (reporter_id, reason, auto_report_count)
      VALUES (
        NEW.reporter_id,
        FORMAT('excessive_reports: %s in %sh', recent_count, window_hours),
        recent_count
      )
      ON CONFLICT (reporter_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_reporter_rate_limit ON content_reports;
CREATE TRIGGER trg_check_reporter_rate_limit
  AFTER INSERT ON content_reports
  FOR EACH ROW
  EXECUTE FUNCTION check_reporter_rate_limit();
```

### 効果

- **1 件目の通報では何も起きない** (蓄積のみ)。以前のような即非表示はない
- 通報の重複はDB側で防がれる (`23505 unique_violation` → フロントで「既に通報済み」表示)
- 24h で 5 件超えた通報者は次回以降の通報 INSERT が RLS でリジェクトされる
- 写真クイズ画面自体をフロントでゲート (詳細後述の PhotoQuiz.tsx / PhotoQuizPlay.tsx の実装)
- 社長は下記 SQL でレビュー・対応する

### 社長の運用 SQL

#### 通報の多い問題を確認 (優先対応判断)

```sql
SELECT
  cr.question_id,
  q.shop_info->>'name' AS shop_name,
  COUNT(DISTINCT cr.reporter_id) AS unique_reporters,
  ARRAY_AGG(DISTINCT cr.reason) AS reasons,
  MAX(cr.created_at) AS latest_report,
  q.is_hidden
FROM content_reports cr
LEFT JOIN user_photo_questions q ON q.id = cr.question_id
WHERE cr.reporter_id IS NOT NULL
GROUP BY cr.question_id, q.shop_info->>'name', q.is_hidden
HAVING COUNT(DISTINCT cr.reporter_id) >= 2
ORDER BY unique_reporters DESC, latest_report DESC;
```

#### 手動で問題を非表示化

```sql
UPDATE user_photo_questions SET is_hidden = true WHERE id = '<question_uuid>';
```

#### 通報乱用でブロックされたユーザーを解除

```sql
-- 現在ブロック中のユーザー一覧
SELECT rb.reporter_id, p.username, rb.blocked_at, rb.reason, rb.auto_report_count
FROM reporter_blocks rb
LEFT JOIN public_profiles p ON p.user_id = rb.reporter_id
ORDER BY rb.blocked_at DESC;

-- 特定ユーザーのブロックを解除
DELETE FROM reporter_blocks WHERE reporter_id = '<user_uuid>';
```

### 動作確認

1. アカウント A で `/quiz/photo/play` にアクセス → 1 問プレイ → 通報ボタンから通報 → トースト表示
2. 同じ問題をもう一度通報しようとする → 「既に通報済み」エラー表示
3. アカウント A で異なる問題を計 5 件通報 (24h 以内)
4. アカウント A で `/quiz/photo` にアクセス → ブロック画面が表示され、プレイできない
5. 社長が SQL で `DELETE FROM reporter_blocks WHERE reporter_id = '<a_uuid>';`
6. アカウント A で `/quiz/photo` → 再度プレイ可能

---

## §21 ユーザー名の一意性を DB で保証する

### 背景: 何が守られていて、何が守られていなかったか

Phase 3 (§11) 以降、ユーザー名は `sha256(usernameKey)` から作った fake email として
`auth.users.email` に入る。email は Supabase Auth 側で UNIQUE なので、
**同じユーザー名での新規登録は結果的に弾かれていた**。

ただし次の穴が残っていた:

| 穴 | 何が起きるか |
|---|---|
| `public_profiles.username` に一意制約が無い | `create_public_profile` を直接叩けば他人と同名のプロフィールを作れる |
| `isUsernameTaken` の `ilike` が `_` をワイルドカード扱い | `a_b` が `axb` にマッチし「使われていない名前を使用中」と誤判定 |
| 事前チェックと登録の間に race | 同時登録で両方が事前チェックを通過し得た (最終的には Auth 側で片方が失敗) |
| 正規化のズレ | `ＲＡＭＥＮ` と `ramen` は Auth では同一、`public_profiles` では別扱い |

`username` は写真投稿の `submitter_id` にも使われる (`SubmissionsSection`) ため、
重複すると**投稿履歴が混ざる**。DB 側で一意にしておく必要がある。

### ユーザー名の規則 (確定)

| 項目 | 規則 |
|---|---|
| 長さ | **3〜20 文字** (前後空白を除去し NFKC 正規化した後の文字数) |
| 使用可能 | 半角英数字 `A-Z a-z 0-9`、`_`、`-`、ひらがな、カタカナ (長音符 `ー`・`ヶ` を含む)、漢字、`々` `〆` `〇` |
| 使用不可 | 空白、`_` `-` 以外の記号、絵文字、制御文字 |
| 正規化 | 前後空白除去 → **NFKC** → その値を保存 (全角英数は半角に、半角カナは全角に畳まれる) |
| 一意性 | `lower(NFKC(username))` で一意。**大文字小文字・全角半角を区別しない** |
| 予約語 | `_shacho` `admin` `administrator` `root` `support` `official` `system` `運営` `管理者` |
| 変更 | **不可** (fake email の材料なので、変更するとログインできなくなる) |

フロント側の実装は `src/lib/validation.ts` の `validateUsername` / `normalizeUsername` /
`usernameKey` が単一のソースオブトゥルース。`fakeEmail.ts` と `localAuthRepository.ts` も
この 3 関数を経由するので、規則を変えるときは `validation.ts` だけを直せばよい。

### 実行 SQL (SQL Editor で 1 度だけ実行)

```sql
-- ==========================================
-- 1. 既存の重複を洗い出す (行が返ったら先に手当てが必要)
-- ==========================================
SELECT lower(normalize(username, NFKC)) AS username_key,
       count(*) AS n,
       array_agg(id) AS ids
FROM public_profiles
GROUP BY 1
HAVING count(*) > 1;
-- ↑ 行が返る場合は、どれを残すか決めて他方の username を変更するか行を削除してから次へ。
--   (例) UPDATE public_profiles SET username = username || '2' WHERE id = '<残さない方のid>';

-- ==========================================
-- 2. 既存行の保存値を NFKC 正規化に揃える
-- ==========================================
UPDATE public_profiles
SET username = btrim(normalize(username, NFKC))
WHERE username IS DISTINCT FROM btrim(normalize(username, NFKC));

-- ==========================================
-- 3. 一意インデックスを張る (これが本丸)
--    normalize() も lower() も IMMUTABLE なので式インデックスに使える。
-- ==========================================
DROP INDEX IF EXISTS idx_public_profiles_username_lower;   -- 非一意の旧インデックスを置換
CREATE UNIQUE INDEX IF NOT EXISTS uq_public_profiles_username_key
  ON public_profiles (lower(normalize(username, NFKC)));

-- ==========================================
-- 4. 長さ制約をフロント (3〜20) に合わせる
--    先に違反行が無いことを確認すること。行が返るなら 3 文字未満/21 文字以上の
--    レガシー行があるので、先に UPDATE で直す。
-- ==========================================
SELECT id, username, char_length(username) AS len
FROM public_profiles
WHERE char_length(username) NOT BETWEEN 3 AND 20;

ALTER TABLE public_profiles DROP CONSTRAINT IF EXISTS public_profiles_username_check;
ALTER TABLE public_profiles ADD CONSTRAINT public_profiles_username_check
  CHECK (char_length(username) BETWEEN 3 AND 20);

-- ==========================================
-- 5. create_public_profile を差し替え
--    - 保存前に NFKC 正規化
--    - 3〜20 文字を強制 (フロントと多重防御)
--    - 他人が同じキーの名前を持っていたら username_taken を投げる
--    - 一意インデックス違反 (23505) も username_taken に翻訳する
-- ==========================================
CREATE OR REPLACE FUNCTION public.create_public_profile(
  p_username TEXT,
  p_prefecture TEXT,
  p_favorite_shop TEXT
) RETURNS public_profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid   TEXT;
  v_name  TEXT;
  v_key   TEXT;
  new_row public_profiles;
BEGIN
  v_uid := auth.uid()::text;
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING HINT = 'JWT が付与されていません';
  END IF;

  -- フロントと同じ正規化 (trim → NFKC)。保存する値そのものを畳む。
  v_name := btrim(normalize(coalesce(p_username, ''), NFKC));
  v_key  := lower(v_name);

  IF char_length(v_name) < 3 OR char_length(v_name) > 20 THEN
    RAISE EXCEPTION 'invalid_username: length must be 3-20';
  END IF;
  IF p_prefecture IS NULL OR char_length(p_prefecture) < 2 OR char_length(p_prefecture) > 8 THEN
    RAISE EXCEPTION 'invalid_prefecture: length must be 2-8';
  END IF;
  IF p_favorite_shop IS NULL
     OR char_length(btrim(p_favorite_shop)) < 1
     OR char_length(p_favorite_shop) > 100 THEN
    RAISE EXCEPTION 'invalid_favorite_shop: length must be 1-100';
  END IF;

  -- 予約語 (フロントの RESERVED_USERNAMES と同じ内容を維持すること)
  IF v_key IN ('_shacho','admin','administrator','root','support','official','system','運営','管理者')
     AND v_key <> '_shacho' THEN
    RAISE EXCEPTION 'reserved_username';
  END IF;

  -- 自分以外が同じキーを既に使っていないか (分かりやすいエラーのための事前判定)
  IF EXISTS (
    SELECT 1 FROM public_profiles
    WHERE lower(normalize(username, NFKC)) = v_key
      AND id <> v_uid
  ) THEN
    RAISE EXCEPTION 'username_taken';
  END IF;

  INSERT INTO public_profiles (id, username, prefecture, favorite_shop)
  VALUES (v_uid, v_name, p_prefecture, btrim(p_favorite_shop))
  ON CONFLICT (id) DO UPDATE
    SET username = EXCLUDED.username,
        prefecture = EXCLUDED.prefecture,
        favorite_shop = EXCLUDED.favorite_shop,
        updated_at = NOW()
  RETURNING * INTO new_row;

  RETURN new_row;

EXCEPTION
  -- 事前判定をすり抜けた同時実行 (race) は一意インデックスが弾く。
  -- そのままだと 23505 の生メッセージが出るので username_taken に翻訳する。
  WHEN unique_violation THEN
    RAISE EXCEPTION 'username_taken';
END;
$$;

REVOKE ALL ON FUNCTION public.create_public_profile(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_public_profile(TEXT, TEXT, TEXT) TO authenticated;
```

> **`_shacho` の扱い**: 予約語チェックで `_shacho` だけ除外しているのは、社長が管理者
> アカウントとして実際に profile を作れるようにするため。一般ユーザーはフロントの
> `validateUsername` で `_shacho` を弾かれるので、この抜け道には到達しない。

### 確認方法

1. アカウント A を `Ramen_Taro` で作成 → 成功
2. 別ブラウザで `ramen_taro` を登録しようとする → 「このユーザー名は既に使われています。」
3. 同じく `Ｒａｍｅｎ＿Ｔａｒｏ` (全角) で登録 → 同じく弾かれる (NFKC で畳まれるため)
4. `a_b` のようにアンダースコアを含む名前が未使用なら登録できる (ilike 誤判定の修正確認)
5. `admin` で登録 → 「このユーザー名は予約されているため使用できません。」
6. 2 文字 / 21 文字で登録 → フロントで弾かれる
7. SQL Editor で一意インデックスの効きを直接確認:
   ```sql
   -- 既存ユーザーと同じキーで別 id を差し込もうとすると 23505 で失敗するはず
   INSERT INTO public_profiles (id, username, prefecture, favorite_shop)
   VALUES ('test-dup', '<既存と同じ名前>', '東京都', 'テスト');
   ```
   → `duplicate key value violates unique constraint "uq_public_profiles_username_key"`
   (確認後 `DELETE FROM public_profiles WHERE id = 'test-dup';` で掃除)

---

## §22 出題時の作成者名表示 (投稿者のオプトイン)

写真当てクイズの出題画面に「作成者: ○○さん」を表示する機能。
**表示は投稿者が明示的に選んだときだけ**行い、既定は非公開とする。

### 何を足すか

`user_photo_questions` に `show_submitter BOOLEAN NOT NULL DEFAULT false` を追加するだけ。
表示名そのものは既存の `submitter_id` (= ユーザー名) を流用する。

- **既定 false**: 既存の投稿はすべて非公開のまま。過去の投稿者は公開に同意していないため、
  後から一括で true にしてはいけない。
- 一括投入スクリプト (`upload_photo_quiz_to_supabase.py`) はこの列を送らないので、
  社長が投入した問題も DEFAULT の false = 非公開になる (`_shacho` が表に出ない)。

### 実行 SQL (SQL Editor で 1 度だけ実行)

```sql
ALTER TABLE user_photo_questions
  ADD COLUMN IF NOT EXISTS show_submitter BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN user_photo_questions.show_submitter IS
  '出題時に submitter_id を作成者名として表示してよいか。投稿者のオプトイン。既定は非公開。';
```

### フロント側の対応 (実装済み)

| 場所 | 内容 |
|---|---|
| `types/photoQuestion.ts` | `PhotoQuestion.submitterName?: string` を追加 |
| `lib/photoQuestionRepository.ts` | `PhotoQuestionSubmission` から `submitterName` を除外し、`showSubmitter: boolean` を追加 |
| `lib/supabasePhotoQuestionRepository.ts` | `show_submitter === true` のときだけ `submitterName` に `submitter_id` を載せる。`select('*')` を明示列指定 `SELECT_COLUMNS` に変更 |
| `pages/PhotoSubmit.tsx` | 「出題時に作成者としてユーザー名を表示する」チェックボックス (既定 OFF) |
| `components/quiz/PhotoQuizCard.tsx` | `submitterName` があるときだけ画像の下に「作成者: ○○ さん」を描画 |

公開可否の判定はリポジトリ層で完結しており、表示側は `submitterName` の有無しか見ない。
非公開の投稿者名が UI に出る経路は構造上作れない。

### ⚠️ 残っていた限界: `submitter_id` 自体は API から読める → **§24 で解消済み**

> **この節の内容は §24 適用前の状態を説明したもの。**
> §24 で公開ビュー `public_photo_questions` に一本化し、
> `show_submitter = false` の `submitter_id` は API からも `null` しか返らなくなった。
> 下記の「選択肢 2 (ビュー経由)」を採用した形。経緯として残す。

`user_photo_questions` の SELECT ポリシーは `FOR SELECT TO public USING (true)` で
**行全体**を公開しているため、`show_submitter = false` でも、Anon Key を使って
PostgREST を直接叩けば `submitter_id` を読み出せる。これは今回の変更で生じたものではなく、
写真投稿機能の当初からの状態。

つまり `show_submitter` が保証するのは **「アプリの画面に出さない」ところまで**であり、
「誰にも知られない」ことまでは保証しない。投稿フォームの文言もその範囲で書いてある
(「出題されたときに表示されます」)。

本当に隠したい場合は、次のいずれかが必要になる (未実施):

1. **列レベル権限**: `REVOKE SELECT (submitter_id) ON user_photo_questions FROM anon, authenticated;`
   ただしマイページの投稿履歴が `submitter_id` で絞り込んでいるため、
   `auth.uid()` からユーザー名を引く SECURITY DEFINER 関数に置き換える必要がある。
2. **ビュー経由に一本化**: `show_submitter` が true のときだけ `submitter_id` を返すビューを作り、
   ベーステーブルへの直接 SELECT を止める。

どちらもマイページ・通報機能に影響が及ぶため、必要になった時点で別タスクとして扱う。

### 確認方法

1. 上の SQL を実行
2. `/quiz/photo/submit` を開く → 「作成者名の表示」セクションが出ており、既定でチェックが外れている
3. チェックを**入れずに**投稿 → `/quiz/photo/play` で出題 → 作成者名が表示されない
4. チェックを**入れて**投稿 → 出題時に画像の下へ「作成者: <自分のユーザー名> さん」が表示される
5. Table Editor で `show_submitter` が期待どおり false / true になっていること
6. 既存の投稿・社長が一括投入した問題では作成者名が出ないこと

---

## §23 復旧コードによるパスワード再設定 (メールアドレス不要)

本サービスはメールアドレスを取得しないため、従来はパスワードを忘れると復旧手段が無かった。
§21 でユーザー名を一意にしたことで「同じ名前で作り直す」逃げ道も塞がったため、
**登録時に一度だけ表示する復旧コード**でパスワードを再設定できるようにする。

個人情報を増やさずに復旧手段を用意することが狙い (社長判断 2026-08-25)。

### 設計の要点

| 論点 | 決めたこと |
|---|---|
| コードの生成場所 | **サーバ (Postgres)**。クライアントに生成させると弱いコードを作られる余地が残る |
| コードの強度 | 32 文字のアルファベットから 20 文字 = **100 bit**。総当たりは非現実的 |
| 使う文字 | `23456789ABCDEFGHJKLMNPQRSTUVWXYZ`。読み間違いを避けるため 0,1,I,O を除外 |
| 保存形式 | **bcrypt ハッシュのみ**。平文は発行時に一度返すだけで DB には残さない |
| 保存場所 | 専用テーブル `account_recovery`。**RLS を有効化してポリシーを1つも作らない** = クライアントからは読めない |
| なぜ public_profiles に置かないか | あのテーブルはランキング用に**全世界から SELECT 可能**。ハッシュを置くとオフライン総当たりの材料になる |
| 使い切り | 再設定に成功したら**新しいコードを発行して返す**。古いコードは無効になる |
| 総当たり対策 | 失敗 5 回で 15 分ロック。成功でカウンタをリセット |
| セッション | 再設定時に既存セッションを破棄し、全端末で再ログインを要求する |

### 承知しておくべきトレードオフ

パスワード変更のため **`auth.users.encrypted_password` を直接 UPDATE する**。
Supabase Auth (GoTrue) は bcrypt で検証するので `crypt(pw, gen_salt('bf'))` で整合するが、
これは Supabase が公式に案内している経路ではない。将来 GoTrue のハッシュ方式が変わった場合、
この関数だけ追随が必要になる (パスワード再設定が急に失敗しだしたらここを疑う)。

正攻法は Service Role Key を持つサーバ側 (Edge Function 等) から `auth.admin.updateUserById`
を呼ぶことだが、本プロジェクトは「Service Role Key をホスティング側に置かない」方針 (§7)
を採っているため、鍵を増やさない SQL 内完結の方式を選んだ。

### 実行 SQL (SQL Editor で 1 度だけ実行)

```sql
-- ==========================================
-- 1. 復旧コード保管テーブル
--    RLS 有効 + ポリシー無し = anon / authenticated からは一切読み書きできない。
--    アクセス経路は下の SECURITY DEFINER 関数だけに限定する。
-- ==========================================
CREATE TABLE IF NOT EXISTS account_recovery (
  user_id         TEXT PRIMARY KEY REFERENCES public_profiles(id) ON DELETE CASCADE,
  code_hash       TEXT NOT NULL,
  failed_attempts INT NOT NULL DEFAULT 0,
  locked_until    TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE account_recovery ENABLE ROW LEVEL SECURITY;
-- ポリシーは意図的に作らない (Postgres の RLS は「ポリシーが無い操作は拒否」が既定)

-- ==========================================
-- 2. 復旧コードを生成する内部関数
--    0,1,I,O を除いた 32 文字から 20 文字。256 は 32 で割り切れるので剰余バイアスなし。
-- ==========================================
CREATE OR REPLACE FUNCTION public.generate_recovery_code()
RETURNS TEXT
LANGUAGE plpgsql
VOLATILE
SET search_path = public
AS $fn$
DECLARE
  v_alphabet CONSTANT TEXT := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  v_bytes    BYTEA;
  v_code     TEXT := '';
  i          INT;
BEGIN
  v_bytes := extensions.gen_random_bytes(20);
  FOR i IN 0..19 LOOP
    v_code := v_code || substr(v_alphabet, (get_byte(v_bytes, i) % 32) + 1, 1);
  END LOOP;
  -- 4 文字ずつ区切って読みやすくする (照合時は区切りを無視する)
  RETURN substr(v_code, 1, 4)  || '-' || substr(v_code, 5, 4)  || '-' ||
         substr(v_code, 9, 4)  || '-' || substr(v_code, 13, 4) || '-' || substr(v_code, 17, 4);
END;
$fn$;

REVOKE ALL ON FUNCTION public.generate_recovery_code() FROM PUBLIC;

-- ==========================================
-- 3. 入力された復旧コードの正規化 (大文字化 + 区切り除去)
-- ==========================================
CREATE OR REPLACE FUNCTION public.normalize_recovery_code(p_code TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $fn$
  SELECT regexp_replace(upper(coalesce(p_code, '')), '[^0-9A-Z]', '', 'g');
$fn$;

-- ==========================================
-- 4. ログイン中ユーザーに復旧コードを発行する
--    サインアップ直後と、マイページからの再発行の両方で使う。
--    戻り値は平文コード。この 1 回しか取得できない。
-- ==========================================
CREATE OR REPLACE FUNCTION public.issue_recovery_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid  TEXT;
  v_code TEXT;
BEGIN
  v_uid := auth.uid()::text;
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public_profiles WHERE id = v_uid) THEN
    RAISE EXCEPTION 'profile_not_found';
  END IF;

  v_code := public.generate_recovery_code();

  INSERT INTO account_recovery (user_id, code_hash, failed_attempts, locked_until, updated_at)
  VALUES (v_uid,
          extensions.crypt(public.normalize_recovery_code(v_code), extensions.gen_salt('bf')),
          0, NULL, NOW())
  ON CONFLICT (user_id) DO UPDATE
    SET code_hash = EXCLUDED.code_hash,
        failed_attempts = 0,
        locked_until = NULL,
        updated_at = NOW();

  RETURN v_code;
END;
$fn$;

REVOKE ALL ON FUNCTION public.issue_recovery_code() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.issue_recovery_code() TO authenticated;

-- ==========================================
-- 5. 復旧コードでパスワードを再設定する (未ログインから呼ぶ)
--    戻り値は新しい復旧コード。古いコードはこの時点で無効。
-- ==========================================
CREATE OR REPLACE FUNCTION public.reset_password_with_recovery_code(
  p_username     TEXT,
  p_code         TEXT,
  p_new_password TEXT
) RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid      TEXT;
  v_rec      account_recovery%ROWTYPE;
  v_input    TEXT;
  v_new_code TEXT;
BEGIN
  IF p_new_password IS NULL OR char_length(p_new_password) < 8 THEN
    RAISE EXCEPTION 'invalid_password';
  END IF;

  -- ユーザー名は §21 と同じキー (trim + NFKC + 小文字) で引く
  SELECT id INTO v_uid
  FROM public_profiles
  WHERE lower(normalize(username, NFKC)) = lower(btrim(normalize(coalesce(p_username,''), NFKC)));

  -- 存在しないユーザー名でも、コード誤りと同じエラーを返す (ユーザー名の存在を漏らさない)
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'invalid_recovery_code';
  END IF;

  SELECT * INTO v_rec FROM account_recovery WHERE user_id = v_uid FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_recovery_code';
  END IF;

  IF v_rec.locked_until IS NOT NULL AND v_rec.locked_until > NOW() THEN
    RAISE EXCEPTION 'recovery_locked:%',
      GREATEST(1, CEIL(EXTRACT(EPOCH FROM (v_rec.locked_until - NOW())))::INT);
  END IF;

  v_input := public.normalize_recovery_code(p_code);

  IF v_rec.code_hash <> extensions.crypt(v_input, v_rec.code_hash) THEN
    UPDATE account_recovery
      SET failed_attempts = failed_attempts + 1,
          locked_until = CASE WHEN failed_attempts + 1 >= 5
                              THEN NOW() + INTERVAL '15 minutes' ELSE locked_until END,
          updated_at = NOW()
      WHERE user_id = v_uid;
    RAISE EXCEPTION 'invalid_recovery_code';
  END IF;

  -- 照合成功。GoTrue は bcrypt で検証するので同じ方式でハッシュを差し替える。
  UPDATE auth.users
    SET encrypted_password = extensions.crypt(p_new_password, extensions.gen_salt('bf')),
        updated_at = NOW()
    WHERE id = v_uid::uuid;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile_not_found';
  END IF;

  -- 全端末のセッションを破棄して再ログインを強制する (盗まれたセッション対策)
  BEGIN
    DELETE FROM auth.refresh_tokens WHERE user_id = v_uid;
    DELETE FROM auth.sessions WHERE user_id = v_uid::uuid;
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    NULL;  -- GoTrue のバージョン差で存在しない場合は無視 (パスワード変更自体は成立)
  END;

  -- 使い切りにするため新しいコードを発行して返す
  v_new_code := public.generate_recovery_code();
  UPDATE account_recovery
    SET code_hash = extensions.crypt(public.normalize_recovery_code(v_new_code), extensions.gen_salt('bf')),
        failed_attempts = 0,
        locked_until = NULL,
        updated_at = NOW()
    WHERE user_id = v_uid;

  RETURN v_new_code;
END;
$fn$;

REVOKE ALL ON FUNCTION public.reset_password_with_recovery_code(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reset_password_with_recovery_code(TEXT, TEXT, TEXT) TO anon, authenticated;
```

### 既存ユーザーへの移行

`account_recovery` に行が無いユーザーは、この時点では復旧コードを持っていない。
**マイページの「復旧コード」セクションから発行してもらう**運用とする (`issue_recovery_code` を呼ぶだけ)。
既存ユーザーに勝手に発行しても本人に渡す手段が無いため、自動生成はしない。

### フロント側の対応 (実装済み)

| 場所 | 内容 |
|---|---|
| `lib/authRepository.ts` | `issueRecoveryCode?` / `resetPasswordWithRecoveryCode?` を任意メソッドとして追加 |
| `lib/supabaseAuthRepository.ts` | 上記 2 つの RPC 呼び出しと、Postgres 側エラーの日本語化 |
| `components/account/RecoveryCodePanel.tsx` | コードの表示・コピー・「控えた」チェックの共通 UI |
| `pages/Signup.tsx` | 登録成功直後にコードを 1 回だけ表示。控えるまで先へ進めない |
| `pages/PasswordReset.tsx` | `/password-reset`。ユーザー名 + 復旧コード + 新パスワード |
| `pages/Login.tsx` | 「パスワードをお忘れの方」リンク |
| `components/mypage/RecoverySection.tsx` | 既存ユーザー向けの発行・再発行 |

### 確認方法

1. 上の SQL を実行
2. 新規サインアップ → 完了画面に 24 桁 (区切り含む) の復旧コードが 1 回だけ表示される
3. Table Editor → `account_recovery` に行が増え、`code_hash` が `$2a$...` の bcrypt 形式であること
4. ログアウト → `/password-reset` でユーザー名 + 復旧コード + 新パスワードを入力 → 成功
5. 成功画面に新しい復旧コードが表示されること
6. 新パスワードでログインできること。旧パスワードではログインできないこと
7. 手順 4 で使った古いコードをもう一度使う → 「復旧コードが正しくありません」
8. わざと 5 回間違える → 「しばらく時間をおいてから」とロック表示
9. アプリの Anon Key からは `account_recovery` が RLS で 0 件になること
   (SQL Editor の社長操作では見える)


---

## §24 `submitter_id` のなりすまし防止と露出遮断 (§17 / §22 の残課題を解消)

§17 の末尾に「詳細な詐称対策は将来 SECURITY DEFINER 関数化して統一する予定」と書き、
§22 の末尾に「`submitter_id` 自体は API から読める」と書いた 2 つの残課題を、まとめて塞ぐ。

### 背景: 塞ぐべき 2 つの穴

**穴 1 — なりすまし (書き込み側)**

§17 で作った INSERT ポリシーは `WITH CHECK (true)` だった。
つまり Anon Key さえあれば、PostgREST を直接叩いて `submitter_id` に**任意の文字列**を
入れて投稿できる。とくに `submitter_id = '_shacho'` を名乗ると、
§9 のレート制限バイパス (`IF NEW.submitter_id = '_shacho' THEN RETURN NEW`) に乗ってしまい、
**5 分に 1 件の制限を無効化して無制限に連投できる**。
`_shacho` という文字列はフロントの `RESERVED_USERNAMES` 経由で JS バンドルに含まれるため、
バンドルを読めば誰でも気づける。ここが最も実害の大きい穴。

**穴 2 — 露出 (読み取り側)**

SELECT ポリシーが `USING (true)` で**行全体**を返すため、`show_submitter = false` の投稿でも
PostgREST を直接叩けば `submitter_id` (= ユーザー名) が読めた。
`show_submitter` が守っていたのは「アプリの画面に出さない」ところまでで、
「誰にも知られない」ことは保証していなかった。

### 方針

| | 対策 |
|---|---|
| 書き込み | INSERT を `TO authenticated` に限定し、`submitter_id` が **`auth.uid()` から引いたユーザー名と一致すること**を DB 側で強制する |
| 読み取り | ベーステーブルの公開 SELECT を止め、**マスク済みビュー `public_photo_questions`** 経由に一本化する。自分の投稿だけはベーステーブルから直接読める |

**UX の後退はない**。`PhotoSubmit.tsx` は以前からログイン必須
(未ログインなら `/login?redirect=/quiz/photo/submit` へ飛ばす) で、
匿名投稿の導線はそもそも存在しない。フロントが既にやっていたことを、
サーバ側でも保証するだけの変更になる。

### 前提

以下が適用済みであること。未適用なら先にそちらを実行する。

- **§22** — `show_submitter` 列 (ビューの `CASE` で使う)
- **§20** — `is_hidden` 列 (ビューの `WHERE` で使う)
- **§21** — `public_profiles.username` の一意インデックス
  (INSERT ポリシーが `auth.uid()` → username の一意な対応を前提にするため)

確認クエリ:

```sql
SELECT
  to_regclass('public.user_photo_questions')                                   AS tbl,
  (SELECT COUNT(*) FROM information_schema.columns
    WHERE table_name = 'user_photo_questions' AND column_name = 'show_submitter') AS has_show_submitter,
  (SELECT COUNT(*) FROM information_schema.columns
    WHERE table_name = 'user_photo_questions' AND column_name = 'is_hidden')      AS has_is_hidden;
```

`tbl` が非 NULL、`has_show_submitter` と `has_is_hidden` が両方 `1` なら OK。

### 実行前後に見るポリシー状態の確認クエリ

SQL が途中で失敗したときに「ポリシーが全部消えて誰も投稿できない」状態になっていないかを見る。

```sql
SELECT tablename, policyname, cmd, roles
FROM pg_policies
WHERE tablename = 'user_photo_questions'
ORDER BY cmd, policyname;
```

- **実行前**: `public_photo_questions_select` (SELECT) と `public_photo_questions_insert` (INSERT) の 2 行
- **実行後**: `photo_questions_select_own` (SELECT) と `photo_questions_insert_own` (INSERT) の 2 行
- **0 行のとき**: DROP だけが通って CREATE が失敗した状態。RLS 有効かつポリシー無し =
  一般ユーザーからは読み書きとも全拒否になる。下の SQL をもう一度流せば復旧する
  (`DROP POLICY IF EXISTS` を先頭に入れてあるので、何度実行しても安全)

### 実行 SQL (SQL Editor で 1 度だけ実行)

```sql
-- ==========================================================
-- 段階 1: なりすまし防止 (INSERT を本人のユーザー名に固定)
-- ==========================================================
-- §17 で作った WITH CHECK (true) を破棄する。
DROP POLICY IF EXISTS "public_photo_questions_insert" ON user_photo_questions;
DROP POLICY IF EXISTS "anon_insert" ON user_photo_questions;
-- 途中で失敗した場合に何度でも流し直せるよう、新ポリシー名も先に落としておく。
DROP POLICY IF EXISTS "photo_questions_insert_own" ON user_photo_questions;

-- submitter_id は「ログイン中のユーザーのユーザー名」以外を受け付けない。
--   - プロフィール未作成 (サブクエリが NULL) → 比較結果が NULL → 拒否
--   - 未ログイン (anon ロール) → ポリシー自体が適用されない → 拒否
-- これにより '_shacho' を名乗ることもできなくなり、§9 のレート制限バイパスは
-- Service Role Key を持つ社長のスクリプト (RLS を迂回する) からしか使えなくなる。
--
-- ⚠️ `auth.uid()::text` のキャストは必須。`public_profiles.id` は Phase 2 の名残で
--    UUID 型ではなく **TEXT 型** (クライアント生成 UUID を文字列で保存していた) のため、
--    キャストを外すと `ERROR: 42883: operator does not exist: text = uuid` になる。
--    §11 以降の他のポリシー・関数もすべて `auth.uid()::text` で統一されている。
CREATE POLICY "photo_questions_insert_own" ON user_photo_questions
  FOR INSERT TO authenticated
  WITH CHECK (
    submitter_id = (SELECT p.username FROM public_profiles p WHERE p.id = auth.uid()::text)
  );

-- Storage も揃える。DB INSERT がログイン必須になった以上、
-- 匿名アップロードを許すと「本文のないゴミ画像」だけを置ける穴が残る。
DROP POLICY IF EXISTS "public_storage_insert" ON storage.objects;
DROP POLICY IF EXISTS "anon_storage_insert" ON storage.objects;
DROP POLICY IF EXISTS "authenticated_storage_insert" ON storage.objects;

CREATE POLICY "authenticated_storage_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'photo-quiz-user');

-- ==========================================================
-- 段階 2: 露出遮断 (公開読み取りをマスク済みビューに一本化)
-- ==========================================================
-- 2-1. ベーステーブルの「全行公開」SELECT を破棄し、自分の投稿だけに絞る。
DROP POLICY IF EXISTS "public_photo_questions_select" ON user_photo_questions;
DROP POLICY IF EXISTS "anon_select" ON user_photo_questions;
DROP POLICY IF EXISTS "photo_questions_select_own" ON user_photo_questions;

CREATE POLICY "photo_questions_select_own" ON user_photo_questions
  FOR SELECT TO authenticated
  USING (
    submitter_id = (SELECT p.username FROM public_profiles p WHERE p.id = auth.uid()::text)
  );

-- 2-2. 出題用の公開ビュー。
--   - submitter_id は show_submitter = true のときだけ実名を返し、それ以外は NULL
--   - is_hidden = true (通報で自動非表示化された行) は最初から出さない
-- ビューの所有者は postgres (= ベーステーブルの所有者) なので、
-- ビュー経由の読み取りにはベーステーブルの RLS が適用されない。
-- これが「本人以外はビューからしか読めないのに、出題はできる」を成立させている。
CREATE OR REPLACE VIEW public_photo_questions AS
SELECT
  q.id,
  CASE WHEN q.show_submitter THEN q.submitter_id ELSE NULL END AS submitter_id,
  q.show_submitter,
  q.image_path,
  q.ramen_type,
  q.prefecture,
  q.photo_type,
  q.difficulty,
  q.noodle_thickness,
  q.question,
  q.options,
  q.answer_idx,
  q.explanation,
  q.shop_info,
  q.created_at
FROM user_photo_questions q
WHERE q.is_hidden = false;

-- 2-3. 権限。読み取り専用で公開する (書き込みはベーステーブルの INSERT ポリシー経由)。
REVOKE ALL ON public_photo_questions FROM anon, authenticated;
GRANT SELECT ON public_photo_questions TO anon, authenticated;

COMMENT ON VIEW public_photo_questions IS
  '写真クイズの公開ビュー。submitter_id は show_submitter=true のときだけ返す。'
  'is_hidden=true の行は含まない。ベーステーブルの直接 SELECT は本人の投稿のみ (docs §24)。';

-- ==========================================================
-- 段階 3: レート制限トリガーを SECURITY DEFINER 化
-- ==========================================================
-- 段階 2 でベーステーブルの SELECT が「自分の行だけ」に狭まった。
-- トリガー関数は既定で呼び出し元の権限で動くため、RLS の影響を受ける。
-- 現状の条件 (submitter_id = 自分) では偶然そのまま動くが、
-- 「レート制限が RLS ポリシーの書き方に依存する」状態は危うい
-- (ポリシーを 1 行いじった瞬間に制限が無言で外れる)。
-- SECURITY DEFINER にして、ポリシーと無関係に必ず全行を数えるようにする。
CREATE OR REPLACE FUNCTION enforce_submit_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  last_submission TIMESTAMPTZ;
  wait_seconds    INT;
BEGIN
  -- 社長のバイパス。段階 1 の INSERT ポリシーにより、この分岐に到達できるのは
  -- RLS を迂回する Service Role Key 経由の一括投入スクリプトだけになった。
  IF NEW.submitter_id = '_shacho' THEN
    RETURN NEW;
  END IF;

  SELECT MAX(created_at) INTO last_submission
  FROM user_photo_questions
  WHERE submitter_id = NEW.submitter_id;

  IF last_submission IS NOT NULL
     AND last_submission > NOW() - INTERVAL '5 minutes' THEN
    wait_seconds := GREATEST(
      1,
      CEIL(EXTRACT(EPOCH FROM (last_submission + INTERVAL '5 minutes' - NOW())))::INT
    );
    RAISE EXCEPTION 'rate_limit_exceeded:%', wait_seconds
      USING HINT = 'Please wait before submitting again';
  END IF;

  RETURN NEW;
END;
$$;
```

> **PostgreSQL 15 以上の場合の補強 (任意)**: ビューが将来 `security_invoker` 既定に
> 変わっても壊れないよう、意図を明示しておける。エラーになる版 (PG14 以前) では実行不要。
>
> ```sql
> ALTER VIEW public_photo_questions SET (security_invoker = false);
> ```

### なぜビューにしたか (列レベル REVOKE との比較)

§22 では選択肢を 2 つ挙げていた。今回は 2 を採った。

| | 列レベル REVOKE | ビュー経由 (採用) |
|---|---|---|
| `REVOKE SELECT (submitter_id)` の効き方 | 全ロールで一律に読めなくなる | — |
| `show_submitter = true` の作成者名 | **読めなくなる** → §22 の機能が死ぬので RPC を別途用意する必要がある | `CASE` でそのまま返せる |
| マイページの投稿履歴 | `submitter_id` で絞れなくなる → SECURITY DEFINER 関数が必要 | ベーステーブルを本人限定 SELECT で読めばよい |
| `is_hidden` の除外 | クライアントが `.eq('is_hidden', false)` を付け忘れると漏れる | ビューの `WHERE` で**構造的に**除外される |
| 追加の関数 | 2 本必要 | 0 本 |

列レベル REVOKE は「公開してよい名前まで巻き添えで隠れる」ため、
§22 で作った機能と両立させるには結局 RPC を足すことになる。ビューなら 1 つで両方さばける。

副産物として `is_hidden` のフィルタがビュー側に移り、
クライアントの `.eq('is_hidden', false)` 付け忘れで非表示問題が出題される事故もなくなった。

### 効果

- `submitter_id` を偽装した投稿が **DB レベルで**拒否される (`_shacho` 詐称によるレート制限回避も不可)
- `show_submitter = false` の投稿者名は、Anon Key で PostgREST を直接叩いても **NULL しか返らない**
- 通報で自動非表示化された問題は、ビューの定義上そもそも出てこない
- レート制限が RLS ポリシーの書き方から独立した (段階 3)
- UPDATE / DELETE ポリシーは引き続き未作成 = 拒否のまま

### 残る前提 (これは仕様として受け入れる)

- **画像そのものは公開バケット**にあり、URL を知っていれば誰でも取得できる。
  Storage のパスは `submissions/<年>/<月>/<ユーザー名>-<時刻>-<乱数>.webp` 形式のため、
  **画像 URL にはユーザー名が含まれる**。ビューは `image_path` を返すので、
  ここから投稿者名が推測できる。完全に消すならパスを乱数のみに変え、
  既存画像のリネームも必要になる → 別タスク。当面は「作成者名を隠す」の主目的
  (一覧・API から機械的に収集されない) は達成できている。
- Service Role Key を持つ社長のスクリプトは RLS を迂回する。これは意図した設計。

### フロント側の変更 (実装済み)

| ファイル | 変更 |
|---|---|
| `lib/supabaseClient.ts` | `PUBLIC_PHOTO_QUESTIONS_VIEW = 'public_photo_questions'` を追加 |
| `lib/supabasePhotoQuestionRepository.ts` | `findByFilter` / `findByIds` の参照先をビューへ変更し、`.eq('is_hidden', false)` を削除 (ビュー側で除外済み。ビューに `is_hidden` 列は無いので付けたままだとエラーになる)。`findBySubmitterId` と `submit` はベーステーブルのまま |

### 確認方法

1. 上の SQL を実行する
2. `/quiz/photo/play` で写真クイズが今までどおり出題される
3. 「作成者名を表示する」で投稿した問題には「作成者: ○○ さん」が出る
4. マイページの投稿履歴に自分の投稿が今までどおり並ぶ
5. `/quiz/photo/submit` から投稿できる (ログイン中であること)
6. **なりすましが弾かれること** — Anon Key で他人の名前を騙って INSERT:
   ```bash
   curl -X POST "https://<PROJECT>.supabase.co/rest/v1/user_photo_questions" \
     -H "apikey: <ANON_KEY>" -H "Content-Type: application/json" \
     -d '{"submitter_id":"_shacho","image_path":"x.webp","ramen_type":"shoyu","prefecture":"東京都","photo_type":"ramen","difficulty":"mid","question":"この画像はどこの店のものですか？","options":["a","b","c","d"],"answer_idx":0,"shop_info":{"name":"x"}}'
   ```
   → `new row violates row-level security policy` が返れば成功
7. **露出が止まっていること** — Anon Key でベーステーブルを直接 SELECT:
   ```bash
   curl "https://<PROJECT>.supabase.co/rest/v1/user_photo_questions?select=submitter_id" \
     -H "apikey: <ANON_KEY>"
   ```
   → `[]` (空配列) が返れば成功
8. **ビューはマスクされていること**:
   ```bash
   curl "https://<PROJECT>.supabase.co/rest/v1/public_photo_questions?select=submitter_id,show_submitter" \
     -H "apikey: <ANON_KEY>"
   ```
   → `show_submitter` が `false` の行は `submitter_id` が `null` になっていること
      (社長が一括投入した 70 問はすべて `false` なので、全部 `null` のはず)
9. レート制限が生きていること — 一般ユーザーで 2 件続けて投稿 → 「あと N 分 M 秒」

### ロールバック (何か壊れた場合)

```sql
DROP VIEW IF EXISTS public_photo_questions;
DROP POLICY IF EXISTS "photo_questions_select_own" ON user_photo_questions;
DROP POLICY IF EXISTS "photo_questions_insert_own" ON user_photo_questions;
DROP POLICY IF EXISTS "authenticated_storage_insert" ON storage.objects;

CREATE POLICY "public_photo_questions_select" ON user_photo_questions
  FOR SELECT TO public USING (true);
CREATE POLICY "public_photo_questions_insert" ON user_photo_questions
  FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "public_storage_insert" ON storage.objects
  FOR INSERT TO public WITH CHECK (bucket_id = 'photo-quiz-user');
```

戻す場合はフロント側も `PUBLIC_PHOTO_QUESTIONS_VIEW` → `USER_PHOTO_QUESTIONS_TABLE` に戻し、
`.eq('is_hidden', false)` を復活させること (ビューが無いと出題が空になる)。
