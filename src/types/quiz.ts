/**
 * クイズドメインの型定義。
 * Supabase のテーブル定義 (design §3.1) に揃え、フロント内では camelCase で扱う。
 */

export type QuizCategory = 'basic' | 'regional' | 'expert';
export type QuizDifficulty = 1 | 2 | 3;

/** 問題1問分。 */
export interface QuizQuestion {
  id: string;
  category: QuizCategory;
  difficulty: QuizDifficulty;
  question: string;
  /** 4択。順序は表示順そのまま使う。 */
  options: string[];
  /** 0..options.length-1 */
  answerIdx: number;
  /** 解説文。任意。 */
  explanation?: string;
}

/** 1問の回答結果。 */
export interface AnswerRecord {
  questionId: string;
  selectedIdx: number | null; // null = 時間切れ
  isCorrect: boolean;
  /** 残り秒数 (0..QUESTION_TIME_LIMIT_SEC) */
  remainingSec: number;
  /** その問題で獲得した点数 */
  pointsEarned: number;
}

/** カテゴリ表示用メタ情報。 */
export interface CategoryMeta {
  category: QuizCategory;
  label: string;
  description: string;
  emoji: string;
}
