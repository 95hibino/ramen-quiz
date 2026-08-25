import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PREFECTURES, type Prefecture, isValidPrefecture } from '@/data/prefectures';
import {
  FAVORITE_SHOP_MAX,
  PASSWORD_MIN,
  USERNAME_MAX,
  USERNAME_MIN,
  validateFavoriteShop,
  validatePassword,
  validatePrefecture,
  validateUsername,
} from '@/lib/validation';
import { useAuthStore } from '@/stores/authStore';
import { Seo } from '@/components/common/Seo';
import { RecoveryCodePanel } from '@/components/account/RecoveryCodePanel';
import {
  compositeAuthRepository,
  isRecoveryCodeAvailable,
} from '@/lib/compositeAuthRepository';

interface FormErrors {
  username?: string;
  password?: string;
  prefecture?: string;
  favoriteShop?: string;
  form?: string;
}

/**
 * 新規アカウント登録ページ。
 * 個人情報 (メール・実名・電話番号) は一切収集しない設計。
 */
export function Signup(): JSX.Element {
  const navigate = useNavigate();
  const signup = useAuthStore((s) => s.signup);
  const status = useAuthStore((s) => s.status);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [prefecture, setPrefecture] = useState<string>('');
  const [favoriteShop, setFavoriteShop] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});

  /**
   * 登録成功後に一度だけ表示する復旧コード。
   * これが入るとフォームを畳んで復旧コード画面に切り替える。
   */
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);
  /** 復旧コードの発行だけ失敗した場合の案内 (アカウント作成自体は成功している)。 */
  const [recoveryError, setRecoveryError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const next: FormErrors = {};
    const usernameErr = validateUsername(username);
    if (usernameErr) next.username = usernameErr;
    const passwordErr = validatePassword(password);
    if (passwordErr) next.password = passwordErr;
    const prefectureErr = validatePrefecture(prefecture);
    if (prefectureErr) next.prefecture = prefectureErr;
    const favoriteShopErr = validateFavoriteShop(favoriteShop);
    if (favoriteShopErr) next.favoriteShop = favoriteShopErr;

    if (Object.keys(next).length > 0) {
      setErrors(next);
      return;
    }

    if (!isValidPrefecture(prefecture)) {
      setErrors({ prefecture: '都道府県の選択が不正です。' });
      return;
    }

    try {
      await signup({
        username: username.trim(),
        password,
        prefecture: prefecture as Prefecture,
        favoriteShop: favoriteShop.trim(),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : '登録に失敗しました。';
      setErrors({ form: message });
      return;
    }

    // アカウント作成は成功済み。ここから先で失敗しても登録自体は取り消さない。
    // 復旧コードはマイページからいつでも再発行できるので、案内だけ出して先へ進める。
    if (!isRecoveryCodeAvailable()) {
      navigate('/', { replace: true });
      return;
    }
    try {
      setRecoveryCode(await compositeAuthRepository.issueRecoveryCode!());
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      setRecoveryError(
        `アカウントは作成できましたが、復旧コードの発行に失敗しました${message ? ` (${message})` : ''}。マイページからあらためて発行してください。`,
      );
    }
  };

  const isSubmitting = status === 'loading';

  // 登録完了後は入力フォームを畳み、復旧コードの提示だけを行う画面に切り替える。
  if (recoveryCode || recoveryError) {
    return (
      <div className="card mx-auto max-w-md space-y-5">
        <Seo title="登録完了" description="アカウント登録が完了しました。" url="/signup" noIndex />
        <div>
          <h1 className="text-2xl font-black text-ramen-soy">登録が完了しました</h1>
          <p className="mt-2 text-xs text-ramen-soy/70">
            最後に、パスワードを忘れたとき用の復旧コードを控えてください。
          </p>
        </div>
        {recoveryCode ? (
          <RecoveryCodePanel
            code={recoveryCode}
            title="復旧コード（この画面でのみ表示されます）"
            confirmLabel="控えたので始める"
            onConfirm={() => navigate('/', { replace: true })}
          />
        ) : (
          <>
            <p className="rounded-lg bg-ramen-chili/10 px-3 py-2 text-sm font-bold text-ramen-chili">
              {recoveryError}
            </p>
            <button
              type="button"
              className="btn-primary w-full"
              onClick={() => navigate('/', { replace: true })}
            >
              ホームへ
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="card mx-auto max-w-md space-y-5">
      <Seo
        title="新規アカウント登録"
        description="ラーメンクイズの新規アカウント登録ページ。メール・実名は不要、ユーザー名とパスワードだけで開始できます。"
        url="/signup"
        noIndex
      />
      <div>
        <h1 className="text-2xl font-black text-ramen-soy">新規アカウント登録</h1>
        <p className="mt-2 text-xs text-ramen-soy/70">
          メール・実名は不要。ユーザー名とパスワードだけで始められます。
        </p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit} noValidate>
        <FormField
          id="signup-username"
          label={`ユーザー名 (${USERNAME_MIN}-${USERNAME_MAX}字)`}
          error={errors.username}
          hint="英数字・ひらがな・カタカナ・漢字と _ - が使えます。他の人と同じ名前は登録できません (大文字小文字・全角半角は区別しません)。"
        >
          <input
            id="signup-username"
            type="text"
            autoComplete="username"
            className="input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            maxLength={USERNAME_MAX + 5}
            required
          />
        </FormField>

        <FormField
          id="signup-password"
          label={`パスワード (${PASSWORD_MIN}文字以上)`}
          error={errors.password}
        >
          <input
            id="signup-password"
            type="password"
            autoComplete="new-password"
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={PASSWORD_MIN}
          />
        </FormField>

        <FormField id="signup-prefecture" label="都道府県" error={errors.prefecture}>
          <select
            id="signup-prefecture"
            className="input"
            value={prefecture}
            onChange={(e) => setPrefecture(e.target.value)}
            required
          >
            <option value="">選択してください</option>
            {PREFECTURES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </FormField>

        <FormField
          id="signup-shop"
          label={`好きなラーメン店 (1-${FAVORITE_SHOP_MAX}字)`}
          error={errors.favoriteShop}
        >
          <input
            id="signup-shop"
            type="text"
            className="input"
            value={favoriteShop}
            onChange={(e) => setFavoriteShop(e.target.value)}
            maxLength={FAVORITE_SHOP_MAX + 5}
            placeholder="例) 一蘭、家系本店"
            required
          />
        </FormField>

        {errors.form ? (
          <p className="rounded-lg bg-ramen-chili/10 px-3 py-2 text-sm font-bold text-ramen-chili">
            {errors.form}
          </p>
        ) : null}

        <button type="submit" className="btn-primary w-full" disabled={isSubmitting}>
          {isSubmitting ? '登録中...' : 'アカウントを作成'}
        </button>
      </form>

      <p className="text-center text-xs text-ramen-soy/70">
        すでにアカウントをお持ちですか?{' '}
        <Link to="/login" className="font-bold text-ramen-chili hover:underline">
          ログイン
        </Link>
      </p>
    </div>
  );
}

interface FormFieldProps {
  id: string;
  label: string;
  error?: string;
  /** 入力欄の下に出す補足説明 (入力規則など)。エラー表示中は隠す。 */
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
      {error ? (
        <p className="text-xs font-bold text-ramen-chili">{error}</p>
      ) : hint ? (
        <p className="text-xs text-ramen-soy/70">{hint}</p>
      ) : null}
    </div>
  );
}
