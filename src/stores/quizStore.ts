import { create } from 'zustand';
import rawQuestions from '@/data/questions.json';
import type { AnswerRecord, QuizCategory, QuizQuestion } from '@/types/quiz';
import { calculatePoints } from '@/lib/score';
import { mockQuestionRepository } from '@/lib/mockQuestionRepository';
import type { QuestionRepository } from '@/lib/questionRepository';
import { shuffle } from '@/lib/shuffle';
import { QUESTIONS_PER_SESSION } from '@/config/quizConfig';

export type SessionStatus = 'idle' | 'loading' | 'playing' | 'finished' | 'error';

/**
 * セッション種別。
 * - `category`: 通常のカテゴリ選択プレイ (basic/regional/expert)。
 * - `review`: 学習モードから、間違えた問題だけを再挑戦するプレイ。
 */
export type SessionMode = 'category' | 'review';

interface QuizState {
  status: SessionStatus;
  category: QuizCategory | null;
  /** セッション種別 (通常 or 復習)。Result 画面がナビ先を切り替えるために参照する。 */
  mode: SessionMode;
  questions: QuizQuestion[];
  currentIndex: number;
  answers: AnswerRecord[];
  errorMessage: string | null;

  /** 指定カテゴリで新規セッションを開始する。 */
  startSession: (category: QuizCategory) => Promise<void>;
  /**
   * 学習モード用: 指定問題 ID のみで復習セッションを開始する。
   * ID から `questions.json` を引き、シャッフルして最大 QUESTIONS_PER_SESSION 問を採用する。
   * 対象が 0 件なら error に落ちる。カテゴリは null のままにする。
   */
  startReviewSession: (questionIds: string[]) => void;
  /** 現在の問題に回答する。 selectedIdx=null は時間切れ。 */
  submitAnswer: (selectedIdx: number | null, remainingSec: number) => void;
  /** 次の問題に進む。最終問題なら status を 'finished' にする。 */
  goToNextQuestion: () => void;
  /** 状態を初期化する (TOPに戻る等)。 */
  reset: () => void;
}

const INITIAL_STATE = {
  status: 'idle' as SessionStatus,
  category: null,
  mode: 'category' as SessionMode,
  questions: [] as QuizQuestion[],
  currentIndex: 0,
  answers: [] as AnswerRecord[],
  errorMessage: null as string | null,
};

/**
 * Zustand ストアファクトリ。
 * 通常は `useQuizStore` を使う。リポジトリ差し替えテスト用に export しておく。
 */
export function createQuizStore(repository: QuestionRepository = mockQuestionRepository) {
  return create<QuizState>((set, get) => ({
    ...INITIAL_STATE,

    startSession: async (category) => {
      set({ ...INITIAL_STATE, status: 'loading', category, mode: 'category' });
      try {
        const questions = await repository.fetchQuestionsByCategory(category, QUESTIONS_PER_SESSION);
        if (questions.length === 0) {
          set({ status: 'error', errorMessage: 'このカテゴリの問題が見つかりませんでした。' });
          return;
        }
        set({ status: 'playing', questions, currentIndex: 0, answers: [] });
      } catch (err) {
        const message = err instanceof Error ? err.message : '問題の取得に失敗しました。';
        set({ status: 'error', errorMessage: message });
      }
    },

    startReviewSession: (questionIds) => {
      // ID セット (JSON 側の順序に依存せずに O(1) ルックアップするため)。
      const idSet = new Set(questionIds);
      const all = rawQuestions as QuizQuestion[];
      const matched = all.filter((q) => idSet.has(q.id));
      if (matched.length === 0) {
        set({
          ...INITIAL_STATE,
          mode: 'review',
          status: 'error',
          errorMessage: '復習する問題がまだ登録されていません。まずはクイズをプレイしてみましょう。',
        });
        return;
      }
      const picked = shuffle(matched).slice(0, QUESTIONS_PER_SESSION);
      set({
        ...INITIAL_STATE,
        mode: 'review',
        status: 'playing',
        questions: picked,
        currentIndex: 0,
        answers: [],
      });
    },

    submitAnswer: (selectedIdx, remainingSec) => {
      const { questions, currentIndex, answers, status } = get();
      if (status !== 'playing') return;
      const question = questions[currentIndex];
      if (!question) return;
      // 既に同じ問題で回答済みなら多重 submit を無視 (タイマー & クリック衝突対策)
      if (answers.length > currentIndex) return;

      const isCorrect = selectedIdx === question.answerIdx;
      const pointsEarned = calculatePoints(isCorrect, remainingSec);
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

    reset: () => set({ ...INITIAL_STATE }),
  }));
}

export const useQuizStore = createQuizStore();
