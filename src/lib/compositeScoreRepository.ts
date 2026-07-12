/**
 * Supabase を優先しつつ、未接続時は localScoreRepository にフォールバックする合成リポジトリ。
 *
 * 挙動 (§14 移行後):
 * - Supabase 接続中:
 *   - recordScore: プロフィール upsert 安全網 → local に履歴保存 → Supabase に履歴 INSERT
 *     + record_best_score RPC でベストスコア更新 (rankingCategory 指定時のみ)
 *   - fetchRanking: quiz_ranking_by_category ビューから指定カテゴリの上位を取得
 * - Supabase 未接続: 完全に localScoreRepository のみを使う (localStorage 完結、
 *   ランキングは端末内ユーザーのみ)
 *
 * 自分のスコア履歴 (`listScoresByUser`):
 * - Supabase 接続中: サーバ (全端末合算) から取得。空なら local fallback。
 * - Supabase 未接続: local から。
 */
import { isSupabaseConfigured } from '@/lib/supabaseClient';
import { localAuthRepository } from '@/lib/localAuthRepository';
import { localScoreRepository } from '@/lib/localScoreRepository';
import type { RecordScoreInput, ScoreRepository } from '@/lib/scoreRepository';
import type {
  MyRankingEntry,
  RankingCategory,
  RankingEntry,
  ScoreRecord,
} from '@/types/account';
import { upsertPublicProfile } from './supabasePublicProfileRepository';
import { supabaseScoreRepository } from './supabaseScoreRepository';

export const compositeScoreRepository: ScoreRepository = {
  async recordScore(input: RecordScoreInput): Promise<ScoreRecord> {
    if (!isSupabaseConfigured()) {
      return localScoreRepository.recordScore(input);
    }

    // FK 制約 (quiz_scores.user_id → public_profiles.id) を満たすため、
    // Supabase INSERT の前に必ずプロフィールを upsert する。
    // Supabase Auth 経由でサインアップ済みならプロフィールは存在するので通常 no-op。
    // レガシー localStorage ユーザー等の救済で残している安全網。
    const user = await localAuthRepository.findUserById(input.userId);
    if (user) {
      await upsertPublicProfile(user);
    }

    // ローカルにも常に書き込むことで、マイページ (ScoreTrendChart) が
    // Supabase 障害時でも空表示にならないようにする。
    const localRecord = await localScoreRepository.recordScore(input);
    try {
      const supaRecord = await supabaseScoreRepository.recordScore(input);
      return supaRecord;
    } catch (err) {
      // 例外は上に伝播させて「ランキング反映失敗」を UI で扱えるようにする。
      // ローカル書き込みは成功しているので、UI 側は自分のスコアは見える。
      throw err instanceof Error
        ? err
        : new Error(`スコア記録に失敗しました。ローカルには保存済み (${localRecord.id})`);
    }
  },

  async listScoresByUser(userId: string): Promise<ScoreRecord[]> {
    if (!isSupabaseConfigured()) {
      return localScoreRepository.listScoresByUser(userId);
    }
    // Supabase 側を優先。空なら localStorage を返す (別端末で作った初期プレイなど)。
    const remote = await supabaseScoreRepository.listScoresByUser(userId);
    if (remote.length > 0) return remote;
    return localScoreRepository.listScoresByUser(userId);
  },

  async fetchRanking(
    category: RankingCategory,
    limit: number,
  ): Promise<RankingEntry[]> {
    if (!isSupabaseConfigured()) {
      return localScoreRepository.fetchRanking(category, limit);
    }
    return supabaseScoreRepository.fetchRanking(category, limit);
  },

  async fetchMyRanking(category: RankingCategory): Promise<MyRankingEntry | null> {
    if (!isSupabaseConfigured()) {
      return localScoreRepository.fetchMyRanking(category);
    }
    return supabaseScoreRepository.fetchMyRanking(category);
  },
};
