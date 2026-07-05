/**
 * 間違えた問題 Zustand ストア。
 *
 * リポジトリ ([[wrongAnswersRepository]]) を薄くラップし、React コンポーネントから
 * 使いやすい形にする。永続化はリポジトリ側の localStorage で完結するため
 * `persist` middleware は使わない (二重書き込み回避)。
 *
 * 初期化時に localStorage を 1 度だけ読み、以降は record/remove 時に
 * state とリポジトリ両方を更新する。
 */
import { create } from 'zustand';
import {
  localWrongAnswersRepository,
  type WrongAnswerEntry,
  type WrongAnswerQuizType,
  type WrongAnswersRepository,
} from '@/lib/wrongAnswersRepository';

interface WrongAnswersState {
  wrongAnswers: WrongAnswerEntry[];

  /** ストアを最新の localStorage 内容で再同期する。 */
  refresh: () => void;
  /** 不正解を記録。既存があれば wrongCount を +1。 */
  record: (quizType: WrongAnswerQuizType, questionId: string) => void;
  /** 削除。存在しなくても no-op。 */
  remove: (quizType: WrongAnswerQuizType, questionId: string) => void;
  /** 登録済み判定。 */
  has: (quizType: WrongAnswerQuizType, questionId: string) => boolean;
  /** 全削除。 */
  clearAll: () => void;
}

export function createWrongAnswersStore(
  repository: WrongAnswersRepository = localWrongAnswersRepository,
) {
  return create<WrongAnswersState>((set, get) => ({
    wrongAnswers: repository.getAll(),

    refresh: () => {
      set({ wrongAnswers: repository.getAll() });
    },

    record: (quizType, questionId) => {
      repository.record(quizType, questionId);
      set({ wrongAnswers: repository.getAll() });
    },

    remove: (quizType, questionId) => {
      repository.remove(quizType, questionId);
      set({ wrongAnswers: repository.getAll() });
    },

    has: (quizType, questionId) => {
      return get().wrongAnswers.some(
        (e) => e.quizType === quizType && e.questionId === questionId,
      );
    },

    clearAll: () => {
      repository.clear();
      set({ wrongAnswers: [] });
    },
  }));
}

export const useWrongAnswersStore = createWrongAnswersStore();
