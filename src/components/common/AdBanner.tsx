/**
 * 広告枠コンポーネント。
 *
 * 動作モード:
 * 1. **AdSense 配信モード**: `VITE_ADSENSE_CLIENT_ID` と該当 slot の
 *    `VITE_ADSENSE_SLOT_*` がともに設定済みのとき、`<ins class="adsbygoogle">` を
 *    レンダリングし、`pushAdsByGoogle()` で広告ロードを要求する。
 * 2. **プレースホルダモード**: 上記いずれかが未設定なら、設計書 §3.3 の固定枠を
 *    維持してプレースホルダ表示する（Phase 1 と同じ挙動）。
 *
 * いずれのモードでも CLS=0 を確保するため、外側 `<div>` で固定サイズを与え、
 * AdSense の `<ins>` はその中で `display:block; width:100%; height:100%` で伸縮させる。
 */

import { useEffect, useRef, type CSSProperties } from 'react';
import { getAdsenseClientId, isAdsenseConfigured, pushAdsByGoogle } from '@/lib/adsense';

export type AdSize = 'leaderboard' | 'medium-rectangle' | 'mobile-banner' | 'responsive';

/** 既知の広告スロット識別子。`AdBanner` の `slot` プロップに与える値。 */
export type AdSlotName =
  | 'home-top'
  | 'knowledge-top'
  | 'result'
  | 'footer'
  | 'in-feed'
  | (string & {}); // 互換性のため未知の slot 名も受け入れる (プレースホルダ表示)

interface AdBannerProps {
  /** 配置スロット識別子。AdSense 配信時はこの値から環境変数を解決する。 */
  slot: AdSlotName;
  size: AdSize;
  className?: string;
}

/** design §3.3 の広告サイズに対応する固定枠 */
const SIZE_STYLES: Record<AdSize, CSSProperties> = {
  leaderboard: { width: 728, height: 90, maxWidth: '100%' },
  'medium-rectangle': { width: 300, height: 250, maxWidth: '100%' },
  'mobile-banner': { width: 320, height: 50, maxWidth: '100%' },
  responsive: { width: '100%', minHeight: 100 },
};

const SIZE_LABEL: Record<AdSize, string> = {
  leaderboard: '728 × 90',
  'medium-rectangle': '300 × 250',
  'mobile-banner': '320 × 50',
  responsive: 'Responsive',
};

/**
 * AdBanner プロップ `slot` から対応する環境変数のスロット ID を取得する。
 *
 * - 未知の slot 名や未設定の環境変数なら空文字を返し、呼び出し側でプレースホルダ表示にフォールバックする。
 * - 環境変数の読み出しは `import.meta.env` のプロパティを直接参照する必要があるため
 *   （Vite のビルド時静的置換のため動的キー参照は不可）、`switch` で列挙する。
 */
function resolveSlotId(slot: AdSlotName): string {
  switch (slot) {
    case 'home-top':
      return import.meta.env.VITE_ADSENSE_SLOT_HOME_TOP ?? '';
    case 'knowledge-top':
      return import.meta.env.VITE_ADSENSE_SLOT_KNOWLEDGE_TOP ?? '';
    case 'result':
      return import.meta.env.VITE_ADSENSE_SLOT_RESULT ?? '';
    case 'footer':
      return import.meta.env.VITE_ADSENSE_SLOT_FOOTER ?? '';
    case 'in-feed':
      return import.meta.env.VITE_ADSENSE_SLOT_IN_FEED ?? '';
    default:
      return '';
  }
}

export function AdBanner({ slot, size, className }: AdBannerProps): JSX.Element {
  const slotId = resolveSlotId(slot);
  const adsenseEnabled = isAdsenseConfigured() && slotId.length > 0;

  // AdSense ロードを 1 度だけ要求する。同一マウント内で複数回 push しないように useRef でガード。
  const pushedRef = useRef(false);
  useEffect(() => {
    if (!adsenseEnabled) return;
    if (pushedRef.current) return;
    pushedRef.current = true;
    pushAdsByGoogle();
  }, [adsenseEnabled]);

  const containerClassName = `mx-auto flex items-center justify-center ${className ?? ''}`.trim();

  if (adsenseEnabled) {
    const clientId = getAdsenseClientId();
    return (
      <div
        role="complementary"
        aria-label={`広告 (${slot})`}
        data-ad-slot={slot}
        data-ad-size={size}
        className={containerClassName}
        style={SIZE_STYLES[size]}
      >
        <ins
          className="adsbygoogle"
          style={{ display: 'block', width: '100%', height: '100%' }}
          data-ad-client={clientId}
          data-ad-slot={slotId}
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      </div>
    );
  }

  // プレースホルダ (CLIENT_ID 未設定 or 該当 slot ID 未設定)
  return (
    <div
      role="complementary"
      aria-label={`広告枠 (${slot})`}
      data-ad-slot={slot}
      data-ad-size={size}
      className={`${containerClassName} rounded border border-dashed border-ramen-soy/30 bg-ramen-noodle/60 text-xs text-ramen-soy/60`}
      style={SIZE_STYLES[size]}
    >
      <span>
        Ad Placeholder — {slot} ({SIZE_LABEL[size]})
      </span>
    </div>
  );
}
