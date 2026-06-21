import { useCallback, useEffect, useState } from 'react';
import {
  buildFacebookShareUrl,
  buildLineShareUrl,
  buildXShareUrl,
  copyTextToClipboard,
} from '@/lib/shareUrls';

/**
 * SNS シェアボタン群。
 *
 * 対応: X (Twitter) / Facebook / LINE / リンクコピー。
 * Web Share API が利用可能なブラウザ (主にモバイル) ではネイティブシェアボタンも併記する。
 *
 * URL 構築ロジックは `@/lib/shareUrls` の純粋関数に委譲。
 * このコンポーネントは表示・トースト・クリップボード操作のみを担当する。
 *
 * design §Phase 2 SNS シェア機能。
 */
export interface ShareButtonsProps {
  /** シェアテキスト本文。X / LINE / Web Share API で使用。 */
  text: string;
  /** シェア対象 URL (絶対 URL)。 */
  url: string;
  /** ハッシュタグ (X用、`#` なしの文字列配列)。 */
  hashtags?: string[];
  /** 見出し (aria-label グループ用)。 */
  ariaLabel?: string;
}

/** コピー完了トーストの表示時間 (ms)。design 要件: 2 秒。 */
const COPY_TOAST_DURATION_MS = 2000;

export function ShareButtons({
  text,
  url,
  hashtags = [],
  ariaLabel = 'SNS シェア',
}: ShareButtonsProps): JSX.Element {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const [supportsWebShare, setSupportsWebShare] = useState(false);

  useEffect(() => {
    // navigator.share は HTTPS + 対応端末のみ。マウント後に判定し、
    // SSR や非対応端末では Web Share ボタンを非表示にする。
    setSupportsWebShare(typeof navigator !== 'undefined' && typeof navigator.share === 'function');
  }, []);

  // コピー完了トーストの自動消滅。
  useEffect(() => {
    if (!copied && !copyFailed) return;
    const timer = window.setTimeout(() => {
      setCopied(false);
      setCopyFailed(false);
    }, COPY_TOAST_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [copied, copyFailed]);

  const xUrl = buildXShareUrl({ text, url, hashtags });
  const facebookUrl = buildFacebookShareUrl({ url });
  const lineUrl = buildLineShareUrl({ text, url });

  const handleCopy = useCallback(async () => {
    const ok = await copyTextToClipboard(url);
    if (ok) {
      setCopyFailed(false);
      setCopied(true);
    } else {
      setCopied(false);
      setCopyFailed(true);
    }
  }, [url]);

  const handleWebShare = useCallback(async () => {
    if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') return;
    try {
      await navigator.share({ text, url });
    } catch {
      // ユーザーキャンセル時は AbortError。無視。
    }
  }, [text, url]);

  return (
    <div role="group" aria-label={ariaLabel} className="space-y-2">
      <div className="flex flex-wrap items-center justify-center gap-3">
        <a
          href={xUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="X (Twitter) でシェア"
          className="inline-flex items-center gap-2 rounded-xl bg-black px-4 py-2 text-sm font-bold text-white shadow-md transition hover:brightness-125 active:scale-95"
        >
          <XIcon />
          <span>X</span>
        </a>

        <a
          href={facebookUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Facebook でシェア"
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold text-white shadow-md transition hover:brightness-110 active:scale-95"
          style={{ backgroundColor: '#1877F2' }}
        >
          <FacebookIcon />
          <span>Facebook</span>
        </a>

        <a
          href={lineUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="LINE でシェア"
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold text-white shadow-md transition hover:brightness-110 active:scale-95"
          style={{ backgroundColor: '#06C755' }}
        >
          <LineIcon />
          <span>LINE</span>
        </a>

        <button
          type="button"
          onClick={handleCopy}
          aria-label="リンクをコピー"
          className="inline-flex items-center gap-2 rounded-xl bg-ramen-soy/70 px-4 py-2 text-sm font-bold text-white shadow-md transition hover:bg-ramen-soy/90 active:scale-95"
        >
          <CopyIcon />
          <span>リンクをコピー</span>
        </button>

        {supportsWebShare ? (
          <button
            type="button"
            onClick={handleWebShare}
            aria-label="共有メニューを開く"
            className="inline-flex items-center gap-2 rounded-xl border-2 border-ramen-soy/30 bg-white px-4 py-2 text-sm font-bold text-ramen-soy shadow-md transition hover:bg-ramen-soy/5 active:scale-95"
          >
            <ShareIcon />
            <span>シェア</span>
          </button>
        ) : null}
      </div>

      {/* スクリーンリーダ向けライブリージョン + 視覚トースト。 */}
      <div
        aria-live="polite"
        role="status"
        className={`text-center text-xs font-bold transition-opacity ${
          copied ? 'text-emerald-600 opacity-100' : copyFailed ? 'text-ramen-chili opacity-100' : 'opacity-0'
        }`}
      >
        {copied ? 'リンクをコピーしました' : copyFailed ? 'コピーに失敗しました' : ''}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------------
 * Brand icons (インライン SVG。外部ライブラリ依存禁止のため自作)
 * ------------------------------------------------------------------------ */

function XIcon(): JSX.Element {
  // X (旧 Twitter) ロゴ。currentColor で塗る。
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zM17.083 19.77h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function FacebookIcon(): JSX.Element {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.879v-6.987H7.898V12h2.54V9.797c0-2.507 1.493-3.891 3.776-3.891 1.094 0 2.238.195 2.238.195v2.46H15.19c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.892h-2.33v6.987C18.343 21.128 22 16.99 22 12z" />
    </svg>
  );
}

function LineIcon(): JSX.Element {
  // LINE 公式風シンプルロゴ (吹き出し+L)。
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.348 0 .63.283.63.63 0 .344-.282.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.4-.09-.527-.264l-2.443-3.318v2.95c0 .349-.279.633-.631.633-.346 0-.626-.284-.626-.633V8.108c0-.27.173-.51.43-.596.06-.022.131-.033.197-.033.207 0 .395.099.526.273l2.443 3.317V8.108c0-.345.282-.63.631-.63.345 0 .63.285.63.63zm-5.741 0c0 .349-.282.633-.631.633-.345 0-.627-.284-.627-.633V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63zm-2.466.633h-2.386c-.346 0-.627-.285-.627-.633V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v3.272h1.755c.348 0 .63.282.63.63 0 .345-.282.63-.63.63M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
    </svg>
  );
}

function CopyIcon(): JSX.Element {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function ShareIcon(): JSX.Element {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );
}
