import { Link } from 'react-router-dom';
import { AdBanner } from '@/components/common/AdBanner';
import { AffiliateBanner } from '@/components/common/AffiliateBanner';
import { Seo } from '@/components/common/Seo';
import { ShareButtons } from '@/components/common/ShareButtons';
import { StructuredData } from '@/components/common/StructuredData';
import { buildSiteUrl, SITE_NAME } from '@/config/site';
import { ARTICLES } from '@/content/articles';
import { GLOSSARY_TERMS } from '@/content/glossary';
import { OPERATOR_CONTACT, OPERATOR_NAME } from '@/content/legalMeta';
import { REGIONAL_RAMEN } from '@/data/regionalRamen';
import rawQuestions from '@/data/questions.json';

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
        description="ラーメンに関する 4 択クイズ Web アプリ。基礎知識から地域文化、上級マニアックな知識まで全 300 問。写真当てクイズも遊べる無料サービス。"
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

      <section className="card space-y-3">
        <h2 className="text-xl font-black text-ramen-soy">ラーメンクイズとは</h2>
        <p className="text-sm leading-relaxed text-ramen-soy/80">
          ラーメンクイズは、ラーメンにまつわる知識を「問題を解いて、解説を読む」ことで身につける無料の学習サイトです。
          中華麺が黄色くコシがあるのはなぜか、札幌・旭川・函館でスープが違うのはなぜか、家系と二郎系はどこが違うのか。
          見聞きする機会は多くてもまとめて確かめる場所の少ないこうした知識を、{rawQuestions.length} 問の 4 択クイズと
          解説で一つずつ整理できます。
        </p>
        <p className="text-sm leading-relaxed text-ramen-soy/80">
          問題は初級（スープ・麺・トッピングの基礎）、中級（ご当地ラーメンと老舗の歴史）、上級（製麺技術・スープの科学・
          家系や二郎系の系譜）の 3 段階。間違えた問題は自動で保存され、学習モードで繰り返し復習できます。
          発祥に諸説ある事柄は断定せず「諸説あり」と明記するなど、問題と解説の作り方は
          <Link to="/about" className="text-ramen-chili hover:underline">
            このサイトについて
          </Link>
          で公開しています。
        </p>
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

      <section className="card">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-2xl" aria-hidden="true">
              📚
            </p>
            <h2 className="mt-2 text-xl font-black text-ramen-nori">学習モード</h2>
            <p className="mt-1 text-sm text-ramen-soy/80">
              間違えた問題は自動で保存され、いつでも復習できます。★ でお気に入り登録した問題も一覧で見返せます。
            </p>
          </div>
          <Link to="/learn" className="btn-secondary self-start sm:self-center">
            復習する
          </Link>
        </div>
      </section>

      <section className="card space-y-3">
        <h2 className="text-xl font-black text-ramen-soy">クイズ以外の読みもの</h2>
        <p className="text-sm text-ramen-soy/80">
          クイズを解く前の予習にも、解いた後の深掘りにも使える解説ページです。
        </p>
        <ul className="grid gap-3 sm:grid-cols-2">
          <ReadingLink
            to="/articles"
            title={`ラーメンの読みもの（${ARTICLES.length} 本）`}
            description="かん水と麺の科学、家系の系譜図、二郎のコール、つけ麺の歴史、地方別のご当地ラーメン図鑑。クイズの解説をテーマ別に編み直した記事。"
          />
          <ReadingLink
            to="/regions"
            title={`都道府県別ご当地ラーメン（${REGIONAL_RAMEN.length} 県）`}
            description="札幌味噌・喜多方・富山ブラック・博多豚骨・沖縄そばまで。各県の代表系統のスープ・麺・発祥・食文化を解説。"
          />
          <ReadingLink
            to="/glossary"
            title={`ラーメン用語辞典（${GLOSSARY_TERMS.length} 語）`}
            description="清湯・白湯・加水率・番手・カエシ・コール。クイズと解説に出てくる専門用語をカテゴリ別に。"
          />
          <ReadingLink
            to="/faq"
            title="よくある質問"
            description="博多・家系・二郎系・つけ麺の元祖は？といったラーメン知識と、サイトの使い方の Q&A。"
          />
          <ReadingLink
            to="/learn"
            title="学習モード"
            description="間違えた問題とお気に入りをまとめて復習。覚えた問題は一覧から自動で外れます。"
          />
        </ul>
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

function ReadingLink({
  to,
  title,
  description,
}: {
  to: string;
  title: string;
  description: string;
}): JSX.Element {
  return (
    <li>
      <Link
        to={to}
        className="flex h-full flex-col rounded-lg border border-ramen-soy/10 bg-white/60 px-3 py-3 hover:border-ramen-chili hover:bg-ramen-broth/10"
      >
        <span className="text-sm font-bold text-ramen-soy">{title}</span>
        <span className="mt-1 text-xs leading-relaxed text-ramen-soy/70">{description}</span>
      </Link>
    </li>
  );
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
