import { Link } from 'react-router-dom';
import { Seo } from '@/components/common/Seo';
import { StructuredData } from '@/components/common/StructuredData';
import { buildSiteUrl } from '@/config/site';
import { ARTICLES, ARTICLE_CATEGORY_META, articlesByCategory } from '@/content/articles';

/**
 * 読みもの一覧ページ (`/articles`)。
 *
 * クイズの解説をテーマ別に編み直した記事を、カテゴリごとに一覧表示する。
 * 各記事は `/articles/:slug` にプリレンダリングされる (publicRoutes.ts)。
 */
export function Articles(): JSX.Element {
  const collectionSchema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'ラーメンの読みもの',
    description:
      '製麺・スープの科学、家系や二郎系の系譜、ラーメンの歴史、ご当地ラーメン図鑑、食文化のトリビア。クイズの解説をテーマ別にまとめた記事一覧。',
    url: buildSiteUrl('/articles'),
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: ARTICLES.length,
      itemListElement: ARTICLES.map((a, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: a.title,
        url: buildSiteUrl(`/articles/${a.slug}`),
      })),
    },
  };

  return (
    <div className="card space-y-8">
      <Seo
        title={`ラーメンの読みもの | 製麺の科学から家系の系譜まで ${ARTICLES.length} 本の解説記事`}
        description={`かん水と麺のコシ、清湯と白湯、家系の系譜図、二郎のコール、つけ麺の歴史、ご当地ラーメン図鑑、トッピングの由来。${ARTICLES.length} 本のテーマ記事でラーメンをまとめて学ぶ。`}
        url="/articles"
        keywords={['ラーメン 解説', 'ラーメン 歴史', '家系 系譜', '二郎 コール', 'かん水', 'ご当地ラーメン']}
      />
      <StructuredData schema={collectionSchema} />

      <header className="space-y-2">
        <h1 className="text-2xl font-black text-ramen-soy">ラーメンの読みもの</h1>
        <p className="text-sm leading-relaxed text-ramen-soy/80">
          クイズ {ARTICLES.length > 0 ? 'の解説' : ''}をテーマごとに編み直した解説記事です。
          製麺やスープの科学、名店の系譜、ラーメンの歴史、地方ごとのご当地ラーメン、食文化のトリビアまで、
          クイズを解く前の予習にも、解いた後の深掘りにも使えます。各記事の末尾には、記事で扱った内容を
          確かめられる「確認クイズ」を載せています。
        </p>
      </header>

      {ARTICLE_CATEGORY_META.map((meta) => {
        const items = articlesByCategory(meta.category);
        if (items.length === 0) return null;
        return (
          <section key={meta.category} className="space-y-3">
            <div>
              <h2 className="border-b border-ramen-soy/10 pb-1 text-base font-bold text-ramen-soy">
                {meta.label}（{items.length} 本）
              </h2>
              <p className="mt-1 text-xs text-ramen-soy/70">{meta.description}</p>
            </div>
            <ul className="space-y-2">
              {items.map((a) => (
                <li key={a.slug}>
                  <Link
                    to={`/articles/${a.slug}`}
                    className="flex flex-col rounded-lg border border-ramen-soy/10 bg-white/60 px-3 py-3 hover:border-ramen-chili hover:bg-ramen-broth/10"
                  >
                    <span className="text-sm font-bold text-ramen-soy sm:text-base">{a.title}</span>
                    <span className="mt-1 text-xs leading-relaxed text-ramen-soy/70">
                      {a.description}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      <div className="flex flex-wrap gap-4 border-t border-ramen-soy/10 pt-4 text-sm">
        <Link to="/regions" className="font-bold text-ramen-chili hover:underline">
          都道府県別ご当地ラーメン →
        </Link>
        <Link to="/glossary" className="font-bold text-ramen-chili hover:underline">
          ラーメン用語辞典 →
        </Link>
        <Link to="/quiz/knowledge" className="font-bold text-ramen-chili hover:underline">
          知識クイズに挑戦 →
        </Link>
        <Link to="/" className="text-ramen-soy/70 hover:underline">
          トップへ戻る
        </Link>
      </div>
    </div>
  );
}
