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
- 詳細な詐称対策 (submitter_id = auth.uid() 強制など) は将来 SECURITY DEFINER 関数化して
  §13 / §15 と同じ方式に統一する予定 (現状はフロント検証 + レート制限で抑制)

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

## §19 通報 N 件超えた問題の自動非表示化

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
