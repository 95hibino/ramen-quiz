import { create } from 'zustand';
import type { ScoreRepository } from '@/lib/scoreRepository';
import { localScoreRepository } from '@/lib/localScoreRepository';
import type { RankingEntry, ScoreRecord } from '@/types/account';
import type { QuizCategory } from '@/types/quiz';

export type ScoreFetchStatus = 'idle' | 'loading' | 'success' | 'error';

interface ScoreState {
  ranking: RankingEntry[];
  rankingStatus: ScoreFetchStatus;
  rankingError: string | null;

  myScores: ScoreRecord[];
  myScoresStatus: ScoreFetchStatus;
  myScoresError: string | null;

  /** スコアを 1 件記録する。 */
  recordScore: (input: {
    userId: string;
    /** 知識クイズの category。写真クイズなどでは省略可。 */
    category?: QuizCategory;
    quizType: string;
    score: number;
    correctCount: number;
    totalCount: number;
  }) => Promise<ScoreRecord>;

  /** 上位 limit 件のランキングを取得する。 */
  loadRanking: (limit?: number) => Promise<void>;

  /** 指定ユーザーのスコア履歴を取得する。 */
  loadMyScores: (userId: string) => Promise<void>;
}

const DEFAULT_RANKING_LIMIT = 100;

export function createScoreStore(repository: ScoreRepository = localScoreRepository) {
  return create<ScoreState>((set) => ({
    ranking: [],
    rankingStatus: 'idle',
    rankingError: null,
    myScores: [],
    myScoresStatus: 'idle',
    myScoresError: null,

    recordScore: async (input) => {
      return repository.recordScore(input);
    },

    loadRanking: async (limit = DEFAULT_RANKING_LIMIT) => {
      set({ rankingStatus: 'loading', rankingError: null });
      try {
        const ranking = await repository.fetchRanking(limit);
        set({ ranking, rankingStatus: 'success' });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'ランキングの取得に失敗しました。';
        set({ rankingStatus: 'error', rankingError: message });
      }
    },

    loadMyScores: async (userId) => {
      set({ myScoresStatus: 'loading', myScoresError: null });
      try {
        const myScores = await repository.listScoresByUser(userId);
        set({ myScores, myScoresStatus: 'success' });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'スコア履歴の取得に失敗しました。';
        set({ myScoresStatus: 'error', myScoresError: message });
      }
    },
  }));
}

export const useScoreStore = createScoreStore();
