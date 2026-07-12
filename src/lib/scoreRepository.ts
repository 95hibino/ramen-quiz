import type { RankingCategory, RankingEntry, ScoreRecord } from '@/types/account';

/**
 * `recordScore` の入力型。
 * 通常セッションのプレイ結果を記録するときに使う。
 *
 * `rankingCategory` が指定された場合は、Supabase 実装が `record_best_score` RPC を
 * 呼んで `quiz_best_scores` を更新する (新記録時のみ)。復習セッション等で
 * ランキングに反映したくないときは undefined を渡す。
 */
export type RecordScoreInput = Omit<ScoreRecord, 'id' | 'playedAt'> & {
  rankingCategory?: RankingCategory;
};

/**
 * スコア永続層の抽象インターフェース。
 *
 * Phase 1: `localScoreRepository` (localStorage)。
 * Phase 3: Supabase 実装に差し替え (同じ interface)。
 * §14: カテゴリ別ベストスコアランキングに移行。
 */
export interface ScoreRepository {
  /** 1 プレイ分のスコアを記録する。返り値は保存済みレコード。 */
  recordScore(input: RecordScoreInput): Promise<ScoreRecord>;

  /** 指定ユーザーのスコア一覧を取得する (新しい順)。 */
  listScoresByUser(userId: string): Promise<ScoreRecord[]>;

  /**
   * 指定カテゴリのベストスコアランキングを取得する。
   *
   * @param category 対象ランキングカテゴリ (basic / regional / expert / photo)
   * @param limit 最大返却件数
   */
  fetchRanking(category: RankingCategory, limit: number): Promise<RankingEntry[]>;
}
