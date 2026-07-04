/**
 * アフィリエイト広告枠コンポーネント。
 *
 * `src/config/affiliate.ts` の `AFFILIATE_ITEMS` から該当 slot の案件配列を読み込み、
 * URL が設定済みの案件のみを 1 件 = 1 カードで表示する。
 *
 * 動作モード:
 * 1. **配信モード**: URL が 1 件以上設定済み → カード一覧を表示
 * 2. **フォールバック**: 全件未設定（または案件 0 件） → `fallback` プロップに従う
 *    - `hidden`（デフォルト）: 何も描画しない（既存挙動を破壊しない）
 *    - `placeholder`: 「広告枠（準備中）」の薄いプレースホルダ
 *
 * ステマ規制（景品表示法 2023 年 10 月施行）対応:
 * - 全リンクに `rel="noopener noreferrer sponsored"` を付与（Google 推奨）
 * - 各カード上部に `[PR]` バッジ + プロバイダ名を明示
 * - 配信モード時は枠の冒頭に「広告・提携リンクを含みます」と明記
 *
 * AdSense 用の `AdBanner` とは見た目を意図的に差別化（カード型 + PR バッジ）し、
 * ユーザーが広告であることを明確に認識できるようにする。
 */

import {
  AFFILIATE_ITEMS,
  PROVIDER_LABEL,
  type AffiliateItem,
  type AffiliateSlot,
} from '@/config/affiliate';

interface AffiliateBannerProps {
  /** 配置場所の識別子。`AFFILIATE_ITEMS` から対応する案件を引く。 */
  slot: AffiliateSlot;
  /**
   * 表示する案件が 1 件もない場合のフォールバック挙動。
   * - `'hidden'` (デフォルト): 何も描画しない
   * - `'placeholder'`: 「広告枠（準備中）」のプレースホルダを表示
   */
  fallback?: 'hidden' | 'placeholder';
  /** 追加 className（呼び出し側でレイアウト微調整したいとき）。 */
  className?: string;
}

export function AffiliateBanner({
  slot,
  fallback = 'hidden',
  className,
}: AffiliateBannerProps): JSX.Element | null {
  const items = AFFILIATE_ITEMS[slot] ?? [];
  // URL が設定済み（空文字でない）の案件だけを表示対象に。
  const visibleItems = items.filter((item) => item.url.trim().length > 0);

  if (visibleItems.length === 0) {
    if (fallback === 'placeholder') {
      return (
        <div
          role="complementary"
          aria-label={`アフィリエイト広告枠 (${slot}) — 準備中`}
          data-affiliate-slot={slot}
          className={`mx-auto w-full rounded-lg border border-dashed border-ramen-soy/20 bg-ramen-noodle/40 px-4 py-3 text-center text-xs text-ramen-soy/50 ${className ?? ''}`.trim()}
        >
          広告枠（準備中）
        </div>
      );
    }
    return null;
  }

  return (
    <aside
      aria-label={`提携広告 (${slot})`}
      data-affiliate-slot={slot}
      className={`w-full space-y-2 ${className ?? ''}`.trim()}
    >
      {/* ステマ規制対応: 枠全体で広告であることを明示。 */}
      <p className="text-[10px] font-bold uppercase tracking-wider text-ramen-soy/50">
        広告・提携リンクを含みます
      </p>
      <div
        className={
          visibleItems.length > 1
            ? 'grid gap-3 sm:grid-cols-2'
            : 'grid gap-3'
        }
      >
        {visibleItems.map((item, idx) => (
          <AffiliateCard key={`${item.provider}-${idx}`} item={item} />
        ))}
      </div>
    </aside>
  );
}

interface AffiliateCardProps {
  item: AffiliateItem;
}

/**
 * 1 案件のカード。
 *
 * - 画像が指定されていればサムネ + テキスト、なければテキストオンリー
 * - 全リンクに `rel="noopener noreferrer sponsored"`（広告リンクの推奨属性）
 * - `[PR] {プロバイダ名}` を必ずカード上部に表示（ステマ規制対応）
 */
function AffiliateCard({ item }: AffiliateCardProps): JSX.Element {
  const providerLabel = PROVIDER_LABEL[item.provider];
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer sponsored"
      className="group flex flex-col gap-2 rounded-xl border border-ramen-broth/40 bg-white p-3 text-left shadow-sm transition hover:border-ramen-chili/60 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ramen-chili/60"
      data-provider={item.provider}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-ramen-chili/10 px-2 py-0.5 text-[10px] font-bold text-ramen-chili">
          <span aria-hidden="true">PR</span>
          <span className="sr-only">広告:</span>
        </span>
        <span className="text-[10px] text-ramen-soy/60">{providerLabel}</span>
      </div>

      {item.imageUrl ? (
        // 画像は 300x300 想定。カード幅いっぱいに引き伸ばさないよう max-w で制約して中央寄せする。
        // これにより Rakuten 等の正方形サムネがぼやけずに表示される。
        // width/height 属性はレイアウトシフト (CLS) 対策で明示。
        <div className="mx-auto w-full max-w-[240px] overflow-hidden rounded-lg bg-ramen-broth/10">
          <img
            src={item.imageUrl}
            alt=""
            loading="lazy"
            width={300}
            height={300}
            className="block h-auto w-full object-cover"
          />
        </div>
      ) : null}

      <p className="text-sm font-bold leading-snug text-ramen-soy group-hover:text-ramen-chili">
        {item.text}
      </p>
      {item.subText ? (
        <p className="text-xs leading-relaxed text-ramen-soy/70">{item.subText}</p>
      ) : null}
    </a>
  );
}
