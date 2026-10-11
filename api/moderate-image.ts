/**
 * 廃止済みエンドポイント。画像審査は `api/submit-photo-question.ts` に統合した
 * (docs/SUPABASE_SETUP.md §26)。
 *
 * 以前は認証なしで誰でも呼べたため、外部から連打されると Cloud Vision の料金が
 * 増える状態だった。古いクライアントがキャッシュから呼んでも Vision を呼ばないよう、
 * 410 を返すだけにしてある。このファイルは削除してよい。
 */
export const config = {
  runtime: 'edge',
};

export default function handler(): Response {
  return new Response(JSON.stringify({ error: 'gone' }), {
    status: 410,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}
