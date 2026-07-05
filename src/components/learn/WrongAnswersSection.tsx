/**
 * 学習モード内: 間違えた問題一覧セクション。
 *
 * Result 画面で自動的に localStorage に蓄積された「不正解の問題」を、
 * 問題文 + 正解 + 解説の順で復習できる形式で表示する。
 *
 * カードごとに「覚えた」ボタンがあり、押すと wrongAnswers から除去される。
 * 復習の完了度合いを可視化する仕掛け。
 *
 * FavoritesSection と設計が似ているが、
 * - 削除ボタン = 「覚えた」ラベル (ポジティブな響き)
 * - wrongCount バッジ (何回間違えたか) を表示
 * - 一括削除は「全部覚えた (リセット)」に変更
 * の 3 点で差別化する。
 */
import { useEffect, useMemo, useState } from 'react';
import rawQuestions from '@/data/questions.json';
import type { QuizQuestion } from '@/types/quiz';
import type { PhotoQuestion } from '@/types/photoQuestion';
import { useWrongAnswersStore } from '@/stores/wrongAnswersStore';
import type { WrongAnswerEntry } from '@/lib/wrongAnswersRepository';
import { compositePhotoQuestionRepository } from '@/lib/compositePhotoQuestionRepository';

interface ResolvedWrong {
  entry: WrongAnswerEntry;
  question: QuizQuestion | PhotoQuestion;
}

function isPhotoQuestion(q: QuizQuestion | PhotoQuestion): q is PhotoQuestion {
  return 'imageUrl' in q;
}

export function WrongAnswersSection(): JSX.Element {
  const wrongAnswers = useWrongAnswersStore((s) => s.wrongAnswers);
  const remove = useWrongAnswersStore((s) => s.remove);
  const clearAll = useWrongAnswersStore((s) => s.clearAll);

  const [photoQuestions, setPhotoQuestions] = useState<PhotoQuestion[]>([]);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  // 写真クイズは非同期取得。知識クイズは同梱 JSON なので同期で OK。
  useEffect(() => {
    const hasPhotoWrong = wrongAnswers.some((w) => w.quizType === 'photo');
    if (!hasPhotoWrong) {
      setPhotoQuestions([]);
      return;
    }
    let cancelled = false;
    setPhotoLoading(true);
    void compositePhotoQuestionRepository
      .findByFilter({})
      .then((list) => {
        if (!cancelled) setPhotoQuestions(list);
      })
      .catch((err) => {
        console.warn('[WrongAnswersSection] photo questions load failed:', err);
        if (!cancelled) setPhotoQuestions([]);
      })
      .finally(() => {
        if (!cancelled) setPhotoLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [wrongAnswers]);

  const knowledgeMap = useMemo<Map<string, QuizQuestion>>(() => {
    const map = new Map<string, QuizQuestion>();
    for (const q of rawQuestions as QuizQuestion[]) {
      map.set(q.id, q);
    }
    return map;
  }, []);

  const photoMap = useMemo<Map<string, PhotoQuestion>>(() => {
    const map = new Map<string, PhotoQuestion>();
    for (const q of photoQuestions) map.set(q.id, q);
    return map;
  }, [photoQuestions]);

  const resolved = useMemo<ResolvedWrong[]>(() => {
    const list: ResolvedWrong[] = [];
    for (const entry of wrongAnswers) {
      const q =
        entry.quizType === 'knowledge'
          ? knowledgeMap.get(entry.questionId)
          : photoMap.get(entry.questionId);
      if (!q) continue; // 元問題が削除済みならスキップ
      list.push({ entry, question: q });
    }
    return list;
  }, [wrongAnswers, knowledgeMap, photoMap]);

  const badgeCount = wrongAnswers.length;

  if (wrongAnswers.length === 0) {
    return (
      <div className="card">
        <h2 className="text-lg font-bold text-ramen-soy">間違えた問題</h2>
        <p className="mt-3 text-sm text-ramen-soy/70">
          クイズで不正解になった問題は自動的にここに保存されます。復習で「覚えた」を押すと一覧から消えます。
        </p>
        <p className="mt-2 text-xs text-ramen-soy/50">
          まだ間違えた問題はありません。まずはクイズをプレイしてみましょう。
        </p>
      </div>
    );
  }

  const handleClearAll = (): void => {
    if (window.confirm('間違えた問題の履歴をすべて削除しますか？')) {
      clearAll();
    }
  };

  return (
    <div className="card space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-ramen-soy">
          間違えた問題{' '}
          <span className="ml-2 rounded-full bg-ramen-chili px-2 py-0.5 text-xs font-bold text-white">
            {badgeCount}
          </span>
        </h2>
        <button
          type="button"
          onClick={handleClearAll}
          className="text-xs font-bold text-ramen-soy/60 hover:text-ramen-chili hover:underline"
        >
          すべて削除
        </button>
      </div>

      <p className="text-xs text-ramen-soy/60">
        カードを展開して問題と解説を確認 → 覚えたら「覚えた」で一覧から外れます。
      </p>

      {photoLoading ? (
        <p className="text-xs text-ramen-soy/60">写真問題を読み込み中...</p>
      ) : null}

      <ul className="space-y-2 text-sm">
        {resolved.map(({ entry, question }) => {
          const key = `${entry.quizType}:${entry.questionId}`;
          const isExpanded = expandedKey === key;
          const isPhoto = isPhotoQuestion(question);
          const title = isPhoto
            ? `写真: ${question.shopInfo.name}`
            : question.question;
          const answerText = question.options[question.answerIdx];

          return (
            <li
              key={key}
              className="rounded-xl border border-ramen-soy/10 bg-white p-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-xs text-ramen-soy/60">
                    <span>{isPhoto ? '写真当てクイズ' : '知識クイズ'}</span>
                    <span>・</span>
                    <span>最終不正解 {formatDate(entry.lastWrongAt)}</span>
                    {entry.wrongCount > 1 ? (
                      <span className="rounded-full bg-ramen-soy/10 px-2 py-0.5 text-[10px] font-bold text-ramen-soy">
                        {entry.wrongCount}回
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-1 line-clamp-2 font-bold text-ramen-soy">{title}</p>
                </div>
                <div className="flex flex-none gap-2">
                  <button
                    type="button"
                    onClick={() => setExpandedKey(isExpanded ? null : key)}
                    className="btn-secondary px-3 py-1 text-xs"
                    aria-expanded={isExpanded}
                  >
                    {isExpanded ? '閉じる' : '復習'}
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(entry.quizType, entry.questionId)}
                    className="rounded-full border border-ramen-nori/50 bg-ramen-nori/10 px-3 py-1 text-xs font-bold text-ramen-nori hover:bg-ramen-nori/20"
                    aria-label="覚えたので一覧から外す"
                  >
                    ✓ 覚えた
                  </button>
                </div>
              </div>

              {isExpanded ? (
                <div className="mt-3 space-y-2 rounded-lg bg-ramen-broth/10 p-3 text-xs text-ramen-soy">
                  {isPhoto ? (
                    <img
                      src={question.imageUrl}
                      alt={`復習写真: ${question.shopInfo.name}`}
                      className="mb-2 h-40 w-full rounded object-cover"
                      loading="lazy"
                    />
                  ) : null}
                  <p>
                    <span className="font-bold">問題: </span>
                    {question.question}
                  </p>
                  <ul className="ml-4 list-disc space-y-1">
                    {question.options.map((opt, i) => (
                      <li
                        key={i}
                        className={
                          i === question.answerIdx
                            ? 'font-bold text-ramen-chili'
                            : 'text-ramen-soy/70'
                        }
                      >
                        {opt} {i === question.answerIdx ? '← 正解' : ''}
                      </li>
                    ))}
                  </ul>
                  <p>
                    <span className="font-bold text-ramen-chili">正解: </span>
                    {answerText}
                  </p>
                  {question.explanation ? (
                    <p>
                      <span className="font-bold">解説: </span>
                      {question.explanation}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      {resolved.length < wrongAnswers.length ? (
        <p className="text-xs text-ramen-soy/50">
          ※ 一部の問題は現在利用できないため表示していません (
          {wrongAnswers.length - resolved.length} 件)。
        </p>
      ) : null}
    </div>
  );
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  } catch {
    return iso;
  }
}
