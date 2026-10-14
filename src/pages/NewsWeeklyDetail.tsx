import { Link, useParams } from 'react-router-dom';
import { Seo } from '@/components/common/Seo';
import { StructuredData } from '@/components/common/StructuredData';
import { buildSiteUrl } from '@/config/site';
import { NotFound } from '@/pages/NotFound';
import {
  findNewsWeeklyBySlug,
  formatMonthDay,
  newsWeeklyTitle,
  youtubeThumbnail,
  youtubeUrl,
  type NewsWeeklyItem,
} from '@/content/newsWeekly';

/**
 * ラーメンニュース週報の詳細ページ (`/news/:slug`)。
 *
 * その週に公開した話題ショートの再生数ランキングと、話題ごとの背景解説を表示する。
 * 動画は埋め込まず、サムネイル画像から YouTube へリンクする (ページを軽く保ち、
 * 埋め込みプレーヤーの Cookie を読み込まないため)。
 */
export function NewsWeeklyDetail(): JSX.Element {
  const { slug } = useParams<{ slug: string }>();
  const report = slug ? findNewsWeeklyBySlug(slug) : undefined;
  if (!report) return <NotFound />;

  const title = newsWeeklyTitle(report);
  const top = report.items[0];
  const description = `${formatMonthDay(report.periodStart)}〜${formatMonthDay(report.periodEnd)}に紹介したラーメンの話題 ${report.items.length} 本を再生数順に振り返り、背景を解説。第 1 位は「${top?.title ?? ''}」。`;
  // viewsCountedAt は日本時間の ISO 文字列。ビルド環境 (UTC) のタイムゾーンに左右されないよう日付部分だけ使う。
  const countedLabel = formatMonthDay(report.viewsCountedAt.slice(0, 10));

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description,
    datePublished: report.publishedAt,
    author: { '@type': 'Organization', name: 'ラーメンクイズ' },
    publisher: { '@type': 'Organization', name: 'ラーメンクイズ' },
    mainEntityOfPage: { '@type': 'WebPage', '@id': buildSiteUrl(`/news/${report.slug}`) },
  };

  return (
    <div className="card space-y-8">
      <Seo title={title} description={description} url={`/news/${report.slug}`} ogType="article" />
      <StructuredData schema={articleSchema} />

      <header className="space-y-2">
        <p className="text-xs text-ramen-soy/60">
          <Link to="/news" className="hover:text-ramen-chili hover:underline">
            ラーメンニュース週報
          </Link>
          <span className="mx-1">/</span>
          <span>{formatMonthDay(report.publishedAt)}公開</span>
        </p>
        <h1 className="text-2xl font-black text-ramen-soy">{title}</h1>
        <p className="text-sm leading-relaxed text-ramen-soy/80">{report.lead}</p>
      </header>

      <section className="space-y-3">
        <h2 className="border-b border-ramen-soy/10 pb-1 text-base font-bold text-ramen-soy">
          今週の再生数ランキング
        </h2>
        <ol className="space-y-1 text-sm text-ramen-soy/90">
          {report.items.map((item) => (
            <li key={item.videoId} className="flex gap-2">
              <span className="w-12 shrink-0 font-bold text-ramen-chili">第{item.rank}位</span>
              <a href={`#rank-${item.rank}`} className="flex-1 hover:text-ramen-chili hover:underline">
                {item.title}
              </a>
              <span className="shrink-0 text-ramen-soy/70">{item.views.toLocaleString()} 回</span>
            </li>
          ))}
        </ol>
        <p className="text-xs text-ramen-soy/60">
          ※ 再生数は {countedLabel}時点の累計です。公開日が早い動画ほど多くなりやすいため、参考としてご覧ください。
        </p>
      </section>

      {report.items.map((item) => (
        <NewsItemSection key={item.videoId} item={item} />
      ))}

      <div className="flex flex-wrap gap-4 border-t border-ramen-soy/10 pt-4 text-sm">
        <Link to="/news" className="font-bold text-ramen-chili hover:underline">
          ほかの週の週報を見る →
        </Link>
        <Link to="/quiz/knowledge" className="font-bold text-ramen-chili hover:underline">
          ラーメン知識クイズに挑戦 →
        </Link>
        <Link to="/" className="text-ramen-soy/70 hover:underline">
          トップへ戻る
        </Link>
      </div>
    </div>
  );
}

function NewsItemSection({ item }: { item: NewsWeeklyItem }): JSX.Element {
  return (
    <section id={`rank-${item.rank}`} className="space-y-3 scroll-mt-4">
      <h2 className="border-b border-ramen-soy/10 pb-1 text-base font-bold text-ramen-soy">
        第{item.rank}位　{item.title}
      </h2>
      <div className="flex flex-col gap-3 sm:flex-row">
        <a
          href={youtubeUrl(item.videoId)}
          target="_blank"
          rel="noopener noreferrer"
          className="block shrink-0 sm:w-48"
        >
          <img
            src={youtubeThumbnail(item.videoId)}
            alt={`動画「${item.title}」のサムネイル`}
            className="w-full rounded-lg border border-ramen-soy/10"
            loading="lazy"
          />
        </a>
        <div className="space-y-1 text-sm text-ramen-soy/90">
          <p className="text-xs text-ramen-soy/60">
            {formatMonthDay(item.postedOn)}公開・{item.views.toLocaleString()} 回再生
          </p>
          <p className="font-bold leading-relaxed">{item.summary}</p>
          <a
            href={youtubeUrl(item.videoId)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-xs font-bold text-ramen-chili hover:underline"
          >
            YouTube で動画を見る →
          </a>
        </div>
      </div>
      <div className="space-y-2">
        <h3 className="text-sm font-bold text-ramen-soy">背景解説</h3>
        {item.background.map((p, i) => (
          <p key={i} className="text-sm leading-relaxed text-ramen-soy/90">
            {p}
          </p>
        ))}
      </div>
      {item.sources.length > 0 ? (
        <div className="text-xs text-ramen-soy/70">
          <p className="font-bold">出典</p>
          <ul className="list-disc pl-5">
            {item.sources.map((s) => (
              <li key={s.url}>
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                  {s.title}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
