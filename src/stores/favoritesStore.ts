/**
 * お気に入り Zustand ストア。
 *
 * リポジトリ (`localFavoritesRepository`) を薄くラップし、React コンポーネント
 * から使いやすい形にする。永続化は `favoritesRepository` 側の localStorage で
 * 完結するため `persist` middleware は使わない (二重書き込みを避ける)。
 *
 * ストア初期化時に localStorage から一度だけ読み込み、以降は add/remove の
 * タイミングで store の state とリポジトリ両方を更新する。
 */
import { create } from 'zustand';
import {
  localFavoritesRepository,
  type FavoriteEntry,
  type FavoriteQuizType,
  type FavoritesRepository,
} from '@/lib/favoritesRepository';

interface FavoritesState {
  favorites: FavoriteEntry[];

  /** ストアを最新の localStorage 内容で再同期する。 */
  refresh: () => void;
  /** 追加。既に存在すれば no-op。 */
  add: (quizType: FavoriteQuizType, questionId: string) => void;
  /** 削除。存在しなくても no-op。 */
  remove: (quizType: FavoriteQuizType, questionId: string) => void;
  /** 登録済み判定 (現在の state を参照。localStorage は読まない)。 */
  has: (quizType: FavoriteQuizType, questionId: string) => boolean;
  /** 全削除。 */
  clearAll: () => void;
}

export function createFavoritesStore(
  repository: FavoritesRepository = localFavoritesRepository,
) {
  return create<FavoritesState>((set, get) => ({
    favorites: repository.getAll(),

    refresh: () => {
      set({ favorites: repository.getAll() });
    },

    add: (quizType, questionId) => {
      const entry: FavoriteEntry = {
        quizType,
        questionId,
        addedAt: new Date().toISOString(),
      };
      repository.add(entry);
      set({ favorites: repository.getAll() });
    },

    remove: (quizType, questionId) => {
      repository.remove(quizType, questionId);
      set({ favorites: repository.getAll() });
    },

    has: (quizType, questionId) => {
      return get().favorites.some(
        (e) => e.quizType === quizType && e.questionId === questionId,
      );
    },

    clearAll: () => {
      repository.clear();
      set({ favorites: [] });
    },
  }));
}

export const useFavoritesStore = createFavoritesStore();
