import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import { useScoreStore } from '@/stores/scoreStore';
import { useAuthStore } from '@/stores/authStore';
import { Seo } from '@/components/common/Seo';
import { ShareButtons } from '@/components/common/ShareButtons';
import { buildSiteUrl } from '@/config/site';
import {
  RANKING_CATEGORIES,
  RANKING_CATEGORY_LABELS,
  type MyRankingEntry,
  type RankingCategory,
  type RankingEntry,
} from '@/types/account';

const RANKING_LIMIT = 100;
const PAGE_SIZE = 20;

/**
 * ランキングページ (§14/§16 ベストスコア方式)。
 *
 * - 4 種類のランキングカテゴリをドロップダウンで切替
 * - 上位 100 位を 20 件ずつページング
 * - ログイン中ユーザーが 100 位以下の場合は末尾に自分の順位を表示 (§16 get_my_ranking RPC)
 */
export function Ranking(): JSX.Element {
  const ranking = useScoreStore((s) => s.ranking);
  const rankingCategory = useScoreStore((s) => s.rankingCategory);
  const rankingStatus = useScoreStore((s) => s.rankingStatus);
  const rankingError = useScoreStore((s) => s.rankingError);
  const loadRanking = useScoreStore((s) => s.loadRanking);
  const myRanking = useScoreStore((s) => s.myRanking);
  const loadMyRanking = useScoreStore((s) => s.loadMyRanking);
  const currentUser = useAuthStore((s) => s.currentUser);

  // カテゴリ切替時に page も 1 にリセット。
  const [page, setPage] = useState(1);

  useEffect(() => {
    void loadRanking(rankingCategory, RANKING_LIMIT);
    if (currentUser) {
      void loadMyRanking(rankingCategory);
    }
    setPage(1);
  }, [loadRanking, loadMyRanking, rankingCategory, currentUser]);

  const handleCategoryChange = (e: ChangeEvent<HTMLSelectElement>): void => {
    const value = e.target.value as RankingCategory;
    if (!RANKING_CATEGORIES.includes(value)) return;
    void loadRanking(value, RANKING_LIMIT);
    if (currentUser) {
      void loadMyRanking(value);
    }
    setPage(1);
  };

  // ページ計算
  const totalPages = Math.max(1, Math.ceil(ranking.length / PAGE_SIZE));
  const clampedPage = Math.min(Math.max(1, page), totalPages);
  const startIdx = (clampedPage - 1) * PAGE_SIZE;
  const endIdx = startIdx + PAGE_SIZE;
  const visibleRanking = useMemo(
    () => ranking.slice(startIdx, endIdx),
    [ranking, startIdx, endIdx],
  );

  // 100 位以下 (top100 に含まれない) 場合のみ、末尾で自分の順位を表示。
  // top100 に含まれるかは currentUser.id とランキング user_id の一致で判定。
  const isMeInTop100 =
    !!currentUser &&
    ranking.some((e) => e.user.id === currentUser.id);
  const showMyRankingBelow =
    !!currentUser && !isMeInTop100 && myRanking !== null;

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
          上位 100 位を 1 ページ {PAGE_SIZE} 件ずつ表示。
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
        <div className="card space-y-3">
          <div className="overflow-x-auto">
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
                {visibleRanking.map((entry, idx) => {
                  const absoluteRank = startIdx + idx + 1;
                  const isMe = currentUser?.id === entry.user.id;
                  return (
                    <RankingRow
                      key={entry.user.id}
                      entry={entry}
                      rank={absoluteRank}
                      isMe={isMe}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ページング (総ページ数 > 1 のときだけ) */}
          {totalPages > 1 ? (
            <Pagination
              currentPage={clampedPage}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          ) : null}
        </div>
      ) : null}

      {/* 100 位以下だった場合、末尾に自分の順位カード */}
      {showMyRankingBelow && myRanking ? (
        <div className="card border-2 border-ramen-chili/40 bg-ramen-chili/5">
          <p className="mb-3 text-sm font-bold text-ramen-soy">
            あなたの順位
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <tbody>
                <MyRankingRow entry={myRanking} />
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-ramen-soy/70">
            上位 100 位に入るとメインのランキング表に表示されます。もう一度挑戦してベストスコア更新を狙いましょう!
          </p>
        </div>
      ) : null}
    </div>
  );
}

interface RankingRowProps {
  entry: RankingEntry;
  rank: number;
  isMe: boolean;
}

function RankingRow({ entry, rank, isMe }: RankingRowProps): JSX.Element {
  return (
    <tr
      className={`border-b border-ramen-soy/10 ${
        isMe ? 'bg-ramen-broth/20 font-bold' : ''
      }`}
    >
      <td className="px-2 py-2">
        <RankBadge rank={rank} />
      </td>
      <td className="px-2 py-2 text-ramen-soy">
        {entry.user.username}
        {isMe ? (
          <span className="ml-1 text-xs text-ramen-chili">(あなた)</span>
        ) : null}
      </td>
      <td className="px-2 py-2 text-ramen-soy/80">{entry.user.prefecture}</td>
      <td className="px-2 py-2 text-ramen-soy/80">{entry.user.favoriteShop}</td>
      <td className="px-2 py-2 text-right text-ramen-chili">{entry.bestScore} pt</td>
      <td className="px-2 py-2 text-right text-ramen-soy/80">
        {entry.correctCount} / {entry.totalCount}
      </td>
      <td className="px-2 py-2 text-right text-xs text-ramen-soy/70">
        {formatDate(entry.achievedAt)}
      </td>
    </tr>
  );
}

interface MyRankingRowProps {
  entry: MyRankingEntry;
}

/** 100 位以下の自分の行 (isMe=true, カラム構成は上と同じ)。 */
function MyRankingRow({ entry }: MyRankingRowProps): JSX.Element {
  return (
    <tr className="border-b border-ramen-chili/20 bg-ramen-broth/20 font-bold">
      <td className="px-2 py-2 text-ramen-chili">{entry.rank}位</td>
      <td className="px-2 py-2 text-ramen-soy">
        {entry.user.username}
        <span className="ml-1 text-xs text-ramen-chili">(あなた)</span>
      </td>
      <td className="px-2 py-2 text-ramen-soy/80">{entry.user.prefecture}</td>
      <td className="px-2 py-2 text-ramen-soy/80">{entry.user.favoriteShop}</td>
      <td className="px-2 py-2 text-right text-ramen-chili">{entry.bestScore} pt</td>
      <td className="px-2 py-2 text-right text-ramen-soy/80">
        {entry.correctCount} / {entry.totalCount}
      </td>
      <td className="px-2 py-2 text-right text-xs text-ramen-soy/70">
        {formatDate(entry.achievedAt)}
      </td>
    </tr>
  );
}

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

/**
 * ページングナビゲーション。
 * ページ数が多いときは省略記号 (…) を挟むが、上位 100 位・20 件区切り = 最大 5 ページなので
 * ここではシンプルに全ページ番号ボタンを並べる。
 */
function Pagination({
  currentPage,
  totalPages,
  onPageChange,
}: PaginationProps): JSX.Element {
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);
  return (
    <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
      <button
        type="button"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage <= 1}
        className="rounded-lg border border-ramen-soy/20 bg-white px-3 py-1 text-sm font-bold text-ramen-soy disabled:cursor-not-allowed disabled:opacity-40 hover:border-ramen-chili"
        aria-label="前のページ"
      >
        ◀ 前
      </button>
      {pages.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onPageChange(p)}
          className={`min-w-[2.5rem] rounded-lg border px-3 py-1 text-sm font-bold ${
            p === currentPage
              ? 'border-ramen-chili bg-ramen-chili text-white'
              : 'border-ramen-soy/20 bg-white text-ramen-soy hover:border-ramen-chili'
          }`}
          aria-label={`${p} ページ目`}
          aria-current={p === currentPage ? 'page' : undefined}
        >
          {p}
        </button>
      ))}
      <button
        type="button"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage >= totalPages}
        className="rounded-lg border border-ramen-soy/20 bg-white px-3 py-1 text-sm font-bold text-ramen-soy disabled:cursor-not-allowed disabled:opacity-40 hover:border-ramen-chili"
        aria-label="次のページ"
      >
        次 ▶
      </button>
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
