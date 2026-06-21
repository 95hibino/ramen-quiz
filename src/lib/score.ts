import {
  BASE_POINTS_PER_CORRECT,
  MAX_TIME_BONUS,
  QUESTION_TIME_LIMIT_SEC,
} from '@/config/quizConfig';

/**
 * 1問あたりの獲得スコアを計算する。
 *
 * - 不正解 / 時間切れ: 0 点
 * - 正解: 基本点 + 残り時間ボーナス (残り秒 / 制限秒 × MAX_TIME_BONUS, 四捨五入)
 *
 * @param isCorrect 正解かどうか
 * @param remainingSec 残り秒数 (0..timeLimitSec)
 * @param timeLimitSec 制限時間 (デフォルト: 知識クイズの 20 秒)
 */
export function calculatePoints(
  isCorrect: boolean,
  remainingSec: number,
  timeLimitSec: number = QUESTION_TIME_LIMIT_SEC,
): number {
  if (!isCorrect) return 0;
  if (timeLimitSec <= 0) return BASE_POINTS_PER_CORRECT;
  const clamped = Math.max(0, Math.min(timeLimitSec, remainingSec));
  const bonus = Math.round((clamped / timeLimitSec) * MAX_TIME_BONUS);
  return BASE_POINTS_PER_CORRECT + bonus;
}

/** 想定される最大スコア (基本点 + ボーナス満点) × 問題数。 */
export function maxPossibleScore(questionCount: number): number {
  return (BASE_POINTS_PER_CORRECT + MAX_TIME_BONUS) * questionCount;
}
