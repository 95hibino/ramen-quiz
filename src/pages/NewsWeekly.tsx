import { Link } from 'react-router-dom';
import { Seo } from '@/components/common/Seo';
import { StructuredData } from '@/components/common/StructuredData';
import { buildSiteUrl } from '@/config/site';
import {
  NEWS_WEEKLY_REPORTS,
  formatMonthDay,
  newsWeeklyTitle,
} from '@/content/newsWeekly';

/**
 * ラーメンニュース週報の一覧ページ (`/news`)。
 *
 * YouTube の話題ショートを 1 週間ごとにまとめた週報を、新しい順に並べる。
 * 各週報は `/news/:slug` にプリレンダリングされる (publicRoutes.ts)。
 */
export function NewsWeekly(): JSX.Element {
  const collectionSchema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'ラーメンニュース週報',
    description:
      'YouTube「ラーメンクイズ」で紹介したラーメンの話題を 1 週間ごとにまとめ、再生数の順位と各話題の背景を解説する週報。',
    url: buildSiteUrl('/news'),
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: NEWS_WEEKLY_REPORTS.length,
      itemListElement: NEWS_WEEKLY_REPORTS.map((r, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: newsWeeklyTitle(r),
        url: buildSiteUrl(`/news/${r.slug}`),
      })),
    },
  };

  return (
    <div className="card space-y-6">
      <Seo
        title="ラーメンニュース週報 | 今週のラーメンの話題と背景解説"
        description="YouTube「ラーメンクイズ」で紹介したラーメンの話題を毎週まとめ、再生数ランキングと各話題の背景を解説します。新商品・新店から、賛否が分かれたルールの話まで。"
        url="/news"
        keywords={['ラーメン ニュース', 'ラーメン 話題', 'ラーメン 新商品', 'ラーメン 新店', 'ラーメン 週報']}
      />
      <StructuredData schema={collectionSchema} />

      <header className="space-y-2">
        <h1 className="text-2xl font-black text-ramen-soy">ラーメンニュース週報</h1>
        <p className="text-sm leading-relaxed text-ramen-soy/80">
          YouTube チャンネル「ラーメンクイズ」では、毎朝ラーメンにまつわる話題を 1 本ずつショート動画で紹介しています。
          この週報では、金曜から木曜までの 1 週間に公開した動画を再生数の順に並べ、それぞれの話題について、
          動画では伝えきれなかった背景や経緯を解説します。新商品・新店の情報から、賛否が分かれたお店のルールの話まで、
          その週のラーメン界の動きをまとめて振り返ることができます。
        </p>
        <p className="text-sm leading-relaxed text-ramen-soy/80">
          動画と解説で扱う数字や固有名詞は、公式の発表や報道の原文で確認したうえで掲載し、各話題の末尾に出典を載せています。
          再生数は集計した時点の累計で、公開日が早い動画ほど多くなりやすい点にご注意ください。毎週金曜に新しい週報を追加します。
        </p>
      </header>

      {NEWS_WEEKLY_REPORTS.length === 0 ? (
        <p className="text-sm text-ramen-soy/70">最初の週報を準備中です。</p>
      ) : (
        <ul className="space-y-2">
          {NEWS_WEEKLY_REPORTS.map((r) => (
            <li key={r.slug}>
              <Link
                to={`/news/${r.slug}`}
                className="flex flex-col rounded-lg border border-ramen-soy/10 bg-white/60 px-3 py-3 hover:border-ramen-chili hover:bg-ramen-broth/10"
              >
                <span className="text-sm font-bold text-ramen-soy sm:text-base">{newsWeeklyTitle(r)}</span>
                <span className="mt-1 text-xs leading-relaxed text-ramen-soy/70">
                  {formatMonthDay(r.publishedAt)}公開・{r.items.length} 本の話題。第 1 位は「{r.items[0]?.title}」
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-4 border-t border-ramen-soy/10 pt-4 text-sm">
        <Link to="/articles" className="font-bold text-ramen-chili hover:underline">
          ラーメンの読みもの →
        </Link>
        <Link to="/" className="text-ramen-soy/70 hover:underline">
          トップへ戻る
        </Link>
      </div>
    </div>
  );
}
