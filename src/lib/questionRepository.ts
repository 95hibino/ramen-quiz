import type { QuizCategory, QuizQuestion } from '@/types/quiz';

/**
 * 問題データソースの抽象インターフェース。
 * Phase 1 はローカル JSON のモック実装、Phase 2 で Supabase 実装に差し替える。
 */
export interface QuestionRepository {
  /**
   * 指定カテゴリから問題を最大 limit 件、ランダムに取得する。
   */
  fetchQuestionsByCategory(category: QuizCategory, limit: number): Promise<QuizQuestion[]>;
}
