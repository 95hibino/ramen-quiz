/**
 * 合成リポジトリ。モック JSON と Supabase の両ソースから取得し、
 * id 重複を避けてマージした結果を返す。
 *
 * - Supabase 未接続時はモックのみを返す (既存挙動を破壊しない)
 * - 投稿 (`submit`) は Supabase に委譲。未接続時は明示的エラー
 * - DB / Storage の一時的な失敗時もモックがあるため UX が壊れない
 */
import type { PhotoQuestion, PhotoQuestionFilter } from '@/types/photoQuestion';
import { mockPhotoQuestionRepository } from './mockPhotoQuestionRepository';
import { supabasePhotoQuestionRepository } from './supabasePhotoQuestionRepository';
import { isSupabaseConfigured } from './supabaseClient';
import {
  canSubmit,
  type PhotoQuestionRepository,
  type PhotoQuestionSubmission,
} from './photoQuestionRepository';

/** id 重複時はあとから来た方を捨てる (モックを優先しない)。 */
function mergeUnique(...lists: PhotoQuestion[][]): PhotoQuestion[] {
  const seen = new Set<string>();
  const merged: PhotoQuestion[] = [];
  for (const list of lists) {
    for (const q of list) {
      if (seen.has(q.id)) continue;
      seen.add(q.id);
      merged.push(q);
    }
  }
  return merged;
}

export const compositePhotoQuestionRepository: PhotoQuestionRepository = {
  async findByFilter(filter: PhotoQuestionFilter): Promise<PhotoQuestion[]> {
    if (!isSupabaseConfigured()) {
      return mockPhotoQuestionRepository.findByFilter(filter);
    }
    const [mock, remote] = await Promise.all([
      mockPhotoQuestionRepository.findByFilter(filter),
      supabasePhotoQuestionRepository.findByFilter(filter),
    ]);
    return mergeUnique(mock, remote);
  },

  async countByFilter(filter: PhotoQuestionFilter): Promise<number> {
    // 単純な count(*) では DB / モック間の id 重複を排除できないので
    // findByFilter 経由でユニーク件数を返す。問題数は MVP 規模 (数百件) で十分軽い。
    const merged = await this.findByFilter(filter);
    return merged.length;
  },

  async submit(
    data: PhotoQuestionSubmission,
    image: Blob,
  ): Promise<PhotoQuestion> {
    if (!isSupabaseConfigured() || !canSubmit(supabasePhotoQuestionRepository)) {
      throw new Error(
        'Supabase が未接続のため、現在は投稿を受け付けられません。社長の作業待ちです。',
      );
    }
    return supabasePhotoQuestionRepository.submit(data, image);
  },

  async findBySubmitterId(submitterId: string): Promise<PhotoQuestion[]> {
    // マイページ「投稿履歴」用。ユーザー投稿は Supabase のみに存在するため
    // モックの結果はマージ対象外 (モック問題には submitterId が無い)。
    if (!isSupabaseConfigured() || !supabasePhotoQuestionRepository.findBySubmitterId) {
      return [];
    }
    return supabasePhotoQuestionRepository.findBySubmitterId(submitterId);
  },

  async findByIds(ids: string[]): Promise<PhotoQuestion[]> {
    if (ids.length === 0) return [];
    // モックとリモートの両方を参照。id 重複はモック優先で解決する。
    if (!isSupabaseConfigured()) {
      return mockPhotoQuestionRepository.findByIds(ids);
    }
    const [mock, remote] = await Promise.all([
      mockPhotoQuestionRepository.findByIds(ids),
      supabasePhotoQuestionRepository.findByIds(ids),
    ]);
    return mergeUnique(mock, remote);
  },
};
