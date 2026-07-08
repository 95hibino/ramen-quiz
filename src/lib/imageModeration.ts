/**
 * 写真投稿前に `/api/moderate-image` を叩いて Cloud Vision SafeSearch で
 * 不適切コンテンツを検査するクライアント側ヘルパー。
 *
 * 動作:
 * - Blob を base64 に変換して POST
 * - サーバ側が Vision API を呼び、`{ safe, reason?, disabled? }` を返す
 * - `disabled: true` の場合は判定機能が未設定 or Vision 障害。UI は通常投稿を通す
 * - `safe: false` の場合は `reason` を UI で表示して投稿を止める
 *
 * Vercel Serverless Function の cold start により最大 2-3 秒かかることがある。
 * 投稿ボタン押下時に呼ぶ想定なので UI 側でスピナー表示を用意すること。
 *
 * ネットワーク失敗時は `safe: true, disabled: true` を返し、投稿は許可する
 * (Fail-Open。サーバ側と揃った挙動)。
 */

export interface ModerationResult {
  safe: boolean;
  /** 判定機能が無効 or 到達失敗のとき true (投稿は通す)。 */
  disabled?: boolean;
  /** 拒否理由 (safe: false のときのみ設定)。UI にそのまま表示可能。 */
  reason?: string;
}

/** Blob → base64 (data URL プレフィックス除去済み) に変換する。 */
async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  // 大きめの画像でも壊れないよう 8KB ずつ分割して btoa する。
  const CHUNK = 8192;
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const slice = bytes.subarray(i, i + CHUNK);
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore - fromCharCode に Uint8Array を渡すのは合法だが型定義が緩い
    binary += String.fromCharCode.apply(null, slice as unknown as number[]);
  }
  return typeof btoa === 'function' ? btoa(binary) : Buffer.from(binary, 'binary').toString('base64');
}

/**
 * 画像 Blob を `/api/moderate-image` に投げて判定結果を得る。
 * ネットワーク失敗時は `safe: true, disabled: true` を返す (Fail-Open)。
 */
export async function moderateImage(blob: Blob): Promise<ModerationResult> {
  let imageBase64: string;
  try {
    imageBase64 = await blobToBase64(blob);
  } catch (err) {
    console.warn('[imageModeration] base64 変換失敗:', err);
    // 変換自体に失敗するのはブラウザ側の問題。投稿は通す。
    return { safe: true, disabled: true };
  }

  try {
    const res = await fetch('/api/moderate-image', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ imageBase64 }),
    });
    if (!res.ok) {
      console.warn('[imageModeration] endpoint returned non-2xx:', res.status);
      return { safe: true, disabled: true };
    }
    const data = (await res.json()) as ModerationResult;
    // 型ガード: safe が boolean であることを最低限確認
    if (typeof data !== 'object' || data === null || typeof data.safe !== 'boolean') {
      return { safe: true, disabled: true };
    }
    return data;
  } catch (err) {
    console.warn('[imageModeration] fetch 失敗:', err);
    return { safe: true, disabled: true };
  }
}
