import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Seo } from '@/components/common/Seo';
import { StructuredData } from '@/components/common/StructuredData';
import { buildSiteUrl, SITE_NAME } from '@/config/site';
import { ARTICLE_CATEGORY_META, findArticleBySlug, type Article } from '@/content/articles';
import { GLOSSARY_TERMS, type GlossaryTerm } from '@/content/glossary';
import { OPERATOR_NAME } from '@/content/legalMeta';
import { findRegionalRamenBySlug } from '@/data/regionalRamen';
import rawQuestions from '@/data/questions.json';
import { NotFound } from '@/pages/NotFound';
import type { QuizQuestion } from '@/types/quiz';

const QUESTIONS = rawQuestions as ReadonlyArray<QuizQuestion>;

/**
 * 読みもの詳細ページ (`/articles/:slug`)。
 *
 * - 本文 (lead + sections) を見出し付きで表示する。
 * - 記事末尾に「確認クイズ」として関連問題の問題文・正解・解説を表示する。
 *   正解と解説は `<details>` に入れ、読者が自分で開けるようにする
 *   (プリレンダ HTML には含まれるので、検索エンジンからは本文として読める)。
 * - 関連用語 (用語辞典へのアンカー)・関連する県ページ・関連記事へ内部リンクする。
 */
export function ArticleDetail(): JSX.Element {
  const { slug } = useParams<{ slug: string }>();
  const article = useMemo(() => (slug ? findArticleBySlug(slug) ?? null : null), [slug]);

  if (!article) {
    return <NotFound />;
  }

  return <ArticleBody article={article} />;
}

function ArticleBody({ article }: { article: Article }): JSX.Element {
  const categoryMeta = ARTICLE_CATEGORY_META.find((m) => m.category === article.category);
  const url = `/articles/${article.slug}`;

  const questions = article.relatedQuestionIds
    .map((id) => QUESTIONS.find((q) => q.id === id))
    .filter((q): q is QuizQuestion => q !== undefined);

  const terms = (article.relatedTerms ?? [])
    .map((id) => GLOSSARY_TERMS.find((t) => t.id === id))
    .filter((t): t is GlossaryTerm => t !== undefined);

  const regions = (article.relatedRegions ?? [])
    .map((s) => findRegionalRamenBySlug(s))
    .filter((r): r is NonNullable<typeof r> => r !== undefined);

  const relatedArticles = (article.relatedArticles ?? [])
    .map((s) => findArticleBySlug(s))
    .filter((a): a is Article => a !== undefined);

  const schemas: Record<string, unknown>[] = [
    {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: article.title,
      description: article.description,
      datePublished: article.publishedAt,
      dateModified: article.publishedAt,
      inLanguage: 'ja',
      author: { '@type': 'Organization', name: OPERATOR_NAME },
      publisher: { '@type': 'Organization', name: SITE_NAME },
      mainEntityOfPage: { '@type': 'WebPage', '@id': buildSiteUrl(url) },
      articleSection: categoryMeta?.label,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'ホーム', item: buildSiteUrl('/') },
        { '@type': 'ListItem', position: 2, name: '読みもの', item: buildSiteUrl('/articles') },
        { '@type': 'ListItem', position: 3, name: article.title, item: buildSiteUrl(url) },
      ],
    },
  ];

  return (
    <article className="card space-y-8">
      <Seo
        title={article.title}
        description={article.description}
        url={url}
        ogType="article"
        keywords={[categoryMeta?.label ?? '', 'ラーメン', ...terms.map((t) => t.name)].filter(Boolean)}
      />
      <StructuredData schema={schemas} />

      <header className="space-y-3">
        <p className="text-xs text-ramen-soy/60">
          <Link to="/articles" className="hover:text-ramen-chili hover:underline">
            読みもの
          </Link>
          {categoryMeta ? (
            <>
              <span className="mx-1">/</span>
              <span>{categoryMeta.label}</span>
            </>
          ) : null}
        </p>
        <h1 className="text-2xl font-black leading-snug text-ramen-soy">{article.title}</h1>
        <p className="text-xs text-ramen-soy/60">
          公開日 {article.publishedAt} ・ 執筆 {OPERATOR_NAME}
        </p>
        <p className="text-sm leading-relaxed text-ramen-soy/90">{article.lead}</p>
      </header>

      {article.sections.map((section) => (
        <section key={section.heading} className="space-y-3">
          <h2 className="border-b border-ramen-soy/10 pb-1 text-lg font-bold text-ramen-soy">
            {section.heading}
          </h2>
          {section.paragraphs.map((p, i) => (
            <p key={i} className="text-sm leading-relaxed text-ramen-soy/90">
              {p}
            </p>
          ))}
        </section>
      ))}

      {questions.length > 0 ? (
        <section className="space-y-3 rounded-lg border border-ramen-broth/40 bg-ramen-broth/10 px-4 py-4">
          <h2 className="text-lg font-bold text-ramen-soy">確認クイズ（{questions.length} 問）</h2>
          <p className="text-xs text-ramen-soy/70">
            この記事で扱った内容から出題。「正解と解説を見る」を開く前に答えを考えてみてください。
            本番のクイズは
            <Link to="/quiz/knowledge" className="text-ramen-chili hover:underline">
              知識クイズ
            </Link>
            から挑戦できます。
          </p>
          <ol className="space-y-3">
            {questions.map((q, idx) => (
              <li key={q.id} className="rounded-lg bg-white/70 px-3 py-3">
                <p className="text-sm font-bold text-ramen-soy">
                  Q{idx + 1}. {q.question}
                </p>
                <ul className="mt-2 space-y-1 text-xs text-ramen-soy/80">
                  {q.options.map((opt, i) => (
                    <li key={i}>
                      {['①', '②', '③', '④'][i] ?? `${i + 1}.`} {opt}
                    </li>
                  ))}
                </ul>
                <details className="mt-2 text-xs">
                  <summary className="cursor-pointer font-bold text-ramen-chili">
                    正解と解説を見る
                  </summary>
                  <p className="mt-1 font-bold text-ramen-soy">
                    正解：{['①', '②', '③', '④'][q.answerIdx] ?? ''} {q.options[q.answerIdx]}
                  </p>
                  {q.explanation ? (
                    <p className="mt-1 leading-relaxed text-ramen-soy/80">{q.explanation}</p>
                  ) : null}
                </details>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {terms.length > 0 ? (
        <section className="space-y-2">
          <h2 className="border-b border-ramen-soy/10 pb-1 text-base font-bold text-ramen-soy">
            この記事に出てくる用語
          </h2>
          <ul className="flex flex-wrap gap-2 text-xs">
            {terms.map((t) => (
              <li key={t.id}>
                <Link
                  to={`/glossary#term-${t.id}`}
                  className="inline-block rounded-full border border-ramen-soy/10 bg-white/60 px-3 py-1 text-ramen-soy hover:border-ramen-chili hover:text-ramen-chili"
                >
                  {t.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {regions.length > 0 ? (
        <section className="space-y-2">
          <h2 className="border-b border-ramen-soy/10 pb-1 text-base font-bold text-ramen-soy">
            関連する都道府県ページ
          </h2>
          <ul className="flex flex-wrap gap-2 text-xs">
            {regions.map((r) => (
              <li key={r.prefectureSlug}>
                <Link
                  to={`/regions/${r.prefectureSlug}`}
                  className="inline-block rounded-full border border-ramen-soy/10 bg-white/60 px-3 py-1 text-ramen-soy hover:border-ramen-chili hover:text-ramen-chili"
                >
                  {r.prefecture} のご当地ラーメン
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {relatedArticles.length > 0 ? (
        <section className="space-y-2">
          <h2 className="border-b border-ramen-soy/10 pb-1 text-base font-bold text-ramen-soy">
            あわせて読みたい
          </h2>
          <ul className="space-y-2">
            {relatedArticles.map((a) => (
              <li key={a.slug}>
                <Link
                  to={`/articles/${a.slug}`}
                  className="flex flex-col rounded-lg border border-ramen-soy/10 bg-white/60 px-3 py-2 hover:border-ramen-chili hover:bg-ramen-broth/10"
                >
                  <span className="text-sm font-bold text-ramen-soy">{a.title}</span>
                  <span className="mt-0.5 text-xs text-ramen-soy/70">{a.description}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="flex flex-wrap gap-4 border-t border-ramen-soy/10 pt-4 text-sm">
        <Link to="/articles" className="font-bold text-ramen-chili hover:underline">
          読みもの一覧へ →
        </Link>
        <Link to="/quiz/knowledge" className="font-bold text-ramen-chili hover:underline">
          知識クイズに挑戦 →
        </Link>
        <Link to="/" className="text-ramen-soy/70 hover:underline">
          トップへ戻る
        </Link>
      </div>
    </article>
  );
}
