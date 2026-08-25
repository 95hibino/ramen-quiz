/**
 * 復旧コードによるパスワード再設定ページ (`/password-reset`)。
 *
 * 本サービスはメールアドレスを取得しないため、メールでのリセットは提供できない。
 * 代わりに登録時に一度だけ発行した復旧コードで本人確認を行う。
 * 検証・パスワード更新はすべてサーバ側の SECURITY DEFINER 関数が担当する
 * (docs/SUPABASE_SETUP.md §23)。
 *
 * 成功すると新しい復旧コードが返るため、その場で控えてもらう。
 */
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Seo } from '@/components/common/Seo';
import { RecoveryCodePanel } from '@/components/account/RecoveryCodePanel';
import {
  compositeAuthRepository,
  isRecoveryCodeAvailable,
} from '@/lib/compositeAuthRepository';
import { validatePassword } from '@/lib/validation';

export function PasswordReset(): JSX.Element {
  const navigate = useNavigate();
  const available = isRecoveryCodeAvailable();

  const [username, setUsername] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  /** 再設定に成功したときに返る「新しい」復旧コード。 */
  const [nextCode, setNextCode] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (username.trim().length === 0) {
      setError('ユーザー名を入力してください。');
      return;
    }
    if (recoveryCode.trim().length === 0) {
      setError('復旧コードを入力してください。');
      return;
    }
    const passwordErr = validatePassword(newPassword);
    if (passwordErr) {
      setError(passwordErr);
      return;
    }

    setIsSubmitting(true);
    try {
      const issued = await compositeAuthRepository.resetPasswordWithRecoveryCode!({
        username,
        recoveryCode,
        newPassword,
      });
      setNextCode(issued);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'パスワードの再設定に失敗しました。');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (nextCode) {
    return (
      <div className="card mx-auto max-w-md space-y-5">
        <Seo title="パスワード再設定完了" description="パスワードを再設定しました。" url="/password-reset" noIndex />
        <div>
          <h1 className="text-2xl font-black text-ramen-soy">パスワードを再設定しました</h1>
          <p className="mt-2 text-xs text-ramen-soy/70">
            安全のため、すべての端末でログアウトされています。新しいパスワードでログインしてください。
          </p>
        </div>
        <RecoveryCodePanel
          code={nextCode}
          title="新しい復旧コード（この画面でのみ表示されます）"
          confirmLabel="控えたのでログインへ"
          onConfirm={() => navigate('/login', { replace: true })}
        />
        <p className="text-xs text-ramen-soy/60">
          いま使った古い復旧コードは無効になりました。次回に備えて、上のコードを控えてください。
        </p>
      </div>
    );
  }

  return (
    <div className="card mx-auto max-w-md space-y-5">
      <Seo
        title="パスワードの再設定"
        description="復旧コードを使ってラーメンクイズのパスワードを再設定します。"
        url="/password-reset"
        noIndex
      />
      <div>
        <h1 className="text-2xl font-black text-ramen-soy">パスワードの再設定</h1>
        <p className="mt-2 text-xs leading-relaxed text-ramen-soy/70">
          登録時に表示された<span className="font-bold">復旧コード</span>で本人確認を行います。
          本サービスはメールアドレスを取得していないため、メールでの再設定はできません。
        </p>
      </div>

      {!available ? (
        <p className="rounded-lg bg-ramen-chili/10 px-3 py-2 text-sm font-bold text-ramen-chili">
          現在この機能を利用できません。時間をおいてお試しください。
        </p>
      ) : null}

      <form className="space-y-4" onSubmit={handleSubmit} noValidate>
        <div className="space-y-1">
          <label htmlFor="reset-username" className="block text-sm font-bold text-ramen-soy">
            ユーザー名
          </label>
          <input
            id="reset-username"
            type="text"
            autoComplete="username"
            className="input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="reset-code" className="block text-sm font-bold text-ramen-soy">
            復旧コード
          </label>
          <input
            id="reset-code"
            type="text"
            className="input font-mono tracking-wider"
            placeholder="XXXX-XXXX-XXXX-XXXX-XXXX"
            value={recoveryCode}
            onChange={(e) => setRecoveryCode(e.target.value)}
            autoCapitalize="characters"
            spellCheck={false}
            required
          />
          <p className="text-xs text-ramen-soy/70">
            大文字・小文字とハイフンの有無は問いません。
          </p>
        </div>

        <div className="space-y-1">
          <label htmlFor="reset-password" className="block text-sm font-bold text-ramen-soy">
            新しいパスワード (8文字以上)
          </label>
          <input
            id="reset-password"
            type="password"
            autoComplete="new-password"
            className="input"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
          />
        </div>

        {error ? (
          <p className="rounded-lg bg-ramen-chili/10 px-3 py-2 text-sm font-bold text-ramen-chili">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          className="btn-primary w-full"
          disabled={isSubmitting || !available}
          aria-disabled={isSubmitting || !available}
        >
          {isSubmitting ? '再設定中...' : 'パスワードを再設定する'}
        </button>
      </form>

      <div className="space-y-1 text-center text-xs text-ramen-soy/70">
        <p>
          <Link to="/login" className="font-bold text-ramen-chili hover:underline">
            ログイン画面へ戻る
          </Link>
        </p>
        <p>
          復旧コードも分からない場合、アカウントを復旧する手段はありません。
          お手数ですが新しいユーザー名で登録し直してください。
        </p>
      </div>
    </div>
  );
}
