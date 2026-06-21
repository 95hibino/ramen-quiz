/**
 * 不適切な写真クイズ投稿を社長権限で削除するための CLI スクリプト。
 *
 * - Service Role Key で Supabase クライアントを作成し RLS をバイパスする
 * - DB 行と Storage の画像オブジェクトを同時に削除する
 * - 環境変数:
 *     - SUPABASE_URL                   (必須) — Supabase プロジェクト URL
 *     - SUPABASE_SERVICE_ROLE_KEY      (必須) — Service Role Key (絶対にコミットしない)
 *     - SUPABASE_STORAGE_BUCKET        (任意) — デフォルト `photo-quiz-user`
 *     - USER_PHOTO_QUESTIONS_TABLE     (任意) — デフォルト `user_photo_questions`
 *
 * 使い方:
 *   npx tsx scripts/admin/delete_user_question.ts <question-id> [<question-id> ...]
 *
 * 注意:
 *   - Service Role Key はフロント / Git / ホスティング環境変数に絶対に置かない
 *   - 削除は不可逆。実行前に対象 ID を Supabase Dashboard で確認すること
 */
import { createClient } from '@supabase/supabase-js';

// 既定値は `src/lib/supabaseClient.ts` の `SUPABASE_STORAGE_BUCKET` /
// `USER_PHOTO_QUESTIONS_TABLE` と同じ値を持つ。フロント側は Vite の
// `import.meta.env` を参照するため Node から import できず、ここでは
// `process.env` ベースで小さく重複定義している (DRY 違反は意図的)。
const DEFAULT_BUCKET = 'photo-quiz-user';
const DEFAULT_TABLE = 'user_photo_questions';

interface DeleteTarget {
  id: string;
  imagePath: string | null;
}

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    console.error(`[delete_user_question] 環境変数 ${name} が未設定です。`);
    process.exit(1);
  }
  return value;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2).filter((a) => a && !a.startsWith('-'));
  if (args.length === 0) {
    console.error(
      'Usage: npx tsx scripts/admin/delete_user_question.ts <question-id> [<question-id> ...]',
    );
    process.exit(1);
  }

  const url = getRequiredEnv('SUPABASE_URL');
  const serviceRoleKey = getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY');
  const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? DEFAULT_BUCKET;
  const table = process.env.USER_PHOTO_QUESTIONS_TABLE ?? DEFAULT_TABLE;

  // Service Role Key 利用のため persistSession 無効・autoRefresh 無効で十分
  const client = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log(`[delete_user_question] target ids: ${args.join(', ')}`);

  // 1) 対象行の image_path を先に取得 (Storage 削除に必要)
  const { data: rows, error: selectError } = await client
    .from(table)
    .select('id, image_path')
    .in('id', args);

  if (selectError) {
    console.error(`[delete_user_question] DB select 失敗: ${selectError.message}`);
    process.exit(1);
  }

  const targets: DeleteTarget[] = (rows ?? []).map((r) => ({
    id: String(r.id),
    imagePath: typeof r.image_path === 'string' ? r.image_path : null,
  }));

  if (targets.length === 0) {
    console.error('[delete_user_question] 対象 ID に該当する行がありませんでした。');
    process.exit(1);
  }

  const missing = args.filter((id) => !targets.some((t) => t.id === id));
  if (missing.length > 0) {
    console.warn(`[delete_user_question] DB に存在しない ID: ${missing.join(', ')}`);
  }

  // 2) Storage の画像オブジェクトを削除 (存在しない場合はスキップ扱いになる)
  const imagePaths = targets
    .map((t) => t.imagePath)
    .filter((p): p is string => typeof p === 'string' && p.length > 0);

  if (imagePaths.length > 0) {
    const { error: storageError } = await client.storage.from(bucket).remove(imagePaths);
    if (storageError) {
      console.error(`[delete_user_question] Storage 削除失敗: ${storageError.message}`);
      // DB 行を残すと再現性が無くなるので継続せず終了
      process.exit(1);
    }
    console.log(`[delete_user_question] Storage 削除 OK: ${imagePaths.length} 件`);
  } else {
    console.log('[delete_user_question] 削除対象の image_path はありません。');
  }

  // 3) DB 行を削除
  const ids = targets.map((t) => t.id);
  const { error: deleteError } = await client.from(table).delete().in('id', ids);
  if (deleteError) {
    console.error(`[delete_user_question] DB delete 失敗: ${deleteError.message}`);
    process.exit(1);
  }
  console.log(`[delete_user_question] DB 削除 OK: ${ids.length} 件 (${ids.join(', ')})`);

  console.log('[delete_user_question] 完了');
}

main().catch((err) => {
  console.error('[delete_user_question] 想定外のエラー:', err);
  process.exit(1);
});
