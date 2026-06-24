import { Link } from 'react-router-dom';
import { AdBanner } from '@/components/common/AdBanner';
import { AffiliateBanner } from '@/components/common/AffiliateBanner';
import { Seo } from '@/components/common/Seo';
import { ShareButtons } from '@/components/common/ShareButtons';
import { StructuredData } from '@/components/common/StructuredData';
import { buildSiteUrl, SITE_NAME } from '@/config/site';
import { OPERATOR_CONTACT, OPERATOR_NAME } from '@/content/legalMeta';

export function Home(): JSX.Element {
  const siteUrl = buildSiteUrl('/');
  const shareText =
    '🍜 ラーメンクイズで知識を試そう！\n歴史・地域・文化を 4 択で楽しく学べる無料アプリです。';

  // Schema.org: サイト全体を示す WebSite + 運営者の Organization。
  // AI 検索エンジン (SearchGPT / Perplexity / Google AI Overviews) からの引用機会を高める。
  // 運営者情報は legalMeta.ts の定数を参照 (環境変数で上書き可能、プレースホルダ「（…）」のままなら email を省略)。
  const organizationSchema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: OPERATOR_NAME,
    url: siteUrl,
  };
  if (!OPERATOR_CONTACT.startsWith('（')) {
    organizationSchema.email = OPERATOR_CONTACT;
  }
  const structuredData: Record<string, unknown>[] = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: SITE_NAME,
      url: siteUrl,
      description:
        'ラーメンの歴史・地域・文化・製麺まで、奥深いラーメン知識を 4 択クイズで楽しく学べる無料 Web アプリ。',
      inLanguage: 'ja',
    },
    organizationSchema,
  ];

  return (
    <div className="space-y-8">
      <Seo
        title="トップ"
        description="ラーメンに関する 4 択クイズ Web アプリ。基礎知識から地域文化、上級マニアックな知識まで全 150 問。写真当てクイズも遊べる無料サービス。"
        url="/"
        keywords={[
          'ラーメン',
          'ラーメンクイズ',
          'クイズ',
          '4択クイズ',
          'ご当地ラーメン',
          'ラーメン雑学',
          '写真当てクイズ',
        ]}
      />
      <StructuredData schema={structuredData} />
      {/* design §3.3: トップページ/ヘッダー下 728x90 Leaderboard */}
      <AdBanner slot="home-top" size="leaderboard" />

      <section className="card text-center">
        <p className="text-4xl" aria-hidden="true">
          🍜
        </p>
        <h1 className="mt-3 text-3xl font-black text-ramen-soy sm:text-4xl">
          ラーメンクイズに挑戦！
        </h1>
        <p className="mt-3 text-base leading-relaxed text-ramen-soy/80">
          ラーメンの歴史・地域・文化・製麺まで、奥深いラーメン知識を 4 択クイズで楽しく学ぼう。
          <br className="hidden sm:block" />
          1セッション 10 問・各 20 秒のスピードクイズです。
        </p>
        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link to="/quiz/knowledge" className="btn-primary">
            知識クイズを始める
          </Link>
          <Link to="/quiz/photo" className="btn-secondary">
            写真当てクイズを始める
          </Link>
        </div>
        <div className="mt-3">
          <Link to="/about" className="text-sm text-ramen-soy/70 hover:underline">
            このサイトについて
          </Link>
        </div>
      </section>

      <section className="card">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-2xl" aria-hidden="true">
              📸
            </p>
            <h2 className="mt-2 text-xl font-black text-ramen-chili">写真当てクイズ</h2>
            <p className="mt-1 text-sm text-ramen-soy/80">
              ラーメンの写真からお店・系統・都道府県を当てよう。
              <br className="hidden sm:block" />
              種類・地域・写真タイプ・難易度・麺の太さで絞り込みできます。
            </p>
          </div>
          <Link to="/quiz/photo" className="btn-primary self-start sm:self-center">
            写真当てに挑戦
          </Link>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <FeatureCard
          icon="🥢"
          title="基礎から学べる"
          description="スープ・麺・トッピングなど、まずは初級から気軽に。"
        />
        <FeatureCard
          icon="🗾"
          title="地域・店舗の知識"
          description="ご当地ラーメンや有名店のうんちくを楽しく吸収。"
        />
        <FeatureCard
          icon="🔥"
          title="マニアック上級編"
          description="製麺技術や乳化など、奥深い世界に踏み込もう。"
        />
      </section>

      <section className="card text-center">
        <p className="text-xs font-bold text-ramen-soy/70">サイトをシェアしてラーメン仲間を増やそう</p>
        <div className="mt-3">
          <ShareButtons
            text={shareText}
            url={siteUrl}
            hashtags={['ラーメンクイズ', 'ラーメン愛好家']}
            ariaLabel="サイト全体のシェア"
          />
        </div>
      </section>

      {/* ホーム下部のアフィリエイト枠（環境変数未設定なら非表示）。 */}
      <AffiliateBanner slot="home-bottom" />
    </div>
  );
}

interface FeatureCardProps {
  icon: string;
  title: string;
  description: string;
}

function FeatureCard({ icon, title, description }: FeatureCardProps): JSX.Element {
  return (
    <div className="card">
      <p className="text-3xl" aria-hidden="true">
        {icon}
      </p>
      <h2 className="mt-2 text-lg font-bold text-ramen-soy">{title}</h2>
      <p className="mt-1 text-sm text-ramen-soy/80">{description}</p>
    </div>
  );
}
