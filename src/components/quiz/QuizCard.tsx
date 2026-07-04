import type { QuizQuestion } from '@/types/quiz';
import { OptionButton } from './OptionButton';
import { resolveOptionState } from './optionState';
import { FavoriteButton } from './FavoriteButton';

interface QuizCardProps {
  question: QuizQuestion;
  /** ユーザーが選択した選択肢 (null = 未回答, 'timeout' = 時間切れ) */
  selectedIdx: number | null | 'timeout';
  /** 回答済みかどうか (時間切れ含む) */
  isAnswered: boolean;
  onSelect: (idx: number) => void;
}

export function QuizCard({ question, selectedIdx, isAnswered, onSelect }: QuizCardProps): JSX.Element {
  return (
    <div className="card space-y-5">
      <h2 className="text-lg font-bold leading-relaxed text-ramen-nori sm:text-xl">
        {question.question}
      </h2>
      <div className="grid gap-3">
        {question.options.map((opt, idx) => {
          const state = resolveOptionState({
            optionIdx: idx,
            answerIdx: question.answerIdx,
            selectedIdx,
            isAnswered,
          });
          return (
            <OptionButton
              key={idx}
              index={idx}
              label={opt}
              state={state}
              onClick={() => onSelect(idx)}
            />
          );
        })}
      </div>
      {isAnswered && question.explanation ? (
        <div className="rounded-xl border border-ramen-broth/40 bg-ramen-broth/10 p-4 text-sm leading-relaxed text-ramen-soy">
          <p className="mb-1 font-bold text-ramen-chili">解説</p>
          <p>{question.explanation}</p>
        </div>
      ) : null}
      {isAnswered ? (
        <div className="flex justify-end">
          <FavoriteButton quizType="knowledge" questionId={question.id} />
        </div>
      ) : null}
    </div>
  );
}

