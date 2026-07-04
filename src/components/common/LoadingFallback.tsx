/**
 * Suspense 中に表示する軽量なローディングフォールバック。
 * Route-based code splitting (React.lazy) と組み合わせて、
 * ページ chunk のダウンロード中に一瞬表示される。
 *
 * デザイン方針:
 * - 最低 min-h を確保して CLS (Cumulative Layout Shift) を防ぐ
 * - 既存のカード風スタイル (bg-white / rounded / border-ramen-soy) に統一
 * - Tailwind の animate-pulse でシンプルなアニメーション (追加ライブラリ不要)
 */
export function LoadingFallback(): JSX.Element {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="flex min-h-[60vh] items-center justify-center px-4"
    >
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-ramen-soy/10 bg-white/70 px-8 py-6 text-ramen-soy shadow-sm">
        <span aria-hidden="true" className="animate-pulse text-4xl">
          🍜
        </span>
        <p className="text-sm font-semibold">読み込み中...</p>
      </div>
    </div>
  );
}
