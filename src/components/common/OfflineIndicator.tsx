/**
 * オフライン状態インジケーター。
 *
 * `navigator.onLine` と `online` / `offline` イベントで通信状態を監視し、
 * オフライン時に画面上部の帯で通知する。
 *
 * オフライン時でも:
 * - 知識クイズ (Service Worker がプレキャッシュ済み)
 * - お気に入り / 間違えた問題 (localStorage)
 * - Home / About / Privacy などの静的ページ
 * は動作する。
 *
 * ランキング・写真クイズ・投稿・ログイン等の Supabase 依存機能は動かないので、
 * ユーザーに「一部機能が利用できない」旨を伝える。
 */
import { useEffect, useState } from 'react';

export function OfflineIndicator(): JSX.Element | null {
  // 初期値はマウント時の navigator.onLine (SSR 対応で typeof チェック)
  const [isOffline, setIsOffline] = useState<boolean>(() => {
    if (typeof navigator === 'undefined') return false;
    return navigator.onLine === false;
  });

  useEffect(() => {
    const handleOnline = (): void => setIsOffline(false);
    const handleOffline = (): void => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-0 z-30 border-b border-ramen-chili/40 bg-ramen-chili/10 px-4 py-2 text-center text-xs font-bold text-ramen-chili"
    >
      📡 オフラインです。知識クイズ・お気に入り・復習は使えます。ランキング / 写真クイズ / 投稿は復旧をお待ちください。
    </div>
  );
}
