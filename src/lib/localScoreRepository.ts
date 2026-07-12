import type {
  RankingCategory,
  RankingEntry,
  ScoreRecord,
  User,
} from '@/types/account';
import { generateId, readJson, STORAGE_KEYS, writeJson } from '@/lib/storage';
import { localAuthRepository } from '@/lib/localAuthRepository';
import type { RecordScoreInput, ScoreRepository } from '@/lib/scoreRepository';

function loadScores(): ScoreRecord[] {
  return readJson<ScoreRecord[]>(STORAGE_KEYS.scores, []);
}

function saveScores(scores: ScoreRecord[]): void {
  writeJson(STORAGE_KEYS.scores, scores);
}

/**
 * ScoreRecord から、それが属するランキングカテゴリを推定する。
 * - photo クイズ → 'photo'
 * - knowledge クイズ + category → その category を採用
 * - それ以外 → null (ランキング対象外)
 */
function inferRankingCategoryFromRecord(record: ScoreRecord): RankingCategory | null {
  if (record.quizType === 'photo') return 'photo';
  if (record.quizType === 'knowledge' && record.category) {
    return record.category;
  }
  return null;
}

/**
 * localStorage 上にスコアを永続化する実装。
 * §14 移行に合わせて fetchRanking はカテゴリ別ベストスコアで並べる。
 */
export const localScoreRepository: ScoreRepository = {
  async recordScore(input: RecordScoreInput): Promise<ScoreRecord> {
    const scores = loadScores();
    const record: ScoreRecord = {
      userId: input.userId,
      quizType: input.quizType,
      category: input.category,
      score: input.score,
      correctCount: input.correctCount,
      totalCount: input.totalCount,
      id: generateId(),
      playedAt: new Date().toISOString(),
    };
    saveScores([...scores, record]);
    return record;
  },

  async listScoresByUser(userId: string): Promise<ScoreRecord[]> {
    return loadScores()
      .filter((s) => s.userId === userId)
      .sort((a, b) => b.playedAt.localeCompare(a.playedAt));
  },

  async fetchRanking(
    category: RankingCategory,
    limit: number,
  ): Promise<RankingEntry[]> {
    // localStorage の scores から、指定カテゴリのユーザーごとのベストを集計。
    // Supabase 未接続の開発環境向けなので、UI 動作確認できる程度で十分。
    const scores = loadScores();
    const users = await localAuthRepository.listUsers();
    const userMap = new Map<string, User>(users.map((u) => [u.id, u]));

    // { userId → best RankingEntry }
    const bestByUser = new Map<string, RankingEntry>();
    for (const s of scores) {
      const cat = inferRankingCategoryFromRecord(s);
      if (cat !== category) continue;
      const user = userMap.get(s.userId);
      if (!user) continue;

      const existing = bestByUser.get(s.userId);
      if (!existing || s.score > existing.bestScore) {
        bestByUser.set(s.userId, {
          user,
          rankingCategory: category,
          bestScore: s.score,
          correctCount: s.correctCount,
          totalCount: s.totalCount,
          achievedAt: s.playedAt,
        });
      }
    }

    const entries = Array.from(bestByUser.values());
    entries.sort((a, b) => {
      if (b.bestScore !== a.bestScore) return b.bestScore - a.bestScore;
      return a.achievedAt.localeCompare(b.achievedAt);
    });
    return entries.slice(0, limit);
  },
};
