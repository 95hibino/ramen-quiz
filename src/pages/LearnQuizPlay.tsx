/**
 * 学習モード復習クイズプレイ画面 (`/learn/quiz`)。
 *
 * `KnowledgeQuizPlay` とほぼ同じ UI・タイマー挙動を維持しつつ、
 * カテゴリではなく「間違えた問題」から出題する。
 *
 * 遷移経路:
 * 1. `/learn` の「復習クイズで挑戦」ボタン → `quizStore.startReviewSession(ids)` → このページ
 * 2. 10 問終了 → `/result` (通常の結果画面を再利用、mode='review' で挙動を分岐)
 *
 * 直アクセス時の挙動:
 * - `status === 'idle'` (未初期化) なら `/learn` に戻す。
 *   カテゴリ選択と違い、間違えた問題は動的に決まるため URL では復元できない。
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuizStore } from '@/stores/quizStore';
import { QuizCard } from '@/components/quiz/QuizCard';
import { Timer } from '@/components/common/Timer';
import { ScoreBar } from '@/components/quiz/ScoreBar';
import { AdBanner } from '@/components/common/AdBanner';
import { Seo } from '@/components/common/Seo';
import { useTimer } from '@/hooks/useTimer';
import {
  AD_INTERVAL_QUESTIONS,
  QUESTION_TIME_LIMIT_SEC,
} from '@/config/quizConfig';

export function LearnQuizPlay(): JSX.Element {
  const navigate = useNavigate();
  const status = useQuizStore((s) => s.status);
  const mode = useQuizStore((s) => s.mode);
  const questions = useQuizStore((s) => s.questions);
  const currentIndex = useQuizStore((s) => s.currentIndex);
  const answers = useQuizStore((s) => s.answers);
  const errorMessage = useQuizStore((s) => s.errorMessage);
  const submitAnswer = useQuizStore((s) => s.submitAnswer);
  const goToNextQuestion = useQuizStore((s) => s.goToNextQuestion);

  const currentQuestion = questions[currentIndex];
  const isAnsweredForCurrent = answers.length > currentIndex;
  const currentAnswer = isAnsweredForCurrent ? answers[currentIndex] : null;

  // 未初期化 or review 以外のモードで直アクセスされたら Learn 画面に戻す。
  useEffect(() => {
    if (status === 'idle' || (mode !== 'review' && status !== 'error')) {
      navigate('/learn', { replace: true });
    }
  }, [status, mode, navigate]);

  // 終了したら結果画面へ (通常セッションと共有)。Result 側で mode を見て挙動分岐。
  useEffect(() => {
    if (status === 'finished') {
      navigate('/result', { replace: true });
    }
  }, [status, navigate]);

  // タイマー: 回答時の残り秒数を保持 (通常プレイと同じ挙動)
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

  const currentScore = useMemo(
    () => answers.reduce((sum, a) => sum + a.pointsEarned, 0),
    [answers],
  );

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
        <p className="font-bold">{errorMessage ?? '不明なエラー'}</p>
        <button
          type="button"
          className="btn-secondary mt-4"
          onClick={() => navigate('/learn')}
        >
          学習モードに戻る
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
        title="復習クイズ プレイ中"
        description="間違えた問題を再挑戦。学習モードで確実に知識を定着させよう。"
        url="/learn/quiz"
        noIndex
      />

      <div className="rounded-xl border border-ramen-nori/40 bg-ramen-nori/5 px-4 py-2 text-xs font-bold text-ramen-nori">
        📚 復習モード ({questions.length} 問) — 正解した問題は間違えた一覧から自動で外れます。
      </div>

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
