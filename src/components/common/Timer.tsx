interface TimerProps {
  remainingSec: number;
  totalSec: number;
}

/** クイズ画面用のカウントダウンタイマー UI (バー + 数字)。 */
export function Timer({ remainingSec, totalSec }: TimerProps): JSX.Element {
  const ratio = totalSec > 0 ? Math.max(0, Math.min(1, remainingSec / totalSec)) : 0;
  const percent = Math.round(ratio * 100);
  const isDanger = remainingSec <= 5;

  return (
    <div
      className="w-full"
      role="timer"
      aria-live="polite"
      aria-label={`残り ${remainingSec} 秒`}
    >
      <div className="mb-1 flex items-center justify-between text-sm font-bold">
        <span className="text-ramen-soy/70">残り時間</span>
        <span className={isDanger ? 'text-ramen-chili' : 'text-ramen-soy'}>
          {remainingSec}s
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-ramen-soy/10">
        <div
          className={`h-full transition-[width] duration-1000 ease-linear ${
            isDanger ? 'bg-ramen-chili' : 'bg-ramen-broth'
          }`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
