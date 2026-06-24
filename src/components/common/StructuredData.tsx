import { Helmet } from 'react-helmet-async';

/**
 * Schema.org の JSON-LD を `<script type="application/ld+json">` で `<head>` に注入する汎用コンポーネント。
 *
 * - 単一スキーマ (オブジェクト) と複数スキーマ (配列) のどちらにも対応。
 * - `react-helmet-async` の `<Helmet>` 配下に出力するため、ページ遷移時に
 *   自動的にクリーンアップされる (SPA で前ページの構造化データが残らない)。
 * - `</script>` を含む文字列が値に紛れ込んでもタグを閉じてしまわないよう、`<` `>` `&` を
 *   Unicode エスケープしてから埋め込む。
 *   参考: https://developers.google.com/search/docs/appearance/structured-data
 *
 * 注: JSON-LD は `<script type="application/ld+json">` で配信され JavaScript として実行されないため、
 *     U+2028 / U+2029 (古い JS パーサ向け対策) のエスケープは行わない (保守性優先)。
 *
 * 使い方:
 * ```tsx
 * <StructuredData schema={{
 *   '@context': 'https://schema.org',
 *   '@type': 'WebSite',
 *   name: 'ラーメンクイズ',
 *   url: 'https://ramen-quiz-ten.vercel.app',
 * }} />
 * ```
 */
export interface StructuredDataProps {
  /** Schema.org の JSON-LD オブジェクト、または複数スキーマの配列。 */
  schema: Record<string, unknown> | ReadonlyArray<Record<string, unknown>>;
}

/** `</script>` 混入を防ぐためのエスケープテーブル。 */
const ESCAPE_TABLE: Record<string, string> = {
  '<': '\\u003c',
  '>': '\\u003e',
  '&': '\\u0026',
};

const ESCAPE_PATTERN = /[<>&]/g;

/**
 * `JSON.stringify` の出力を `<script>` タグ内で安全に展開できる形に整形する。
 * 参考: https://developers.google.com/search/docs/appearance/structured-data#format-rules
 */
function safeStringify(value: unknown): string {
  return JSON.stringify(value).replace(ESCAPE_PATTERN, (ch) => ESCAPE_TABLE[ch] ?? ch);
}

export function StructuredData({ schema }: StructuredDataProps): JSX.Element {
  const payload = safeStringify(schema);
  return (
    <Helmet>
      <script type="application/ld+json">{payload}</script>
    </Helmet>
  );
}
