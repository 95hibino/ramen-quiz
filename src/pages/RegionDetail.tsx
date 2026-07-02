import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Seo } from '@/components/common/Seo';
import { StructuredData } from '@/components/common/StructuredData';
import { buildSiteUrl } from '@/config/site';
import { NotFound } from '@/pages/NotFound';
import { findRegionalRamenBySlug, type RamenType } from '@/data/regionalRamen';
import { GLOSSARY_TERMS, type GlossaryTerm } from '@/content/glossary';

/**
 * 都道府県別ご当地ラーメン詳細ページ (`/regions/:prefectureSlug`)。
 *
 * SEO 強化第三弾。
 * - URL パラメータの slug から都道府県データを取得し、その県のご当地ラーメンを一括表示する。
 * - 該当 slug が存在しない場合は NotFound ページを表示 (404 相当)。
 * - Schema.org の Article スキーマを注入し、AI 検索・Google リッチリザルトに引用されやすくする。
 * - 関連用語 (relatedTerms) は用語辞典 `/glossary#term-<id>` へアンカーリンクする。
 */
export function RegionDetail(): JSX.Element {
  const { prefectureSlug } = useParams<{ prefectureSlug: string }>();

  /**
   * slug から都道府県データを取得。slug 未指定 or 存在しない場合は null。
   * useMemo で slug が変わったときだけ検索を再実行する。
   */
  const data = useMemo(() => {
    if (!prefectureSlug) return null;
    return findRegionalRamenBySlug(prefectureSlug) ?? null;
  }, [prefectureSlug]);

  /**
   * Schema.org Article スキーマ。data が null の場合は空オブジェクトを返し、
   * 描画側 (NotFound) で StructuredData をレンダリングしないよう分岐する。
   */
  const articleSchema = useMemo(() => {
    if (!data) return null;
    const headline = `${data.prefecture} のご当地ラーメン`;
    const description = buildDescription(data.prefecture, data.ramenTypes);
    return {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline,
      description,
      author: {
        '@type': 'Organization',
        name: '大森商事',
      },
      publisher: {
        '@type': 'Organization',
        name: 'ラーメンクイズ',
      },
      mainEntityOfPage: {
        '@type': 'WebPage',
        '@id': buildSiteUrl(`/regions/${data.prefectureSlug}`),
      },
    };
  }, [data]);

  // slug に対応するデータが無ければ 404 ページを表示
  if (!data || !articleSchema) {
    return <NotFound />;
  }

  const highlightNames = data.ramenTypes.map((t) => t.name).join('・');
  const description = buildDescription(data.prefecture, data.ramenTypes);

  return (
    <div className="card space-y-6">
      <Seo
        title={`${data.prefecture} のご当地ラーメン | 特徴・発祥・代表系統`}
        description={description}
        url={`/regions/${data.prefectureSlug}`}
        ogType="article"
        keywords={[
          `${data.prefecture} ラーメン`,
          `${data.prefecture} ご当地`,
          ...data.ramenTypes.map((t) => t.name),
        ]}
      />
      <StructuredData schema={articleSchema} />

      <header className="space-y-2">
        <p className="text-xs text-ramen-soy/60">
          <Link to="/regions" className="hover:text-ramen-chili hover:underline">
            都道府県別ラーメン一覧
          </Link>
          <span className="mx-1">/</span>
          <span>{data.region}地方</span>
        </p>
        <h1 className="text-2xl font-black text-ramen-soy">
          {data.prefecture} のご当地ラーメン
        </h1>
        <p className="text-sm text-ramen-soy/80">
          {data.prefecture} を代表するご当地ラーメン（{highlightNames}）の特徴、スープ・麺・トッピング、発祥店の情報をまとめました。
        </p>
      </header>

      {data.culture ? (
        <section className="rounded-lg border border-ramen-broth/40 bg-ramen-broth/10 px-3 py-3">
          <h2 className="text-sm font-bold text-ramen-soy">この地域のラーメン文化</h2>
          <p className="mt-1 text-sm leading-relaxed text-ramen-soy/90">{data.culture}</p>
        </section>
      ) : null}

      <section className="space-y-4">
        <h2 className="border-b border-ramen-soy/10 pb-1 text-base font-bold text-ramen-soy">
          代表的なラーメン
        </h2>
        <ul className="space-y-4">
          {data.ramenTypes.map((ramen) => (
            <li key={ramen.name}>
              <RamenCard ramen={ramen} />
            </li>
          ))}
        </ul>
      </section>

      {data.relatedTerms && data.relatedTerms.length > 0 ? (
        <RelatedTermsSection termIds={data.relatedTerms} />
      ) : null}

      <div className="flex flex-wrap gap-4 border-t border-ramen-soy/10 pt-4 text-sm">
        <Link to="/regions" className="font-bold text-ramen-chili hover:underline">
          他の県のラーメンを見る →
        </Link>
        <Link to="/glossary" className="font-bold text-ramen-chili hover:underline">
          ラーメン用語辞典 →
        </Link>
        <Link to="/" className="text-ramen-soy/70 hover:underline">
          トップへ戻る
        </Link>
      </div>
    </div>
  );
}

/**
 * 1 種類のご当地ラーメンをカード形式で表示する。
 * スープ / 麺 / トッピング / 発祥 / エリア を項目別に列挙。
 */
function RamenCard({ ramen }: { ramen: RamenType }): JSX.Element {
  return (
    <article className="rounded-lg border border-ramen-soy/10 bg-white/60 px-3 py-3">
      <h3 className="text-sm font-bold text-ramen-soy sm:text-base">{ramen.name}</h3>
      <p className="mt-2 border-t border-ramen-soy/10 pt-2 text-sm leading-relaxed text-ramen-soy/90">
        {ramen.description}
      </p>
      <dl className="mt-3 space-y-1 text-xs leading-relaxed text-ramen-soy/80">
        <DetailRow label="スープ" value={ramen.soup} />
        <DetailRow label="麺" value={ramen.noodle} />
        <DetailRow label="トッピング" value={ramen.toppings} />
        {ramen.origin ? <DetailRow label="発祥" value={ramen.origin} /> : null}
        {ramen.area ? <DetailRow label="提供エリア" value={ramen.area} /> : null}
      </dl>
    </article>
  );
}

/**
 * `<dt>{label}</dt><dd>{value}</dd>` を横並びで表示する行。
 */
function DetailRow({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
      <dt className="min-w-[5rem] shrink-0 font-bold text-ramen-chili">{label}</dt>
      <dd className="flex-1">{value}</dd>
    </div>
  );
}

/**
 * 関連用語セクション。用語辞典 `/glossary#term-<id>` へアンカーリンクする。
 * 用語 ID が glossary 側に存在しない場合はスキップ (安全対策)。
 */
function RelatedTermsSection({
  termIds,
}: {
  termIds: ReadonlyArray<string>;
}): JSX.Element | null {
  const terms = termIds
    .map((id) => GLOSSARY_TERMS.find((t) => t.id === id))
    .filter((t): t is GlossaryTerm => t !== undefined);

  if (terms.length === 0) return null;

  return (
    <section className="space-y-2">
      <h2 className="border-b border-ramen-soy/10 pb-1 text-base font-bold text-ramen-soy">
        関連する用語
      </h2>
      <ul className="flex flex-wrap gap-2 text-xs">
        {terms.map((term) => (
          <li key={term.id}>
            <Link
              to={`/glossary#term-${term.id}`}
              className="inline-block rounded-full border border-ramen-soy/10 bg-white/60 px-3 py-1 text-ramen-soy hover:border-ramen-chili hover:text-ramen-chili"
            >
              {term.name}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * SEO description を組み立てる。
 * 「{都道府県名} を代表するご当地ラーメン（系統列挙）の特徴、スープ・麺・トッピング、発祥店を解説。」
 */
function buildDescription(prefecture: string, ramens: ReadonlyArray<RamenType>): string {
  const names = ramens.map((r) => r.name).join('・');
  return `${prefecture} を代表するご当地ラーメン（${names}）の特徴、スープ・麺・トッピング、発祥店を解説。地方別ご当地ラーメン一覧の詳細ページ。`;
}
