/**
 * 復旧コードを利用者に 1 回だけ提示するための共通 UI。
 *
 * サーバ (`issue_recovery_code`) は bcrypt ハッシュしか保存しないため、
 * ここで表示している文字列を閉じてしまうと二度と取得できない。
 * そのため「控えた」チェックを入れるまで次の操作へ進めない作りにしている。
 *
 * docs/SUPABASE_SETUP.md §23 参照。
 */
import { useId, useState } from 'react';

interface RecoveryCodePanelProps {
  /** 表示する平文の復旧コード。 */
  code: string;
  /** 見出し。文脈に応じて差し替える。 */
  title?: string;
  /**
   * 「控えた」チェックが入ったときに押せるボタンのラベル。
   * 省略するとボタン自体を出さない (チェックだけさせたい画面用)。
   */
  confirmLabel?: string;
  /** confirmLabel のボタンを押したときの処理。 */
  onConfirm?: () => void;
}

export function RecoveryCodePanel({
  code,
  title = '復旧コード',
  confirmLabel,
  onConfirm,
}: RecoveryCodePanelProps): JSX.Element {
  const checkboxId = useId();
  const [saved, setSaved] = useState(false);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');

  const handleCopy = async () => {
    try {
      // navigator.clipboard は HTTPS / localhost 以外では使えないため失敗を握る
      await navigator.clipboard.writeText(code);
      setCopyState('copied');
      window.setTimeout(() => setCopyState('idle'), 2000);
    } catch {
      setCopyState('failed');
    }
  };

  return (
    <section className="space-y-3 rounded-2xl border-2 border-ramen-chili/40 bg-ramen-chili/5 p-4">
      <h2 className="text-base font-bold text-ramen-chili">{title}</h2>

      <p className="text-sm leading-relaxed text-ramen-soy">
        パスワードを忘れたときに、このコードで再設定できます。
        <span className="font-bold">
          この画面を閉じると二度と表示できません。
        </span>
        スクリーンショットやパスワード管理アプリなど、安全な場所に必ず控えてください。
      </p>

      <p
        className="select-all break-all rounded-xl bg-white px-4 py-3 text-center font-mono text-lg font-bold tracking-wider text-ramen-soy"
        data-testid="recovery-code"
      >
        {code}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={handleCopy} className="btn-secondary text-sm">
          コードをコピー
        </button>
        {copyState === 'copied' ? (
          <span className="text-xs font-bold text-ramen-nori">コピーしました</span>
        ) : null}
        {copyState === 'failed' ? (
          <span className="text-xs font-bold text-ramen-chili">
            コピーできませんでした。手動で控えてください。
          </span>
        ) : null}
      </div>

      <ul className="ml-5 list-disc space-y-1 text-xs text-ramen-soy/70">
        <li>コードは 1 回使うと無効になり、再設定時に新しいコードが発行されます。</li>
        <li>他人に知られると、そのアカウントのパスワードを変更されてしまいます。</li>
        <li>紛失した場合は、ログイン中にマイページからいつでも再発行できます。</li>
      </ul>

      <label
        htmlFor={checkboxId}
        className="flex cursor-pointer items-start gap-2 rounded-xl bg-white/70 px-3 py-2 text-sm font-bold text-ramen-soy"
      >
        <input
          id={checkboxId}
          type="checkbox"
          className="mt-0.5 h-4 w-4 accent-ramen-chili"
          checked={saved}
          onChange={(e) => setSaved(e.target.checked)}
        />
        <span>復旧コードを安全な場所に控えました</span>
      </label>

      {confirmLabel ? (
        <button
          type="button"
          className="btn-primary w-full"
          disabled={!saved}
          aria-disabled={!saved}
          onClick={onConfirm}
        >
          {confirmLabel}
        </button>
      ) : null}
    </section>
  );
}
