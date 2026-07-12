import { useEffect, type ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import { useScoreStore } from '@/stores/scoreStore';
import { useAuthStore } from '@/stores/authStore';
import { Seo } from '@/components/common/Seo';
import { ShareButtons } from '@/components/common/ShareButtons';
import { buildSiteUrl } from '@/config/site';
import {
  RANKING_CATEGORIES,
  RANKING_CATEGORY_LABELS,
  type RankingCategory,
} from '@/types/account';

const RANKING_LIMIT = 100;

/**
 * ランキングページ (§14 ベストスコア方式)。
 *
 * 4 種類のランキングカテゴリ (初級/中級/上級/写真当て) をドロップダウンで切り替える。
 * 各ランキングはユーザーごとの「そのカテゴリのベストスコア」で並び、
 * タイブレークは達成日時が早い方が上位。
 *
 * 表示項目: 順位 / ユーザー名 / 都道府県 / 好きなラーメン店 / ベストスコア / 正解 / 達成日
 */
export function Ranking(): JSX.Element {
  const ranking = useScoreStore((s) => s.ranking);
  const rankingCategory = useScoreStore((s) => s.rankingCategory);
  const rankingStatus = useScoreStore((s) => s.rankingStatus);
  const rankingError = useScoreStore((s) => s.rankingError);
  const loadRanking = useScoreStore((s) => s.loadRanking);
  const currentUser = useAuthStore((s) => s.currentUser);

  useEffect(() => {
    void loadRanking(rankingCategory, RANKING_LIMIT);
  }, [loadRanking, rankingCategory]);

  const handleCategoryChange = (e: ChangeEvent<HTMLSelectElement>): void => {
    const value = e.target.value as RankingCategory;
    if (!RANKING_CATEGORIES.includes(value)) return;
    void loadRanking(value, RANKING_LIMIT);
  };

  const shareUrl = buildSiteUrl('/ranking');
  const shareText = `🍜 ラーメンクイズ「${RANKING_CATEGORY_LABELS[rankingCategory]}」ランキングをチェック！\n上位を狙ってラーメン知識で挑戦しよう！`;

  return (
    <div className="space-y-6">
      <Seo
        title={`ランキング (${RANKING_CATEGORY_LABELS[rankingCategory]})`}
        description={`ラーメンクイズ ${RANKING_CATEGORY_LABELS[rankingCategory]} のランキング。全プレイヤーのベストスコアと順位を表示。あなたの順位は？`}
        url="/ranking"
        keywords={[
          'ラーメンクイズ',
          'ランキング',
          RANKING_CATEGORY_LABELS[rankingCategory],
          'クイズスコア',
          'ラーメン愛好家',
        ]}
      />
      <div className="card space-y-4">
        <h1 className="text-2xl font-black text-ramen-soy">ランキング</h1>

        {/* ドロップダウン: 4 種類のランキングカテゴリを切替 */}
        <div className="flex flex-wrap items-center gap-3">
          <label
            htmlFor="ranking-category"
            className="text-sm font-bold text-ramen-soy"
          >
            カテゴリ
          </label>
          <select
            id="ranking-category"
            value={rankingCategory}
            onChange={handleCategoryChange}
            className="input max-w-xs"
          >
            {RANKING_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {RANKING_CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </div>

        <p className="text-sm text-ramen-soy/70">
          各ユーザーの「{RANKING_CATEGORY_LABELS[rankingCategory]}」でのベストスコアで並びます。
          新記録を出した時だけ順位が更新され、同点は達成日時が早い方が上位です。
        </p>
        {!currentUser ? (
          <p className="text-xs text-ramen-soy/70">
            ランキングに参加するには{' '}
            <Link to="/signup" className="font-bold text-ramen-chili hover:underline">
              アカウントを作成
            </Link>
            してください。
          </p>
        ) : null}
        <div className="border-t border-ramen-soy/10 pt-4">
          <p className="mb-3 text-xs font-bold text-ramen-soy/70">
            このランキングをシェアする
          </p>
          <ShareButtons
            text={shareText}
            url={shareUrl}
            hashtags={['ラーメンクイズ', 'ラーメン愛好家']}
            ariaLabel="ランキングのシェア"
          />
        </div>
      </div>

      {rankingStatus === 'loading' ? (
        <p className="card text-center text-ramen-soy/70">読み込み中...</p>
      ) : null}

      {rankingStatus === 'error' ? (
        <p className="card text-center font-bold text-ramen-chili">
          エラー: {rankingError ?? '不明なエラー'}
        </p>
      ) : null}

      {rankingStatus === 'success' && ranking.length === 0 ? (
        <p className="card text-center text-ramen-soy/70">
          このカテゴリではまだベストスコアの記録がありません。<br />
          最初のプレイヤーになって 1 位を狙いましょう!
        </p>
      ) : null}

      {ranking.length > 0 ? (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b-2 border-ramen-soy/20 text-left">
                <th className="px-2 py-3 font-bold text-ramen-soy">順位</th>
                <th className="px-2 py-3 font-bold text-ramen-soy">ユーザー名</th>
                <th className="px-2 py-3 font-bold text-ramen-soy">都道府県</th>
                <th className="px-2 py-3 font-bold text-ramen-soy">好きな店</th>
                <th className="px-2 py-3 text-right font-bold text-ramen-soy">
                  ベスト
                </th>
                <th className="px-2 py-3 text-right font-bold text-ramen-soy">
                  正解
                </th>
                <th className="px-2 py-3 text-right font-bold text-ramen-soy">
                  達成日
                </th>
              </tr>
            </thead>
            <tbody>
              {ranking.map((entry, idx) => {
                const isMe = currentUser?.id === entry.user.id;
                return (
                  <tr
                    key={entry.user.id}
                    className={`border-b border-ramen-soy/10 ${
                      isMe ? 'bg-ramen-broth/20 font-bold' : ''
                    }`}
                  >
                    <td className="px-2 py-2">
                      <RankBadge rank={idx + 1} />
                    </td>
                    <td className="px-2 py-2 text-ramen-soy">
                      {entry.user.username}
                      {isMe ? (
                        <span className="ml-1 text-xs text-ramen-chili">(あなた)</span>
                      ) : null}
                    </td>
                    <td className="px-2 py-2 text-ramen-soy/80">
                      {entry.user.prefecture}
                    </td>
                    <td className="px-2 py-2 text-ramen-soy/80">
                      {entry.user.favoriteShop}
                    </td>
                    <td className="px-2 py-2 text-right text-ramen-chili">
                      {entry.bestScore} pt
                    </td>
                    <td className="px-2 py-2 text-right text-ramen-soy/80">
                      {entry.correctCount} / {entry.totalCount}
                    </td>
                    <td className="px-2 py-2 text-right text-xs text-ramen-soy/70">
                      {formatDate(entry.achievedAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

function RankBadge({ rank }: { rank: number }): JSX.Element {
  if (rank === 1) return <span className="text-lg">🥇</span>;
  if (rank === 2) return <span className="text-lg">🥈</span>;
  if (rank === 3) return <span className="text-lg">🥉</span>;
  return <span className="text-ramen-soy">{rank}</span>;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  } catch {
    return iso;
  }
}
