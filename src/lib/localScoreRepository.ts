import type { RankingEntry, ScoreRecord, User } from '@/types/account';
import { generateId, readJson, STORAGE_KEYS, writeJson } from '@/lib/storage';
import { localAuthRepository } from '@/lib/localAuthRepository';
import type { ScoreRepository } from '@/lib/scoreRepository';

function loadScores(): ScoreRecord[] {
  return readJson<ScoreRecord[]>(STORAGE_KEYS.scores, []);
}

function saveScores(scores: ScoreRecord[]): void {
  writeJson(STORAGE_KEYS.scores, scores);
}

/**
 * localStorage 上にスコアを永続化する実装。
 */
export const localScoreRepository: ScoreRepository = {
  async recordScore(input): Promise<ScoreRecord> {
    const scores = loadScores();
    const record: ScoreRecord = {
      ...input,
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

  async fetchRanking(limit: number): Promise<RankingEntry[]> {
    const scores = loadScores();
    const users = await localAuthRepository.listUsers();
    const userMap = new Map<string, User>(users.map((u) => [u.id, u]));

    const aggregated = new Map<string, { totalScore: number; playCount: number }>();
    for (const s of scores) {
      const cur = aggregated.get(s.userId) ?? { totalScore: 0, playCount: 0 };
      cur.totalScore += s.score;
      cur.playCount += 1;
      aggregated.set(s.userId, cur);
    }

    const entries: RankingEntry[] = [];
    for (const [userId, agg] of aggregated.entries()) {
      const user = userMap.get(userId);
      if (!user) continue; // ユーザー削除済み等
      entries.push({ user, totalScore: agg.totalScore, playCount: agg.playCount });
    }

    entries.sort((a, b) => {
      if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
      // 同点はプレイ回数の少ない方を優先 (効率重視)
      return a.playCount - b.playCount;
    });

    return entries.slice(0, limit);
  },
};
