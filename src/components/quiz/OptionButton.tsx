interface OptionButtonProps {
  index: number;
  label: string;
  /** 回答済みなら正解 / 不正解の色付けをする。null は未回答。 */
  state: 'idle' | 'selected' | 'correct' | 'wrong' | 'reveal-correct' | 'disabled';
  onClick: () => void;
}

const LETTERS = ['A', 'B', 'C', 'D'] as const;

const STATE_CLASS: Record<OptionButtonProps['state'], string> = {
  idle: 'border-ramen-soy/20 bg-white hover:border-ramen-chili hover:shadow-md',
  selected: 'border-ramen-chili bg-ramen-chili/10',
  correct: 'border-emerald-500 bg-emerald-50',
  wrong: 'border-ramen-chili bg-ramen-chili/10',
  'reveal-correct': 'border-emerald-500 bg-emerald-50',
  disabled: 'border-ramen-soy/10 bg-white/60 opacity-70',
};

export function OptionButton({ index, label, state, onClick }: OptionButtonProps): JSX.Element {
  const isClickable = state === 'idle';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!isClickable}
      className={`flex w-full items-start gap-3 rounded-xl border-2 px-4 py-3 text-left text-base font-medium transition active:scale-[0.99] disabled:cursor-not-allowed ${STATE_CLASS[state]}`}
    >
      <span className="mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-full bg-ramen-soy/10 text-sm font-black text-ramen-soy">
        {LETTERS[index] ?? index + 1}
      </span>
      <span className="flex-1 leading-relaxed text-ramen-nori">{label}</span>
    </button>
  );
}
