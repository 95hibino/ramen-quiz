import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Seo } from '@/components/common/Seo';
import { StructuredData } from '@/components/common/StructuredData';
import { buildSiteUrl } from '@/config/site';
import {
  GLOSSARY_CATEGORY_LABELS,
  GLOSSARY_CATEGORY_ORDER,
  GLOSSARY_TERMS,
  type GlossaryCategory,
  type GlossaryTerm,
} from '@/content/glossary';

/**
 * ラーメン用語辞典 (`/glossary`)。
 *
 * SEO 強化第三弾。
 * - 単一ページ内に約 40 語を掲載し、カテゴリ別セクション + 目次で回遊させる。
 * - Schema.org の DefinedTermSet / DefinedTerm を注入し、AI 検索・Google リッチリザルトに引用されやすくする。
 * - 各用語には `id="term-<id>"` を付与し、`/glossary#term-<id>` でのアンカーリンクを可能にする。
 *
 * 本文データは `src/content/glossary.ts` に集約。ページ側では見た目の組み立てだけを担う。
 */
export function Glossary(): JSX.Element {
  /** カテゴリごとに用語をグルーピング (useMemo で再計算を抑える)。 */
  const termsByCategory = useMemo(() => groupByCategory(GLOSSARY_TERMS), []);

  /** Schema.org DefinedTermSet スキーマ。定義本文はプレーンテキストのまま渡す。 */
  const glossarySchema = useMemo(
    () => ({
      '@context': 'https://schema.org',
      '@type': 'DefinedTermSet',
      name: 'ラーメン用語辞典',
      description:
        'ラーメンに関するスープ・麺・タレ・トッピング・系統・文化用語をカテゴリ別にまとめた辞典。',
      hasDefinedTerm: GLOSSARY_TERMS.map((term) => ({
        '@type': 'DefinedTerm',
        name: term.name,
        description: term.definition,
        inDefinedTermSet: buildSiteUrl('/glossary'),
        termCode: term.id,
      })),
    }),
    [],
  );

  return (
    <div className="card space-y-6">
      <Seo
        title="ラーメン用語辞典 | 40語で学ぶラーメンの世界"
        description="ラーメンに関する 40 の重要用語をカテゴリ別（スープ・麺・タレ・トッピング・系統・文化）に解説。清湯白湯、乳化、加水率、カエシ、家系、二郎系など、ラーメンをより深く楽しむための知識を網羅。"
        url="/glossary"
        keywords={[
          'ラーメン 用語',
          'ラーメン 辞典',
          '清湯 白湯 違い',
          '乳化 意味',
          '加水率',
          'カエシ とは',
          '家系 二郎系',
          '香味油',
        ]}
      />
      <StructuredData schema={glossarySchema} />

      <header className="space-y-2">
        <h1 className="text-2xl font-black text-ramen-soy">ラーメン用語辞典</h1>
        <p className="text-sm text-ramen-soy/80">
          ラーメンに関する重要用語を、スープ・麺・タレ・トッピング・系統・文化の 6 カテゴリに分けて解説しています。
          全 {GLOSSARY_TERMS.length} 語収録。気になる用語は目次からジャンプできます。
        </p>
      </header>

      {/* 目次: カテゴリ内の用語をアンカーリンクで一覧化 */}
      <nav aria-label="用語目次" className="space-y-3 rounded-lg border border-ramen-soy/10 bg-white/60 p-3">
        <h2 className="text-sm font-bold text-ramen-soy">目次</h2>
        <ul className="space-y-2 text-sm">
          {GLOSSARY_CATEGORY_ORDER.map((category) => {
            const items = termsByCategory[category];
            if (!items || items.length === 0) return null;
            return (
              <li key={category} className="space-y-1">
                <a
                  href={`#category-${category}`}
                  className="font-bold text-ramen-chili hover:underline"
                >
                  {GLOSSARY_CATEGORY_LABELS[category]}（{items.length} 語）
                </a>
                <ul className="flex flex-wrap gap-x-3 gap-y-1 pl-3 text-xs text-ramen-soy/80">
                  {items.map((term) => (
                    <li key={term.id}>
                      <a href={`#term-${term.id}`} className="hover:text-ramen-chili hover:underline">
                        {term.name}
                      </a>
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      </nav>

      {GLOSSARY_CATEGORY_ORDER.map((category) => {
        const items = termsByCategory[category];
        if (!items || items.length === 0) return null;
        return (
          <section key={category} id={`category-${category}`} className="space-y-3 scroll-mt-6">
            <h2 className="border-b border-ramen-soy/10 pb-1 text-base font-bold text-ramen-soy">
              {GLOSSARY_CATEGORY_LABELS[category]}
            </h2>
            <ul className="space-y-3">
              {items.map((term) => (
                <li key={term.id}>
                  <GlossaryEntry term={term} />
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
        <Link to="/faq" className="font-bold text-ramen-chili hover:underline">
          よくある質問 →
        </Link>
        <Link to="/" className="text-ramen-soy/70 hover:underline">
          トップへ戻る
        </Link>
      </div>
    </div>
  );
}

/**
 * 用語 1 件を表示するコンポーネント。
 * `id="term-<id>"` を付与し、`/glossary#term-<id>` でのアンカージャンプに対応する。
 * `scroll-mt-6` はヘッダー分の余白確保 (アンカーで飛んだときに用語名が見切れないように)。
 */
function GlossaryEntry({ term }: { term: GlossaryTerm }): JSX.Element {
  return (
    <article
      id={`term-${term.id}`}
      className="scroll-mt-6 rounded-lg border border-ramen-soy/10 bg-white/60 px-3 py-3"
    >
      <h3 className="text-sm font-bold text-ramen-soy sm:text-base">
        {term.name}
        {term.reading && term.reading !== term.name ? (
          <span className="ml-2 text-xs font-normal text-ramen-soy/60">（{term.reading}）</span>
        ) : null}
      </h3>
      <p className="mt-2 border-t border-ramen-soy/10 pt-2 text-sm leading-relaxed text-ramen-soy/90">
        {term.definition}
      </p>
      {term.related ? (
        <p className="mt-2 text-xs leading-relaxed text-ramen-soy/70">
          <span className="mr-1 font-bold text-ramen-chili">関連:</span>
          {term.related}
        </p>
      ) : null}
    </article>
  );
}

/**
 * 用語をカテゴリ別にグルーピングする。
 * 元配列の順序を維持したまま、カテゴリごとの配列に分解する。
 */
function groupByCategory(
  items: ReadonlyArray<GlossaryTerm>,
): Record<GlossaryCategory, ReadonlyArray<GlossaryTerm>> {
  const initial: Record<GlossaryCategory, GlossaryTerm[]> = {
    soup: [],
    noodle: [],
    tare: [],
    topping: [],
    style: [],
    culture: [],
  };
  for (const item of items) {
    initial[item.category].push(item);
  }
  return initial;
}
