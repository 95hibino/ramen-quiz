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
