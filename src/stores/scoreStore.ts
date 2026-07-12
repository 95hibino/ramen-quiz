import { create } from 'zustand';
import type { ScoreRepository } from '@/lib/scoreRepository';
import { compositeScoreRepository } from '@/lib/compositeScoreRepository';
import type {
  MyRankingEntry,
  RankingCategory,
  RankingEntry,
  ScoreRecord,
} from '@/types/account';
import type { QuizCategory } from '@/types/quiz';

export type ScoreFetchStatus = 'idle' | 'loading' | 'success' | 'error';

interface ScoreState {
  /** 現在表示中のランキング (カテゴリ別ベストスコア)。 */
  ranking: RankingEntry[];
  /** 現在の ranking に対応するカテゴリ (`fetchRanking` の引数)。 */
  rankingCategory: RankingCategory;
  rankingStatus: ScoreFetchStatus;
  rankingError: string | null;
  /**
   * ログイン中ユーザーの、選択カテゴリでの順位情報。
   * ランキング画面で 100 位以下だった場合の末尾表示に使う。
   * 未取得 / 該当なし (未プレイ) は null。
   */
  myRanking: MyRankingEntry | null;

  myScores: ScoreRecord[];
  myScoresStatus: ScoreFetchStatus;
  myScoresError: string | null;

  /**
   * スコアを 1 件記録する。
   * `rankingCategory` を指定するとサーバ側でベストスコア更新も走る (通常セッション時のみ)。
   * 復習セッションでは指定しない (ランキングに反映させないため)。
   */
  recordScore: (input: {
    userId: string;
    /** 知識クイズの category (basic/regional/expert)。写真クイズでは省略可。 */
    category?: QuizCategory;
    quizType: string;
    score: number;
    correctCount: number;
    totalCount: number;
    /** ランキング反映用のカテゴリ。省略時はランキング更新を行わない。 */
    rankingCategory?: RankingCategory;
  }) => Promise<ScoreRecord>;

  /** 指定カテゴリの上位 limit 件のランキングを取得する。 */
  loadRanking: (category: RankingCategory, limit?: number) => Promise<void>;

  /**
   * ログイン中ユーザーの指定カテゴリでの順位を取得する。
   * ランキング画面の loadRanking と並行して呼ぶ。
   */
  loadMyRanking: (category: RankingCategory) => Promise<void>;

  /** 指定ユーザーのスコア履歴を取得する。 */
  loadMyScores: (userId: string) => Promise<void>;
}

const DEFAULT_RANKING_LIMIT = 100;
const DEFAULT_RANKING_CATEGORY: RankingCategory = 'basic';

export function createScoreStore(repository: ScoreRepository = compositeScoreRepository) {
  return create<ScoreState>((set) => ({
    ranking: [],
    rankingCategory: DEFAULT_RANKING_CATEGORY,
    rankingStatus: 'idle',
    rankingError: null,
    myRanking: null,
    myScores: [],
    myScoresStatus: 'idle',
    myScoresError: null,

    recordScore: async (input) => {
      return repository.recordScore(input);
    },

    loadRanking: async (category, limit = DEFAULT_RANKING_LIMIT) => {
      set({ rankingCategory: category, rankingStatus: 'loading', rankingError: null });
      try {
        const ranking = await repository.fetchRanking(category, limit);
        set({ ranking, rankingStatus: 'success' });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'ランキングの取得に失敗しました。';
        set({ rankingStatus: 'error', rankingError: message });
      }
    },

    loadMyRanking: async (category) => {
      // myRanking はランキング画面での付属情報。失敗しても UX を止めない (silent)。
      try {
        const my = await repository.fetchMyRanking(category);
        set({ myRanking: my });
      } catch (err) {
        console.warn('[scoreStore] loadMyRanking failed:', err);
        set({ myRanking: null });
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
