/**
 * 公開ページのルート定義（sitemap 生成とプリレンダリングの共通ソース）。
 *
 * ここに載るパスは「クローラに中身を見せてよい静的ページ」であり、
 * `scripts/generate-sitemap.ts` と `scripts/prerender.tsx` の両方が参照する。
 * 片方だけ更新して食い違うのを防ぐため、定義は必ず本ファイルに集約すること。
 *
 * 除外しているパス（ユーザー固有 / 状態依存で、直接アクセスでは意味のある
 * コンテンツを持たない）:
 *   `/mypage` `/result` `/login` `/signup` `/password-reset`
 *   `/quiz/photo/play` `/quiz/photo/submit` `/learn/quiz` `/learn/photo`
 */
import { REGIONAL_RAMEN } from '../src/data/regionalRamen';

/** 公開ページ 1 件の定義。`priority` / `changefreq` は sitemap 用。 */
export interface PublicRoute {
  /** ルート相対パス (例: `/quiz/knowledge`)。 */
  path: string;
  /**
   * 0.0〜1.0 の優先度。トップ・主要動線 1.0、カテゴリ 0.8、サブ 0.6、法務系 0.4 を目安。
   * Google は priority を強くは尊重しないが、Bing/AI 系クローラーには参考にされうる。
   */
  priority: number;
  /** 更新頻度。Google は無視するが他で参照される。 */
  changefreq: 'daily' | 'weekly' | 'monthly' | 'yearly';
  /**
   * プリレンダリング対象か（省略時は true）。
   *
   * false にするのは「sitemap には載せるが、ビルド時に描画しても意味のある
   * HTML にならない」ページ。クイズのプレイ画面は出題データを実行時に読むため、
   * サーバ側では `問題を読み込み中...` と空の `<title>` しか出ず、
   * プリレンダするとかえって title の無いページを公開してしまう。
   * これらは `spa-shell.html`（既定の title / meta 入り）にフォールバックさせる。
   */
  prerender?: boolean;
}

/** 固定分。順序は sitemap.xml の出力順と一致する。 */
const STATIC_ROUTES: ReadonlyArray<PublicRoute> = [
  { path: '/', priority: 1.0, changefreq: 'weekly' },
  { path: '/quiz/knowledge', priority: 0.9, changefreq: 'weekly' },
  // プレイ画面は出題データを実行時に読むためプリレンダ対象外 (noIndex)
  { path: '/quiz/knowledge/basic', priority: 0.8, changefreq: 'monthly', prerender: false },
  // プレイ画面は出題データを実行時に読むためプリレンダ対象外 (noIndex)
  { path: '/quiz/knowledge/regional', priority: 0.8, changefreq: 'monthly', prerender: false },
  // プレイ画面は出題データを実行時に読むためプリレンダ対象外 (noIndex)
  { path: '/quiz/knowledge/expert', priority: 0.8, changefreq: 'monthly', prerender: false },
  { path: '/quiz/photo', priority: 0.8, changefreq: 'weekly' },
  { path: '/ranking', priority: 0.6, changefreq: 'daily' },
  { path: '/learn', priority: 0.7, changefreq: 'weekly' },
  { path: '/about', priority: 0.5, changefreq: 'monthly' },
  { path: '/faq', priority: 0.7, changefreq: 'monthly' },
  { path: '/glossary', priority: 0.7, changefreq: 'monthly' },
  { path: '/regions', priority: 0.7, changefreq: 'monthly' },
  { path: '/privacy', priority: 0.4, changefreq: 'yearly' },
  { path: '/terms', priority: 0.4, changefreq: 'yearly' },
  { path: '/contact', priority: 0.4, changefreq: 'yearly' },
];

/**
 * 固定分 + `/regions/:prefectureSlug` の動的分を合成して返す。
 *
 * 動的分は `src/data/regionalRamen.ts` から slug を読み込むため、
 * データを足せば sitemap もプリレンダリング対象も自動的に広がる。
 */
export function buildPublicRoutes(): ReadonlyArray<PublicRoute> {
  const regionDetailRoutes: ReadonlyArray<PublicRoute> = REGIONAL_RAMEN.map((r) => ({
    path: `/regions/${r.prefectureSlug}`,
    priority: 0.6,
    changefreq: 'monthly' as const,
  }));
  return [...STATIC_ROUTES, ...regionDetailRoutes];
}
