/**
 * Supabase クライアント (シングルトン)。
 *
 * 環境変数 `VITE_SUPABASE_URL` と `VITE_SUPABASE_ANON_KEY` の両方が
 * セットされているときだけ `createClient` を呼び、それ以外は `null` を返す。
 *
 * 呼び出し側 (リポジトリ層) は `getSupabaseClient()` の戻り値が `null` か否かを
 * 見て分岐し、未接続環境ではモックデータにフォールバックする。
 *
 * Phase 3 で Supabase Auth に統合する際は本ファイルにセッション周りを集約する。
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/** Storage バケット名 (env で上書き可、デフォルトは `photo-quiz-user`)。 */
export const SUPABASE_STORAGE_BUCKET: string =
  import.meta.env.VITE_SUPABASE_STORAGE_BUCKET ?? 'photo-quiz-user';

/** ユーザー投稿問題テーブル名 (Phase 2 で固定)。 */
export const USER_PHOTO_QUESTIONS_TABLE = 'user_photo_questions';

/** 公開プロフィールテーブル名 (ランキング表示用の最小情報)。 */
export const PUBLIC_PROFILES_TABLE = 'public_profiles';

/** クイズスコアテーブル名 (1 プレイ = 1 行)。 */
export const QUIZ_SCORES_TABLE = 'quiz_scores';

/** 【legacy】 §10 の SUM ベースランキングビュー。§14 移行後は未使用。 */
export const QUIZ_RANKING_VIEW = 'quiz_ranking';

/** カテゴリ別ベストスコアランキングビュー (§14)。 */
export const QUIZ_RANKING_BY_CATEGORY_VIEW = 'quiz_ranking_by_category';

/** カテゴリ別ベストスコアテーブル名 (§14)。 */
export const QUIZ_BEST_SCORES_TABLE = 'quiz_best_scores';

let cachedClient: SupabaseClient | null | undefined;

/**
 * Supabase クライアントを取得する。
 * - 環境変数未設定なら `null` (モックフォールバックを意味する)。
 * - 同一プロセス内ではシングルトンとしてキャッシュ。
 */
export function getSupabaseClient(): SupabaseClient | null {
  if (cachedClient !== undefined) return cachedClient;
  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    cachedClient = null;
    return null;
  }
  cachedClient = createClient(url, anonKey, {
    auth: {
      // Phase 3: Supabase Auth (Email+Password ベース、内部的に fake email 変換)。
      // セッションを localStorage に永続化し、リロード後も自動復元する。
      // 環境変数未設定時は getSupabaseClient() 自体が null を返すので、
      // ここには到達しない (二重防御)。
      persistSession: true,
      autoRefreshToken: true,
      storageKey: 'ramen-quiz:supabase-auth',
    },
  });
  return cachedClient;
}

/** Supabase が接続可能か (= 環境変数がセットされているか)。 */
export function isSupabaseConfigured(): boolean {
  return getSupabaseClient() !== null;
}

/** テスト用にキャッシュをリセットする (本番コードでは使用しない)。 */
export function _resetSupabaseClientForTest(): void {
  cachedClient = undefined;
}
