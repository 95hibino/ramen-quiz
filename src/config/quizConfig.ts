import type { CategoryMeta } from '@/types/quiz';

/** 1セッションの問題数 (design §3.1)。 */
export const QUESTIONS_PER_SESSION = 10;

/** 1問あたりの制限時間 (秒) (design §3.1)。 */
export const QUESTION_TIME_LIMIT_SEC = 20;

/**
 * 写真当てクイズの 1 問あたりの制限時間 (秒)。
 * 写真を視認する時間を確保するため知識クイズより長めに設定する (design §3.2)。
 */
export const PHOTO_QUESTION_TIME_LIMIT_SEC = 30;

/** 正解時の基本点。 */
export const BASE_POINTS_PER_CORRECT = 10;

/** 残り時間ボーナスの最大値 (design §3.1: 最大5点)。 */
export const MAX_TIME_BONUS = 5;

/** 何問おきにインフィード広告枠を挿入するか (design §3.3)。 */
export const AD_INTERVAL_QUESTIONS = 5;

/** カテゴリ表示メタ。 */
export const CATEGORY_META: CategoryMeta[] = [
  {
    category: 'basic',
    label: '初級',
    description: 'ラーメンの基礎知識 (スープ・麺・トッピングなど)',
    emoji: '🥢',
  },
  {
    category: 'regional',
    label: '中級',
    description: '地域・店舗・歴史 (ご当地ラーメンや老舗)',
    emoji: '🗾',
  },
  {
    category: 'expert',
    label: '上級',
    description: 'マニアック・食材・製麺',
    emoji: '🔥',
  },
];
