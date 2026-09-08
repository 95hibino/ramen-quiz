import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Seo } from '@/components/common/Seo';
import { StructuredData } from '@/components/common/StructuredData';
import { buildSiteUrl, SITE_NAME } from '@/config/site';
import { CATEGORY_META } from '@/config/quizConfig';
import { GLOSSARY_TERMS } from '@/content/glossary';
import { LEGAL_LAST_UPDATED, OPERATOR_NAME } from '@/content/legalMeta';
import { REGIONAL_RAMEN } from '@/data/regionalRamen';
import rawQuestions from '@/data/questions.json';
import type { QuizCategory } from '@/types/quiz';

/**
 * 「このサイトについて」ページ (`/about`)。
 *
 * 運営者・目的・コンテンツの作り方・検証方針・広告の扱いを明記する、
 * サイトの信頼性 (E-E-A-T) を担うページ。問題数や収録県数は同梱データから
 * 動的に算出し、データを増やしても本文の数字が古くならないようにしている。
 */
export function About(): JSX.Element {
  const totalQuestions = rawQuestions.length;
  const countByCategory = (category: QuizCategory): number =>
    rawQuestions.filter((q) => q.category === category).length;

  const aboutSchema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    name: `${SITE_NAME} について`,
    description:
      'ラーメンクイズの運営者・目的・問題の作り方と検証方針・広告の扱いについて説明するページ。',
    url: buildSiteUrl('/about'),
    inLanguage: 'ja',
    publisher: {
      '@type': 'Organization',
      name: OPERATOR_NAME,
      url: buildSiteUrl('/'),
    },
  };

  return (
    <div className="card space-y-8">
      <Seo
        title="このサイトについて"
        description={`ラーメンクイズの運営者・目的・問題の作り方と検証方針。知識クイズ ${totalQuestions} 問、都道府県別ご当地ラーメン ${REGIONAL_RAMEN.length} 県、用語辞典 ${GLOSSARY_TERMS.length} 語を収録する無料のラーメン学習サイトです。`}
        url="/about"
      />
      <StructuredData schema={aboutSchema} />

      <header className="space-y-2">
        <h1 className="text-2xl font-black text-ramen-soy">このサイトについて</h1>
        <p className="text-sm leading-relaxed text-ramen-soy/80">
          「{SITE_NAME}」は、ラーメンの歴史・地域文化・製麺技術・有名店の系譜といった知識を、
          4 択クイズと解説を通じて楽しく学べる無料の学習サイトです。個人が運営しており、
          収録している問題・解説・ご当地ラーメンの紹介文はすべて運営者が執筆・編集しています。
        </p>
      </header>

      <Section title="サイトの目的">
        <p>
          ラーメンは日本で最も身近な料理の一つでありながら、「なぜ中華麺は黄色いのか」「家系と二郎系は
          何が違うのか」「札幌・旭川・函館でスープが違うのはなぜか」といった疑問に、まとまって答えてくれる
          場所は意外と多くありません。本サイトは、そうした断片的になりがちな知識を「問題 → 解説」という
          形で一つずつ確かめながら身につけられるように作りました。クイズで間違えた問題は自動的に保存され、
          学習モードで繰り返し復習できます。
        </p>
      </Section>

      <Section title="収録しているコンテンツ">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>知識クイズ {totalQuestions} 問</strong>：
            {CATEGORY_META.map((meta, idx) => (
              <span key={meta.category}>
                {idx > 0 ? '・' : ''}
                {meta.label} ({meta.description.replace(/ \(.*\)$/, '')}) {countByCategory(meta.category)} 問
              </span>
            ))}
            。すべての問題に解説を付けています。
          </li>
          <li>
            <strong>写真当てクイズ</strong>：実際のラーメンの写真からお店・系統・都道府県を当てる形式。
            運営者が撮影した写真に加え、利用者から投稿された写真も掲載しています。
          </li>
          <li>
            <strong>都道府県別ご当地ラーメン {REGIONAL_RAMEN.length} 県</strong>：各県の代表的な系統について、
            スープ・麺・トッピング・発祥・地域の食文化を解説しています（
            <Link to="/regions" className="text-ramen-chili hover:underline">
              一覧はこちら
            </Link>
            ）。
          </li>
          <li>
            <strong>ラーメン用語辞典 {GLOSSARY_TERMS.length} 語</strong>：清湯・白湯・加水率・番手・カエシなど、
            クイズや解説に登場する専門用語をカテゴリ別にまとめています（
            <Link to="/glossary" className="text-ramen-chili hover:underline">
              用語辞典
            </Link>
            ）。
          </li>
          <li>
            <strong>学習モード・ランキング</strong>：間違えた問題の復習、お気に入り登録、スコアの記録と
            ランキング表示ができます。
          </li>
        </ul>
      </Section>

      <Section title="問題と解説の作り方・検証方針">
        <p>
          問題文と解説は、次の方針で作成・点検しています。
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            発祥店や発祥年など一次情報にあたれるものは、自治体・観光協会・当該店舗の公表情報など
            広く周知されている内容を基にしています。
          </li>
          <li>
            発祥に諸説あるものは、特定の説を断定せず「〜とされる」「諸説あり」と明記しています。
            ラーメンの歴史は口伝や店主の証言に依る部分が多く、断定できないことを正直に書くことを
            優先しています。
          </li>
          <li>
            製麺・スープの科学（かん水とグルテンの反応、乳化、うま味の相乗効果など）は、
            食品科学の一般的な知見に沿った説明にとどめ、独自の説は加えていません。
          </li>
          <li>
            ご当地ラーメンの紹介文は、その土地の産業や気候との関わりなど背景も含めて書くよう努めていますが、
            店舗の営業状況や価格は変わるため、訪問前には最新情報をご確認ください。
          </li>
        </ul>
        <p>
          誤りや古くなった記述を見つけた場合は、
          <Link to="/contact" className="text-ramen-chili hover:underline">
            お問い合わせフォーム
          </Link>
          からお知らせください。確認のうえ修正します。
        </p>
      </Section>

      <Section title="更新について">
        <p>
          問題・解説・ご当地ラーメンの情報は継続的に追加・見直しを行っています。新しい問題の追加や、
          既存の解説の補強は不定期に実施しており、収録数はこのページに自動反映されます。
        </p>
      </Section>

      <Section title="広告について">
        <p>
          本サイトは無料で利用できます。運営費用をまかなうため、Google AdSense による広告と、
          一部ページでアフィリエイトリンクを掲載しています。広告の表示に伴う Cookie の利用や
          データの取り扱いについては
          <Link to="/privacy" className="text-ramen-chili hover:underline">
            プライバシーポリシー
          </Link>
          をご覧ください。広告主やアフィリエイト先の意向がクイズの内容や解説に影響することはありません。
        </p>
      </Section>

      <Section title="運営者情報">
        <dl className="space-y-1 text-sm text-ramen-soy/90">
          <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
            <dt className="min-w-[7rem] shrink-0 font-bold text-ramen-chili">運営者</dt>
            <dd>{OPERATOR_NAME}（個人運営）</dd>
          </div>
          <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
            <dt className="min-w-[7rem] shrink-0 font-bold text-ramen-chili">お問い合わせ</dt>
            <dd>
              <Link to="/contact" className="text-ramen-chili hover:underline">
                お問い合わせフォーム
              </Link>
              （バグ報告・内容の誤り・写真の削除依頼など）
            </dd>
          </div>
          <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
            <dt className="min-w-[7rem] shrink-0 font-bold text-ramen-chili">規約・ポリシー</dt>
            <dd>
              <Link to="/terms" className="text-ramen-chili hover:underline">
                利用規約
              </Link>
              ・
              <Link to="/privacy" className="text-ramen-chili hover:underline">
                プライバシーポリシー
              </Link>
              （最終更新 {LEGAL_LAST_UPDATED}）
            </dd>
          </div>
        </dl>
      </Section>

      <Section title="免責事項">
        <p>
          本サイトの情報は正確を期していますが、内容の正確性・完全性を保証するものではありません。
          店舗名・所在地・営業形態は変更されることがあります。本サイトの利用により生じた損害について、
          運営者は責任を負いかねます。掲載している店舗名・商品名は各社の商標または登録商標です。
        </p>
      </Section>

      <div className="flex flex-wrap gap-4 border-t border-ramen-soy/10 pt-4 text-sm">
        <Link to="/faq" className="font-bold text-ramen-chili hover:underline">
          よくある質問 →
        </Link>
        <Link to="/quiz/knowledge" className="font-bold text-ramen-chili hover:underline">
          知識クイズを始める →
        </Link>
        <Link to="/" className="text-ramen-soy/70 hover:underline">
          トップへ戻る
        </Link>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }): JSX.Element {
  return (
    <section className="space-y-2">
      <h2 className="border-b border-ramen-soy/10 pb-1 text-base font-bold text-ramen-soy">{title}</h2>
      <div className="space-y-2 text-sm leading-relaxed text-ramen-soy/85">{children}</div>
    </section>
  );
}
