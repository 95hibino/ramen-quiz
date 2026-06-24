import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePhotoQuizStore } from '@/stores/photoQuizStore';
import { PhotoQuizCard } from '@/components/quiz/PhotoQuizCard';
import { Timer } from '@/components/common/Timer';
import { ScoreBar } from '@/components/quiz/ScoreBar';
import { AdBanner } from '@/components/common/AdBanner';
import { Seo } from '@/components/common/Seo';
import { useTimer } from '@/hooks/useTimer';
import {
  AD_INTERVAL_QUESTIONS,
  PHOTO_QUESTION_TIME_LIMIT_SEC,
} from '@/config/quizConfig';

/**
 * 写真当てクイズプレイ画面。
 *
 * - セッションが未開始なら開始画面 `/quiz/photo` にリダイレクト
 * - 終了したら結果画面 `/result` へ遷移
 * - 制限時間: 30秒 / 問
 */
export function PhotoQuizPlay(): JSX.Element {
  const navigate = useNavigate();
  const status = usePhotoQuizStore((s) => s.status);
  const questions = usePhotoQuizStore((s) => s.questions);
  const currentIndex = usePhotoQuizStore((s) => s.currentIndex);
  const answers = usePhotoQuizStore((s) => s.answers);
  const errorMessage = usePhotoQuizStore((s) => s.errorMessage);
  const submitAnswer = usePhotoQuizStore((s) => s.submitAnswer);
  const goToNextQuestion = usePhotoQuizStore((s) => s.goToNextQuestion);

  const currentQuestion = questions[currentIndex];
  const isAnsweredForCurrent = answers.length > currentIndex;
  const currentAnswer = isAnsweredForCurrent ? answers[currentIndex] : null;

  // セッション未開始 (直アクセス / リロード) なら開始画面へ
  useEffect(() => {
    if (status === 'idle') {
      navigate('/quiz/photo', { replace: true });
    }
  }, [status, navigate]);

  // 終了したら結果画面へ
  useEffect(() => {
    if (status === 'finished') {
      navigate('/result', { replace: true });
    }
  }, [status, navigate]);

  const [lastRemainingSec, setLastRemainingSec] = useState(PHOTO_QUESTION_TIME_LIMIT_SEC);

  const handleExpire = useCallback(() => {
    setLastRemainingSec(0);
    submitAnswer(null, 0);
  }, [submitAnswer]);

  const { remainingSec, reset } = useTimer({
    initialSec: PHOTO_QUESTION_TIME_LIMIT_SEC,
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
    setLastRemainingSec(PHOTO_QUESTION_TIME_LIMIT_SEC);
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
        <p className="font-bold">エラー: {errorMessage ?? '不明なエラー'}</p>
        <button
          type="button"
          className="btn-secondary mt-4"
          onClick={() => navigate('/quiz/photo')}
        >
          条件選択に戻る
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
        title="写真当てクイズ プレイ中"
        description="ラーメン写真当てクイズに挑戦中"
        url="/quiz/photo/play"
        noIndex
      />
      <ScoreBar
        currentIndex={currentIndex}
        totalQuestions={questions.length}
        currentScore={currentScore}
      />
      <Timer remainingSec={remainingSec} totalSec={PHOTO_QUESTION_TIME_LIMIT_SEC} />

      <PhotoQuizCard
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
              <span className="text-ramen-chili">+{currentAnswer?.pointsEarned ?? 0} pt</span>{' '}
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
