/**
 * 学習モード復習クイズ (写真クイズ版) `/learn/photo`。
 *
 * `PhotoQuizPlay` とほぼ同じ UI・タイマー挙動を維持しつつ、
 * 5 軸フィルタではなく「間違えた写真クイズ」から出題する。
 *
 * `photoQuizStore.startReviewSession(ids)` が Supabase 由来の写真も含めて
 * 非同期に問題を取得するため、`status === 'loading'` の待機表示が
 * (knowledge の Learn より) 発生し得る点に注意。
 *
 * 直アクセス (status === 'idle') は `/learn` に戻す。
 */
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

export function LearnPhotoQuizPlay(): JSX.Element {
  const navigate = useNavigate();
  const status = usePhotoQuizStore((s) => s.status);
  const mode = usePhotoQuizStore((s) => s.mode);
  const questions = usePhotoQuizStore((s) => s.questions);
  const currentIndex = usePhotoQuizStore((s) => s.currentIndex);
  const answers = usePhotoQuizStore((s) => s.answers);
  const errorMessage = usePhotoQuizStore((s) => s.errorMessage);
  const submitAnswer = usePhotoQuizStore((s) => s.submitAnswer);
  const goToNextQuestion = usePhotoQuizStore((s) => s.goToNextQuestion);

  const currentQuestion = questions[currentIndex];
  const isAnsweredForCurrent = answers.length > currentIndex;
  const currentAnswer = isAnsweredForCurrent ? answers[currentIndex] : null;

  // 未初期化 or review 以外のモードで直アクセスされたら Learn 画面に戻す。
  useEffect(() => {
    if (status === 'idle' || (mode !== 'review' && status !== 'error' && status !== 'loading')) {
      navigate('/learn', { replace: true });
    }
  }, [status, mode, navigate]);

  // 終了したら結果画面へ (通常セッションと共有)。Result 側で mode='review' を見て挙動分岐。
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
    return <p className="card text-center">復習問題を読み込み中...</p>;
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
        title="写真復習クイズ プレイ中"
        description="間違えた写真クイズを再挑戦。写真から店舗を当てる目を鍛えよう。"
        url="/learn/photo"
        noIndex
      />

      <div className="rounded-xl border border-ramen-nori/40 bg-ramen-nori/5 px-4 py-2 text-xs font-bold text-ramen-nori">
        📸 写真復習モード ({questions.length} 問) — 正解した問題は間違えた一覧から自動で外れます。
      </div>

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
