/**
 * 学習モード (`/learn`) ページ。
 *
 * 「間違えた問題」と「お気に入り問題」を復習するための入口。
 * どちらもクイズプレイ後の自動蓄積 (前者) / ユーザーの手動保存 (後者) に基づく localStorage 由来のデータ。
 *
 * 認証不要 (localStorage 完結のため未ログインでも動作)。
 * ランキング機能とは独立し、端末単位で成長するタイプの機能。
 */
import { useState } from 'react';
import { Seo } from '@/components/common/Seo';
import { StructuredData } from '@/components/common/StructuredData';
import { buildSiteUrl } from '@/config/site';
import { WrongAnswersSection } from '@/components/learn/WrongAnswersSection';
import { FavoritesSection } from '@/components/mypage/FavoritesSection';
import { useWrongAnswersStore } from '@/stores/wrongAnswersStore';
import { useFavoritesStore } from '@/stores/favoritesStore';

type Tab = 'wrong' | 'favorites';

export function Learn(): JSX.Element {
  const wrongCount = useWrongAnswersStore((s) => s.wrongAnswers.length);
  const favoritesCount = useFavoritesStore((s) => s.favorites.length);
  // 初期タブは「間違えた問題があればそこ、無ければお気に入り」の優先度で選ぶ。
  const [tab, setTab] = useState<Tab>(wrongCount > 0 ? 'wrong' : 'favorites');

  const breadcrumbSchema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'ホーム',
        item: buildSiteUrl('/'),
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: '学習モード',
        item: buildSiteUrl('/learn'),
      },
    ],
  };

  return (
    <div className="space-y-6">
      <Seo
        title="学習モード"
        description="間違えた問題とお気に入りを復習して、ラーメン知識を確実に身につけよう。復習で「覚えた」を押すと一覧から自動的に外れます。"
        url="/learn"
        keywords={['ラーメンクイズ', '学習モード', '復習', '間違えた問題', 'お気に入り']}
      />
      <StructuredData schema={breadcrumbSchema} />

      <section className="card">
        <p className="text-3xl" aria-hidden="true">
          📚
        </p>
        <h1 className="mt-2 text-2xl font-black text-ramen-soy">学習モード</h1>
        <p className="mt-2 text-sm leading-relaxed text-ramen-soy/80">
          間違えた問題は自動的に「間違えた問題」に貯まります。復習して「✓ 覚えた」を押すと一覧から外れます。<br />
          気になった問題はクイズ画面の ★ ボタンで「お気に入り」に保存でき、いつでも見直せます。
        </p>
      </section>

      {/* タブ */}
      <div className="flex gap-2" role="tablist" aria-label="学習コンテンツの種類">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'wrong'}
          onClick={() => setTab('wrong')}
          className={`flex-1 rounded-xl px-4 py-3 text-sm font-bold transition ${
            tab === 'wrong'
              ? 'bg-ramen-chili text-white shadow'
              : 'bg-white text-ramen-soy hover:bg-ramen-broth/20'
          }`}
        >
          間違えた問題{' '}
          <span className="ml-1 rounded-full bg-white/25 px-2 py-0.5 text-[10px]">
            {wrongCount}
          </span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'favorites'}
          onClick={() => setTab('favorites')}
          className={`flex-1 rounded-xl px-4 py-3 text-sm font-bold transition ${
            tab === 'favorites'
              ? 'bg-ramen-chili text-white shadow'
              : 'bg-white text-ramen-soy hover:bg-ramen-broth/20'
          }`}
        >
          お気に入り{' '}
          <span className="ml-1 rounded-full bg-white/25 px-2 py-0.5 text-[10px]">
            {favoritesCount}
          </span>
        </button>
      </div>

      {tab === 'wrong' ? <WrongAnswersSection /> : <FavoritesSection />}
    </div>
  );
}
