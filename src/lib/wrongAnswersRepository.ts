/**
 * 間違えた問題リポジトリ (学習モード用)。
 *
 * ユーザーがクイズで不正解になった問題の ID を localStorage に蓄積し、
 * `/learn` の復習画面で再表示するためのストレージ。
 *
 * 設計方針:
 * - お気に入り ([[favoritesRepository]]) と同じく端末単位で保存 (per-device)。
 *   複数端末での同期は行わない。
 * - `quizType` (knowledge/photo) × `questionId` で一意。
 * - 再度間違えると `wrongCount` を加算 (優先復習の指標に将来使える)。
 * - 復習で正解したときは `remove` で削除するのは呼び出し側の責任。
 *
 * 保存キー: `ramen-quiz:wrong-answers:v1`
 */
import { readJson, writeJson } from '@/lib/storage';

export type WrongAnswerQuizType = 'knowledge' | 'photo';

/** 間違えた問題 1 件分。 */
export interface WrongAnswerEntry {
  quizType: WrongAnswerQuizType;
  questionId: string;
  /** 累計不正解回数 (1 以上)。同じ問題を再度間違えたら +1 する。 */
  wrongCount: number;
  /** 最後に不正解になった日時 (ISO8601)。 */
  lastWrongAt: string;
}

export const WRONG_ANSWERS_STORAGE_KEY = 'ramen-quiz:wrong-answers:v1';

export interface WrongAnswersRepository {
  /** 全件取得 (最新の間違えた順)。 */
  getAll(): WrongAnswerEntry[];
  /**
   * 追加 or 更新。既存があれば `wrongCount` を +1 し、`lastWrongAt` を更新する。
   * (同じセッション内で同じ問題を複数回間違えるケースは想定しない。)
   */
  record(quizType: WrongAnswerQuizType, questionId: string): void;
  /** 削除。存在しなくても no-op。 */
  remove(quizType: WrongAnswerQuizType, questionId: string): void;
  /** 登録済みかを判定。 */
  has(quizType: WrongAnswerQuizType, questionId: string): boolean;
  /** 全削除。 */
  clear(): void;
}

function loadEntries(): WrongAnswerEntry[] {
  const raw = readJson<WrongAnswerEntry[]>(WRONG_ANSWERS_STORAGE_KEY, []);
  if (!Array.isArray(raw)) return [];
  // 型ガード: 破損データが混入していた場合は落ちずに無視する。
  return raw.filter(
    (e): e is WrongAnswerEntry =>
      !!e &&
      typeof e === 'object' &&
      (e.quizType === 'knowledge' || e.quizType === 'photo') &&
      typeof e.questionId === 'string' &&
      typeof e.wrongCount === 'number' &&
      typeof e.lastWrongAt === 'string',
  );
}

function saveEntries(entries: WrongAnswerEntry[]): void {
  writeJson(WRONG_ANSWERS_STORAGE_KEY, entries);
}

function sameKey(
  e: WrongAnswerEntry,
  quizType: WrongAnswerQuizType,
  questionId: string,
): boolean {
  return e.quizType === quizType && e.questionId === questionId;
}

export const localWrongAnswersRepository: WrongAnswersRepository = {
  getAll(): WrongAnswerEntry[] {
    return loadEntries().sort((a, b) => b.lastWrongAt.localeCompare(a.lastWrongAt));
  },

  record(quizType, questionId): void {
    const entries = loadEntries();
    const now = new Date().toISOString();
    const existingIdx = entries.findIndex((e) => sameKey(e, quizType, questionId));
    if (existingIdx >= 0) {
      const cur = entries[existingIdx];
      entries[existingIdx] = {
        ...cur,
        wrongCount: cur.wrongCount + 1,
        lastWrongAt: now,
      };
    } else {
      entries.push({ quizType, questionId, wrongCount: 1, lastWrongAt: now });
    }
    saveEntries(entries);
  },

  remove(quizType, questionId): void {
    const entries = loadEntries();
    const next = entries.filter((e) => !sameKey(e, quizType, questionId));
    if (next.length === entries.length) return;
    saveEntries(next);
  },

  has(quizType, questionId): boolean {
    return loadEntries().some((e) => sameKey(e, quizType, questionId));
  },

  clear(): void {
    saveEntries([]);
  },
};
