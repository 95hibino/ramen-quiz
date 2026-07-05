/**
 * Supabase を優先しつつ、未接続時は localScoreRepository にフォールバックする合成リポジトリ。
 *
 * 挙動:
 * - Supabase 接続中: プロフィール upsert → Supabase INSERT で恒久記録。ローカルにも同一 record を書き込み、
 *   オフライン・障害時のバックアップとする。
 * - Supabase 未接続: 従来通り localScoreRepository のみを使う (完全に localStorage 動作)。
 *
 * ランキング:
 * - Supabase 接続中: Supabase の quiz_ranking ビューから取得。失敗時は空配列。
 * - Supabase 未接続: ローカル集計。
 *
 * 自分のスコア履歴 (`listScoresByUser`):
 * - Supabase 接続中: サーバ (全端末合算) から取得。
 * - Supabase 未接続: ローカルから。
 */
import { isSupabaseConfigured } from '@/lib/supabaseClient';
import { localAuthRepository } from '@/lib/localAuthRepository';
import { localScoreRepository } from '@/lib/localScoreRepository';
import type { ScoreRepository } from '@/lib/scoreRepository';
import type { RankingEntry, ScoreRecord } from '@/types/account';
import { upsertPublicProfile } from './supabasePublicProfileRepository';
import { supabaseScoreRepository } from './supabaseScoreRepository';

export const compositeScoreRepository: ScoreRepository = {
  async recordScore(input): Promise<ScoreRecord> {
    if (!isSupabaseConfigured()) {
      return localScoreRepository.recordScore(input);
    }

    // FK 制約 (quiz_scores.user_id → public_profiles.id) を満たすため、
    // Supabase INSERT の前に必ずプロフィールを upsert する。
    // localAuthRepository からユーザー情報を引く (Phase 2 の localStorage 認証前提)。
    const user = await localAuthRepository.findUserById(input.userId);
    if (user) {
      await upsertPublicProfile(user);
    }

    // Supabase INSERT。失敗時は例外を投げる (RateLimitError 含む)。
    // 呼び出し側 (Result.tsx など) でトースト表示することで、ユーザーには
    // 「今回はランキング反映されなかった」旨を伝える。
    // ローカルには常に書き込むことで、マイページ (ScoreTrendChart) が
    // Supabase 障害時でも空表示にならないようにする。
    const localRecord = await localScoreRepository.recordScore(input);
    try {
      const supaRecord = await supabaseScoreRepository.recordScore(input);
      return supaRecord;
    } catch (err) {
      // ローカル書き込みは成功しているので、UI は自分のスコアは見える。
      // 例外は上に伝播させて「ランキング反映失敗」を UI で扱えるようにする。
      // (RateLimitError もそのまま伝播)
      // ローカル record を返さず throw することで、Result などが失敗を検知できる。
      throw err instanceof Error
        ? err
        : new Error(`スコア記録に失敗しました。ローカルには保存済み (${localRecord.id})`);
    }
  },

  async listScoresByUser(userId: string): Promise<ScoreRecord[]> {
    if (!isSupabaseConfigured()) {
      return localScoreRepository.listScoresByUser(userId);
    }
    // Supabase 側を優先。空なら localStorage を返す (別端末で作った初期プレイなど)。
    const remote = await supabaseScoreRepository.listScoresByUser(userId);
    if (remote.length > 0) return remote;
    return localScoreRepository.listScoresByUser(userId);
  },

  async fetchRanking(limit: number): Promise<RankingEntry[]> {
    if (!isSupabaseConfigured()) {
      return localScoreRepository.fetchRanking(limit);
    }
    const remote = await supabaseScoreRepository.fetchRanking(limit);
    return remote;
  },
};
