import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Seo } from '@/components/common/Seo';
import { OPERATOR_CONTACT } from '@/content/legalMeta';
import {
  ContactRateLimitError,
  isContactRepositoryReady,
  submitContact,
} from '@/lib/supabaseContactRepository';
import {
  CONTACT_BODY_MAX,
  CONTACT_BODY_MIN,
  CONTACT_CATEGORIES,
  CONTACT_CATEGORY_LABELS,
  CONTACT_EMAIL_MAX,
  CONTACT_NAME_MAX,
  isContactCategory,
  validateContactBody,
  validateContactEmail,
  validateContactName,
  type ContactCategory,
} from '@/lib/validation';

interface FormErrors {
  name?: string;
  email?: string;
  category?: string;
  body?: string;
  form?: string;
}

type SubmitState = 'idle' | 'submitting' | 'success' | 'error';

/**
 * お問い合わせフォームページ (`/contact`)。
 *
 * - ログイン不要
 * - Supabase 未接続時は送信フォームを非表示にし、直接連絡先を案内する
 * - メールアドレス入力時は DB トリガーで「同アドレスから 1 時間 1 件」のレート制限
 */
export function Contact(): JSX.Element {
  const supabaseReady = useMemo(() => isContactRepositoryReady(), []);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [category, setCategory] = useState<ContactCategory | ''>('');
  const [body, setBody] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitState, setSubmitState] = useState<SubmitState>('idle');
  const [toast, setToast] = useState<string | null>(null);

  // リアルタイムバリデーション
  useEffect(() => {
    const next: FormErrors = {};
    const nameErr = validateContactName(name);
    if (nameErr) next.name = nameErr;
    const emailErr = validateContactEmail(email);
    if (emailErr) next.email = emailErr;
    if (category === '' || !isContactCategory(category)) {
      next.category = 'お問い合わせ種別を選択してください。';
    }
    const bodyErr = validateContactBody(body);
    if (bodyErr) next.body = bodyErr;
    setErrors(next);
  }, [name, email, category, body]);

  // 送信成功後に入力が再開されたら success 状態を解除して再送信できるようにする
  useEffect(() => {
    if (submitState === 'success' && (name || email || category || body)) {
      setSubmitState('idle');
    }
  }, [submitState, name, email, category, body]);

  const hasFieldErrors = Object.keys(errors).length > 0;
  const canSubmit = !hasFieldErrors && supabaseReady && submitState !== 'submitting';

  // トーストを 3 秒で自動消去
  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(id);
  }, [toast]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // 念のため送信直前にも再バリデーション
    if (hasFieldErrors || !isContactCategory(category)) {
      return;
    }
    if (!supabaseReady) {
      setErrors({ form: 'Supabase が未接続のため送信できません。' });
      return;
    }

    setSubmitState('submitting');
    setErrors((prev) => ({ ...prev, form: undefined }));

    try {
      await submitContact({
        name: name.trim() ? name.trim() : undefined,
        email: email.trim() ? email.trim() : undefined,
        category,
        body: body.trim(),
      });
      setSubmitState('success');
      setToast('お問い合わせを受け付けました');
      // 成功後はフォームをリセット (連続送信を視覚的に分かりやすく)
      setName('');
      setEmail('');
      setCategory('');
      setBody('');
    } catch (err) {
      let message: string;
      if (err instanceof ContactRateLimitError) {
        message = formatRateLimitMessage(err.retryAfterSeconds);
      } else {
        message = err instanceof Error ? err.message : '送信に失敗しました。';
      }
      setErrors((prev) => ({ ...prev, form: message }));
      setSubmitState('error');
    }
  };

  return (
    <div className="space-y-6">
      <Seo
        title="お問い合わせ"
        description="ラーメンクイズへのバグ報告・機能要望・削除依頼などのお問い合わせフォームです。"
        url="/contact"
      />

      <div className="card space-y-3">
        <h1 className="text-2xl font-black text-ramen-soy">お問い合わせ</h1>
        <p className="text-sm text-ramen-soy/80">
          バグ報告・機能要望・著作権や削除のご依頼などを以下のフォームからお送りください。
          ログインは不要です。
        </p>
        <p className="text-xs text-ramen-soy/70">
          ご返信が必要な場合は、メールアドレスをご入力ください。
          同じメールアドレスからのお問い合わせは <span className="font-bold">1 時間に 1 件まで</span>に制限しています。
        </p>
      </div>

      {!supabaseReady ? (
        <div className="card border-2 border-ramen-chili/40 bg-ramen-chili/5 space-y-2">
          <p className="text-sm font-bold text-ramen-chili">送信機能は準備中です</p>
          <p className="text-xs text-ramen-soy/80">
            お手数ですが、直接 <span className="font-bold">{OPERATOR_CONTACT}</span> までご連絡ください。
          </p>
          <p className="text-xs text-ramen-soy/60">
            （Supabase 未接続のため、フォーム送信を一時的に停止しています）
          </p>
        </div>
      ) : (
        <form className="card space-y-5" onSubmit={handleSubmit} noValidate>
          <FormField id="contact-name" label={`お名前 (任意, ${name.length}/${CONTACT_NAME_MAX})`} error={errors.name}>
            <input
              id="contact-name"
              type="text"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={CONTACT_NAME_MAX + 5}
              autoComplete="name"
            />
          </FormField>

          <FormField
            id="contact-email"
            label={`メールアドレス (任意, ${email.length}/${CONTACT_EMAIL_MAX})`}
            error={errors.email}
            hint="ご返信を希望される場合のみご入力ください。"
          >
            <input
              id="contact-email"
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={CONTACT_EMAIL_MAX + 5}
              autoComplete="email"
              placeholder="example@example.com"
            />
          </FormField>

          <FormField id="contact-category" label="お問い合わせ種別 (必須)" error={errors.category}>
            <select
              id="contact-category"
              className="input"
              value={category}
              onChange={(e) => setCategory(e.target.value as ContactCategory | '')}
              required
            >
              <option value="">選択してください</option>
              {CONTACT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CONTACT_CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </FormField>

          <FormField
            id="contact-body"
            label={`お問い合わせ内容 (必須, ${body.length}/${CONTACT_BODY_MAX})`}
            error={errors.body}
            hint={`${CONTACT_BODY_MIN}〜${CONTACT_BODY_MAX} 字でご入力ください。`}
          >
            <textarea
              id="contact-body"
              className="input min-h-[8rem]"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={CONTACT_BODY_MAX + 50}
              rows={7}
              required
            />
          </FormField>

          {errors.form ? (
            <p className="rounded-lg bg-ramen-chili/10 px-3 py-2 text-sm font-bold text-ramen-chili">
              {errors.form}
            </p>
          ) : null}

          {submitState === 'success' ? (
            <p
              role="status"
              className="rounded-lg bg-ramen-broth/20 px-3 py-2 text-sm font-bold text-ramen-soy"
            >
              お問い合わせを受け付けました。ご返信が必要な場合は、お時間をいただく場合があります。
            </p>
          ) : null}

          <div className="flex flex-col items-center gap-3">
            <button type="submit" className="btn-primary w-full sm:w-auto" disabled={!canSubmit}>
              {submitState === 'submitting' ? '送信中...' : '送信する'}
            </button>
            <Link to="/" className="text-xs text-ramen-soy/70 hover:underline">
              ← トップへ戻る
            </Link>
          </div>
        </form>
      )}

      {toast ? (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 rounded-full bg-ramen-soy px-6 py-3 text-sm font-bold text-white shadow-xl"
        >
          {toast}
        </div>
      ) : null}
    </div>
  );
}

/**
 * レート制限時の残り秒数を「あと N 分 M 秒」形式に整形する。
 * - 60 秒未満: 「あと N 秒」
 * - それ以外: 「あと N 分 (M 秒)」
 */
function formatRateLimitMessage(retryAfterSeconds: number): string {
  const total = Math.max(1, Math.ceil(retryAfterSeconds));
  if (total < 60) {
    return `同じメールアドレスからは 1 時間に 1 件までお送りいただけます。あと ${total} 秒お待ちください。`;
  }
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  const remainder = seconds > 0 ? ` ${seconds} 秒` : '';
  return `同じメールアドレスからは 1 時間に 1 件までお送りいただけます。あと ${minutes} 分${remainder}お待ちください。`;
}

interface FormFieldProps {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}

function FormField({ id, label, error, hint, children }: FormFieldProps): JSX.Element {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-bold text-ramen-soy">
        {label}
      </label>
      {children}
      {hint && !error ? <p className="text-xs text-ramen-soy/60">{hint}</p> : null}
      {error ? <p className="text-xs font-bold text-ramen-chili">{error}</p> : null}
    </div>
  );
}
