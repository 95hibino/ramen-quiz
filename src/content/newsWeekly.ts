/**
 * ラーメンニュース週報 (`/news`, `/news/:slug`) のデータ定義。
 *
 * YouTube の話題ショート (ニュース動画) を 1 週間分 (金曜〜木曜) まとめ、再生数の順位と
 * 各話題の背景解説を載せる。データは `src/data/newsWeekly.json` で、毎週金曜に
 * shorts_factory の `build_news_weekly.py` が 1 件ずつ追記する (手で編集してもよい)。
 *
 * 事実性の方針:
 * - 背景解説は、動画の台本で裏取り済みの事実と、その出典 (`sources`) で確かめられる内容だけで書く。
 * - 再生数は集計時点 (`viewsCountedAt`) の累計で、公開日が早い動画ほど多くなりやすい。
 */
import rawReports from '../data/newsWeekly.json';

export interface NewsSource {
  /** 出典の名前 (媒体名・記事名など)。 */
  title: string;
  url: string;
}

export interface NewsWeeklyItem {
  /** 再生数の順位 (1 始まり)。 */
  rank: number;
  /** 動画の公開日 (YYYY-MM-DD, 日本時間)。 */
  postedOn: string;
  /** YouTube の動画 ID。 */
  videoId: string;
  /** 動画のタイトル。 */
  title: string;
  /** 集計時点の累計再生数。 */
  views: number;
  /** 話題の要約 (1〜2 文)。 */
  summary: string;
  /** 背景解説の段落。 */
  background: ReadonlyArray<string>;
  sources: ReadonlyArray<NewsSource>;
}

export interface NewsWeeklyReport {
  /** URL slug (`/news/:slug`)。対象期間の初日 (YYYY-MM-DD)。 */
  slug: string;
  /** 対象期間の初日・最終日 (YYYY-MM-DD)。 */
  periodStart: string;
  periodEnd: string;
  /** ページの公開日 (YYYY-MM-DD)。 */
  publishedAt: string;
  /** 再生数の集計日時 (ISO 8601)。 */
  viewsCountedAt: string;
  /** その週の振り返り (導入文)。 */
  lead: string;
  items: ReadonlyArray<NewsWeeklyItem>;
}

/** 新しい週が先頭に来るよう並べた全週報。 */
export const NEWS_WEEKLY_REPORTS: ReadonlyArray<NewsWeeklyReport> = [
  ...(rawReports as ReadonlyArray<NewsWeeklyReport>),
].sort((a, b) => b.slug.localeCompare(a.slug));

export function findNewsWeeklyBySlug(slug: string): NewsWeeklyReport | undefined {
  return NEWS_WEEKLY_REPORTS.find((r) => r.slug === slug);
}

/** `2026-10-02` → `10月2日` */
export function formatMonthDay(isoDate: string): string {
  const [, m, d] = isoDate.split('-').map(Number);
  return `${m}月${d}日`;
}

/** 週報のタイトル (一覧・詳細で共通)。 */
export function newsWeeklyTitle(report: NewsWeeklyReport): string {
  return `ラーメンニュース週報（${formatMonthDay(report.periodStart)}〜${formatMonthDay(report.periodEnd)}）`;
}

export function youtubeUrl(videoId: string): string {
  return `https://www.youtube.com/shorts/${videoId}`;
}

export function youtubeThumbnail(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}
