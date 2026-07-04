/**
 * マイページ内: 投稿履歴セクション。
 *
 * `compositePhotoQuestionRepository.findBySubmitterId(currentUser.username)` で
 * Supabase から取得。Supabase 未接続時は「Supabase 未接続のため表示できません」を表示。
 *
 * 表示: サムネイル (imageUrl), 店名, 投稿日 (取れない場合は非表示), 正解の選択肢。
 * NOTE: PhotoQuestion 型には createdAt が含まれないため、投稿日はここでは表示しない。
 * (仕様どおり日付を出したい場合は将来 findBySubmitterId で createdAt をドメインに含める。)
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { PhotoQuestion } from '@/types/photoQuestion';
import { compositePhotoQuestionRepository } from '@/lib/compositePhotoQuestionRepository';
import { isSupabaseConfigured } from '@/lib/supabaseClient';

interface SubmissionsSectionProps {
  submitterId: string;
}

type LoadState = 'idle' | 'loading' | 'success' | 'error';

export function SubmissionsSection({ submitterId }: SubmissionsSectionProps): JSX.Element {
  const supabaseReady = isSupabaseConfigured();
  const [items, setItems] = useState<PhotoQuestion[]>([]);
  const [status, setStatus] = useState<LoadState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!supabaseReady) {
      setStatus('success');
      setItems([]);
      return;
    }
    let cancelled = false;
    setStatus('loading');
    setErrorMessage(null);
    void (async () => {
      try {
        const fetcher = compositePhotoQuestionRepository.findBySubmitterId;
        if (!fetcher) {
          if (!cancelled) {
            setItems([]);
            setStatus('success');
          }
          return;
        }
        const list = await fetcher(submitterId);
        if (!cancelled) {
          setItems(list);
          setStatus('success');
        }
      } catch (err) {
        if (!cancelled) {
          setErrorMessage(err instanceof Error ? err.message : '取得に失敗しました。');
          setStatus('error');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabaseReady, submitterId]);

  if (!supabaseReady) {
    return (
      <div className="card">
        <h2 className="text-lg font-bold text-ramen-soy">投稿履歴</h2>
        <p className="mt-3 text-sm text-ramen-soy/70">
          投稿履歴は Supabase 未接続のため表示できません。
        </p>
      </div>
    );
  }

  return (
    <div className="card space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-ramen-soy">
          投稿履歴{' '}
          {status === 'success' ? (
            <span className="ml-2 rounded-full bg-ramen-nori px-2 py-0.5 text-xs font-bold text-white">
              {items.length}
            </span>
          ) : null}
        </h2>
        <Link
          to="/quiz/photo/submit"
          className="text-xs font-bold text-ramen-chili hover:underline"
        >
          写真を投稿する
        </Link>
      </div>

      {status === 'loading' ? (
        <p className="text-sm text-ramen-soy/70">読み込み中...</p>
      ) : null}
      {status === 'error' ? (
        <p className="text-sm font-bold text-ramen-chili">
          エラー: {errorMessage ?? '不明なエラー'}
        </p>
      ) : null}
      {status === 'success' && items.length === 0 ? (
        <p className="text-sm text-ramen-soy/70">
          まだ投稿はありません。{' '}
          <Link
            to="/quiz/photo/submit"
            className="font-bold text-ramen-chili hover:underline"
          >
            最初の一枚を投稿する
          </Link>
        </p>
      ) : null}
      {items.length > 0 ? (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {items.map((q) => (
            <li
              key={q.id}
              className="flex gap-3 rounded-xl border border-ramen-soy/10 bg-white p-3"
            >
              <img
                src={q.thumbnailUrl ?? q.imageUrl}
                alt={`投稿写真: ${q.shopInfo.name}`}
                className="h-20 w-20 flex-none rounded object-cover"
                loading="lazy"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold text-ramen-soy">{q.shopInfo.name}</p>
                {q.shopInfo.area ? (
                  <p className="truncate text-xs text-ramen-soy/60">{q.shopInfo.area}</p>
                ) : null}
                <p className="mt-1 text-xs text-ramen-soy/70">
                  <span className="font-bold text-ramen-chili">正解: </span>
                  {q.options[q.answerIdx]}
                </p>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
