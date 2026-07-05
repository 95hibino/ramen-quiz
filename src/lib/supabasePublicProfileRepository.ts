/**
 * 公開プロフィール (username / prefecture / favoriteShop) を Supabase に upsert する薄いリポジトリ。
 *
 * ランキング表示のため各端末に散らばっているユーザーの最小情報を、
 * サーバ側 (public_profiles テーブル) に集約する。
 *
 * 呼び出しタイミング:
 * - サインアップ直後
 * - ログイン成功時 (idempotent、別端末での初回ログインに備える)
 * - スコア記録前 (安全網。プロフィール未登録だと FK 違反で INSERT が失敗するため)
 *
 * Supabase 未接続 (環境変数なし) 環境では何もしない (`null` 返し) で、
 * 既存の localStorage ランキング挙動と互換に保つ。
 */
import type { User } from '@/types/account';
import { getSupabaseClient, PUBLIC_PROFILES_TABLE } from './supabaseClient';

/**
 * User を public_profiles テーブルに upsert する。
 * Supabase 未接続時は no-op。
 *
 * 冪等性: id が PK なので同 id での再送は UPDATE として処理される。
 * ネットワーク失敗などで例外化するとサインアップ/ログインが落ちるため、
 * エラーはコンソールに warn するだけで throw しない。
 */
export async function upsertPublicProfile(user: User): Promise<void> {
  const client = getSupabaseClient();
  if (!client) return;

  const payload = {
    id: user.id,
    username: user.username,
    prefecture: user.prefecture,
    favorite_shop: user.favoriteShop,
  };

  const { error } = await client
    .from(PUBLIC_PROFILES_TABLE)
    .upsert(payload, { onConflict: 'id' });

  if (error) {
    console.warn('[upsertPublicProfile] failed:', error.message);
  }
}
