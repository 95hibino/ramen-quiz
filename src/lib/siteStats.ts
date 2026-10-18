/**
 * トップページの「数字で見るラーメンクイズ」に出す実数の取得。
 * どれも取れなければ null を返し、画面側でその項目を出さない (仮の数字は出さない)。
 */
import { getSupabaseClient, PUBLIC_PHOTO_QUESTIONS_VIEW } from './supabaseClient';

/** 公開中の写真当てクイズの問題数。 */
export async function fetchPhotoQuestionCount(): Promise<number | null> {
  const client = getSupabaseClient();
  if (!client) return null;
  const { count, error } = await client
    .from(PUBLIC_PHOTO_QUESTIONS_VIEW)
    .select('id', { count: 'exact', head: true });
  if (error || typeof count !== 'number') return null;
  return count;
}

/**
 * 公式 YouTube の動画の累計再生数 (/api/youtube-stats)。
 * 今は 3 分以下の動画しかないので shortViews を使う。通常の長さの動画を出し始めたら
 * longViews を別の項目として出し分ける。
 */
export async function fetchYoutubeViews(): Promise<number | null> {
  try {
    const res = await fetch('/api/youtube-stats');
    if (!res.ok) return null;
    const body = (await res.json()) as { shortViews?: unknown };
    return typeof body.shortViews === 'number' && body.shortViews > 0 ? body.shortViews : null;
  } catch {
    return null;
  }
}

/** 1 万以上は「5.3万」のように小数 1 桁で切り捨て、それ未満はカンマ区切り。 */
export function formatJapaneseCount(value: number): string {
  if (value >= 10000) {
    const man = Math.floor(value / 1000) / 10;
    return `${man.toLocaleString('ja-JP')}万`;
  }
  return value.toLocaleString('ja-JP');
}
