/**
 * Cloud Vision SafeSearch モデレーション用 Vercel Serverless Function。
 *
 * `POST /api/moderate-image`
 *   Body: JSON `{ "imageBase64": "<base64 without data:URI prefix>" }`
 *   Res:  JSON `{ safe: boolean, categories?: {...}, reason?: string, disabled?: boolean }`
 *
 * 動作:
 * - 環境変数 `GOOGLE_VISION_API_KEY` が未設定なら判定を skip し `safe: true, disabled: true`
 *   を返す (社長が GCP をセットアップするまでは既存挙動維持)。
 * - 設定済みなら Google Cloud Vision REST API の `images:annotate` に SAFE_SEARCH_DETECTION
 *   を投げ、結果をアプリのしきい値に照らして判定する。
 *
 * Runtime: Edge (api/og.tsx と統一)。
 *   Web 標準の Request/Response で書けて cold start が短く、fetch がネイティブで使える。
 *   Body 上限は 4MB だが、投稿画像は 800px WebP に最適化済みで通常 50〜200KB なので十分。
 *   Node runtime を指定していたバージョンは Vercel で不完全な扱いだったため、
 *   応答が返らずハングする不具合があった (2026-07-15 修正)。
 *
 * しきい値ポリシー:
 * - adult / violence / racy が `LIKELY` または `VERY_LIKELY` → 拒否
 * - medical は誤検知が多いため無視
 * - spoof (画像加工されたミーム等) は許容
 *
 * コスト:
 * - Google 側の無料枠は月 1,000 unit。以降は $1.50/1000 unit。
 * - 既存の投稿レート制限 (5 分 = 1 投稿) と組み合わせ、費用暴走はしにくい設計。
 *
 * docs/CLOUD_VISION_SETUP.md にセットアップ手順を記載。
 */
export const config = {
  runtime: 'edge',
};

/** SafeSearch のカテゴリ (Google 側の likelihood 名)。 */
type Likelihood =
  | 'UNKNOWN'
  | 'VERY_UNLIKELY'
  | 'UNLIKELY'
  | 'POSSIBLE'
  | 'LIKELY'
  | 'VERY_LIKELY';

interface SafeSearchAnnotation {
  adult?: Likelihood;
  medical?: Likelihood;
  racy?: Likelihood;
  spoof?: Likelihood;
  violence?: Likelihood;
}

interface VisionApiResponse {
  responses?: Array<{
    safeSearchAnnotation?: SafeSearchAnnotation;
    error?: { code?: number; message?: string };
  }>;
  error?: { code?: number; message?: string };
}

/** ModerationResult: フロントに返す共通の判定結果型。 */
interface ModerationResult {
  safe: boolean;
  disabled?: boolean;
  categories?: SafeSearchAnnotation;
  reason?: string;
}

/**
 * likelihood が `LIKELY` 以上なら true。
 * `POSSIBLE` は誤検知が多いので拒否対象に含めない。
 */
function isBadLikelihood(v: Likelihood | undefined): boolean {
  return v === 'LIKELY' || v === 'VERY_LIKELY';
}

/**
 * SafeSearch 結果を判定する。
 * - adult / violence / racy のいずれかが LIKELY 以上なら reject
 * - reason はユーザー向けに日本語で組み立てる
 */
function judge(annotation: SafeSearchAnnotation): ModerationResult {
  const flagged: string[] = [];
  if (isBadLikelihood(annotation.adult)) flagged.push('成人向けコンテンツ');
  if (isBadLikelihood(annotation.violence)) flagged.push('暴力的表現');
  if (isBadLikelihood(annotation.racy)) flagged.push('過激なコンテンツ');
  if (flagged.length === 0) {
    return { safe: true, categories: annotation };
  }
  return {
    safe: false,
    categories: annotation,
    reason: `画像に ${flagged.join('・')} が検出されたため投稿できません。別の画像をお試しください。`,
  };
}

/**
 * Vercel Serverless Function ハンドラー。
 * ES module 形式なので default export で公開する。
 */
export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return json({ safe: false, reason: 'Method Not Allowed' }, 405);
  }

  const apiKey = process.env.GOOGLE_VISION_API_KEY;
  if (!apiKey || apiKey.trim().length === 0) {
    // API キー未設定 → 判定 skip (既存挙動を破壊しないための救済)
    return json({ safe: true, disabled: true } satisfies ModerationResult, 200);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ safe: false, reason: 'Invalid JSON body' }, 400);
  }

  const imageBase64 = extractImageBase64(body);
  if (!imageBase64) {
    return json({ safe: false, reason: 'imageBase64 が指定されていません' }, 400);
  }

  // 画像サイズの上限 (Edge runtime の body 上限は 4MB。base64 は ~4/3 倍に膨らむ)
  // 通常 800px WebP は 50〜200KB なので余裕あり。3.5MB を超えたら弾く。
  if (imageBase64.length > 3.5 * 1024 * 1024) {
    return json({ safe: false, reason: '画像サイズが大きすぎます' }, 400);
  }

  const visionUrl = `https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(apiKey)}`;
  const visionRequest = {
    requests: [
      {
        image: { content: imageBase64 },
        features: [{ type: 'SAFE_SEARCH_DETECTION', maxResults: 1 }],
      },
    ],
  };

  let visionResponse: Response;
  try {
    visionResponse = await fetch(visionUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(visionRequest),
    });
  } catch (err) {
    console.warn('[moderate-image] Vision API fetch failed:', err);
    // Google 側が落ちていた場合は Fail-Open (safe: true) を返し、通常投稿は通す。
    // Fail-Closed にすると Google の障害でサイト全体の投稿が止まるためこちらを選択。
    return json(
      { safe: true, disabled: true, reason: 'Vision API に到達できませんでした (投稿は許可)' },
      200,
    );
  }

  if (!visionResponse.ok) {
    const text = await visionResponse.text().catch(() => '');
    console.warn(
      '[moderate-image] Vision API returned non-2xx:',
      visionResponse.status,
      text.slice(0, 200),
    );
    // 401/403 (API キー不正) 等は Fail-Closed にしても社長作業を待つ必要があるので
    // Fail-Open で通しつつ、コンソールに警告だけ残す。
    return json(
      { safe: true, disabled: true, reason: 'Vision API がエラーを返しました (投稿は許可)' },
      200,
    );
  }

  let payload: VisionApiResponse;
  try {
    payload = (await visionResponse.json()) as VisionApiResponse;
  } catch {
    return json({ safe: true, disabled: true, reason: 'Vision API 応答のパース失敗 (投稿は許可)' }, 200);
  }

  const annotation = payload.responses?.[0]?.safeSearchAnnotation;
  const perImageError = payload.responses?.[0]?.error;
  if (perImageError && perImageError.code) {
    console.warn('[moderate-image] Vision per-image error:', perImageError);
    return json({ safe: true, disabled: true, reason: '画像単位のエラー (投稿は許可)' }, 200);
  }
  if (!annotation) {
    return json({ safe: true, disabled: true, reason: '判定結果が空 (投稿は許可)' }, 200);
  }

  const result = judge(annotation);
  return json(result, 200);
}

/** JSON レスポンスの薄いヘルパー。 */
function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

/** リクエストボディから imageBase64 を安全に取り出す。 */
function extractImageBase64(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const value = (body as { imageBase64?: unknown }).imageBase64;
  if (typeof value !== 'string' || value.length === 0) return null;
  // `data:image/webp;base64,...` の形式で来た場合はプレフィックスを剥がす。
  const commaIdx = value.indexOf(',');
  if (value.startsWith('data:') && commaIdx > 0) {
    return value.slice(commaIdx + 1);
  }
  return value;
}
