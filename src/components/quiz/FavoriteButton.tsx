import { useFavoritesStore } from '@/stores/favoritesStore';
import type { FavoriteQuizType } from '@/lib/favoritesRepository';

interface FavoriteButtonProps {
  quizType: FavoriteQuizType;
  questionId: string;
  /** ボタンサイズ (デフォルト: md)。マイページなどコンパクトに置きたい場合は sm。 */
  size?: 'sm' | 'md';
}

/**
 * 問題を「お気に入り」に追加・解除するトグル星ボタン。
 *
 * - 未登録: 白抜き ☆
 * - 登録済: 塗り ★
 *
 * localStorage 完結の永続化。ユーザー認証状態には依存しない
 * (未ログインでもお気に入り登録可能)。
 */
export function FavoriteButton({
  quizType,
  questionId,
  size = 'md',
}: FavoriteButtonProps): JSX.Element {
  // has() は state を参照するため、コンポーネントは favorites が更新されれば再描画される。
  const isFavorite = useFavoritesStore((s) =>
    s.favorites.some((e) => e.quizType === quizType && e.questionId === questionId),
  );
  const add = useFavoritesStore((s) => s.add);
  const remove = useFavoritesStore((s) => s.remove);

  const handleClick = (): void => {
    if (isFavorite) {
      remove(quizType, questionId);
    } else {
      add(quizType, questionId);
    }
  };

  const label = isFavorite ? 'お気に入りから削除' : 'お気に入りに追加';
  const sizeClass = size === 'sm' ? 'text-sm px-2 py-1' : 'text-base px-3 py-1.5';

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={isFavorite}
      aria-label={label}
      className={`inline-flex items-center gap-1 rounded-full border font-bold transition ${sizeClass} ${
        isFavorite
          ? 'border-ramen-chili bg-ramen-chili/10 text-ramen-chili'
          : 'border-ramen-soy/30 bg-white text-ramen-soy hover:border-ramen-chili hover:text-ramen-chili'
      }`}
    >
      <span aria-hidden="true">{isFavorite ? '★' : '☆'}</span>
      <span>{isFavorite ? 'お気に入り済' : 'お気に入り'}</span>
    </button>
  );
}
