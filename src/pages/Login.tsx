import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { Seo } from '@/components/common/Seo';

/** ログインページ。 */
export function Login(): JSX.Element {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const status = useAuthStore((s) => s.status);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage(null);
    try {
      await login({ username, password });
      navigate('/', { replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'ログインに失敗しました。';
      setErrorMessage(message);
    }
  };

  const isSubmitting = status === 'loading';

  return (
    <div className="card mx-auto max-w-md space-y-5">
      <Seo
        title="ログイン"
        description="ラーメンクイズにログインしてスコアを記録しよう。"
        url="/login"
        noIndex
      />
      <h1 className="text-2xl font-black text-ramen-soy">ログイン</h1>

      <form className="space-y-4" onSubmit={handleSubmit} noValidate>
        <div className="space-y-1">
          <label htmlFor="login-username" className="block text-sm font-bold text-ramen-soy">
            ユーザー名
          </label>
          <input
            id="login-username"
            type="text"
            autoComplete="username"
            className="input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="login-password" className="block text-sm font-bold text-ramen-soy">
            パスワード
          </label>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        {errorMessage ? (
          <p className="rounded-lg bg-ramen-chili/10 px-3 py-2 text-sm font-bold text-ramen-chili">
            {errorMessage}
          </p>
        ) : null}

        <button type="submit" className="btn-primary w-full" disabled={isSubmitting}>
          {isSubmitting ? '認証中...' : 'ログイン'}
        </button>
      </form>

      <p className="text-center text-xs text-ramen-soy/70">
        アカウントをお持ちでないですか?{' '}
        <Link to="/signup" className="font-bold text-ramen-chili hover:underline">
          新規登録
        </Link>
      </p>
    </div>
  );
}
