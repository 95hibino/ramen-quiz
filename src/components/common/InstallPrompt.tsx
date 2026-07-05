/**
 * PWA インストールプロンプト。
 *
 * Chrome / Edge / Android Chrome 系ブラウザで `beforeinstallprompt` イベントが
 * 発火したとき、画面下部にバナーを表示して「ホーム画面に追加」を促す。
 *
 * iOS Safari は `beforeinstallprompt` を発火させないため、代替として
 * 「共有 → ホーム画面に追加」の案内を軽く表示するモードも用意する。
 *
 * ユーザーが「後で」を押した場合は localStorage に記録し、7 日間再表示しない。
 */
import { useCallback, useEffect, useState } from 'react';

const DISMISS_STORAGE_KEY = 'ramen-quiz:pwa-install-dismissed-at';
const DISMISS_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 日間

/**
 * `beforeinstallprompt` イベントの型 (Chrome 拡張)。
 * Web 標準にはまだ含まれていないため独自定義。
 */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

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
    // 容量超過等は無視
  }
}

/**
 * 既にインストール済み (standalone モードで開かれている) かを判定。
 * インストール済みならプロンプトを出さない。
 */
function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const displayModeStandalone = window.matchMedia?.('(display-mode: standalone)').matches;
  // iOS Safari は navigator.standalone (非標準) を使う
  const iosStandalone = (navigator as unknown as { standalone?: boolean }).standalone === true;
  return displayModeStandalone || iosStandalone;
}

export function InstallPrompt(): JSX.Element | null {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    if (isRecentlyDismissed()) return;

    const onBeforeInstall = (e: Event): void => {
      // Chrome / Edge / Android の自動プロンプトを抑制し、手動でトリガーするため
      // e.preventDefault() を呼ぶ (仕様通り)
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
    };
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === 'dismissed') {
      markDismissed();
    }
    setDeferredPrompt(null);
    setVisible(false);
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    markDismissed();
    setVisible(false);
    setDeferredPrompt(null);
  }, []);

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="ホーム画面に追加"
      className="fixed bottom-4 left-1/2 z-40 flex w-[min(92vw,420px)] -translate-x-1/2 items-center gap-3 rounded-2xl border border-ramen-soy/10 bg-white p-3 shadow-xl"
    >
      <div aria-hidden="true" className="text-2xl">
        📱
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-ramen-soy">アプリとして使いませんか？</p>
        <p className="text-xs text-ramen-soy/70">
          ホーム画面に追加すると、オフラインでも遊べます。
        </p>
      </div>
      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={handleInstall}
          className="rounded-full bg-ramen-chili px-3 py-1 text-xs font-bold text-white hover:bg-ramen-chili/90"
        >
          追加
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          className="text-[10px] text-ramen-soy/60 hover:underline"
        >
          後で
        </button>
      </div>
    </div>
  );
}
