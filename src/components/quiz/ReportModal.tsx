import { useEffect, useState, type FormEvent } from 'react';
import { submitReport } from '@/lib/supabaseReportRepository';
import {
  REPORT_BODY_MAX,
  REPORT_REASONS,
  REPORT_REASON_LABELS,
  isReportReason,
  validateReportBody,
  type ReportReason,
} from '@/lib/validation';

/** モーダル状態。 */
type SubmitState = 'idle' | 'submitting' | 'success' | 'error';

interface ReportModalProps {
  /** 通報対象の問題 ID (`user_photo_questions.id`)。 */
  questionId: string;
  /** モーダルを閉じるコールバック。 */
  onClose: () => void;
  /** 送信成功時に親に通知するコールバック (トースト表示用)。 */
  onSubmitted: (message: string) => void;
}

/**
 * 写真クイズの問題を通報するモーダル。
 *
 * - ログイン不要
 * - 通報理由 select (必須) + 自由記述 (任意, 最大 500 字)
 * - 送信ボタン + キャンセル
 * - Esc キーで閉じる、背景クリックで閉じる
 * - 同じ画像への重複通報は許容 (DB 側で UNIQUE 制約なし)
 */
export function ReportModal({ questionId, onClose, onSubmitted }: ReportModalProps): JSX.Element {
  const [reason, setReason] = useState<ReportReason | ''>('');
  const [body, setBody] = useState('');
  const [bodyError, setBodyError] = useState<string | null>(null);
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [submitState, setSubmitState] = useState<SubmitState>('idle');
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Esc キーで閉じる
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // body のリアルタイムバリデーション
  useEffect(() => {
    setBodyError(validateReportBody(body));
  }, [body]);

  const canSubmit =
    reason !== '' && isReportReason(reason) && !bodyError && submitState !== 'submitting';

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (reason === '' || !isReportReason(reason)) {
      setReasonError('通報理由を選択してください。');
      return;
    }
    setReasonError(null);
    if (bodyError) return;

    setSubmitState('submitting');
    setSubmitError(null);
    try {
      await submitReport({
        questionId,
        reason,
        body: body.trim() ? body.trim() : undefined,
      });
      setSubmitState('success');
      onSubmitted('通報を受け付けました。対応まで時間がかかる場合があります');
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : '通報に失敗しました。';
      setSubmitError(message);
      setSubmitState('error');
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="card w-full max-w-md space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id="report-modal-title" className="text-lg font-black text-ramen-soy">
            この問題を通報
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            className="text-ramen-soy/60 transition hover:text-ramen-chili"
          >
            ✕
          </button>
        </div>

        <p className="text-xs text-ramen-soy/70">
          対象問題 ID: <code className="rounded bg-ramen-broth/20 px-1">{questionId}</code>
        </p>

        <form className="space-y-4" onSubmit={handleSubmit} noValidate>
          <div className="space-y-1">
            <label htmlFor="report-reason" className="block text-sm font-bold text-ramen-soy">
              通報理由 (必須)
            </label>
            <select
              id="report-reason"
              className="input"
              value={reason}
              onChange={(e) => setReason(e.target.value as ReportReason | '')}
              required
            >
              <option value="">選択してください</option>
              {REPORT_REASONS.map((r) => (
                <option key={r} value={r}>
                  {REPORT_REASON_LABELS[r]}
                </option>
              ))}
            </select>
            {reasonError ? (
              <p className="text-xs font-bold text-ramen-chili">{reasonError}</p>
            ) : null}
          </div>

          <div className="space-y-1">
            <label htmlFor="report-body" className="block text-sm font-bold text-ramen-soy">
              補足 (任意, {body.length}/{REPORT_BODY_MAX})
            </label>
            <textarea
              id="report-body"
              className="input min-h-[5rem]"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={REPORT_BODY_MAX + 20}
              rows={4}
              placeholder="状況をなるべく具体的にお書きください (任意)"
            />
            {bodyError ? (
              <p className="text-xs font-bold text-ramen-chili">{bodyError}</p>
            ) : null}
          </div>

          {submitError ? (
            <p className="rounded-lg bg-ramen-chili/10 px-3 py-2 text-xs font-bold text-ramen-chili">
              {submitError}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="text-sm font-bold text-ramen-soy/70 hover:text-ramen-chili hover:underline"
            >
              キャンセル
            </button>
            <button type="submit" className="btn-primary" disabled={!canSubmit}>
              {submitState === 'submitting' ? '送信中...' : '通報する'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
