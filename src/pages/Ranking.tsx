import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useScoreStore } from '@/stores/scoreStore';
import { useAuthStore } from '@/stores/authStore';
import { Seo } from '@/components/common/Seo';
import { ShareButtons } from '@/components/common/ShareButtons';
import { buildSiteUrl } from '@/config/site';

const RANKING_LIMIT = 100;

/**
 * ランキングページ。
 * 表示項目: 順位 / ユーザー名 / 都道府県 / 好きなラーメン店 / 合計スコア / プレイ回数。
 */
export function Ranking(): JSX.Element {
  const ranking = useScoreStore((s) => s.ranking);
  const rankingStatus = useScoreStore((s) => s.rankingStatus);
  const rankingError = useScoreStore((s) => s.rankingError);
  const loadRanking = useScoreStore((s) => s.loadRanking);
  const currentUser = useAuthStore((s) => s.currentUser);

  useEffect(() => {
    void loadRanking(RANKING_LIMIT);
  }, [loadRanking]);

  const shareUrl = buildSiteUrl('/ranking');
  const shareText =
    '🍜 ラーメンクイズランキングをチェック！\n上位を狙ってラーメン知識で挑戦しよう！';

  return (
    <div className="space-y-6">
      <Seo
        title="ランキング"
        description="ラーメンクイズのランキング。全プレイヤーの累計スコアと順位を表示。あなたの順位は？上位を目指して挑戦しよう。"
        url="/ranking"
        keywords={['ラーメンクイズ', 'ランキング', 'クイズスコア', 'ラーメン愛好家']}
      />
      <div className="card">
        <h1 className="text-2xl font-black text-ramen-soy">ランキング (上位 {RANKING_LIMIT} 名)</h1>
        <p className="mt-2 text-sm text-ramen-soy/70">
          全プレイヤーの累計スコアで順位を表示します。同点の場合はプレイ回数の少ない方が上位です。
        </p>
        {!currentUser ? (
          <p className="mt-3 text-xs text-ramen-soy/70">
            ランキングに参加するには{' '}
            <Link to="/signup" className="font-bold text-ramen-chili hover:underline">
              アカウントを作成
            </Link>
            してください。
          </p>
        ) : null}
        <div className="mt-4 border-t border-ramen-soy/10 pt-4">
          <p className="mb-3 text-xs font-bold text-ramen-soy/70">サイトをシェアする</p>
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
          まだスコアの記録がありません。クイズを 1 回プレイしてランキング 1 位を狙いましょう!
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
                <th className="px-2 py-3 text-right font-bold text-ramen-soy">合計スコア</th>
                <th className="px-2 py-3 text-right font-bold text-ramen-soy">プレイ回数</th>
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
                      {isMe ? <span className="ml-1 text-xs text-ramen-chili">(あなた)</span> : null}
                    </td>
                    <td className="px-2 py-2 text-ramen-soy/80">{entry.user.prefecture}</td>
                    <td className="px-2 py-2 text-ramen-soy/80">{entry.user.favoriteShop}</td>
                    <td className="px-2 py-2 text-right text-ramen-chili">{entry.totalScore} pt</td>
                    <td className="px-2 py-2 text-right text-ramen-soy/80">{entry.playCount}</td>
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
