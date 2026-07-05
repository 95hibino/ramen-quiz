/**
 * マイページ内: 危険な操作セクション。
 *
 * - ログアウト (既存機能)
 * - お気に入り全削除 (favoritesStore.clearAll)
 * - アカウント削除 (localStorage 内のユーザー・スコア・お気に入りを削除し、ホームへ)
 *
 * アカウント削除は取り消せない操作のため、確認モーダルでユーザー名の再入力を求める
 * (誤操作防止)。Supabase 側のユーザー削除は Phase 3 で対応。
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { useFavoritesStore } from '@/stores/favoritesStore';
import { useScoreStore } from '@/stores/scoreStore';
import { readJson, writeJson, STORAGE_KEYS } from '@/lib/storage';
import type { PasswordCredential, ScoreRecord, User } from '@/types/account';

export function DangerZone(): JSX.Element {
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.currentUser);
  const logout = useAuthStore((s) => s.logout);
  const clearFavorites = useFavoritesStore((s) => s.clearAll);
  const favoritesCount = useFavoritesStore((s) => s.favorites.length);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmInput, setConfirmInput] = useState('');

  const handleLogout = async (): Promise<void> => {
    try {
      await logout();
    } catch (err) {
      console.warn('[DangerZone] logout failed:', err);
    }
    navigate('/', { replace: true });
  };

  const handleClearFavorites = (): void => {
    if (favoritesCount === 0) return;
    if (window.confirm(`お気に入り (${favoritesCount} 件) をすべて削除しますか？`)) {
      clearFavorites();
    }
  };

  const handleDeleteAccount = async (): Promise<void> => {
    if (!currentUser) return;
    if (confirmInput !== currentUser.username) return;

    // 1) ユーザー本体 (localStorage 旧データ)
    const users = readJson<User[]>(STORAGE_KEYS.users, []);
    writeJson<User[]>(
      STORAGE_KEYS.users,
      users.filter((u) => u.id !== currentUser.id),
    );

    // 2) パスワードクレデンシャル
    const creds = readJson<PasswordCredential[]>(STORAGE_KEYS.credentials, []);
    writeJson<PasswordCredential[]>(
      STORAGE_KEYS.credentials,
      creds.filter((c) => c.userId !== currentUser.id),
    );

    // 3) スコア履歴 (このユーザー分のみ)
    const scores = readJson<ScoreRecord[]>(STORAGE_KEYS.scores, []);
    writeJson<ScoreRecord[]>(
      STORAGE_KEYS.scores,
      scores.filter((s) => s.userId !== currentUser.id),
    );

    // 4) 認証セッション + お気に入りは端末単位 (共用端末を想定) なので全削除
    clearFavorites();

    // 5) scoreStore のインメモリキャッシュもクリアしておく (次回ログイン時に別ユーザー分が漏れないように)
    useScoreStore.setState({ myScores: [], myScoresStatus: 'idle', myScoresError: null });

    // 6) ログアウト (Supabase Auth セッションクリア含む) → ホームへ
    // 注: Phase 3 では Supabase 側の auth.users 本体削除は Service Role Key が必要なため
    // フロントから直接は行わない。代わりに Supabase セッションをクリアし、
    // public_profiles / quiz_scores はサーバ側に残す (完全削除は社長運用手順で対応)。
    try {
      await logout();
    } catch (err) {
      console.warn('[DangerZone] logout failed:', err);
    }
    navigate('/', { replace: true });
  };

  const usernameForConfirm = currentUser?.username ?? '';
  const canConfirmDelete = confirmInput === usernameForConfirm && usernameForConfirm.length > 0;

  return (
    <div className="card space-y-3">
      <h2 className="text-lg font-bold text-ramen-soy">危険な操作</h2>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={handleLogout} className="btn-secondary text-sm">
          ログアウト
        </button>
        <button
          type="button"
          onClick={handleClearFavorites}
          className="rounded-full border border-ramen-soy/30 bg-white px-4 py-2 text-sm font-bold text-ramen-soy hover:border-ramen-chili hover:text-ramen-chili"
          disabled={favoritesCount === 0}
        >
          お気に入り全削除
        </button>
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          className="rounded-full border border-ramen-chili bg-ramen-chili px-4 py-2 text-sm font-bold text-white hover:bg-ramen-chili/90"
        >
          アカウント削除
        </button>
      </div>

      <p className="text-xs text-ramen-soy/60">
        アカウント削除はこの端末に保存されているユーザー情報・スコア履歴を削除します。
        投稿済みの写真クイズなど、他ユーザーからも見えるデータは削除されません。
      </p>

      {confirmOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-account-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <div className="w-full max-w-md space-y-3 rounded-2xl bg-white p-6 shadow-2xl">
            <h3 id="delete-account-title" className="text-lg font-bold text-ramen-chili">
              アカウント削除の確認
            </h3>
            <p className="text-sm text-ramen-soy">
              この操作は取り消せません。確認のため、ユーザー名{' '}
              <span className="font-bold">「{usernameForConfirm}」</span>
              {' '}を入力してください。
            </p>
            <input
              type="text"
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              className="w-full rounded-lg border border-ramen-soy/30 px-3 py-2 text-sm"
              placeholder={usernameForConfirm}
              aria-label="ユーザー名確認"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setConfirmOpen(false);
                  setConfirmInput('');
                }}
                className="btn-secondary text-sm"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={!canConfirmDelete}
                className="rounded-full bg-ramen-chili px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                削除する
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
