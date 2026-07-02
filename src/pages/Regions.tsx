import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Seo } from '@/components/common/Seo';
import { StructuredData } from '@/components/common/StructuredData';
import { buildSiteUrl } from '@/config/site';
import {
  REGION_ORDER,
  REGIONAL_RAMEN,
  groupRegionalRamenByRegion,
} from '@/data/regionalRamen';

/**
 * 都道府県別ご当地ラーメン一覧ページ (`/regions`)。
 *
 * SEO 強化第三弾。
 * - 8 地方 (北海道・東北・関東・中部・近畿・中国・四国・九州) にグルーピングして表示する。
 * - 各都道府県のリンクの右に代表系統名を併記し、目的別クリックを促す。
 * - Schema.org の CollectionPage を注入し、都道府県ページ群の入口であることを構造化データで示す。
 */
export function Regions(): JSX.Element {
  /** 地方ごとの都道府県一覧 (useMemo でオブジェクト再生成を抑える)。 */
  const byRegion = useMemo(() => groupRegionalRamenByRegion(), []);

  /** Schema.org CollectionPage スキーマ。各都道府県詳細ページを ItemList で列挙する。 */
  const collectionSchema = useMemo(
    () => ({
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: '都道府県別ご当地ラーメン一覧',
      description:
        '北海道から鹿児島まで、日本全国のご当地ラーメンを都道府県別に一覧化。地方別グルーピングで比較しやすい。',
      url: buildSiteUrl('/regions'),
      mainEntity: {
        '@type': 'ItemList',
        numberOfItems: REGIONAL_RAMEN.length,
        itemListElement: REGIONAL_RAMEN.map((r, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: `${r.prefecture} のご当地ラーメン`,
          url: buildSiteUrl(`/regions/${r.prefectureSlug}`),
        })),
      },
    }),
    [],
  );

  return (
    <div className="card space-y-6">
      <Seo
        title={`都道府県別ご当地ラーメン一覧 | ${REGIONAL_RAMEN.length}県のご当地ラーメンをまとめて解説`}
        description={`北海道の札幌味噌ラーメンから鹿児島ラーメンまで、日本全国 ${REGIONAL_RAMEN.length} 県のご当地ラーメンを地方別に一覧化。各県のスープ・麺・トッピングの特徴、発祥店の情報などをまとめました。`}
        url="/regions"
        keywords={[
          'ご当地ラーメン',
          '都道府県別ラーメン',
          '全国 ラーメン 特集',
          'ラーメン 種類 地域',
          '札幌 博多 家系',
          '燕背脂 富山ブラック',
        ]}
      />
      <StructuredData schema={collectionSchema} />

      <header className="space-y-2">
        <h1 className="text-2xl font-black text-ramen-soy">都道府県別ご当地ラーメン</h1>
        <p className="text-sm text-ramen-soy/80">
          日本全国 {REGIONAL_RAMEN.length} 県のご当地ラーメンを地方別にまとめました。
          各都道府県をクリックすると、その県の代表的なラーメンの特徴・スープ・麺・トッピングを詳しく解説します。
        </p>
      </header>

      {REGION_ORDER.map((region) => {
        const items = byRegion[region];
        if (!items || items.length === 0) return null;
        return (
          <section key={region} className="space-y-2">
            <h2 className="border-b border-ramen-soy/10 pb-1 text-base font-bold text-ramen-soy">
              {region}地方（{items.length} 県）
            </h2>
            <ul className="space-y-2">
              {items.map((item) => {
                // 代表系統名を最大 3 件までカンマ区切りで抜粋
                const highlightNames = item.ramenTypes
                  .slice(0, 3)
                  .map((t) => t.name)
                  .join('・');
                return (
                  <li key={item.prefectureSlug}>
                    <Link
                      to={`/regions/${item.prefectureSlug}`}
                      className="flex flex-col rounded-lg border border-ramen-soy/10 bg-white/60 px-3 py-2 hover:border-ramen-chili hover:bg-ramen-broth/10 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3"
                    >
                      <span className="text-sm font-bold text-ramen-soy sm:text-base">
                        {item.prefecture}
                      </span>
                      <span className="text-xs text-ramen-soy/70">{highlightNames}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      <div className="flex flex-wrap gap-4 border-t border-ramen-soy/10 pt-4 text-sm">
        <Link to="/glossary" className="font-bold text-ramen-chili hover:underline">
          ラーメン用語辞典 →
        </Link>
        <Link to="/quiz/knowledge/regional" className="font-bold text-ramen-chili hover:underline">
          地域ラーメンクイズに挑戦 →
        </Link>
        <Link to="/" className="text-ramen-soy/70 hover:underline">
          トップへ戻る
        </Link>
      </div>
    </div>
  );
}
