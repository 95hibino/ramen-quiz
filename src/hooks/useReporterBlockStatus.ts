/**
 * 現在ログイン中ユーザーが「通報乱用でブロック中」かどうかを取得するフック。
 *
 * §20 の `reporter_blocks` を参照する。用途:
 * - `/quiz/photo` (絞り込み画面) と `/quiz/photo/play` (プレイ画面) の入り口で
 *   ブロック済みユーザーには専用のブロック画面を表示する
 * - `/quiz/photo/submit` (投稿画面) は投稿と通報が独立した機能なのでブロック対象外
 *
 * 未ログインユーザーは通報自体できないため、常に `not_blocked` を返す。
 * Supabase 未接続時も同様。
 */
import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import {
  fetchReporterBlockStatus,
  type ReporterBlockRecord,
} from '@/lib/supabaseReportRepository';

export type ReporterBlockStatus =
  | { state: 'loading' }
  | { state: 'not_blocked' }
  | { state: 'blocked'; block: ReporterBlockRecord };

export function useReporterBlockStatus(): ReporterBlockStatus {
  const currentUser = useAuthStore((s) => s.currentUser);
  const [status, setStatus] = useState<ReporterBlockStatus>({ state: 'loading' });

  useEffect(() => {
    let cancelled = false;

    if (!currentUser) {
      // 未ログインは通報できないためブロック検査対象外
      setStatus({ state: 'not_blocked' });
      return;
    }

    setStatus({ state: 'loading' });
    void fetchReporterBlockStatus(currentUser.id).then((block) => {
      if (cancelled) return;
      setStatus(block ? { state: 'blocked', block } : { state: 'not_blocked' });
    });

    return () => {
      cancelled = true;
    };
  }, [currentUser]);

  return status;
}
