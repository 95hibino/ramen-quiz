import { CULTURE_ARTICLES } from './culture';
import { HISTORY_ARTICLES } from './history';
import { REGIONAL_ARTICLES } from './regional';
import { SCIENCE_ARTICLES } from './science';
import { SHOPS_ARTICLES } from './shops';
import type { Article, ArticleCategory } from './types';

export { ARTICLE_CATEGORY_META } from './types';
export type { Article, ArticleCategory, ArticleSection } from './types';

/** 全記事。一覧ページの表示順 (カテゴリ順 → 各ファイル内の定義順)。 */
export const ARTICLES: ReadonlyArray<Article> = [
  ...SCIENCE_ARTICLES,
  ...SHOPS_ARTICLES,
  ...HISTORY_ARTICLES,
  ...REGIONAL_ARTICLES,
  ...CULTURE_ARTICLES,
];

export function findArticleBySlug(slug: string): Article | undefined {
  return ARTICLES.find((a) => a.slug === slug);
}

export function articlesByCategory(category: ArticleCategory): ReadonlyArray<Article> {
  return ARTICLES.filter((a) => a.category === category);
}
