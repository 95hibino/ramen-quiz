/**
 * SNS シェア URL を組み立てる純粋関数群。
 *
 * 関数を分離する理由:
 *   - 単体テストしやすくする (副作用なし)
 *   - ShareButtons コンポーネントの責務を「表示」だけに保つ
 *   - 各 SNS のクエリパラメータ仕様変更に追従しやすくする
 *
 * design §Phase 2 SNS シェア機能 / §Phase 3 動的 OG 画像。
 */
import { buildSiteUrl } from '@/config/site';

/** シェア入力の共通形。 */
export interface ShareInput {
  /** シェア本文 (X / LINE / Web Share API で使用)。 */
  text: string;
  /** シェア対象 URL (絶対 URL 推奨)。 */
  url: string;
  /** ハッシュタグ ("#" 抜き)。X のみで使用。 */
  hashtags?: string[];
}

/**
 * X (旧 Twitter) Web Intent URL を生成する。
 * 仕様: https://twitter.com/intent/tweet (新ドメイン x.com も同じ)。
 */
export function buildXShareUrl({ text, url, hashtags = [] }: ShareInput): string {
  const params = new URLSearchParams();
  params.set('text', text);
  params.set('url', url);
  if (hashtags.length > 0) {
    params.set('hashtags', hashtags.join(','));
  }
  return `https://twitter.com/intent/tweet?${params.toString()}`;
}

/**
 * Facebook Sharer URL を生成する。
 * Facebook は URL のみを受け取り、本文はリンク先 OGP から自動取得する。
 */
export function buildFacebookShareUrl({ url }: Pick<ShareInput, 'url'>): string {
  const params = new URLSearchParams();
  params.set('u', url);
  return `https://www.facebook.com/sharer/sharer.php?${params.toString()}`;
}

/**
 * LINE 共有 URL を生成する。
 * 仕様: https://social-plugins.line.me/lineit/share
 *
 * 注意: LINE 公式仕様では `url` のみが必須で、`text` は省略可。
 * テキストを乗せたい場合は url にメッセージを含めるのが推奨だが、
 * 旧 `text` パラメータも多くのクライアントで動作するので併用する。
 */
export function buildLineShareUrl({ text, url }: Pick<ShareInput, 'text' | 'url'>): string {
  const params = new URLSearchParams();
  params.set('url', url);
  if (text) {
    params.set('text', text);
  }
  return `https://social-plugins.line.me/lineit/share?${params.toString()}`;
}

/**
 * Clipboard API でテキストをコピーする。
 *
 * 優先: `navigator.clipboard.writeText` (HTTPS / フォーカス時のみ動作)
 * フォールバック: 非対応・失敗時に `document.execCommand('copy')` を使う
 * (古いブラウザ / iOS Safari の一部 / 非セキュアコンテキスト対応)。
 *
 * @returns コピー成功時 true、失敗時 false。例外は投げない。
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  // モダンパス: 利用可能ならこちらを使う。
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // 続けてフォールバック試行。
    }
  }

  // フォールバック: 一時 textarea を生成して execCommand('copy')。
  if (typeof document === 'undefined') return false;
  const textarea = document.createElement('textarea');
  textarea.value = text;
  // 画面外に配置 (display:none だと選択不可になるため off-screen に置く)。
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.top = '-1000px';
  textarea.style.left = '-1000px';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  try {
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    // execCommand は deprecated だが、依然として広く動作するフォールバック手段。
    const ok = document.execCommand('copy');
    return ok;
  } catch {
    return false;
  } finally {
    document.body.removeChild(textarea);
  }
}

/* --------------------------------------------------------------------------
 * 動的 OG 画像 URL (Phase 3)
 *
 * `/api/og?score=...&max=...&category=...&username=...&type=...`
 * のようなクエリで Vercel Edge Function を呼び出し、
 * SNS シェアカード用の 1200x630 PNG を返させる。
 *
 * URL 生成ロジックだけをここに置き、実装は `api/og.tsx` に集約している。
 * ------------------------------------------------------------------------ */

/** buildOgImageUrl に渡す入力。 */
export interface OgImageParams {
  /** 獲得スコア (0..999 の範囲でクランプされる)。 */
  score: number;
  /** 最大スコア (1..999 の範囲でクランプされる)。 */
  max: number;
  /** カテゴリラベル (例: '初級' / '中級' / '写真当てクイズ')。 */
  category: string;
  /** ユーザー名 (任意)。省略時は画像に表示しない。 */
  username?: string;
  /** クイズ種別。'photo' のときはフッターを「写真当てクイズ」にする。 */
  quizType?: 'knowledge' | 'photo';
}

/**
 * 動的 OG 画像の絶対 URL を組み立てる。
 *
 * - `SITE_URL` 環境変数 (VITE_SITE_URL) が設定されていればその origin、
 *   未設定時はブラウザの `window.location.origin` を使う (config/site.ts の挙動)。
 * - SSR/CLI ビルド時に origin が空になる場合は `/api/og?...` の相対 URL を返す。
 *   OG 画像は Facebook / X などのクローラーが取得するため、絶対 URL が必要。
 *   SITE_URL を必ず設定するのが本番運用の前提。
 *
 * @example
 *   buildOgImageUrl({ score: 87, max: 100, category: '中級', username: '大森商事' })
 *   // → 'https://ramen-quiz-ten.vercel.app/api/og?score=87&max=100&category=%E4%B8%AD%E7%B4%9A&username=%E5%A4%A7%E6%A3%AE%E5%95%86%E4%BA%8B&type=knowledge'
 */
export function buildOgImageUrl(params: OgImageParams): string {
  const search = new URLSearchParams();
  // Number.isFinite でない値 (NaN) は 0 として送る。API 側でもクランプするので二重の保険。
  search.set('score', String(Number.isFinite(params.score) ? params.score : 0));
  search.set('max', String(Number.isFinite(params.max) ? params.max : 100));
  search.set('category', params.category);
  const trimmedUsername = params.username?.trim();
  if (trimmedUsername) {
    search.set('username', trimmedUsername);
  }
  // quizType は現状 API 側でフッター表示に使うのみ。省略時は knowledge 扱い。
  search.set('type', params.quizType ?? 'knowledge');

  // buildSiteUrl は末尾スラッシュを取り除いた origin + パスを返す。
  // origin が空 (SSR/CLI ビルド時) の場合は `/api/og?...` の相対 URL となる。
  return `${buildSiteUrl('/api/og')}?${search.toString()}`;
}
