import { Link } from 'react-router-dom';
import type { AnswerRecord, QuizCategory, QuizQuestion } from '@/types/quiz';
import type { PhotoQuestion } from '@/types/photoQuestion';
import { AdBanner } from '@/components/common/AdBanner';
import { AffiliateBanner } from '@/components/common/AffiliateBanner';
import { ShareButtons } from '@/components/common/ShareButtons';
import { maxPossibleScore } from '@/lib/score';
import { CATEGORY_META } from '@/config/quizConfig';
import { buildSiteUrl } from '@/config/site';

/** 結果画面が扱える問題型 (知識クイズ / 写真当てクイズ)。 */
type AnyQuestion = QuizQuestion | PhotoQuestion;

interface ResultScreenProps {
  /** どのクイズタイプの結果か。 'photo' のときカテゴリは表示しない。 */
  quizType?: 'knowledge' | 'photo';
  questions: AnyQuestion[];
  answers: AnswerRecord[];
  onRetry: () => void;
  /** ログイン状態。未ログインのときは CTA を表示する。 */
  isLoggedIn?: boolean;
  /** 知識クイズのカテゴリ。シェア文に含めるために使う。 */
  category?: QuizCategory | null;
  /** ログイン中ユーザー名。シェア文に含める (任意)。 */
  username?: string | null;
}

export function ResultScreen({
  quizType = 'knowledge',
  questions,
  answers,
  onRetry,
  isLoggedIn = false,
  category = null,
  username = null,
}: ResultScreenProps): JSX.Element {
  const totalScore = answers.reduce((sum, a) => sum + a.pointsEarned, 0);
  const correctCount = answers.filter((a) => a.isCorrect).length;
  const maxScore = maxPossibleScore(questions.length);
  const rate = questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0;

  const categoryLabel =
    quizType === 'knowledge' && category
      ? CATEGORY_META.find((m) => m.category === category)?.label
      : null;
  const quizTypeLabel = quizType === 'photo' ? '写真当てクイズ' : 'ラーメンクイズ';
  const lines = [`🍜 ${quizTypeLabel}に挑戦！`];
  if (username) lines.push(`プレイヤー: ${username}`);
  if (categoryLabel) lines.push(`カテゴリ: ${categoryLabel}`);
  lines.push(`スコア: ${totalScore} / ${maxScore}`);
  lines.push('あなたもラーメン知識を試してみよう！');
  const shareText = lines.join('\n');
  const shareUrl = buildSiteUrl('/');

  return (
    <div className="space-y-6">
      <div className="card text-center">
        <p className="text-sm font-bold text-ramen-soy/60">あなたの結果</p>
        <p className="mt-2 text-5xl font-black text-ramen-chili">
          {totalScore}
          <span className="text-2xl text-ramen-soy/60"> / {maxScore} pt</span>
        </p>
        <p className="mt-3 text-base text-ramen-soy">
          正解 <span className="font-bold text-ramen-chili">{correctCount}</span> / {questions.length} 問
          （正解率 <span className="font-bold">{rate}%</span>）
        </p>
        <p className="mt-4 text-lg font-bold text-ramen-soy">{renderGrade(rate)}</p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button type="button" className="btn-primary" onClick={onRetry}>
            もう一度プレイ
          </button>
          <Link to="/" className="btn-secondary">
            トップに戻る
          </Link>
        </div>
        <div className="mt-6 border-t border-ramen-soy/10 pt-4">
          <p className="mb-3 text-xs font-bold text-ramen-soy/70">スコアをシェアする</p>
          <ShareButtons
            text={shareText}
            url={shareUrl}
            hashtags={['ラーメンクイズ', 'ラーメン愛好家']}
            ariaLabel="結果のシェア"
          />
        </div>
      </div>

      {!isLoggedIn ? (
        <div className="card border-2 border-dashed border-ramen-chili/40 bg-ramen-broth/10 text-center">
          <p className="text-base font-bold text-ramen-soy">
            アカウント作成でスコアをランキングに記録できます
          </p>
          <p className="mt-1 text-xs text-ramen-soy/70">
            登録項目は 4 つだけ。メールアドレス・実名は不要です。
          </p>
          <div className="mt-4 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link to="/signup" className="btn-primary">
              アカウント作成
            </Link>
            <Link to="/login" className="btn-secondary">
              ログイン
            </Link>
          </div>
        </div>
      ) : (
        <div className="card text-center text-sm text-ramen-soy/80">
          スコアを記録しました。{' '}
          <Link to="/ranking" className="font-bold text-ramen-chili hover:underline">
            ランキングを見る
          </Link>
        </div>
      )}

      {/* design §3.3: 結果画面 300x250 Medium Rectangle */}
      <AdBanner slot="result" size="medium-rectangle" />

      {/* AdSense 枠の少し下に「あわせて読みたい」感覚でアフィリエイトを配置。 */}
      <AffiliateBanner slot="result-bottom" />

      <div className="card">
        <h3 className="mb-3 text-lg font-bold text-ramen-soy">回答の振り返り</h3>
        <ol className="space-y-3 text-sm">
          {questions.map((q, idx) => {
            const a = answers[idx];
            const isCorrect = a?.isCorrect ?? false;
            return (
              <li
                key={q.id}
                className={`rounded-xl border p-3 ${
                  isCorrect ? 'border-emerald-300 bg-emerald-50/60' : 'border-ramen-chili/30 bg-ramen-chili/5'
                }`}
              >
                <p className="font-bold">
                  Q{idx + 1}. {q.question}
                </p>
                <p className="mt-1">
                  正解: <span className="font-bold">{q.options[q.answerIdx]}</span>
                </p>
                <p>
                  あなたの回答: {renderUserAnswer(q, a)}
                  <span className={`ml-2 font-bold ${isCorrect ? 'text-emerald-700' : 'text-ramen-chili'}`}>
                    {isCorrect ? '○ 正解' : '× 不正解'}
                  </span>
                </p>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

function renderGrade(rate: number): string {
  if (rate === 100) return '完璧！ラーメンマスター 🍜';
  if (rate >= 80) return 'すごい！ラーメン通ですね';
  if (rate >= 50) return 'いい感じ。もう一杯いきましょう';
  return '修行が必要です。再挑戦してみよう！';
}

function renderUserAnswer(question: AnyQuestion, record: AnswerRecord | undefined): string {
  if (!record) return '未回答';
  if (record.selectedIdx === null) return '時間切れ';
  return question.options[record.selectedIdx] ?? '不明';
}
