import { Link } from 'react-router-dom';
import type { ReporterBlockRecord } from '@/lib/supabaseReportRepository';

/**
 * 通報乱用でブロックされたユーザーに表示する画面 (§20)。
 *
 * `/quiz/photo` と `/quiz/photo/play` の入り口で使う。
 * ユーザーはこの画面から解除申請 (お問い合わせフォーム) にのみ進める。
 */
interface Props {
  block: ReporterBlockRecord;
}

export function ReporterBlockedScreen({ block }: Props): JSX.Element {
  return (
    <div className="card space-y-4 border-2 border-ramen-chili/40 bg-ramen-chili/5">
      <h1 className="text-xl font-black text-ramen-chili">写真クイズは現在ご利用いただけません</h1>
      <p className="text-sm text-ramen-soy/90">
        あなたのアカウントは通報の乱用により、写真クイズの利用および通報機能を一時的に制限中です。
      </p>
      <dl className="grid grid-cols-1 gap-1 rounded-xl bg-white/60 p-3 text-xs sm:grid-cols-2">
        <div className="flex gap-2">
          <dt className="font-bold text-ramen-soy/60">制限開始:</dt>
          <dd className="text-ramen-soy">{formatDateTime(block.blockedAt)}</dd>
        </div>
        {block.reason ? (
          <div className="flex gap-2">
            <dt className="font-bold text-ramen-soy/60">理由:</dt>
            <dd className="text-ramen-soy">{block.reason}</dd>
          </div>
        ) : null}
        {block.autoReportCount !== null ? (
          <div className="flex gap-2">
            <dt className="font-bold text-ramen-soy/60">直近通報数:</dt>
            <dd className="text-ramen-soy">{block.autoReportCount} 件</dd>
          </div>
        ) : null}
      </dl>
      <p className="text-xs text-ramen-soy/70">
        制限解除をご希望の場合は、お問い合わせフォームからその旨をご連絡ください。
        運営で状況を確認したうえで対応いたします。
      </p>
      <div className="flex flex-wrap gap-3">
        <Link to="/contact" className="btn-primary">
          お問い合わせフォームへ
        </Link>
        <Link
          to="/"
          className="text-sm font-bold text-ramen-soy/70 hover:text-ramen-chili hover:underline"
        >
          ← トップに戻る
        </Link>
      </div>
    </div>
  );
}

/** ISO8601 を「2026-07-14 12:34」形式のローカル日時に整形。 */
function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${y}-${mo}-${day} ${h}:${mi}`;
  } catch {
    return iso;
  }
}
