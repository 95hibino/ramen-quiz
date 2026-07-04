/**
 * お気に入り問題リポジトリ。
 *
 * localStorage 完結の軽量ストレージ。既存の `types/account.ts` の
 * `ScoreRecord` などとは独立した型を持ち、知識クイズ (`knowledge`) と
 * 写真クイズ (`photo`) 双方の問題 ID を扱う。
 *
 * 保存キー: `ramen-quiz:favorites:v1`
 * 保存形式: `FavoriteEntry[]` (追加順)
 *
 * 別デバイス間の同期は行わない。仕様の詳細は `docs/MYPAGE.md` を参照。
 */
import { readJson, writeJson } from '@/lib/storage';

export type FavoriteQuizType = 'knowledge' | 'photo';

/** お気に入り 1 件分。 */
export interface FavoriteEntry {
  quizType: FavoriteQuizType;
  questionId: string;
  /** 追加日時 (ISO8601)。 */
  addedAt: string;
}

/**
 * localStorage キー。旧バージョンとの共存に備え `:v1` で明示的にスキーマを分ける。
 * (`STORAGE_KEYS` には敢えて含めない: 認証・スコアと別ドメインのため。)
 */
export const FAVORITES_STORAGE_KEY = 'ramen-quiz:favorites:v1';

export interface FavoritesRepository {
  /** 全件取得 (追加日時の新しい順)。 */
  getAll(): FavoriteEntry[];
  /**
   * 追加。既に同じ `quizType` + `questionId` が存在すればそのまま。
   * (二重追加による重複を避けるためリポジトリ側で吸収する)
   */
  add(entry: FavoriteEntry): void;
  /** 削除。存在しなくても no-op。 */
  remove(quizType: FavoriteQuizType, questionId: string): void;
  /** 登録済みかを判定。 */
  has(quizType: FavoriteQuizType, questionId: string): boolean;
  /** 全削除。 */
  clear(): void;
}

function loadEntries(): FavoriteEntry[] {
  const raw = readJson<FavoriteEntry[]>(FAVORITES_STORAGE_KEY, []);
  // 型ガード: 破損データが混入していた場合は落ちずに無視する
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (e): e is FavoriteEntry =>
      !!e &&
      typeof e === 'object' &&
      (e.quizType === 'knowledge' || e.quizType === 'photo') &&
      typeof e.questionId === 'string' &&
      typeof e.addedAt === 'string',
  );
}

function saveEntries(entries: FavoriteEntry[]): void {
  writeJson(FAVORITES_STORAGE_KEY, entries);
}

function sameKey(a: FavoriteEntry, quizType: FavoriteQuizType, questionId: string): boolean {
  return a.quizType === quizType && a.questionId === questionId;
}

/** localStorage 実装のお気に入りリポジトリ。 */
export const localFavoritesRepository: FavoritesRepository = {
  getAll(): FavoriteEntry[] {
    return loadEntries().sort((a, b) => b.addedAt.localeCompare(a.addedAt));
  },

  add(entry: FavoriteEntry): void {
    const entries = loadEntries();
    if (entries.some((e) => sameKey(e, entry.quizType, entry.questionId))) {
      return; // 既存の重複はスキップ
    }
    saveEntries([...entries, entry]);
  },

  remove(quizType: FavoriteQuizType, questionId: string): void {
    const entries = loadEntries();
    const next = entries.filter((e) => !sameKey(e, quizType, questionId));
    if (next.length === entries.length) return;
    saveEntries(next);
  },

  has(quizType: FavoriteQuizType, questionId: string): boolean {
    return loadEntries().some((e) => sameKey(e, quizType, questionId));
  },

  clear(): void {
    saveEntries([]);
  },
};
