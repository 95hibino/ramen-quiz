/**
 * 写真クイズ投稿の唯一の登録経路 (Vercel Edge Function)。
 *
 * `POST /api/submit-photo-question`
 *   Header: `Authorization: Bearer <Supabase のアクセストークン>`
 *   Body:   JSON `{ "imagePath": "submissions/yyyy/mm/<32桁16進>.webp", "submission": {...} }`
 *   Res:    200 `{ status: 'approved' | 'pending', question: <user_photo_questions の行> }`
 *           422 `{ error: 'image_rejected', reason }`  画像が不適切
 *           429 `{ error: 'rate_limit_exceeded', retryAfterSeconds }`
 *
 * なぜサーバ経由にしたか (docs/SUPABASE_SETUP.md §26):
 *   以前はブラウザが `/api/moderate-image` で審査 → 自分で DB に INSERT していたため、
 *   API を直接叩けば審査を飛ばして投稿できた。現在は DB の INSERT 権限を外し、
 *   `submit_photo_question` RPC (この関数だけが知る共有シークレットが必要) だけを入口にしている。
 *
 * 流れ:
 *   1. ブラウザが画像を Storage に置く (自分のファイルとして owner が記録される)
 *   2. 本関数が `reserve_photo_moderation` で審査枠を確保 (ユーザー単位・全体の回数制限)
 *   3. 置かれた画像そのものを公開 URL から取得して Cloud Vision に掛ける
 *      → ブラウザが審査用と投稿用で別の画像を渡す、という差し替えはできない
 *   4. `submit_photo_question` で登録。審査できなかった投稿は `pending` (非公開) になる
 *
 * RPC はどちらもユーザー本人のトークンで呼ぶ。DB 側では auth.uid() から投稿者を決めるので、
 * この関数が service_role キーを持つ必要はない。
 */
export const config = {
  runtime: 'edge',
};

/** ブラウザ側 `generateImagePath()` と同じ形式。これ以外のパスは受け付けない。 */
const IMAGE_PATH_PATTERN = /^submissions\/\d{4}\/\d{2}\/[0-9a-f]{32}\.webp$/;

/** バケットの上限 (500KB) に少し余裕を持たせた取得上限。 */
const MAX_IMAGE_BYTES = 600 * 1024;

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

/**
 * 審査結果。
 * - `safe`: 公開してよい
 * - `unsafe`: 不適切。投稿を拒否する
 * - `unavailable`: 審査できなかった (キー未設定・Google 障害など)。非公開で受け付ける
 */
type ModerationOutcome =
  | { kind: 'safe' }
  | { kind: 'unsafe'; reason: string }
  | { kind: 'unavailable'; detail: string };

interface RpcError {
  status: number;
  code?: string;
  message: string;
}

interface Env {
  supabaseUrl: string;
  anonKey: string;
  bucket: string;
  secret: string;
  visionApiKey: string;
}

function readEnv(): Env | null {
  const supabaseUrl = (process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '').trim();
  const anonKey = (process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? '').trim();
  const secret = (process.env.PHOTO_SUBMIT_SECRET ?? '').trim();
  if (!supabaseUrl || !anonKey || !secret) return null;
  return {
    supabaseUrl: supabaseUrl.replace(/\/+$/, ''),
    anonKey,
    bucket: (process.env.VITE_SUPABASE_STORAGE_BUCKET ?? '').trim() || 'photo-quiz-user',
    secret,
    visionApiKey: (process.env.GOOGLE_VISION_API_KEY ?? '').trim(),
  };
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405);
  }

  const env = readEnv();
  if (!env) {
    console.error('[submit-photo-question] SUPABASE_URL / ANON_KEY / PHOTO_SUBMIT_SECRET が未設定');
    return json({ error: 'server_not_configured' }, 503);
  }

  const token = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    return json({ error: 'not_authenticated' }, 401);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }
  if (!body || typeof body !== 'object') {
    return json({ error: 'invalid_body' }, 400);
  }
  const { imagePath, submission } = body as { imagePath?: unknown; submission?: unknown };
  if (typeof imagePath !== 'string' || !IMAGE_PATH_PATTERN.test(imagePath)) {
    return json({ error: 'invalid_image_path' }, 400);
  }
  if (!submission || typeof submission !== 'object') {
    return json({ error: 'invalid_submission' }, 400);
  }

  // 審査枠の確保。投稿の 5 分制限・審査回数の上限はここで DB が判定する。
  // Vision を呼ぶ前に済ませることで、審査 API を連打されても課金が増えない。
  const reserve = await callRpc(env, token, 'reserve_photo_moderation', { p_secret: env.secret });
  if ('error' in reserve) return rpcErrorResponse(reserve.error);

  let outcome: ModerationOutcome;
  if (reserve.data === 'skip') {
    outcome = { kind: 'unavailable', detail: '本日の自動審査の上限に達しました' };
  } else {
    outcome = await moderateStoredImage(env, imagePath);
  }

  if (outcome.kind === 'unsafe') {
    return json({ error: 'image_rejected', reason: outcome.reason }, 422);
  }
  if (outcome.kind === 'unavailable') {
    console.warn('[submit-photo-question] 審査できなかったため非公開で受け付けます:', outcome.detail);
  }

  const s = submission as Record<string, unknown>;
  const inserted = await callRpc(env, token, 'submit_photo_question', {
    p_secret: env.secret,
    p_moderation_status: outcome.kind === 'safe' ? 'approved' : 'pending',
    p_image_path: imagePath,
    p_show_submitter: s.showSubmitter === true,
    p_ramen_type: s.ramenType ?? null,
    p_prefecture: s.prefecture ?? null,
    p_photo_type: s.photoType ?? null,
    p_difficulty: s.difficulty ?? null,
    p_noodle_thickness: s.noodleThickness ?? null,
    p_options: s.options ?? null,
    p_answer_idx: s.answerIdx ?? null,
    p_explanation: s.explanation ?? null,
    p_shop_info: s.shopInfo ?? null,
  });
  if ('error' in inserted) return rpcErrorResponse(inserted.error);

  return json(
    { status: outcome.kind === 'safe' ? 'approved' : 'pending', question: inserted.data },
    200,
  );
}

/** Storage に置かれた画像を取得して SafeSearch に掛ける。 */
async function moderateStoredImage(env: Env, imagePath: string): Promise<ModerationOutcome> {
  if (!env.visionApiKey) {
    return { kind: 'unavailable', detail: 'GOOGLE_VISION_API_KEY 未設定' };
  }

  const imageUrl = `${env.supabaseUrl}/storage/v1/object/public/${env.bucket}/${imagePath}`;
  let bytes: Uint8Array;
  try {
    const res = await fetch(imageUrl);
    if (!res.ok) {
      // 画像が無いなら投稿自体が成立しない。DB 側でも所有確認で弾かれるが、ここで止める。
      return { kind: 'unsafe', reason: '画像が見つかりませんでした。もう一度投稿してください。' };
    }
    bytes = new Uint8Array(await res.arrayBuffer());
  } catch (err) {
    return { kind: 'unavailable', detail: `画像取得失敗: ${String(err)}` };
  }
  if (bytes.length > MAX_IMAGE_BYTES) {
    return { kind: 'unsafe', reason: '画像サイズが大きすぎます。' };
  }

  let visionResponse: Response;
  try {
    visionResponse = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(env.visionApiKey)}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          requests: [
            {
              image: { content: toBase64(bytes) },
              features: [{ type: 'SAFE_SEARCH_DETECTION', maxResults: 1 }],
            },
          ],
        }),
      },
    );
  } catch (err) {
    return { kind: 'unavailable', detail: `Vision API 到達不可: ${String(err)}` };
  }
  if (!visionResponse.ok) {
    const text = await visionResponse.text().catch(() => '');
    return { kind: 'unavailable', detail: `Vision API ${visionResponse.status}: ${text.slice(0, 200)}` };
  }

  let payload: {
    responses?: Array<{ safeSearchAnnotation?: SafeSearchAnnotation; error?: { code?: number } }>;
  };
  try {
    payload = await visionResponse.json();
  } catch {
    return { kind: 'unavailable', detail: 'Vision API 応答のパース失敗' };
  }
  const first = payload.responses?.[0];
  if (first?.error?.code || !first?.safeSearchAnnotation) {
    return { kind: 'unavailable', detail: '判定結果が空、または画像単位のエラー' };
  }
  return judge(first.safeSearchAnnotation);
}

/**
 * adult / violence / racy のいずれかが LIKELY 以上なら拒否。
 * POSSIBLE は誤検知が多いので通す。medical / spoof は見ない。
 */
function judge(annotation: SafeSearchAnnotation): ModerationOutcome {
  const isBad = (v: Likelihood | undefined) => v === 'LIKELY' || v === 'VERY_LIKELY';
  const flagged: string[] = [];
  if (isBad(annotation.adult)) flagged.push('成人向けコンテンツ');
  if (isBad(annotation.violence)) flagged.push('暴力的表現');
  if (isBad(annotation.racy)) flagged.push('過激なコンテンツ');
  if (flagged.length === 0) return { kind: 'safe' };
  return {
    kind: 'unsafe',
    reason: `画像に ${flagged.join('・')} が検出されたため投稿できません。別の画像をお試しください。`,
  };
}

/** PostgREST の RPC をユーザー本人のトークンで呼ぶ。 */
async function callRpc(
  env: Env,
  token: string,
  name: string,
  args: Record<string, unknown>,
): Promise<{ data: unknown } | { error: RpcError }> {
  let res: Response;
  try {
    res = await fetch(`${env.supabaseUrl}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: {
        apikey: env.anonKey,
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(args),
    });
  } catch (err) {
    return { error: { status: 502, message: `Supabase に到達できません: ${String(err)}` } };
  }
  const text = await res.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  if (!res.ok) {
    const e = (parsed ?? {}) as { code?: string; message?: string; details?: string; hint?: string };
    const message = [e.message, e.details, e.hint].filter((v) => typeof v === 'string').join(' | ');
    return { error: { status: res.status, code: e.code, message: message || text } };
  }
  return { data: parsed };
}

/** DB からのエラーを、ブラウザが扱いやすい形に変換する。 */
function rpcErrorResponse(error: RpcError): Response {
  const rate = error.message.match(/rate_limit_exceeded:(\d+)/);
  if (rate) {
    return json({ error: 'rate_limit_exceeded', retryAfterSeconds: Number(rate[1]) }, 429);
  }
  if (/not_authenticated|JWT/i.test(error.message) || error.status === 401) {
    return json({ error: 'not_authenticated' }, 401);
  }
  if (/invalid_secret/.test(error.message)) {
    // サーバ設定の不整合 (Vercel と DB でシークレットが違う)。利用者の責任ではない。
    console.error('[submit-photo-question] PHOTO_SUBMIT_SECRET が DB の値と一致しません');
    return json({ error: 'server_not_configured' }, 503);
  }
  if (/image_not_owned|image_already_used|profile_not_found/.test(error.message)) {
    return json({ error: error.message.match(/image_not_owned|image_already_used|profile_not_found/)![0] }, 403);
  }
  // CHECK 制約違反など入力不備は 400。中身はそのまま返す (利用者が直せる情報なので)。
  if (error.code === '23514' || error.code === '22P02' || error.code === '23502' || /^invalid_/.test(error.message)) {
    return json({ error: 'invalid_submission', detail: error.message }, 400);
  }
  console.error('[submit-photo-question] RPC 失敗:', error);
  return json({ error: 'internal_error' }, 500);
}

/** Uint8Array → base64。大きめの画像でも引数上限に当たらないよう分割する。 */
function toBase64(bytes: Uint8Array): string {
  const CHUNK = 8192;
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}
