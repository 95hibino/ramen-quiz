import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { YOUTUBE_CHANNEL_URL } from '@/config/site';
import rawQuestions from '@/data/questions.json';
import { fetchPhotoQuestionCount, fetchYoutubeViews, formatJapaneseCount } from '@/lib/siteStats';

/**
 * トップページの「数字で見るラーメンクイズ」。
 *
 * サイトに人がいることを伝えるための表示。出すのは実数だけで、取れなかった項目は出さない。
 * 写真クイズの問題はほとんどが運営の作成なので「投稿数」ではなく「問題数」と書く。
 * YouTube は動画の種類 (短尺・通常) を書かずに「動画」とだけ書く (社長方針 2026-10-18)。
 */
export function SiteStats(): JSX.Element {
  const [photoCount, setPhotoCount] = useState<number | null>(null);
  const [youtubeViews, setYoutubeViews] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchPhotoQuestionCount().then((n) => {
      if (!cancelled) setPhotoCount(n);
    });
    void fetchYoutubeViews().then((n) => {
      if (!cancelled) setYoutubeViews(n);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="card space-y-3" aria-labelledby="site-stats-heading">
      <h2 id="site-stats-heading" className="text-center text-sm font-bold text-ramen-soy/70">
        数字で見るラーメンクイズ
      </h2>
      <ul className="grid gap-3 sm:grid-cols-3">
        <StatItem
          icon="📝"
          label="知識クイズ"
          value={`${rawQuestions.length.toLocaleString('ja-JP')}問`}
          to="/quiz/knowledge"
        />
        {photoCount !== null && photoCount > 0 ? (
          <StatItem
            icon="📸"
            label="写真当てクイズ"
            value={`${photoCount.toLocaleString('ja-JP')}問`}
            to="/quiz/photo"
          />
        ) : null}
        {youtubeViews !== null ? (
          <StatItem
            icon="▶️"
            label="YouTube 動画の累計再生"
            value={`${formatJapaneseCount(youtubeViews)}回`}
            href={YOUTUBE_CHANNEL_URL}
          />
        ) : null}
      </ul>
    </section>
  );
}

interface StatItemProps {
  icon: string;
  label: string;
  value: string;
  to?: string;
  href?: string;
}

function StatItem({ icon, label, value, to, href }: StatItemProps): JSX.Element {
  const className =
    'flex h-full flex-col items-center rounded-lg border border-ramen-soy/10 bg-white/60 px-3 py-3 text-center hover:border-ramen-chili hover:bg-ramen-broth/10';
  const body = (
    <>
      <span className="text-xs text-ramen-soy/70">
        <span aria-hidden="true">{icon} </span>
        {label}
      </span>
      <span className="mt-1 text-2xl font-black text-ramen-chili">{value}</span>
    </>
  );
  return (
    <li>
      {href ? (
        <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
          {body}
        </a>
      ) : (
        <Link to={to ?? '/'} className={className}>
          {body}
        </Link>
      )}
    </li>
  );
}
