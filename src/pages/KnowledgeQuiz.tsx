import { Link, useNavigate } from 'react-router-dom';
import { CATEGORY_META } from '@/config/quizConfig';
import type { QuizCategory } from '@/types/quiz';
import { useQuizStore } from '@/stores/quizStore';
import { AdBanner } from '@/components/common/AdBanner';
import { Seo } from '@/components/common/Seo';
import { StructuredData } from '@/components/common/StructuredData';
import { buildSiteUrl } from '@/config/site';
import rawQuestions from '@/data/questions.json';

/** カテゴリ選択画面。 */
export function KnowledgeQuiz(): JSX.Element {
  const navigate = useNavigate();
  const startSession = useQuizStore((s) => s.startSession);

  const handleStart = async (category: QuizCategory) => {
    await startSession(category);
    navigate(`/quiz/knowledge/${category}`);
  };

  const countByCategory = (category: QuizCategory): number =>
    rawQuestions.filter((q) => q.category === category).length;

  // Schema.org: Quiz + ItemList (3 カテゴリ)。
  // 検索結果上で「クイズ」としての構造が伝わるようにし、AI 検索の引用候補にも入りやすくする。
  const structuredData: Record<string, unknown>[] = [
    {
      '@context': 'https://schema.org',
      '@type': 'Quiz',
      name: 'ラーメン知識クイズ',
      description:
        'ラーメンの基礎・地域・上級知識を問う全 300 問の 4 択クイズ。基礎・地域が各 70 問、上級が 160 問。1 セッション 10 問・制限時間 20 秒/問。',
      url: buildSiteUrl('/quiz/knowledge'),
      inLanguage: 'ja',
      learningResourceType: 'Quiz',
      educationalLevel: 'beginner to advanced',
      about: { '@type': 'Thing', name: 'ラーメン' },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: 'ラーメン知識クイズ カテゴリ一覧',
      itemListElement: CATEGORY_META.map((meta, idx) => ({
        '@type': 'ListItem',
        position: idx + 1,
        name: `${meta.label} (${meta.category})`,
        description: meta.description,
        url: buildSiteUrl(`/quiz/knowledge/${meta.category}`),
      })),
    },
  ];

  return (
    <div className="space-y-6">
      <Seo
        title="知識クイズ"
        description="ラーメン知識クイズ全 300 問。基礎・地域・上級の 3 カテゴリから選んで挑戦。各問題に解説付きでラーメンの歴史・文化・製麺技術が学べる。"
        url="/quiz/knowledge"
        keywords={['ラーメンクイズ', '4択クイズ', 'ラーメン知識', 'ご当地ラーメン', 'ラーメン雑学']}
      />
      <StructuredData schema={structuredData} />
      <AdBanner slot="knowledge-top" size="leaderboard" />

      <div className="card">
        <h1 className="text-2xl font-black text-ramen-soy">難易度を選んでください</h1>
        <p className="mt-2 text-sm text-ramen-soy/70">
          各セッション 10 問・制限時間 20 秒 / 問。正解 1 問 = 10 点 + 残り時間ボーナス最大 5 点です。
        </p>
      </div>

      <div className="card space-y-3">
        <h2 className="text-lg font-black text-ramen-soy">3つの難易度について</h2>
        <p className="text-sm leading-relaxed text-ramen-soy/80">
          <strong>初級</strong>（{countByCategory('basic')} 問）はスープ・麺・タレ・トッピングといった
          ラーメンの基本構造を問う入門編です。<strong>中級</strong>（{countByCategory('regional')} 問）は
          札幌味噌・喜多方・博多豚骨などのご当地ラーメンや、老舗の歴史を扱います。
          <strong>上級</strong>（{countByCategory('expert')} 問）は、かん水と麺のグルテン形成、清湯と
          白湯の違い、乳化、家系や二郎系の系譜といった、製麺技術・スープの科学・専門店の知識まで踏み込みます。
          初めての方は初級から、ラーメン店巡りが趣味の方は中級・上級から挑戦するのがおすすめです。
        </p>
        <p className="text-sm leading-relaxed text-ramen-soy/80">
          出題形式はすべて 4 択で、正誤に関わらず解説が表示されます。間違えた問題は自動で保存され、
          <Link to="/learn" className="text-ramen-chili hover:underline">
            学習モード
          </Link>
          でいつでも復習できます。問題の背景をじっくり読みたい場合は、テーマ別にまとめた
          <Link to="/articles" className="text-ramen-chili hover:underline">
            読みもの
          </Link>
          や
          <Link to="/glossary" className="text-ramen-chili hover:underline">
            用語辞典
          </Link>
          もあわせてご覧ください。
        </p>
      </div>

      <ul className="grid gap-4 sm:grid-cols-3">
        {CATEGORY_META.map((meta) => (
          <li key={meta.category}>
            <button
              type="button"
              onClick={() => handleStart(meta.category)}
              className="card flex h-full w-full flex-col items-start gap-2 text-left transition hover:-translate-y-0.5 hover:shadow-2xl"
            >
              <span className="text-3xl" aria-hidden="true">
                {meta.emoji}
              </span>
              <h2 className="text-xl font-black text-ramen-chili">{meta.label}</h2>
              <p className="text-sm text-ramen-soy/80">{meta.description}</p>
              <span className="mt-auto inline-flex items-center text-sm font-bold text-ramen-soy">
                このカテゴリで開始 →
              </span>
            </button>
          </li>
        ))}
      </ul>

      <div className="text-center">
        <Link to="/" className="text-sm text-ramen-soy/70 hover:underline">
          ← トップに戻る
        </Link>
      </div>
    </div>
  );
}
