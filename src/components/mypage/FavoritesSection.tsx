/**
 * マイページ内: お気に入り問題一覧セクション。
 *
 * 知識クイズは同梱 JSON (`data/questions.json`) から id で引く。
 * 写真クイズは `compositePhotoQuestionRepository.findByFilter({})` で
 * 現在利用可能な全問題を取得し、id で引く。
 *
 * 復習モードは初期スコープでは静的表示のみ (問題文 + 正解 + 解説)。
 * 詳細ボタンで開閉できるアコーディオン形式にする。
 */
import { useEffect, useMemo, useState } from 'react';
import rawQuestions from '@/data/questions.json';
import type { QuizQuestion } from '@/types/quiz';
import type { PhotoQuestion } from '@/types/photoQuestion';
import { useFavoritesStore } from '@/stores/favoritesStore';
import type { FavoriteEntry } from '@/lib/favoritesRepository';
import { compositePhotoQuestionRepository } from '@/lib/compositePhotoQuestionRepository';

interface ResolvedFavorite {
  entry: FavoriteEntry;
  question: QuizQuestion | PhotoQuestion;
}

function isPhotoQuestion(
  q: QuizQuestion | PhotoQuestion,
): q is PhotoQuestion {
  return 'imageUrl' in q;
}

export function FavoritesSection(): JSX.Element {
  const favorites = useFavoritesStore((s) => s.favorites);
  const remove = useFavoritesStore((s) => s.remove);
  const clearAll = useFavoritesStore((s) => s.clearAll);

  const [photoQuestions, setPhotoQuestions] = useState<PhotoQuestion[]>([]);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  // 写真クイズは非同期取得 (Supabase + モック)。同梱 JSON の知識クイズは同期でよい。
  useEffect(() => {
    // お気に入りに写真が 1 件でもあれば読み込む (無ければ API を叩かない)
    const hasPhotoFav = favorites.some((f) => f.quizType === 'photo');
    if (!hasPhotoFav) {
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
        console.warn('[FavoritesSection] photo questions load failed:', err);
        if (!cancelled) setPhotoQuestions([]);
      })
      .finally(() => {
        if (!cancelled) setPhotoLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [favorites]);

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

  const resolved = useMemo<ResolvedFavorite[]>(() => {
    const list: ResolvedFavorite[] = [];
    for (const entry of favorites) {
      const q =
        entry.quizType === 'knowledge'
          ? knowledgeMap.get(entry.questionId)
          : photoMap.get(entry.questionId);
      if (!q) continue; // 元問題が削除されていた場合はスキップ
      list.push({ entry, question: q });
    }
    return list;
  }, [favorites, knowledgeMap, photoMap]);

  const badgeCount = favorites.length;

  if (favorites.length === 0) {
    return (
      <div className="card">
        <h2 className="text-lg font-bold text-ramen-soy">お気に入り問題</h2>
        <p className="mt-3 text-sm text-ramen-soy/70">
          クイズの回答後に表示される「☆ お気に入り」ボタンから、気になった問題を保存できます。
        </p>
      </div>
    );
  }

  const handleClearAll = (): void => {
    if (window.confirm('お気に入りをすべて削除しますか？')) {
      clearAll();
    }
  };

  return (
    <div className="card space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-ramen-soy">
          お気に入り問題{' '}
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
                  <p className="text-xs text-ramen-soy/60">
                    {isPhoto ? '写真当てクイズ' : '知識クイズ'} ・{' '}
                    {formatDate(entry.addedAt)}
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
                    className="rounded-full border border-ramen-soy/30 px-3 py-1 text-xs font-bold text-ramen-soy hover:border-ramen-chili hover:text-ramen-chili"
                    aria-label="お気に入りから削除"
                  >
                    削除
                  </button>
                </div>
              </div>

              {isExpanded ? (
                <div className="mt-3 space-y-2 rounded-lg bg-ramen-broth/10 p-3 text-xs text-ramen-soy">
                  {isPhoto ? (
                    <img
                      src={question.imageUrl}
                      alt={`お気に入り写真: ${question.shopInfo.name}`}
                      className="mb-2 h-40 w-full rounded object-cover"
                      loading="lazy"
                    />
                  ) : null}
                  <p>
                    <span className="font-bold">問題: </span>
                    {question.question}
                  </p>
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

      {resolved.length < favorites.length ? (
        <p className="text-xs text-ramen-soy/50">
          ※ 一部の問題は現在利用できないため表示していません (
          {favorites.length - resolved.length} 件)。
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
