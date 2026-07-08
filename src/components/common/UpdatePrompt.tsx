/**
 * PWA アップデート通知トースト。
 *
 * Service Worker が新バージョンを検知したときに画面下部にバナーを出し、
 * ユーザーに「今すぐ更新」を促す。
 *
 * 仕組み:
 * - `useRegisterSW` (virtual:pwa-register/react) の `needRefresh` state を購読
 * - `updateServiceWorker(true)` で waiting SW を activate → 自動リロード
 * - 「あとで」を選んだ場合は 30 分間 localStorage で抑制 (毎リロードで再表示するのを避ける)
 *
 * vite.config.ts の `registerType: 'autoUpdate'` により、SW は既にバックグラウンドで
 * 更新済み。ユーザーが「更新」ボタンを押すのは実質「今すぐリロードして反映」に
 * 相当する。「あとで」でも次回リロード時に反映されるため、いずれにせよ最終的に
 * 新版になる。
 */
import { useCallback, useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

const DISMISS_STORAGE_KEY = 'ramen-quiz:pwa-update-dismissed-at';
const DISMISS_TTL_MS = 30 * 60 * 1000; // 30 分間

function isRecentlyDismissed(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_STORAGE_KEY);
    if (!raw) return false;
    const at = Number.parseInt(raw, 10);
    if (!Number.isFinite(at)) return false;
    return Date.now() - at < DISMISS_TTL_MS;
  } catch {
    return false;
  }
}

function markDismissed(): void {
  try {
    localStorage.setItem(DISMISS_STORAGE_KEY, String(Date.now()));
  } catch {
    // 容量超過等は無視 (更新通知は次回リロードでどのみち再表示される)
  }
}

export function UpdatePrompt(): JSX.Element | null {
  // SW 登録時のコールバックは開発時デバッグ用。本番ではノイズにならないよう info レベル。
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl) {
      console.info('[UpdatePrompt] SW registered:', swUrl);
    },
    onRegisterError(error) {
      console.warn('[UpdatePrompt] SW registration failed:', error);
    },
  });

  // 直近で「あとで」された場合は最初から表示しない。
  const [dismissed, setDismissed] = useState<boolean>(() => isRecentlyDismissed());

  // 新版検出時に「あとで」抑制の TTL 内なら state 側もクリアしておく。
  useEffect(() => {
    if (needRefresh && !dismissed) {
      // 表示中は特に何もしない (このブランチは表示条件用)。
    }
  }, [needRefresh, dismissed]);

  const handleUpdate = useCallback(async () => {
    // 抑制フラグは新版を採用したのでクリアする (次のリリース通知は即出したい)。
    try {
      localStorage.removeItem(DISMISS_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    // `reloadPage=true` で SW アクティベート後にページを自動リロードする。
    await updateServiceWorker(true);
  }, [updateServiceWorker]);

  const handleDismiss = useCallback(() => {
    markDismissed();
    setDismissed(true);
    setNeedRefresh(false);
  }, [setNeedRefresh]);

  if (!needRefresh || dismissed) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="アプリの新バージョンが利用可能"
      className="fixed bottom-4 left-1/2 z-40 flex w-[min(92vw,420px)] -translate-x-1/2 items-center gap-3 rounded-2xl border border-ramen-nori/20 bg-ramen-nori p-3 text-white shadow-xl"
    >
      <div aria-hidden="true" className="text-2xl">
        🔄
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold">新しいバージョンが利用可能です</p>
        <p className="text-xs opacity-80">
          最新の機能・修正を反映するには更新してください。
        </p>
      </div>
      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={handleUpdate}
          className="rounded-full bg-white px-3 py-1 text-xs font-bold text-ramen-nori hover:bg-white/90"
        >
          今すぐ更新
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          className="text-[10px] text-white/70 hover:underline"
        >
          あとで
        </button>
      </div>
    </div>
  );
}
