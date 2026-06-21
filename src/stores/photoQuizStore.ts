import { create } from 'zustand';
import type { AnswerRecord } from '@/types/quiz';
import type { PhotoQuestion, PhotoQuestionFilter } from '@/types/photoQuestion';
import { calculatePoints } from '@/lib/score';
import { compositePhotoQuestionRepository } from '@/lib/compositePhotoQuestionRepository';
import type { PhotoQuestionRepository } from '@/lib/photoQuestionRepository';
import { shuffle } from '@/lib/shuffle';
import { PHOTO_QUESTION_TIME_LIMIT_SEC, QUESTIONS_PER_SESSION } from '@/config/quizConfig';

export type PhotoSessionStatus = 'idle' | 'loading' | 'playing' | 'finished' | 'error';

interface PhotoQuizState {
  status: PhotoSessionStatus;
  /** 開始画面で選んだフィルタ条件 (セッション中も参照する)。 */
  filter: PhotoQuestionFilter;
  /** セッション用に決定した問題リスト (最大 QUESTIONS_PER_SESSION 件)。 */
  questions: PhotoQuestion[];
  currentIndex: number;
  answers: AnswerRecord[];
  errorMessage: string | null;

  /** フィルタ条件を更新する (開始画面用)。 */
  setFilter: (filter: PhotoQuestionFilter) => void;

  /** 現在のフィルタで新規セッションを開始する。 */
  startSession: () => Promise<void>;
  /** 現在の問題に回答する。 selectedIdx=null は時間切れ。 */
  submitAnswer: (selectedIdx: number | null, remainingSec: number) => void;
  /** 次の問題へ進む。最終問題なら status を 'finished' にする。 */
  goToNextQuestion: () => void;
  /** セッションを初期化する (フィルタは保持する)。 */
  resetSession: () => void;
  /** すべて初期化する (フィルタも含む)。 */
  reset: () => void;
}

const EMPTY_FILTER: PhotoQuestionFilter = {};

const INITIAL_SESSION = {
  status: 'idle' as PhotoSessionStatus,
  questions: [] as PhotoQuestion[],
  currentIndex: 0,
  answers: [] as AnswerRecord[],
  errorMessage: null as string | null,
};

/**
 * 写真当てクイズ用 Zustand ストアファクトリ。
 * 通常は `usePhotoQuizStore` を使う。
 */
export function createPhotoQuizStore(
  repository: PhotoQuestionRepository = compositePhotoQuestionRepository,
) {
  return create<PhotoQuizState>((set, get) => ({
    ...INITIAL_SESSION,
    filter: EMPTY_FILTER,

    setFilter: (filter) => {
      set({ filter });
    },

    startSession: async () => {
      const { filter } = get();
      set({ ...INITIAL_SESSION, status: 'loading', filter });
      try {
        const matched = await repository.findByFilter(filter);
        if (matched.length === 0) {
          set({
            status: 'error',
            errorMessage: '条件にマッチする問題がありません。条件を緩めてください。',
          });
          return;
        }
        const picked = shuffle(matched).slice(0, QUESTIONS_PER_SESSION);
        set({ status: 'playing', questions: picked, currentIndex: 0, answers: [] });
      } catch (err) {
        const message = err instanceof Error ? err.message : '問題の取得に失敗しました。';
        set({ status: 'error', errorMessage: message });
      }
    },

    submitAnswer: (selectedIdx, remainingSec) => {
      const { questions, currentIndex, answers, status } = get();
      if (status !== 'playing') return;
      const question = questions[currentIndex];
      if (!question) return;
      // 多重 submit を無視 (タイマー & クリック衝突対策)
      if (answers.length > currentIndex) return;

      const isCorrect = selectedIdx === question.answerIdx;
      const pointsEarned = calculatePoints(
        isCorrect,
        remainingSec,
        PHOTO_QUESTION_TIME_LIMIT_SEC,
      );
      const record: AnswerRecord = {
        questionId: question.id,
        selectedIdx,
        isCorrect,
        remainingSec,
        pointsEarned,
      };
      set({ answers: [...answers, record] });
    },

    goToNextQuestion: () => {
      const { currentIndex, questions } = get();
      const nextIndex = currentIndex + 1;
      if (nextIndex >= questions.length) {
        set({ status: 'finished' });
      } else {
        set({ currentIndex: nextIndex });
      }
    },

    resetSession: () => {
      const { filter } = get();
      set({ ...INITIAL_SESSION, filter });
    },

    reset: () => set({ ...INITIAL_SESSION, filter: EMPTY_FILTER }),
  }));
}

export const usePhotoQuizStore = createPhotoQuizStore();
