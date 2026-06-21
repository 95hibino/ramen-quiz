import rawPhotoQuestions from '@/data/photoQuestions.json';
import type { PhotoQuestion, PhotoQuestionFilter } from '@/types/photoQuestion';
import { matchesFilter, type PhotoQuestionRepository } from './photoQuestionRepository';

/**
 * ローカル JSON ファイルから写真クイズ問題を返すモック実装。
 * 画像 URL は `public/photo_quiz/<ファイル名>` で社長提供の実画像を参照する。
 */
export const mockPhotoQuestionRepository: PhotoQuestionRepository = {
  async findByFilter(filter: PhotoQuestionFilter): Promise<PhotoQuestion[]> {
    const all = rawPhotoQuestions as PhotoQuestion[];
    return all.filter((q) => matchesFilter(q, filter));
  },

  async countByFilter(filter: PhotoQuestionFilter): Promise<number> {
    const all = rawPhotoQuestions as PhotoQuestion[];
    let count = 0;
    for (const q of all) {
      if (matchesFilter(q, filter)) count += 1;
    }
    return count;
  },
};
