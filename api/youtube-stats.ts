/**
 * 公式 YouTube チャンネルの累計再生数 (Vercel Edge Function)。
 *
 * `GET /api/youtube-stats`
 *   Res: 200 `{ shortViews, longViews, videoCount, countedAt }`
 *        503 `{ error: 'not_configured' }`  YOUTUBE_API_KEY が未設定
 *        502 `{ error: 'youtube_unavailable' }`
 *
 * トップページの「数字で見るラーメンクイズ」に使う。
 *
 * - チャンネル全体の viewCount は動画ごとの再生数の合計より遅れて更新されるため、
 *   公開中の動画を全件取得して 1 本ずつ足す
 * - 3 分以下の動画 (`shortViews`) と、それより長い動画 (`longViews`) を分けて返す。
 *   今は 3 分以下の動画しかないので画面は shortViews だけを出す。通常の長さの動画を
 *   出し始めたら、画面で出し分ける (社長方針 2026-10-18)
 * - API キー (公開データの読み取りのみ。OAuth ではない) は Vercel の環境変数 YOUTUBE_API_KEY
 * - CDN に 6 時間キャッシュさせ、YouTube API の呼び出しを 1 日数回に抑える。
 *   期限切れ後に古い値を返してよいのは 1 時間まで (訪問が途絶えた後でも、表示は最大 7 時間前の値。
 *   社長方針 2026-10-19「毎日更新」を満たすため。以前は 24 時間で、最大 30 時間前の値が出えた)
 */
export const config = {
  runtime: 'edge',
};

const CHANNEL_ID = 'UCHRiRiUAUCbZ-ylsM3d2DCw';
const SHORT_MAX_SEC = 180;
const API_BASE = 'https://www.googleapis.com/youtube/v3';
const CACHE_HEADER = 'public, max-age=600, s-maxage=21600, stale-while-revalidate=3600';

interface PlaylistItemsResponse {
  items?: { contentDetails?: { videoId?: string } }[];
  nextPageToken?: string;
}

interface VideosResponse {
  items?: {
    statistics?: { viewCount?: string };
    contentDetails?: { duration?: string };
  }[];
}

function json(body: unknown, status: number, cache: boolean): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': cache ? CACHE_HEADER : 'no-store',
    },
  });
}

/** ISO 8601 の再生時間 (例: PT1M5S) を秒に。読めなければ null。 */
function durationSeconds(iso: string | undefined): number | null {
  const m = iso?.match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return null;
  const [, d, h, min, s] = m.map((v) => Number(v ?? 0));
  return ((d * 24 + h) * 60 + min) * 60 + s;
}

async function getJson<T>(path: string, params: Record<string, string>, key: string): Promise<T> {
  const url = new URL(`${API_BASE}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set('key', key);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return (await res.json()) as T;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET') {
    return json({ error: 'method_not_allowed' }, 405, false);
  }
  const key = (process.env.YOUTUBE_API_KEY ?? '').trim();
  if (!key) {
    return json({ error: 'not_configured' }, 503, false);
  }

  try {
    // チャンネルの「アップロード動画」再生リスト = UC を UU に置き換えた ID
    const uploads = `UU${CHANNEL_ID.slice(2)}`;
    const videoIds: string[] = [];
    let pageToken = '';
    // 1 ページ 50 件。暴走防止に 40 ページ (2000 本) で打ち切る
    for (let page = 0; page < 40; page++) {
      const params: Record<string, string> = {
        part: 'contentDetails',
        playlistId: uploads,
        maxResults: '50',
      };
      if (pageToken) params.pageToken = pageToken;
      const res = await getJson<PlaylistItemsResponse>('playlistItems', params, key);
      for (const item of res.items ?? []) {
        const id = item.contentDetails?.videoId;
        if (id) videoIds.push(id);
      }
      if (!res.nextPageToken) break;
      pageToken = res.nextPageToken;
    }

    let shortViews = 0;
    let longViews = 0;
    let videoCount = 0;
    for (let i = 0; i < videoIds.length; i += 50) {
      const res = await getJson<VideosResponse>(
        'videos',
        { part: 'statistics,contentDetails', id: videoIds.slice(i, i + 50).join(',') },
        key,
      );
      // API キーでは公開中の動画しか返らない (非公開・予約中は数えない)
      for (const v of res.items ?? []) {
        const views = Number(v.statistics?.viewCount ?? 0);
        if (!Number.isFinite(views)) continue;
        const sec = durationSeconds(v.contentDetails?.duration);
        if (sec !== null && sec > SHORT_MAX_SEC) longViews += views;
        else shortViews += views;
        videoCount++;
      }
    }

    return json(
      { shortViews, longViews, videoCount, countedAt: new Date().toISOString() },
      200,
      true,
    );
  } catch (err) {
    console.error('[youtube-stats]', err instanceof Error ? err.message : err);
    return json({ error: 'youtube_unavailable' }, 502, false);
  }
}
