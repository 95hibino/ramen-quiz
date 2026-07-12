/**
 * Supabase 実装の ScoreRepository。
 *
 * §14 移行後の役割:
 * - `recordScore`: `quiz_scores` に INSERT (プレイ履歴) + `record_best_score` RPC
 *   (ベストスコア更新、rankingCategory が指定されたときのみ)
 * - `listScoresByUser`: `quiz_scores` を user_id で絞って新しい順 (マイページ用)
 * - `fetchRanking`: `quiz_ranking_by_category` ビューから指定カテゴリ分を取得
 *
 * Supabase 未接続時は空データを返し、`compositeScoreRepository` 側で
 * localScoreRepository にフォールバックする。
 *
 * レート制限: DB トリガー `enforce_quiz_score_rate_limit` が同一 user_id からの
 * 3 秒以内連投を弾く (`rate_limit_exceeded:<秒数>` を RAISE)。
 * `RateLimitError` は写真投稿と同じ形式でフロントに伝える。
 */
import { generateId } from '@/lib/storage';
import type { RecordScoreInput, ScoreRepository } from '@/lib/scoreRepository';
import type {
  RankingCategory,
  RankingEntry,
  ScoreRecord,
  User,
} from '@/types/account';
import { isValidPrefecture, type Prefecture } from '@/data/prefectures';
import type { QuizCategory } from '@/types/quiz';
import { RateLimitError } from './supabasePhotoQuestionRepository';
import { upsertPublicProfile } from './supabasePublicProfileRepository';
import {
  getSupabaseClient,
  QUIZ_RANKING_BY_CATEGORY_VIEW,
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

/** DB 行 (quiz_ranking_by_category view) → RankingEntry のマッピング用。 */
interface RankingByCategoryRow {
  user_id: string;
  username: string;
  prefecture: string;
  favorite_shop: string;
  ranking_category: string;
  best_score: number;
  correct_count: number;
  total_count: number;
  achieved_at: string;
}

const VALID_QUIZ_TYPES = new Set(['knowledge', 'photo']);
const VALID_CATEGORIES = new Set<QuizCategory>(['basic', 'regional', 'expert']);
const VALID_RANKING_CATEGORIES = new Set<RankingCategory>([
  'basic',
  'regional',
  'expert',
  'photo',
]);

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

function rowToRankingEntry(row: RankingByCategoryRow): RankingEntry | null {
  if (!isValidPrefecture(row.prefecture)) return null;
  if (!VALID_RANKING_CATEGORIES.has(row.ranking_category as RankingCategory)) return null;
  const user: User = {
    id: row.user_id,
    username: row.username,
    prefecture: row.prefecture as Prefecture,
    favoriteShop: row.favorite_shop,
    // view には created_at を含めていないため、達成日時で代用 (UI 上表示しない情報)
    createdAt: row.achieved_at,
  };
  return {
    user,
    rankingCategory: row.ranking_category as RankingCategory,
    bestScore: row.best_score,
    correctCount: row.correct_count,
    totalCount: row.total_count,
    achievedAt: row.achieved_at,
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
  async recordScore(input: RecordScoreInput): Promise<ScoreRecord> {
    const client = getSupabaseClient();
    if (!client) {
      throw new Error('Supabase が未接続のためスコアを記録できません。');
    }

    // 1) quiz_scores に履歴として INSERT (マイページのプレイ履歴・スコア推移用)
    const record: ScoreRecord = {
      id: generateId(),
      playedAt: new Date().toISOString(),
      userId: input.userId,
      quizType: input.quizType,
      category: input.category,
      score: input.score,
      correctCount: input.correctCount,
      totalCount: input.totalCount,
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

    // 2) rankingCategory が指定されていればベストスコアを更新 (§14 RPC)。
    //    新記録のときのみサーバ側で UPDATE される。復習セッションなどでは
    //    rankingCategory を渡さずに呼ぶことでランキングへの反映を抑止できる。
    if (input.rankingCategory) {
      const { error: rpcError } = await client.rpc('record_best_score', {
        p_ranking_category: input.rankingCategory,
        p_score: input.score,
        p_correct_count: input.correctCount,
        p_total_count: input.totalCount,
      });
      if (rpcError) {
        // ベストスコア更新の失敗はプレイ履歴 (quiz_scores) 保存は成功しているため、
        // ユーザー体験を止めない。warn だけ残す。
        console.warn(
          '[supabaseScoreRepository] record_best_score RPC failed:',
          rpcError.message,
        );
      }
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

  async fetchRanking(
    category: RankingCategory,
    limit: number,
  ): Promise<RankingEntry[]> {
    const client = getSupabaseClient();
    if (!client) return [];
    // quiz_ranking_by_category ビューをカテゴリで絞り、
    // インデックス (ranking_category, best_score DESC, achieved_at ASC) を活用してソート。
    const { data, error } = await client
      .from(QUIZ_RANKING_BY_CATEGORY_VIEW)
      .select('*')
      .eq('ranking_category', category)
      .order('best_score', { ascending: false })
      .order('achieved_at', { ascending: true })
      .limit(limit);
    if (error) {
      console.warn('[supabaseScoreRepository] fetchRanking failed:', error.message);
      return [];
    }
    const rows = (data ?? []) as RankingByCategoryRow[];
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
  input: RecordScoreInput,
): Promise<ScoreRecord> {
  await upsertPublicProfile(user);
  return supabaseScoreRepository.recordScore(input);
}
