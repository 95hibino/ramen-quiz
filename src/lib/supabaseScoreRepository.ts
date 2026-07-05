/**
 * Supabase 実装の ScoreRepository。
 *
 * - `recordScore`: プロフィール upsert → quiz_scores に INSERT
 * - `listScoresByUser`: user_id で絞って新しい順
 * - `fetchRanking`: quiz_ranking ビュー (public_profiles LEFT JOIN quiz_scores) を SELECT
 *
 * Supabase 未接続時は空データを返し、`compositeScoreRepository` 側で
 * localScoreRepository にフォールバックする。
 *
 * レート制限: DB トリガー `enforce_quiz_score_rate_limit` が同一 user_id からの
 * 3 秒以内連投を弾く (`rate_limit_exceeded:<秒数>` を RAISE)。
 * `RateLimitError` は写真投稿と同じ形式でフロントに伝える。
 */
import { generateId } from '@/lib/storage';
import type { ScoreRepository } from '@/lib/scoreRepository';
import type { RankingEntry, ScoreRecord, User } from '@/types/account';
import { isValidPrefecture, type Prefecture } from '@/data/prefectures';
import type { QuizCategory } from '@/types/quiz';
import { RateLimitError } from './supabasePhotoQuestionRepository';
import { upsertPublicProfile } from './supabasePublicProfileRepository';
import {
  getSupabaseClient,
  QUIZ_RANKING_VIEW,
  QUIZ_SCORES_TABLE,
} from './supabaseClient';

/** DB 行 (quiz_scores) → ScoreRecord へのマッピング用の row 型。 */
interface QuizScoreRow {
  id: string;
  user_id: string;
  quiz_type: string;
  category: string | null;
  score: number;
  correct_count: number;
  total_count: number;
  played_at: string;
}

/** DB 行 (quiz_ranking view) → RankingEntry のマッピング用。 */
interface RankingRow {
  user_id: string;
  username: string;
  prefecture: string;
  favorite_shop: string;
  created_at: string;
  total_score: number;
  play_count: number;
}

const VALID_QUIZ_TYPES = new Set(['knowledge', 'photo']);
const VALID_CATEGORIES = new Set<QuizCategory>(['basic', 'regional', 'expert']);

function parseCategory(value: string | null): QuizCategory | undefined {
  if (!value) return undefined;
  return VALID_CATEGORIES.has(value as QuizCategory) ? (value as QuizCategory) : undefined;
}

function rowToScoreRecord(row: QuizScoreRow): ScoreRecord | null {
  if (!VALID_QUIZ_TYPES.has(row.quiz_type)) return null;
  return {
    id: row.id,
    userId: row.user_id,
    quizType: row.quiz_type,
    category: parseCategory(row.category),
    score: row.score,
    correctCount: row.correct_count,
    totalCount: row.total_count,
    playedAt: row.played_at,
  };
}

function rowToRankingEntry(row: RankingRow): RankingEntry | null {
  if (!isValidPrefecture(row.prefecture)) return null;
  const user: User = {
    id: row.user_id,
    username: row.username,
    prefecture: row.prefecture as Prefecture,
    favoriteShop: row.favorite_shop,
    createdAt: row.created_at,
  };
  return {
    user,
    totalScore: row.total_score,
    playCount: row.play_count,
  };
}

/** レート制限メッセージのパース (`rate_limit_exceeded:<秒数>` を検出)。 */
function parseRateLimitMessage(message: string | undefined | null): number | null {
  if (!message) return null;
  const match = message.match(/rate_limit_exceeded:(\d+)/);
  if (!match) return null;
  const seconds = Number.parseInt(match[1], 10);
  if (!Number.isFinite(seconds) || seconds < 0) return null;
  return seconds;
}

export const supabaseScoreRepository: ScoreRepository = {
  async recordScore(input): Promise<ScoreRecord> {
    const client = getSupabaseClient();
    if (!client) {
      throw new Error('Supabase が未接続のためスコアを記録できません。');
    }

    // FK 制約 (user_id → public_profiles) を満たすため、記録前に必ずプロフィールが
    // 存在することを保証する。呼び出し側 (compositeScoreRepository) がユーザー情報を
    // 事前に渡していない場合、localAuthRepository から補完する。
    // ここでは呼び出し元が upsert 済みの想定で INSERT のみ行う (安全網は composite 側)。

    const record: ScoreRecord = {
      id: generateId(),
      playedAt: new Date().toISOString(),
      ...input,
    };

    const payload = {
      id: record.id,
      user_id: record.userId,
      quiz_type: record.quizType,
      category: record.category ?? null,
      score: record.score,
      correct_count: record.correctCount,
      total_count: record.totalCount,
      played_at: record.playedAt,
    };

    const { error } = await client.from(QUIZ_SCORES_TABLE).insert(payload);
    if (error) {
      const composite = [error.message, error.details, error.hint]
        .filter((s): s is string => typeof s === 'string')
        .join(' | ');
      const retryAfter = parseRateLimitMessage(composite);
      if (retryAfter !== null) {
        throw new RateLimitError(retryAfter);
      }
      throw new Error(`スコア記録に失敗しました: ${error.message}`);
    }
    return record;
  },

  async listScoresByUser(userId: string): Promise<ScoreRecord[]> {
    const client = getSupabaseClient();
    if (!client) return [];
    const { data, error } = await client
      .from(QUIZ_SCORES_TABLE)
      .select('*')
      .eq('user_id', userId)
      .order('played_at', { ascending: false });
    if (error) {
      console.warn('[supabaseScoreRepository] listScoresByUser failed:', error.message);
      return [];
    }
    const rows = (data ?? []) as QuizScoreRow[];
    const result: ScoreRecord[] = [];
    for (const row of rows) {
      const rec = rowToScoreRecord(row);
      if (rec) result.push(rec);
    }
    return result;
  },

  async fetchRanking(limit: number): Promise<RankingEntry[]> {
    const client = getSupabaseClient();
    if (!client) return [];
    // quiz_ranking view はサーバ側で totalScore DESC, playCount ASC の順序を保証する。
    const { data, error } = await client
      .from(QUIZ_RANKING_VIEW)
      .select('*')
      .limit(limit);
    if (error) {
      console.warn('[supabaseScoreRepository] fetchRanking failed:', error.message);
      return [];
    }
    const rows = (data ?? []) as RankingRow[];
    const result: RankingEntry[] = [];
    for (const row of rows) {
      const entry = rowToRankingEntry(row);
      if (entry) result.push(entry);
    }
    return result;
  },
};

/**
 * プロフィール upsert を含む安全網付きの recordScore。
 * 通常は compositeScoreRepository 経由で呼ばれる。
 */
export async function recordScoreWithProfile(
  user: User,
  input: Omit<ScoreRecord, 'id' | 'playedAt'>,
): Promise<ScoreRecord> {
  await upsertPublicProfile(user);
  return supabaseScoreRepository.recordScore(input);
}

