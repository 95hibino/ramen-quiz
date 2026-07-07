import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuizStore } from '@/stores/quizStore';
import { usePhotoQuizStore } from '@/stores/photoQuizStore';
import { useAuthStore } from '@/stores/authStore';
import { useScoreStore } from '@/stores/scoreStore';
import { useWrongAnswersStore } from '@/stores/wrongAnswersStore';
import { ResultScreen } from '@/components/quiz/ResultScreen';
import { Seo } from '@/components/common/Seo';
import { StructuredData } from '@/components/common/StructuredData';
import { buildSiteUrl } from '@/config/site';
import { CATEGORY_META } from '@/config/quizConfig';
import { maxPossibleScore } from '@/lib/score';
import { buildOgImageUrl } from '@/lib/shareUrls';

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

  // 知識クイズ (通常 + 復習セッション共通)
  const knowledgeStatus = useQuizStore((s) => s.status);
  const knowledgeQuestions = useQuizStore((s) => s.questions);
  const knowledgeAnswers = useQuizStore((s) => s.answers);
  const knowledgeCategory = useQuizStore((s) => s.category);
  const knowledgeMode = useQuizStore((s) => s.mode);
  const knowledgeReset = useQuizStore((s) => s.reset);
  const knowledgeStartSession = useQuizStore((s) => s.startSession);
  const startReviewSession = useQuizStore((s) => s.startReviewSession);

  // 写真クイズ
  const photoStatus = usePhotoQuizStore((s) => s.status);
  const photoQuestions = usePhotoQuizStore((s) => s.questions);
  const photoAnswers = usePhotoQuizStore((s) => s.answers);
  const photoStartSession = usePhotoQuizStore((s) => s.startSession);

  const currentUser = useAuthStore((s) => s.currentUser);
  const recordScore = useScoreStore((s) => s.recordScore);
  const recordWrongAnswer = useWrongAnswersStore((s) => s.record);
  const removeWrongAnswer = useWrongAnswersStore((s) => s.remove);
  // 復習セッション後に残っている「知識クイズで間違えた問題」の数。
  // ResultScreen で「残り N 問を復習」ボタンのラベルに使う。
  const remainingKnowledgeWrongCount = useWrongAnswersStore(
    (s) => s.wrongAnswers.filter((w) => w.quizType === 'knowledge').length,
  );

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

  // 復習セッションの完了かどうか。Retry / ナビ先の切替に使う。
  // 写真クイズには復習モードが無いので必ず false になる。
  const isReviewSession = activeQuizType === 'knowledge' && knowledgeMode === 'review';

  // ログイン中なら結果到達時にスコアを 1 回だけ記録する。
  // また、間違えた問題は学習モード用に (未ログインでも) localStorage に記録する。
  const recordedRef = useRef<string | null>(null);
  useEffect(() => {
    if (activeQuizType === null || questions.length === 0) return;
    // ログイン有無に関係なくセッションキーで重複記録を防ぐ (未ログイン時は 'guest')。
    const uid = currentUser?.id ?? 'guest';
    const sessionKey = `${uid}:${activeQuizType}:${questions.map((q) => q.id).join(',')}:${answers.length}`;
    if (recordedRef.current === sessionKey) return;
    recordedRef.current = sessionKey;

    // 学習モード用の間違えた問題ストアを更新 (ログイン不要)。
    // - 不正解: 記録 (wrongCount +1)
    // - 正解 (復習セッション時): remove して覚えた扱いに
    // - 正解 (通常セッション時): remove もしないし record もしない (何もしない)
    //   → 過去に間違えた問題を「たまたま今回は正解」でも「復習」動作にはしない
    for (const a of answers) {
      if (!a.isCorrect) {
        recordWrongAnswer(activeQuizType, a.questionId);
      } else if (isReviewSession) {
        removeWrongAnswer(activeQuizType, a.questionId);
      }
    }

    // スコアはログイン中のみ記録する (匿名ランキングを避けるため)。
    // また、復習セッションは同じ問題を何度も繰り返すためランキング反映しない
    // (「復習で稼ぐ」不公平を回避する)。
    if (!currentUser) return;
    if (isReviewSession) return;

    const totalScore = answers.reduce((sum, a) => sum + a.pointsEarned, 0);
    const correctCount = answers.filter((a) => a.isCorrect).length;
    // Supabase 未接続時はローカルにのみ保存 (throw なし)。
    // Supabase 接続中は世界ランキング反映が失敗しても、ローカルには保存済みなので
    // マイページ表示は担保される。ここでは warn だけで UX を止めない。
    const scoreInput =
      activeQuizType === 'photo'
        ? {
            userId: currentUser.id,
            quizType: 'photo',
            score: totalScore,
            correctCount,
            totalCount: questions.length,
          }
        : knowledgeCategory
          ? {
              userId: currentUser.id,
              category: knowledgeCategory,
              quizType: 'knowledge',
              score: totalScore,
              correctCount,
              totalCount: questions.length,
            }
          : null;
    if (scoreInput) {
      recordScore(scoreInput).catch((err) => {
        console.warn('[Result] 世界ランキングへのスコア反映に失敗:', err);
      });
    }
  }, [
    activeQuizType,
    questions,
    answers,
    currentUser,
    knowledgeCategory,
    isReviewSession,
    recordScore,
    recordWrongAnswer,
    removeWrongAnswer,
  ]);

  if (activeQuizType === null || questions.length === 0) {
    return <p className="card text-center">結果がありません。</p>;
  }

  const handleRetry = async () => {
    if (activeQuizType === 'photo') {
      await photoStartSession();
      navigate('/quiz/photo/play');
      return;
    }
    // 復習セッションの再挑戦: 覚えていなかった問題だけをもう一度出題する。
    // 全問正解して間違えた問題が 0 になったら Learn 画面に戻して達成感を演出。
    if (isReviewSession) {
      const remainingWrongIds = useWrongAnswersStore
        .getState()
        .wrongAnswers.filter((w) => w.quizType === 'knowledge')
        .map((w) => w.questionId);
      if (remainingWrongIds.length === 0) {
        navigate('/learn', { replace: true });
        return;
      }
      startReviewSession(remainingWrongIds);
      navigate('/learn/quiz');
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

  // 動的 OG 画像 (SNS シェア用) の URL を組み立てる。
  // - 結果画面自体は noIndex だが、og:image は SNS クローラー (X / Facebook / LINE) が
  //   シェアカード生成のために取得する。
  // - カテゴリラベルは知識クイズなら CATEGORY_META から、写真クイズなら固定文言。
  const ogCategoryLabel =
    activeQuizType === 'photo'
      ? '写真当てクイズ'
      : (knowledgeCategory
          ? CATEGORY_META.find((m) => m.category === knowledgeCategory)?.label
          : undefined) ?? 'ラーメンクイズ';
  const ogImage = buildOgImageUrl({
    score: totalScore,
    max: maxPossibleScore(questions.length),
    category: ogCategoryLabel,
    username: currentUser?.username ?? undefined,
    quizType: activeQuizType,
  });

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
      <Seo
        title="クイズ結果"
        description={seoDescription}
        url="/result"
        ogImage={ogImage}
        noIndex
      />
      <StructuredData schema={breadcrumbSchema} />
      <ResultScreen
        quizType={activeQuizType}
        questions={questions}
        answers={answers}
        onRetry={handleRetry}
        isLoggedIn={Boolean(currentUser)}
        category={activeQuizType === 'knowledge' ? knowledgeCategory : null}
        username={currentUser?.username ?? null}
        isReview={isReviewSession}
        remainingWrongCount={remainingKnowledgeWrongCount}
      />
    </>
  );
}
