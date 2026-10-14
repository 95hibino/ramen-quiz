/**
 * SNS シェア URL を組み立てる純粋関数群。
 *
 * 関数を分離する理由:
 *   - 単体テストしやすくする (副作用なし)
 *   - ShareButtons コンポーネントの責務を「表示」だけに保つ
 *   - 各 SNS のクエリパラメータ仕様変更に追従しやすくする
 *
 * design §Phase 2 SNS シェア機能。
 */

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
