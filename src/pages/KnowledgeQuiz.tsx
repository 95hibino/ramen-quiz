import { Link, useNavigate } from 'react-router-dom';
import { CATEGORY_META } from '@/config/quizConfig';
import type { QuizCategory } from '@/types/quiz';
import { useQuizStore } from '@/stores/quizStore';
import { AdBanner } from '@/components/common/AdBanner';

/** カテゴリ選択画面。 */
export function KnowledgeQuiz(): JSX.Element {
  const navigate = useNavigate();
  const startSession = useQuizStore((s) => s.startSession);

  const handleStart = async (category: QuizCategory) => {
    await startSession(category);
    navigate(`/quiz/knowledge/${category}`);
  };

  return (
    <div className="space-y-6">
      <AdBanner slot="knowledge-top" size="leaderboard" />

      <div className="card">
        <h1 className="text-2xl font-black text-ramen-soy">難易度を選んでください</h1>
        <p className="mt-2 text-sm text-ramen-soy/70">
          各セッション 10 問・制限時間 20 秒 / 問。正解 1 問 = 10 点 + 残り時間ボーナス最大 5 点です。
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
