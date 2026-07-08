import { create } from 'zustand';
import type { AnswerRecord } from '@/types/quiz';
import type { PhotoQuestion, PhotoQuestionFilter } from '@/types/photoQuestion';
import { calculatePoints } from '@/lib/score';
import { compositePhotoQuestionRepository } from '@/lib/compositePhotoQuestionRepository';
import type { PhotoQuestionRepository } from '@/lib/photoQuestionRepository';
import { shuffle } from '@/lib/shuffle';
import { PHOTO_QUESTION_TIME_LIMIT_SEC, QUESTIONS_PER_SESSION } from '@/config/quizConfig';

export type PhotoSessionStatus = 'idle' | 'loading' | 'playing' | 'finished' | 'error';

/**
 * セッション種別。
 * - `filter`: 通常の 5 軸絞り込みプレイ
 * - `review`: 学習モードから、間違えた写真クイズだけを再挑戦するプレイ
 */
export type PhotoSessionMode = 'filter' | 'review';

interface PhotoQuizState {
  status: PhotoSessionStatus;
  /** セッション種別 (通常フィルタ or 復習)。Result 側で挙動を切り替えるために参照。 */
  mode: PhotoSessionMode;
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
  /**
   * 学習モード用: 指定問題 ID のみで復習セッションを開始する。
   * リポジトリから ID で問題を取得し、shuffle して最大 QUESTIONS_PER_SESSION 問を採用する。
   * 対象が 0 件なら error に落ちる。
   */
  startReviewSession: (questionIds: string[]) => Promise<void>;
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
  mode: 'filter' as PhotoSessionMode,
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
      set({ ...INITIAL_SESSION, status: 'loading', mode: 'filter', filter });
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

    startReviewSession: async (questionIds) => {
      // フィルタは復習では意味を持たないので空でリセット。
      set({ ...INITIAL_SESSION, status: 'loading', mode: 'review', filter: EMPTY_FILTER });
      if (questionIds.length === 0) {
        set({
          status: 'error',
          errorMessage: '復習する写真クイズがまだ登録されていません。まずはクイズをプレイしてみましょう。',
        });
        return;
      }
      try {
        const matched = await repository.findByIds(questionIds);
        if (matched.length === 0) {
          // 指定 ID が全て失われている (投稿削除・DB オフライン等)。
          set({
            status: 'error',
            errorMessage:
              '復習対象の問題が現在利用できません。オフラインのときは Supabase 由来の問題は取得できないため、通信を確認してもう一度お試しください。',
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
