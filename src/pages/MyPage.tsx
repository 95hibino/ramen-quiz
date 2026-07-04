import { lazy, Suspense, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { useScoreStore } from '@/stores/scoreStore';
import { CATEGORY_META } from '@/config/quizConfig';
import type { QuizCategory } from '@/types/quiz';
import { Seo } from '@/components/common/Seo';
import { FavoritesSection } from '@/components/mypage/FavoritesSection';
import { SubmissionsSection } from '@/components/mypage/SubmissionsSection';
import { DangerZone } from '@/components/mypage/DangerZone';

/**
 * recharts (~100KB) を初期バンドルに含めないよう、グラフだけ React.lazy で分離。
 * MyPage が表示された瞬間にネットワーク越しに取得され、Suspense fallback を表示する。
 */
const ScoreTrendChart = lazy(() =>
  import('@/components/mypage/ScoreTrendChart').then((m) => ({
    default: m.ScoreTrendChart,
  })),
);

const CATEGORY_LABELS = new Map<QuizCategory, string>(
  CATEGORY_META.map((meta) => [meta.category, meta.label]),
);

/**
 * マイページ: ユーザー情報 / スコア推移 / お気に入り / 投稿履歴 / 危険な操作 を集約。
 */
export function MyPage(): JSX.Element {
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.currentUser);
  const myScores = useScoreStore((s) => s.myScores);
  const myScoresStatus = useScoreStore((s) => s.myScoresStatus);
  const myScoresError = useScoreStore((s) => s.myScoresError);
  const loadMyScores = useScoreStore((s) => s.loadMyScores);

  useEffect(() => {
    if (!currentUser) {
      navigate('/login', { replace: true });
      return;
    }
    void loadMyScores(currentUser.id);
  }, [currentUser, loadMyScores, navigate]);

  const summary = useMemo(() => {
    const total = myScores.reduce((sum, s) => sum + s.score, 0);
    const count = myScores.length;
    const best = myScores.reduce((max, s) => Math.max(max, s.score), 0);
    return { total, count, best };
  }, [myScores]);

  if (!currentUser) {
    return <p className="card text-center text-ramen-soy/70">ログインしてください。</p>;
  }

  return (
    <div className="space-y-6">
      <Seo
        title="マイページ"
        description="ラーメンクイズのマイページ。自分の戦績・スコア推移・お気に入り・投稿履歴を確認できます。"
        url="/mypage"
        noIndex
      />

      {/* ユーザー情報カード */}
      <div className="card space-y-2">
        <h1 className="text-2xl font-black text-ramen-soy">マイページ</h1>
        <p className="text-sm text-ramen-soy/80">
          ようこそ、<span className="font-bold">{currentUser.username}</span> さん
        </p>
        <dl className="grid grid-cols-2 gap-2 pt-2 text-sm text-ramen-soy/80 sm:grid-cols-4">
          <Stat label="都道府県" value={currentUser.prefecture} />
          <Stat label="好きな店" value={currentUser.favoriteShop} />
          <Stat label="プレイ回数" value={`${summary.count} 回`} />
          <Stat label="合計スコア" value={`${summary.total} pt`} />
        </dl>
      </div>

      {/* スコア推移グラフ */}
      <div className="card space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-ramen-soy">スコア推移</h2>
          <span className="text-xs text-ramen-soy/60">最近 30 プレイ</span>
        </div>
        {myScoresStatus === 'loading' ? (
          <p className="text-sm text-ramen-soy/70">読み込み中...</p>
        ) : null}
        {myScoresStatus === 'error' ? (
          <p className="text-sm font-bold text-ramen-chili">
            エラー: {myScoresError ?? '不明なエラー'}
          </p>
        ) : null}
        {myScoresStatus === 'success' ? (
          <Suspense fallback={<p className="text-sm text-ramen-soy/70">グラフを読み込み中...</p>}>
            <ScoreTrendChart scores={myScores} limit={30} />
          </Suspense>
        ) : null}
      </div>

      {/* お気に入り問題 */}
      <FavoritesSection />

      {/* 投稿履歴 (Supabase 接続時のみ内容表示) */}
      <SubmissionsSection submitterId={currentUser.username} />

      {/* プレイ履歴 (既存表示を残す) */}
      <div className="card">
        <h2 className="text-lg font-bold text-ramen-soy">プレイ履歴 ({summary.count} 回)</h2>
        {myScoresStatus === 'success' && myScores.length === 0 ? (
          <p className="mt-3 text-sm text-ramen-soy/70">
            まだプレイ履歴がありません。{' '}
            <Link to="/quiz/knowledge" className="font-bold text-ramen-chili hover:underline">
              クイズに挑戦する
            </Link>
          </p>
        ) : null}
        {myScores.length > 0 ? (
          <ul className="mt-3 space-y-2 text-sm">
            {myScores.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ramen-soy/10 bg-white px-3 py-2"
              >
                <div>
                  <p className="font-bold text-ramen-soy">
                    {renderScoreLabel(s.quizType, s.category)}
                    <span className="ml-2 text-xs text-ramen-soy/60">
                      {s.correctCount} / {s.totalCount} 問正解
                    </span>
                  </p>
                  <p className="text-xs text-ramen-soy/60">{formatDateTime(s.playedAt)}</p>
                </div>
                <p className="text-lg font-black text-ramen-chili">{s.score} pt</p>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {/* 危険な操作 */}
      <DangerZone />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="rounded-xl bg-white/70 px-3 py-2">
      <dt className="text-xs text-ramen-soy/60">{label}</dt>
      <dd className="font-bold text-ramen-soy">{value}</dd>
    </div>
  );
}

/**
 * スコアレコード 1 行のラベル文字列を組み立てる。
 * 知識クイズはカテゴリ名 (初級/中級/上級)、写真クイズは「写真当てクイズ」表記にする。
 */
function renderScoreLabel(quizType: string, category: QuizCategory | undefined): string {
  if (quizType === 'photo') return '写真当てクイズ';
  if (category) return CATEGORY_LABELS.get(category) ?? category;
  return quizType;
}

function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}
