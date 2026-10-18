import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import { useScoreStore } from '@/stores/scoreStore';
import { useAuthStore } from '@/stores/authStore';
import { Seo } from '@/components/common/Seo';
import { ShareButtons } from '@/components/common/ShareButtons';
import { buildSiteUrl } from '@/config/site';
import {
  BASE_POINTS_PER_CORRECT,
  MAX_TIME_BONUS,
  PHOTO_QUESTION_TIME_LIMIT_SEC,
  QUESTION_TIME_LIMIT_SEC,
  QUESTIONS_PER_SESSION,
} from '@/config/quizConfig';
import {
  FAVORITE_SHOP_MAX,
  PASSWORD_MIN,
  USERNAME_MAX,
  USERNAME_MIN,
} from '@/lib/validation';
import rawQuestions from '@/data/questions.json';
import { isDemoEntry } from '@/lib/demoRanking';
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

          {ranking.some(isDemoEntry) ? (
            <p className="text-xs text-ramen-soy/60">参考記録を含みます</p>
          ) : null}

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

      <RankingGuide />
    </div>
  );
}

/**
 * ランキングの仕組み (スコア計算・集計ルール) の説明。
 *
 * ランキング表は実行時に Supabase から読むため、プリレンダ後の HTML には表の中身が入らない。
 * 集計ルールを静的な文章で載せておくことで、表が空のときも利用者と検索エンジンに
 * ページの中身が伝わるようにする。数値は quizConfig の定数から組み立て、実装とずれないようにする。
 */
function RankingGuide(): JSX.Element {
  const countByCategory = (category: string): number =>
    rawQuestions.filter((q) => q.category === category).length;
  const maxPerQuestion = BASE_POINTS_PER_CORRECT + MAX_TIME_BONUS;
  const maxScore = maxPerQuestion * QUESTIONS_PER_SESSION;
  // 例: 知識クイズで残り 12 秒のときのボーナス (score.ts と同じ四捨五入)。
  const exampleRemaining = 12;
  const exampleBonus = Math.round((exampleRemaining / QUESTION_TIME_LIMIT_SEC) * MAX_TIME_BONUS);

  return (
    <>
      <section className="card space-y-3">
        <h2 className="text-lg font-black text-ramen-soy">スコアの計算方法</h2>
        <p className="text-sm leading-relaxed text-ramen-soy/80">
          1 問正解するごとに基本点 {BASE_POINTS_PER_CORRECT} 点と、回答までの速さに応じた残り時間ボーナス（最大{' '}
          {MAX_TIME_BONUS} 点）が入ります。ボーナスは「残り秒数 ÷ 制限時間 × {MAX_TIME_BONUS}」を四捨五入した値で、
          不正解や時間切れの問題は 0 点です。制限時間は知識クイズが 1 問 {QUESTION_TIME_LIMIT_SEC} 秒、写真当てクイズが
          1 問 {PHOTO_QUESTION_TIME_LIMIT_SEC} 秒です。
        </p>
        <p className="text-sm leading-relaxed text-ramen-soy/80">
          たとえば知識クイズで残り {exampleRemaining} 秒の時点で正解すると、{BASE_POINTS_PER_CORRECT} 点 +
          ボーナス {exampleBonus} 点で {BASE_POINTS_PER_CORRECT + exampleBonus} 点です。1 セッションは{' '}
          {QUESTIONS_PER_SESSION} 問なので、全問を即答で正解したときの満点は {maxScore} 点になります。
        </p>
      </section>

      <section className="card space-y-3">
        <h2 className="text-lg font-black text-ramen-soy">4 つのランキングと集計のルール</h2>
        <p className="text-sm leading-relaxed text-ramen-soy/80">
          ランキングは「知識クイズ 初級」「知識クイズ 中級」「知識クイズ 上級」「写真当てクイズ」の 4 つに分かれていて、
          それぞれ別々に集計されます。写真当てクイズは、ラーメンの種類や都道府県などの絞り込み条件に関係なく、
          一つのランキングにまとめて集計します。
        </p>
        <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-ramen-soy/80">
          <li>ランキングに記録されるのは、ログインした状態でプレイしたセッションのスコアです。</li>
          <li>
            学習モードの復習クイズは、同じ問題を繰り返し解けるため、ランキングには反映されません。
          </li>
          <li>各ユーザーのベストスコアだけで順位を決め、自己ベストを更新したときに順位が更新されます。</li>
          <li>同点の場合は、そのスコアを先に達成したユーザーが上位になります。</li>
          <li>
            表には上位 100 位までを表示し、ユーザー名・都道府県・好きな店・ベストスコア・正解数・達成日が並びます。
            100 位より下の場合は、表の下に自分の順位が表示されます。
          </li>
        </ul>
      </section>

      <section className="card space-y-3">
        <h2 className="text-lg font-black text-ramen-soy">ランキングへの参加方法</h2>
        <p className="text-sm leading-relaxed text-ramen-soy/80">
          ランキングに参加するには、
          <Link to="/signup" className="text-ramen-chili hover:underline">
            アカウント作成
          </Link>
          ページでユーザー名（{USERNAME_MIN}〜{USERNAME_MAX} 文字）、パスワード（{PASSWORD_MIN} 文字以上）、
          都道府県、好きなラーメン店（{FAVORITE_SHOP_MAX} 文字以内）を登録します。メールアドレスの登録は不要です。
          登録したユーザー名・都道府県・好きなラーメン店は、ランキング表にそのまま表示されます。
          本名や個人が特定できる情報は入力しないでください。
        </p>
        <p className="text-sm leading-relaxed text-ramen-soy/80">
          知識クイズは初級 {countByCategory('basic')} 問、中級 {countByCategory('regional')} 問、上級{' '}
          {countByCategory('expert')} 問の中から毎回ランダムに {QUESTIONS_PER_SESSION} 問が出題されます。
          同じ難易度でもセッションごとに問題が変わるので、何度か挑戦して自己ベストを更新していくのが上位への近道です。
        </p>
      </section>

      <section className="card space-y-3">
        <h2 className="text-lg font-black text-ramen-soy">上位を狙うコツ</h2>
        <p className="text-sm leading-relaxed text-ramen-soy/80">
          1 問あたり、正解の基本点は {BASE_POINTS_PER_CORRECT} 点、速さのボーナスは最大でも {MAX_TIME_BONUS} 点です。
          急いで 1 問落とすより、確実に正解するほうがスコアは伸びます。まずは
          <Link to="/learn" className="text-ramen-chili hover:underline">
            学習モード
          </Link>
          で間違えた問題をつぶし、正解できる問題を増やしてから速さを意識するのがおすすめです。
        </p>
        <p className="text-sm leading-relaxed text-ramen-soy/80">
          中級ではご当地ラーメンや老舗の歴史が多く出題されるので、
          <Link to="/regions" className="text-ramen-chili hover:underline">
            都道府県別ご当地ラーメン
          </Link>
          が予習に役立ちます。上級は製麺やスープの科学、家系・二郎系の系譜など範囲が広いため、
          <Link to="/glossary" className="text-ramen-chili hover:underline">
            用語辞典
          </Link>
          と
          <Link to="/articles" className="text-ramen-chili hover:underline">
            読みもの
          </Link>
          で用語と背景を押さえておくと安定して得点できます。
        </p>
        <p className="text-sm leading-relaxed text-ramen-soy/80">
          写真当てクイズは 1 問 {PHOTO_QUESTION_TIME_LIMIT_SEC} 秒と知識クイズより長めです。スープの色や濁り、表面の油、
          麺の太さ、トッピングといった見た目の手がかりを順に確かめると、選択肢を絞り込みやすくなります。
          見分け方のポイントは
          <Link to="/quiz/photo" className="text-ramen-chili hover:underline">
            写真当てクイズ
          </Link>
          のページにまとめています。
        </p>
      </section>
    </>
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
