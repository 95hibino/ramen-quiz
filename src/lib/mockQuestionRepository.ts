import rawQuestions from '@/data/questions.json';
import type { QuizCategory, QuizQuestion } from '@/types/quiz';
import { shuffle } from './shuffle';
import type { QuestionRepository } from './questionRepository';

/**
 * ローカル JSON ファイルから問題を返すモック実装。
 * Supabase 接続前の Phase 1 で使用する。
 */
export const mockQuestionRepository: QuestionRepository = {
  async fetchQuestionsByCategory(category: QuizCategory, limit: number): Promise<QuizQuestion[]> {
    const all = rawQuestions as QuizQuestion[];
    const filtered = all.filter((q) => q.category === category);
    return shuffle(filtered).slice(0, limit);
  },
};
