interface ScoreBarProps {
  currentIndex: number;
  totalQuestions: number;
  currentScore: number;
}

/** プレイ画面上部の進捗 + 現在スコア表示。 */
export function ScoreBar({ currentIndex, totalQuestions, currentScore }: ScoreBarProps): JSX.Element {
  const displayed = Math.min(currentIndex + 1, totalQuestions);
  return (
    <div className="flex items-center justify-between text-sm font-bold text-ramen-soy">
      <span>
        問題 <span className="text-lg text-ramen-chili">{displayed}</span> / {totalQuestions}
      </span>
      <span>
        スコア <span className="text-lg text-ramen-chili">{currentScore}</span> pt
      </span>
    </div>
  );
}
