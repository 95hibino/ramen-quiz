/**
 * `OptionButton` の表示状態を判定する共通ロジック。
 * 知識クイズと写真当てクイズの両カード (QuizCard / PhotoQuizCard) から使う。
 */
export type OptionState =
  | 'idle'
  | 'selected'
  | 'correct'
  | 'wrong'
  | 'reveal-correct'
  | 'disabled';

export function resolveOptionState({
  optionIdx,
  answerIdx,
  selectedIdx,
  isAnswered,
}: {
  optionIdx: number;
  answerIdx: number;
  selectedIdx: number | null | 'timeout';
  isAnswered: boolean;
}): OptionState {
  if (!isAnswered) return 'idle';
  if (optionIdx === answerIdx) {
    // 回答済みなら必ず正解枠は強調
    return selectedIdx === answerIdx ? 'correct' : 'reveal-correct';
  }
  if (selectedIdx === optionIdx) {
    return 'wrong';
  }
  return 'disabled';
}
