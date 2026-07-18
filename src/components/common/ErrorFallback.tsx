/**
 * `Sentry.ErrorBoundary` の fallback UI。
 *
 * React 描画中に未捕捉の例外が発生した際、ホワイトスクリーンではなく
 * このコンポーネントが表示される。ユーザーは「再読み込み」でアプリを復旧できる。
 * Sentry にはエラー詳細が自動送信される (DSN 設定時のみ)。
 */
interface ErrorFallbackProps {
  /** Sentry.ErrorBoundary から渡される例外オブジェクト (未使用だが型互換のため受け取る)。 */
  error?: unknown;
  /** バウンダリの状態をリセットするコールバック (Sentry が提供)。 */
  resetError?: () => void;
}

export function ErrorFallback({ resetError }: ErrorFallbackProps): JSX.Element {
  const handleReload = () => {
    // 状態をリセットしたうえで location.reload。SPA 内リセットだけでは
    // ロード時に壊れた chunk が原因のエラーには復旧しないため強制リロード。
    if (resetError) resetError();
    window.location.reload();
  };

  return (
    <div className="mx-auto mt-16 max-w-md space-y-4 rounded-2xl border-2 border-ramen-chili/40 bg-ramen-chili/5 p-6 text-center">
      <p className="text-4xl" aria-hidden="true">
        🍜
      </p>
      <h1 className="text-xl font-black text-ramen-chili">問題が発生しました</h1>
      <p className="text-sm text-ramen-soy/80">
        画面の描画中にエラーが発生しました。ページを再読み込みしてお試しください。
        <br />
        繰り返す場合は、時間をおいて再度アクセスしてください。
      </p>
      <button type="button" onClick={handleReload} className="btn-primary">
        ページを再読み込み
      </button>
    </div>
  );
}
