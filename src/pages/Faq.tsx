import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Seo } from '@/components/common/Seo';
import { StructuredData } from '@/components/common/StructuredData';
import {
  FAQ_CATEGORY_LABELS,
  FAQ_ITEMS,
  type FaqCategory,
  type FaqItem,
} from '@/content/faq';

/**
 * FAQ (よくある質問) ページ (`/faq`)。
 *
 * SEO 強化第二弾。
 * - コンテンツ系 (ラーメン知識) 12 件 + サービス系 8 件を Q&A 形式で提供する。
 * - Schema.org の FAQPage スキーマを注入し、AI 検索・Google リッチリザルトに引用されやすくする。
 * - 各 Q&A はネイティブの `<details>` によるアコーディオン表示 (JS 不要)。
 *
 * 本文データは `src/content/faq.tsx` に集約。ページ側では見た目の組み立てだけを担う。
 */

/** 表示上のカテゴリの並び順。SEO 上、知識コンテンツを先に見せたいので content → service。 */
const CATEGORY_ORDER: ReadonlyArray<FaqCategory> = ['content', 'service'];

export function Faq(): JSX.Element {
  /** カテゴリごとに FAQ 項目をグルーピング (useMemo で再計算を抑える)。 */
  const itemsByCategory = useMemo(() => groupByCategory(FAQ_ITEMS), []);

  /** Schema.org FAQPage スキーマ。答えは表示側の HTML と切り離してプレーンテキストのまま渡す。 */
  const faqSchema = useMemo(
    () => ({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: FAQ_ITEMS.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: item.answer,
        },
      })),
    }),
    [],
  );

  return (
    <div className="card space-y-6">
      <Seo
        title="よくある質問 (FAQ)"
        description="ラーメンクイズに関するよくある質問と、ラーメン知識（博多ラーメン、家系、二郎系、味噌、つけ麺の元祖など）に関する解説を Q&A 形式でまとめています。"
        url="/faq"
        keywords={[
          'ラーメン FAQ',
          'ラーメン クイズ 使い方',
          '博多ラーメン とは',
          '家系ラーメン 特徴',
          'つけ麺 発祥',
          '加水率 意味',
          '乳化 意味',
          'かん水 とは',
        ]}
      />
      <StructuredData schema={faqSchema} />

      <header className="space-y-2">
        <h1 className="text-2xl font-black text-ramen-soy">よくある質問 (FAQ)</h1>
        <p className="text-sm text-ramen-soy/80">
          ラーメンクイズの使い方に関するご質問と、ラーメン文化・用語の基礎知識を Q&A 形式でまとめました。
          各質問をタップすると回答が展開されます。
        </p>
      </header>

      {CATEGORY_ORDER.map((category) => {
        const items = itemsByCategory[category];
        if (!items || items.length === 0) return null;
        return (
          <section key={category} className="space-y-3">
            <h2 className="border-b border-ramen-soy/10 pb-1 text-base font-bold text-ramen-soy">
              {FAQ_CATEGORY_LABELS[category]}
            </h2>
            <ul className="space-y-2">
              {items.map((item) => (
                <li key={item.id}>
                  <FaqEntry item={item} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      <div className="flex flex-wrap gap-4 border-t border-ramen-soy/10 pt-4 text-sm">
        <Link to="/contact" className="font-bold text-ramen-chili hover:underline">
          お問い合わせ →
        </Link>
        <Link to="/about" className="font-bold text-ramen-chili hover:underline">
          このサイトについて →
        </Link>
        <Link to="/" className="text-ramen-soy/70 hover:underline">
          トップへ戻る
        </Link>
      </div>
    </div>
  );
}

/**
 * 1 件の Q&A を `<details>` アコーディオンで表示する。
 * `id` はページ内アンカー (`/faq#q-xxxx`) からのジャンプにも使う。
 */
function FaqEntry({ item }: { item: FaqItem }): JSX.Element {
  return (
    <details
      id={`q-${item.id}`}
      className="group rounded-lg border border-ramen-soy/10 bg-white/60 px-3 py-2 open:bg-ramen-broth/10"
    >
      <summary className="cursor-pointer list-none text-sm font-bold text-ramen-soy sm:text-base">
        <span className="mr-2 text-ramen-chili">Q.</span>
        {item.question}
        <span
          aria-hidden="true"
          className="ml-2 text-xs text-ramen-soy/50 transition-transform group-open:rotate-180 inline-block"
        >
          ▼
        </span>
      </summary>
      <p className="mt-2 border-t border-ramen-soy/10 pt-2 text-sm leading-relaxed text-ramen-soy/90">
        <span className="mr-2 font-bold text-ramen-chili">A.</span>
        {item.answer}
      </p>
    </details>
  );
}

/**
 * FAQ 項目をカテゴリ別にグルーピングする。
 * 元配列の順序を維持したまま、カテゴリごとの配列に分解する。
 */
function groupByCategory(
  items: ReadonlyArray<FaqItem>,
): Record<FaqCategory, ReadonlyArray<FaqItem>> {
  const initial: Record<FaqCategory, FaqItem[]> = {
    content: [],
    service: [],
  };
  for (const item of items) {
    initial[item.category].push(item);
  }
  return initial;
}
