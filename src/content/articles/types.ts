/**
 * 読みもの (テーマ記事) の型定義。
 *
 * 記事はクイズの解説 (questions.json) をテーマ別に編み直した読み物で、
 * 本文の各段落は運営者が執筆する。`relatedQuestionIds` に挙げた問題は
 * 記事末尾に「確認クイズ」として問題文・正解・解説を表示し、
 * 記事と問題データの整合を保つ (本文で触れた事実は必ず問題側にも根拠がある)。
 */

export type ArticleCategory = 'science' | 'shops' | 'history' | 'regional' | 'culture';

export interface ArticleSection {
  heading: string;
  paragraphs: ReadonlyArray<string>;
}

export interface Article {
  /** URL slug (`/articles/:slug`)。英小文字とハイフンのみ。 */
  slug: string;
  title: string;
  /** SEO description / 一覧のサマリ。100 文字前後。 */
  description: string;
  category: ArticleCategory;
  /** 公開日 (YYYY-MM-DD)。 */
  publishedAt: string;
  /** 導入文。 */
  lead: string;
  sections: ReadonlyArray<ArticleSection>;
  /** 記事末尾の確認クイズに使う questions.json の id。 */
  relatedQuestionIds: ReadonlyArray<string>;
  /** glossary の id。 */
  relatedTerms?: ReadonlyArray<string>;
  /** regionalRamen の prefectureSlug。 */
  relatedRegions?: ReadonlyArray<string>;
  /** 関連記事の slug。 */
  relatedArticles?: ReadonlyArray<string>;
}

export interface ArticleCategoryMeta {
  category: ArticleCategory;
  label: string;
  description: string;
}

export const ARTICLE_CATEGORY_META: ReadonlyArray<ArticleCategoryMeta> = [
  {
    category: 'science',
    label: '製麺・スープの科学',
    description: 'かん水とグルテン、乳化、うま味の相乗効果。一杯の裏側で起きている化学と物理。',
  },
  {
    category: 'shops',
    label: '名店と系譜',
    description: '家系・二郎・つけ麺・海外へ出た名店。人と店がつないできた味の系譜。',
  },
  {
    category: 'history',
    label: '歴史と文化',
    description: 'ラーメンの起源、インスタント麺の発明、評論家とメディア、フィクションの中のラーメン。',
  },
  {
    category: 'regional',
    label: 'ご当地ラーメン図鑑',
    description: '北海道から沖縄まで、地方ごとの系統と成り立ちを地域単位で読む。',
  },
  {
    category: 'culture',
    label: 'トリビアと食文化',
    description: '丼の模様、トッピングの由来、店の経営事情。知っていると一杯が少し面白くなる話。',
  },
];
