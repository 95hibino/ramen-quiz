import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuizStore } from '@/stores/quizStore';
import { QuizCard } from '@/components/quiz/QuizCard';
import { Timer } from '@/components/common/Timer';
import { ScoreBar } from '@/components/quiz/ScoreBar';
import { AdBanner } from '@/components/common/AdBanner';
import { Seo } from '@/components/common/Seo';
import { useTimer } from '@/hooks/useTimer';
import {
  AD_INTERVAL_QUESTIONS,
  CATEGORY_META,
  QUESTION_TIME_LIMIT_SEC,
} from '@/config/quizConfig';
import type { QuizCategory } from '@/types/quiz';

function isValidCategory(value: string | undefined): value is QuizCategory {
  if (value === undefined) return false;
  return CATEGORY_META.some((meta) => meta.category === value);
}

/** 問題プレイ中の画面。 */
export function KnowledgeQuizPlay(): JSX.Element {
  const navigate = useNavigate();
  const { categoryId } = useParams<{ categoryId: string }>();
  const status = useQuizStore((s) => s.status);
  const questions = useQuizStore((s) => s.questions);
  const currentIndex = useQuizStore((s) => s.currentIndex);
  const answers = useQuizStore((s) => s.answers);
  const errorMessage = useQuizStore((s) => s.errorMessage);
  const startSession = useQuizStore((s) => s.startSession);
  const submitAnswer = useQuizStore((s) => s.submitAnswer);
  const goToNextQuestion = useQuizStore((s) => s.goToNextQuestion);

  const currentQuestion = questions[currentIndex];
  const isAnsweredForCurrent = answers.length > currentIndex;
  const currentAnswer = isAnsweredForCurrent ? answers[currentIndex] : null;

  // URL が直接叩かれた等で問題未ロードならカテゴリページに戻す
  useEffect(() => {
    if (!isValidCategory(categoryId)) {
      navigate('/quiz/knowledge', { replace: true });
      return;
    }
    if (status === 'idle') {
      void startSession(categoryId);
    }
  }, [categoryId, navigate, startSession, status]);

  // 終了したら結果画面へ
  useEffect(() => {
    if (status === 'finished') {
      navigate('/result', { replace: true });
    }
  }, [status, navigate]);

  // タイマー用 state: 回答時の残り秒数を保持
  const [lastRemainingSec, setLastRemainingSec] = useState(QUESTION_TIME_LIMIT_SEC);

  const handleExpire = useCallback(() => {
    setLastRemainingSec(0);
    submitAnswer(null, 0);
  }, [submitAnswer]);

  const { remainingSec, reset } = useTimer({
    initialSec: QUESTION_TIME_LIMIT_SEC,
    isRunning: status === 'playing' && !isAnsweredForCurrent,
    onExpire: handleExpire,
  });

  const handleSelect = useCallback(
    (idx: number) => {
      if (isAnsweredForCurrent) return;
      setLastRemainingSec(remainingSec);
      submitAnswer(idx, remainingSec);
    },
    [isAnsweredForCurrent, remainingSec, submitAnswer],
  );

  const handleNext = useCallback(() => {
    goToNextQuestion();
    reset();
    setLastRemainingSec(QUESTION_TIME_LIMIT_SEC);
  }, [goToNextQuestion, reset]);

  const currentScore = useMemo(() => answers.reduce((sum, a) => sum + a.pointsEarned, 0), [answers]);

  // インフィード広告を表示するか (design §3.3: 5問ごと)
  // 回答済みかつ次があるときに表示
  const isLastQuestion = currentIndex === questions.length - 1;
  const showInterstitialAd =
    isAnsweredForCurrent &&
    !isLastQuestion &&
    (currentIndex + 1) % AD_INTERVAL_QUESTIONS === 0;

  if (status === 'loading' || status === 'idle') {
    return <p className="card text-center">問題を読み込み中...</p>;
  }
  if (status === 'error') {
    return (
      <div className="card text-center text-ramen-chili">
        <p className="font-bold">エラー: {errorMessage ?? '不明なエラー'}</p>
        <button type="button" className="btn-secondary mt-4" onClick={() => navigate('/quiz/knowledge')}>
          カテゴリ選択に戻る
        </button>
      </div>
    );
  }
  if (!currentQuestion) {
    return <p className="card text-center">問題がありません。</p>;
  }

  return (
    <div className="space-y-5">
      <Seo
        title="知識クイズ プレイ中"
        description="ラーメン知識クイズに挑戦中。残り時間内に 4 択から正解を選ぼう。"
        url={`/quiz/knowledge/${categoryId ?? ''}`}
        noIndex
      />
      <ScoreBar
        currentIndex={currentIndex}
        totalQuestions={questions.length}
        currentScore={currentScore}
      />
      <Timer remainingSec={remainingSec} totalSec={QUESTION_TIME_LIMIT_SEC} />

      <QuizCard
        question={currentQuestion}
        selectedIdx={currentAnswer ? currentAnswer.selectedIdx : null}
        isAnswered={isAnsweredForCurrent}
        onSelect={handleSelect}
      />

      {isAnsweredForCurrent ? (
        <div className="text-center">
          {currentAnswer?.selectedIdx === null ? (
            <p className="mb-3 text-sm font-bold text-ramen-chili">時間切れでした。</p>
          ) : (
            <p className="mb-3 text-sm font-bold text-ramen-soy">
              {currentAnswer?.isCorrect ? '正解！' : '残念、不正解...'}{' '}
              <span className="text-ramen-chili">+{currentAnswer?.pointsEarned ?? 0} pt</span>
              {' '}
              <span className="text-ramen-soy/60">(残り {lastRemainingSec} 秒で回答)</span>
            </p>
          )}
          <button type="button" className="btn-primary" onClick={handleNext}>
            {isLastQuestion ? '結果を見る' : '次の問題へ'}
          </button>
        </div>
      ) : null}

      {showInterstitialAd ? <AdBanner slot="in-feed" size="responsive" /> : null}
    </div>
  );
}
