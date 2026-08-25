/**
 * マイページの「復旧コード」セクション。
 *
 * §23 導入より前に登録した利用者は復旧コードを持っていないため、ここから発行してもらう。
 * 紛失した場合の再発行もここで行う (発行するたびに古いコードは無効になる)。
 *
 * サーバは bcrypt ハッシュしか保持しないので、いま持っているコードが有効かどうかは
 * 画面からは判定できない。そのため「発行済みかどうか」ではなく
 * 「いつでも作り直せる」という見せ方にしている。
 */
import { useState } from 'react';
import { RecoveryCodePanel } from '@/components/account/RecoveryCodePanel';
import {
  compositeAuthRepository,
  isRecoveryCodeAvailable,
} from '@/lib/compositeAuthRepository';

export function RecoverySection(): JSX.Element | null {
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isIssuing, setIsIssuing] = useState(false);
  const [confirming, setConfirming] = useState(false);

  // Supabase 未接続 (オフライン開発) では機能自体を出さない
  if (!isRecoveryCodeAvailable()) return null;

  const handleIssue = async () => {
    setError(null);
    setIsIssuing(true);
    try {
      setCode(await compositeAuthRepository.issueRecoveryCode!());
      setConfirming(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : '復旧コードの発行に失敗しました。');
    } finally {
      setIsIssuing(false);
    }
  };

  return (
    <section className="card space-y-3">
      <h2 className="text-lg font-bold text-ramen-soy">復旧コード</h2>
      <p className="text-sm leading-relaxed text-ramen-soy/80">
        パスワードを忘れたときに、パスワードを再設定するためのコードです。
        本サービスはメールアドレスを取得していないため、
        <span className="font-bold">復旧コードが唯一の復旧手段</span>になります。
        控えていない場合や紛失した場合は、ここで新しく発行してください。
      </p>

      {code ? (
        <RecoveryCodePanel code={code} title="新しい復旧コード（この画面でのみ表示されます）" />
      ) : confirming ? (
        <div className="space-y-3 rounded-2xl border border-ramen-chili/40 bg-ramen-chili/5 p-4">
          <p className="text-sm font-bold text-ramen-chili">
            新しいコードを発行すると、いま持っている復旧コードは使えなくなります。
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-primary text-sm"
              onClick={handleIssue}
              disabled={isIssuing}
              aria-disabled={isIssuing}
            >
              {isIssuing ? '発行中...' : '発行する'}
            </button>
            <button
              type="button"
              className="btn-secondary text-sm"
              onClick={() => setConfirming(false)}
              disabled={isIssuing}
            >
              やめる
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="btn-secondary text-sm" onClick={() => setConfirming(true)}>
          復旧コードを発行する
        </button>
      )}

      {error ? (
        <p className="rounded-lg bg-ramen-chili/10 px-3 py-2 text-sm font-bold text-ramen-chili">
          {error}
        </p>
      ) : null}
    </section>
  );
}
