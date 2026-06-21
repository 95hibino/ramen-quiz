import { useEffect, useState } from 'react';
import type { PhotoQuestion } from '@/types/photoQuestion';
import { OptionButton } from './OptionButton';
import { resolveOptionState } from './optionState';
import { ReportModal } from './ReportModal';
import { isReportRepositoryReady } from '@/lib/supabaseReportRepository';

interface PhotoQuizCardProps {
  question: PhotoQuestion;
  /** ユーザーが選択した選択肢 (null = 未回答, 'timeout' = 時間切れ)。 */
  selectedIdx: number | null | 'timeout';
  /** 回答済みかどうか (時間切れ含む)。 */
  isAnswered: boolean;
  onSelect: (idx: number) => void;
}

/**
 * 写真当てクイズ用カード。
 * 画像 → 問題文 → 4 択 → (回答後) 解説 + 店舗情報 の縦並び。
 *
 * カード右下に「⚠ この問題を通報」リンクを設置 (Supabase 接続時のみ)。
 * クリックでモーダルを開き、`content_reports` テーブルに INSERT。
 */
export function PhotoQuizCard({
  question,
  selectedIdx,
  isAnswered,
  onSelect,
}: PhotoQuizCardProps): JSX.Element {
  // Supabase が接続されていれば通報ボタンを表示する。
  // 接続状態はモジュールロード時に確定するため、初期値で評価して再描画コストを削る。
  const [reportReady] = useState<boolean>(() => isReportRepositoryReady());
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // 通報トーストを 4 秒で自動消去
  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(id);
  }, [toast]);

  return (
    <div className="card relative space-y-5">
      <div className="overflow-hidden rounded-xl bg-ramen-broth/10">
        <img
          src={question.imageUrl}
          alt={`クイズ写真: ${question.shopInfo.name}`}
          className="block h-auto w-full object-cover"
          loading="lazy"
        />
      </div>

      <h2 className="text-lg font-bold leading-relaxed text-ramen-nori sm:text-xl">
        {question.question}
      </h2>

      <div className="grid gap-3">
        {question.options.map((opt, idx) => {
          const state = resolveOptionState({
            optionIdx: idx,
            answerIdx: question.answerIdx,
            selectedIdx,
            isAnswered,
          });
          return (
            <OptionButton
              key={idx}
              index={idx}
              label={opt}
              state={state}
              onClick={() => onSelect(idx)}
            />
          );
        })}
      </div>

      {isAnswered ? (
        <div className="space-y-3">
          {question.explanation ? (
            <div className="rounded-xl border border-ramen-broth/40 bg-ramen-broth/10 p-4 text-sm leading-relaxed text-ramen-soy">
              <p className="mb-1 font-bold text-ramen-chili">解説</p>
              <p>{question.explanation}</p>
            </div>
          ) : null}
          <div className="rounded-xl border border-ramen-soy/20 bg-white p-4 text-sm text-ramen-soy">
            <p className="mb-2 font-bold text-ramen-chili">店舗情報</p>
            <dl className="grid grid-cols-1 gap-1 sm:grid-cols-2">
              <ShopInfoRow label="店名" value={question.shopInfo.name} />
              {question.shopInfo.area ? (
                <ShopInfoRow label="エリア" value={question.shopInfo.area} />
              ) : null}
              {question.shopInfo.genre ? (
                <ShopInfoRow label="ジャンル" value={question.shopInfo.genre} />
              ) : null}
            </dl>
            {question.shopInfo.description ? (
              <p className="mt-2 text-xs text-ramen-soy/70">{question.shopInfo.description}</p>
            ) : null}
          </div>
        </div>
      ) : null}

      {reportReady ? (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setIsReportOpen(true)}
            className="text-xs text-ramen-soy/50 transition hover:text-ramen-chili hover:underline"
            aria-label="この問題を通報する"
          >
            ⚠ この問題を通報
          </button>
        </div>
      ) : null}

      {isReportOpen ? (
        <ReportModal
          questionId={question.id}
          onClose={() => setIsReportOpen(false)}
          onSubmitted={(message) => setToast(message)}
        />
      ) : null}

      {toast ? (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 rounded-full bg-ramen-soy px-6 py-3 text-sm font-bold text-white shadow-xl"
        >
          {toast}
        </div>
      ) : null}
    </div>
  );
}

function ShopInfoRow({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="flex gap-2 text-xs">
      <dt className="font-bold text-ramen-soy/60">{label}</dt>
      <dd className="text-ramen-soy">{value}</dd>
    </div>
  );
}
