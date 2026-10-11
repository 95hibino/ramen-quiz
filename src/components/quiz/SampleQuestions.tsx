import { CATEGORY_META } from '@/config/quizConfig';
import rawQuestions from '@/data/questions.json';

/**
 * 知識クイズの例題を、問題文・選択肢・正解・解説までまとめて静的に表示する。
 *
 * クイズのプレイ画面は出題データを実行時に読むためプリレンダされず、検索エンジンからは
 * 問題の中身が見えない。入口ページやトップに例題を載せることで、サイトの中身
 * (問題と解説) をクローラにも利用者にも見せる目的のコンポーネント。
 *
 * - 正解と解説は `<details>` に入れ、先に自分で考えてから開けるようにする
 *   (閉じていても HTML には含まれるのでクローラは読める)。
 * - 存在しない ID は表示しない (問題データ側の ID 変更で壊れないように)。
 * - ページ間で同じ問題を使い回すと重複コンテンツになるため、呼び出し側で別の ID を渡す。
 */
export function SampleQuestions({
  ids,
  heading,
  lead,
}: {
  ids: ReadonlyArray<string>;
  heading: string;
  lead?: string;
}): JSX.Element | null {
  const questions = ids
    .map((id) => rawQuestions.find((q) => q.id === id))
    .filter((q): q is (typeof rawQuestions)[number] => q !== undefined);

  if (questions.length === 0) return null;

  return (
    <section className="card space-y-4">
      <h2 className="text-lg font-black text-ramen-soy">{heading}</h2>
      {lead ? <p className="text-sm leading-relaxed text-ramen-soy/80">{lead}</p> : null}
      <ol className="space-y-4">
        {questions.map((q, idx) => {
          const label = CATEGORY_META.find((m) => m.category === q.category)?.label ?? '';
          return (
            <li
              key={q.id}
              className="rounded-lg border border-ramen-soy/10 bg-white/60 px-3 py-3"
            >
              <p className="text-xs font-bold text-ramen-chili">
                例題 {idx + 1}（{label}）
              </p>
              <p className="mt-1 text-sm font-bold leading-relaxed text-ramen-soy">
                {q.question}
              </p>
              <ol className="mt-2 grid gap-1 text-sm text-ramen-soy/90 sm:grid-cols-2">
                {q.options.map((opt, i) => (
                  <li key={opt}>
                    {String.fromCharCode(65 + i)}. {opt}
                  </li>
                ))}
              </ol>
              <details className="mt-2 text-sm">
                <summary className="cursor-pointer font-bold text-ramen-chili">
                  正解と解説を見る
                </summary>
                <p className="mt-2 font-bold text-ramen-soy">
                  正解：{String.fromCharCode(65 + q.answerIdx)}. {q.options[q.answerIdx]}
                </p>
                <p className="mt-1 leading-relaxed text-ramen-soy/80">{q.explanation}</p>
              </details>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
