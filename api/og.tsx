/**
 * 動的 OG 画像生成 Serverless Function (Vercel Edge Runtime)。
 *
 * `https://<domain>/api/og?score=87&max=100&category=中級&username=大森商事`
 * のように呼び出すと、スコアを描画した 1200x630 PNG を返す。
 *
 * SNS シェア時に og:image としてこの URL を指定すると、
 * X / Facebook / LINE のシェアカードにスコアが埋め込まれる。
 *
 * 実装メモ:
 * - Vercel の File System Routing により本ファイルは自動的に
 *   `/api/og` エンドポイントとしてデプロイされる。Vite のビルド対象外。
 * - Edge Runtime を指定することで cold start を短縮し、
 *   `@vercel/og` (Satori ベース) のバンドルサイズ制限にも収まる。
 * - デフォルトフォント (sans-serif) は Vercel Edge Runtime 上で
 *   基本的な日本語グリフを描画可能。もし文字化けする環境が判明したら
 *   `docs/OG_IMAGE.md` の手順で Noto Sans JP を追加すること。
 * - 絵文字 (🍜) は Satori のデフォルト絵文字フォールバックで描画される。
 *
 * design §Phase 3 動的 OG 画像。
 */
import { ImageResponse } from '@vercel/og';

/** Edge Runtime 指定 (必須)。 */
export const config = {
  runtime: 'edge',
};

/** 数値クエリを安全に取り込むためのクランプ関数。 */
function clampInt(raw: string | null, fallback: number, min: number, max: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

/**
 * SVG/PNG インジェクション対策の軽い文字列サニタイズ。
 * Satori は JSX を SVG に変換する前に子ノードをテキストとして扱うため
 * 実際には XSS リスクは低いが、極端に長い文字列は幅崩れを起こすので切り詰める。
 */
function safeText(raw: string | null, fallback: string, maxLen: number): string {
  const value = (raw ?? '').trim();
  if (value.length === 0) return fallback;
  // 制御文字を除去し、maxLen 超過は省略記号で切り詰める。
  const cleaned = value.replace(/[\x00-\x1f\x7f]/g, '');
  if (cleaned.length <= maxLen) return cleaned;
  return `${cleaned.slice(0, maxLen)}…`;
}

export default function handler(request: Request): Response {
  const { searchParams } = new URL(request.url);

  // mode: 'score' (デフォルト) / 'hero' (スコアなし・トップやデフォルト OG 用)
  const mode = searchParams.get('mode') === 'hero' ? 'hero' : 'score';

  // クエリパラメータを取り出し、それぞれクランプ/サニタイズする。
  // score / max は 0..999 の範囲に丸め、想定外値でも壊れないようにする。
  const safeScore = clampInt(searchParams.get('score'), 0, 0, 999);
  const safeMax = clampInt(searchParams.get('max'), 100, 1, 999);
  // カテゴリはラベルとしてそのまま表示。長すぎるとレイアウトが崩れるので 20 文字で打ち切り。
  const category = safeText(searchParams.get('category'), 'ラーメンクイズ', 20);
  // ユーザー名は空文字なら非表示。表示時は 20 文字で打ち切り。
  const usernameRaw = searchParams.get('username');
  const username =
    usernameRaw && usernameRaw.trim().length > 0 ? safeText(usernameRaw, '', 20) : '';
  const quizType = searchParams.get('type') === 'photo' ? 'photo' : 'knowledge';
  const quizTypeLabel = quizType === 'photo' ? '写真当てクイズ' : 'ラーメンクイズ';

  // hero モード: サイトの汎用 OG 画像。デフォルト OG 画像 (`/api/og?mode=hero`) 用途。
  // Twitter/Facebook/LINE の各種クローラーが安定してレンダリングできる PNG を返す。
  // 動的にスコアを乗せる `score` モードと並存させ、Result 画面からのシェアはそのまま `?score=..`
  // でリッチカードにする。
  if (mode === 'hero') {
    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #f97316 0%, #dc2626 100%)',
            fontFamily: 'sans-serif',
            color: '#ffffff',
          }}
        >
          <div style={{ fontSize: 200, marginBottom: 20, display: 'flex' }}>🍜</div>
          <div
            style={{
              fontSize: 96,
              fontWeight: 900,
              letterSpacing: 4,
              marginBottom: 12,
              display: 'flex',
            }}
          >
            ラーメンクイズ
          </div>
          <div
            style={{
              fontSize: 36,
              fontWeight: 700,
              opacity: 0.9,
              display: 'flex',
              textAlign: 'center',
            }}
          >
            歴史・地域・文化を 4 択クイズで楽しく学ぼう
          </div>
        </div>
      ),
      { width: 1200, height: 630 },
    );
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          // 既存 og-default.svg のブランドカラー (orange → red グラデ) を踏襲。
          background: 'linear-gradient(135deg, #f97316 0%, #dc2626 100%)',
          fontFamily: 'sans-serif',
          color: '#ffffff',
        }}
      >
        {/* ラーメン絵文字 (Satori のデフォルト絵文字フォールバックで描画)。 */}
        <div style={{ fontSize: 120, marginBottom: 12, display: 'flex' }}>🍜</div>

        {/* メインスコア表示 (最も視認性重視)。 */}
        <div
          style={{
            fontSize: 96,
            fontWeight: 900,
            marginBottom: 8,
            display: 'flex',
            alignItems: 'baseline',
            gap: 12,
          }}
        >
          <span>{safeScore}</span>
          <span style={{ fontSize: 48, opacity: 0.85 }}>/ {safeMax}</span>
        </div>

        {/* カテゴリ (中央強調)。 */}
        <div
          style={{
            fontSize: 44,
            fontWeight: 700,
            opacity: 0.95,
            marginBottom: 24,
            display: 'flex',
          }}
        >
          {category}
        </div>

        {/* ユーザー名 (任意)。 */}
        {username ? (
          <div style={{ fontSize: 32, opacity: 0.9, marginBottom: 20, display: 'flex' }}>
            {username} さんが挑戦！
          </div>
        ) : null}

        {/* フッターのブランド名 (og-default.svg と統一)。 */}
        <div
          style={{
            fontSize: 28,
            fontWeight: 700,
            opacity: 0.8,
            marginTop: 32,
            display: 'flex',
          }}
        >
          {quizTypeLabel}
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    },
  );
}
