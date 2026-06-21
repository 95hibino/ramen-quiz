import type { RankingEntry, ScoreRecord } from '@/types/account';

/**
 * スコア永続層の抽象インターフェース。
 *
 * Phase 1: `localScoreRepository` (localStorage)。
 * Phase 3: Supabase 実装に差し替え (同じ interface)。
 */
export interface ScoreRepository {
  /** 1 プレイ分のスコアを記録する。返り値は保存済みレコード。 */
  recordScore(input: Omit<ScoreRecord, 'id' | 'playedAt'>): Promise<ScoreRecord>;

  /** 指定ユーザーのスコア一覧を取得する (新しい順)。 */
  listScoresByUser(userId: string): Promise<ScoreRecord[]>;

  /**
   * 上位ランキングを取得する。
   *
   * @param limit 最大返却件数
   */
  fetchRanking(limit: number): Promise<RankingEntry[]>;
}
