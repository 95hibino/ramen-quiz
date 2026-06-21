# 管理スクリプト (社長専用)

不適切投稿の削除など、Service Role Key を必要とする運用タスクをまとめます。

## 共通の前提

- **Service Role Key は絶対にコミットしない / フロントに含めない / ホスティング環境変数にも置かない**
  ローカル (社長のマシン) でのみ使用してください。
- 実行には `tsx` を使います。プロジェクト依存に無いため、初回のみ `npx tsx` で取り込まれます。
- ベースとなる Supabase 接続情報は環境変数で渡します。

```bash
# ramen_quiz ディレクトリ直下で実行
cd shacho/engineering/output/ramen_quiz

# 一時的にシェルで設定する例
export SUPABASE_URL=https://xxxxxxxxxxx.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=ey...           # 絶対に Git に push しない
# 任意 (デフォルトは photo-quiz-user / user_photo_questions)
# export SUPABASE_STORAGE_BUCKET=photo-quiz-user
# export USER_PHOTO_QUESTIONS_TABLE=user_photo_questions
```

`.env` ファイルに書きたい場合は **`.gitignore` に登録済みであることを必ず確認** してください
(Vite の `.env.local` は既に Git 除外、`.env.admin` 等別ファイルを使う場合は `.gitignore` に追記)。

## delete_user_question.ts — 投稿削除

DB 行と Storage の画像オブジェクトを同時に削除します。RLS をバイパスするため一般ユーザーでは
不可能な操作です。**削除は不可逆**なので、対象 ID を Supabase Dashboard で必ず目視確認してから実行してください。

```bash
# 単発削除
npx tsx scripts/admin/delete_user_question.ts <question-id>

# 複数同時削除
npx tsx scripts/admin/delete_user_question.ts <id1> <id2> <id3>
```

### 出力例

```
[delete_user_question] target ids: 0c1b9a...
[delete_user_question] Storage 削除 OK: 1 件
[delete_user_question] DB 削除 OK: 1 件 (0c1b9a...)
[delete_user_question] 完了
```

### エラー時の挙動

- Storage 削除が失敗した場合は DB 行を削除せず終了 (再実行で同じ手順を試せるように)。
- DB の対象 ID が見つからない場合はエラー終了 (誤入力検知のため)。

## 今後追加する想定

- `disable_rate_limit_trigger.ts` (緊急時にレート制限を一時停止)
- `export_user_photo_questions.ts` (バックアップ)

必要に応じてエンジニアリングエージェントに追加依頼してください。
