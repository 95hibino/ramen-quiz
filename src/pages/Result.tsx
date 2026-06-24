import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuizStore } from '@/stores/quizStore';
import { usePhotoQuizStore } from '@/stores/photoQuizStore';
import { useAuthStore } from '@/stores/authStore';
import { useScoreStore } from '@/stores/scoreStore';
import { ResultScreen } from '@/components/quiz/ResultScreen';
import { Seo } from '@/components/common/Seo';
import { StructuredData } from '@/components/common/StructuredData';
import { buildSiteUrl } from '@/config/site';

/**
 * 結果画面 (知識クイズ / 写真当てクイズ 共通)。
 *
 * `quiz_type` で振り分け:
 * - 知識クイズの状態が 'finished' → 知識クイズ結果
 * - 写真クイズの状態が 'finished' → 写真クイズ結果
 * - どちらも違えば TOP にリダイレクト
 */
export function Result(): JSX.Element {
  const navigate = useNavigate();

  // 知識クイズ
  const knowledgeStatus = useQuizStore((s) => s.status);
  const knowledgeQuestions = useQuizStore((s) => s.questions);
  const knowledgeAnswers = useQuizStore((s) => s.answers);
  const knowledgeCategory = useQuizStore((s) => s.category);
  const knowledgeReset = useQuizStore((s) => s.reset);
  const knowledgeStartSession = useQuizStore((s) => s.startSession);

  // 写真クイズ
  const photoStatus = usePhotoQuizStore((s) => s.status);
  const photoQuestions = usePhotoQuizStore((s) => s.questions);
  const photoAnswers = usePhotoQuizStore((s) => s.answers);
  const photoStartSession = usePhotoQuizStore((s) => s.startSession);

  const currentUser = useAuthStore((s) => s.currentUser);
  const recordScore = useScoreStore((s) => s.recordScore);

  // どちらのクイズが完了状態か判定 (両方完了は通常起きないが、写真クイズを優先)
  const activeQuizType: 'knowledge' | 'photo' | null =
    photoStatus === 'finished' && photoQuestions.length > 0
      ? 'photo'
      : knowledgeStatus === 'finished' && knowledgeQuestions.length > 0
        ? 'knowledge'
        : null;

  // 直アクセス or リロード時は TOP へ
  useEffect(() => {
    if (activeQuizType === null) {
      navigate('/', { replace: true });
    }
  }, [activeQuizType, navigate]);

  const questions = activeQuizType === 'photo' ? photoQuestions : knowledgeQuestions;
  const answers = activeQuizType === 'photo' ? photoAnswers : knowledgeAnswers;

  // ログイン中なら結果到達時にスコアを 1 回だけ記録する。
  const recordedRef = useRef<string | null>(null);
  useEffect(() => {
    if (activeQuizType === null || questions.length === 0 || !currentUser) return;
    const sessionKey = `${currentUser.id}:${activeQuizType}:${questions.map((q) => q.id).join(',')}:${answers.length}`;
    if (recordedRef.current === sessionKey) return;
    recordedRef.current = sessionKey;

    const totalScore = answers.reduce((sum, a) => sum + a.pointsEarned, 0);
    const correctCount = answers.filter((a) => a.isCorrect).length;
    if (activeQuizType === 'photo') {
      void recordScore({
        userId: currentUser.id,
        quizType: 'photo',
        score: totalScore,
        correctCount,
        totalCount: questions.length,
      });
    } else if (knowledgeCategory) {
      void recordScore({
        userId: currentUser.id,
        category: knowledgeCategory,
        quizType: 'knowledge',
        score: totalScore,
        correctCount,
        totalCount: questions.length,
      });
    }
  }, [activeQuizType, questions, answers, currentUser, knowledgeCategory, recordScore]);

  if (activeQuizType === null || questions.length === 0) {
    return <p className="card text-center">結果がありません。</p>;
  }

  const handleRetry = async () => {
    if (activeQuizType === 'photo') {
      await photoStartSession();
      navigate('/quiz/photo/play');
      return;
    }
    if (!knowledgeCategory) {
      knowledgeReset();
      navigate('/quiz/knowledge');
      return;
    }
    await knowledgeStartSession(knowledgeCategory);
    navigate(`/quiz/knowledge/${knowledgeCategory}`);
  };

  const totalScore = answers.reduce((sum, a) => sum + a.pointsEarned, 0);
  const seoDescription = `ラーメンクイズで ${totalScore}点 を獲得！あなたもラーメン知識を試してみよう。`;

  // BreadcrumbList: ホーム → クイズ一覧 → 結果。
  // 結果画面はユーザーの個別状態に依存するため検索エンジンには noIndex を伝える。
  const quizListUrl =
    activeQuizType === 'photo'
      ? buildSiteUrl('/quiz/photo')
      : buildSiteUrl('/quiz/knowledge');
  const quizListLabel = activeQuizType === 'photo' ? '写真当てクイズ' : '知識クイズ';
  const breadcrumbSchema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'ホーム',
        item: buildSiteUrl('/'),
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: quizListLabel,
        item: quizListUrl,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: 'クイズ結果',
        item: buildSiteUrl('/result'),
      },
    ],
  };

  return (
    <>
      <Seo title="クイズ結果" description={seoDescription} url="/result" noIndex />
      <StructuredData schema={breadcrumbSchema} />
      <ResultScreen
        quizType={activeQuizType}
        questions={questions}
        answers={answers}
        onRetry={handleRetry}
        isLoggedIn={Boolean(currentUser)}
        category={activeQuizType === 'knowledge' ? knowledgeCategory : null}
        username={currentUser?.username ?? null}
      />
    </>
  );
}
