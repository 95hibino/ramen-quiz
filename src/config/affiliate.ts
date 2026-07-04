/**
 * アフィリエイト案件の設定。
 *
 * 各 `slot`（配置場所）に対し、表示する案件を配列で定義する。
 * 案件 URL は `import.meta.env.VITE_AFF_*` 環境変数から読み込み、
 * 未設定（空文字）の案件はコンポーネント側でスキップされる。
 *
 * 社長の作業:
 * 1. アフィリエイトサービス（楽天 / A8.net / もしも / Amazon）に登録
 * 2. 案件ごとに発行された専用 URL を `.env.local` の `VITE_AFF_*` に設定
 * 3. Vercel Dashboard の Environment Variables にも同じ値を登録
 *
 * 案件の追加・差し替え:
 * - 本ファイルの `AFFILIATE_ITEMS` を編集
 * - 必要に応じて `.env.example` および `src/vite-env.d.ts` に環境変数キーを追加
 *
 * 詳細は `docs/AFFILIATE_SETUP.md` を参照。
 */

/** アフィリエイトを配置するスロット（画面上の位置）の識別子。 */
export type AffiliateSlot = 'result-bottom' | 'photo-shop-info' | 'footer' | 'home-bottom';

/** アフィリエイトプロバイダ（広告主サービス）。 */
export type AffiliateProvider = 'rakuten' | 'a8' | 'moshimo' | 'amazon';

/** 各プロバイダの表示名（カードの「PR ラベル」横に出すサービス名）。 */
export const PROVIDER_LABEL: Record<AffiliateProvider, string> = {
  rakuten: '楽天アフィリエイト',
  a8: 'A8.net',
  moshimo: 'もしもアフィリエイト',
  amazon: 'Amazonアソシエイト',
};

/** 1 件のアフィリエイト案件。 */
export interface AffiliateItem {
  /** どのプロバイダの案件か。 */
  provider: AffiliateProvider;
  /** カードに表示する主見出し（クリックを誘うキャッチ）。 */
  text: string;
  /** リンク先 URL。空文字なら表示スキップ（環境変数未設定時の挙動）。 */
  url: string;
  /** 任意。バナー画像 URL。指定するとカードに画像を表示する。 */
  imageUrl?: string;
  /** 任意。テキストオンリー時の補助説明。 */
  subText?: string;
}

/**
 * 各スロットに表示する案件配列。
 *
 * URL は `import.meta.env.VITE_AFF_*` から読み込む。未設定なら空文字となり、
 * `AffiliateBanner` 側で案件がスキップされる（= 何も表示されない）。
 *
 * Vite は `import.meta.env` の参照を**ビルド時静的置換**するため、
 * 動的キー参照は不可。プロパティを直接参照する。
 */
/**
 * 楽天アフィリエイト: 博多一風堂ラーメンセット（2年連続 楽天グルメ大賞）。
 * URL は公開 URL（アフィリエイト ID を含む）なので、そのままリポに置いて問題ない。
 * 画像 URL は Rakuten のインプレッショントラッキングも兼ねる (`hbb.afl.rakuten.co.jp`)。
 * env var が設定されていればそちらを優先し、未設定時はハードコード値をフォールバックとして使う。
 */
const RAKUTEN_IPPUDO_URL =
  'https://hb.afl.rakuten.co.jp/ichiba/55782e19.5af60877.55782e1a.656821b1/?pc=https%3A%2F%2Fitem.rakuten.co.jp%2Fippudo-os%2F6408%2F&link_type=picttext&ut=eyJwYWdlIjoiaXRlbSIsInR5cGUiOiJwaWN0dGV4dCIsInNpemUiOiIzMDB4MzAwIiwibmFtIjoxLCJuYW1wIjoicmlnaHQiLCJjb20iOjEsImNvbXAiOiJkb3duIiwicHJpY2UiOjEsImJvciI6MSwiY29sIjoxLCJiYnRuIjoxLCJwcm9kIjowLCJhbXAiOmZhbHNlfQ%3D%3D';
const RAKUTEN_IPPUDO_IMAGE =
  'https://hbb.afl.rakuten.co.jp/hgb/55782e19.5af60877.55782e1a.656821b1/?me_id=1405989&item_id=10000043&pc=https%3A%2F%2Fthumbnail.image.rakuten.co.jp%2F%400_mall%2Fippudo-os%2Fcabinet%2Fshouhintouroku%2Fnekopos%2Fsamune800.jpg%3F_ex%3D300x300&s=300x300&t=picttext';

export const AFFILIATE_ITEMS: Record<AffiliateSlot, AffiliateItem[]> = {
  'result-bottom': [
    {
      provider: 'rakuten',
      text: '博多一風堂 選べるラーメンセット【2年連続 楽天グルメ大賞】',
      url: import.meta.env.VITE_AFF_RAKUTEN_RAMEN_RANKING || RAKUTEN_IPPUDO_URL,
      imageUrl: RAKUTEN_IPPUDO_IMAGE,
      subText: '1,000円（税込・送料無料）／ とんこつ 2〜8 食のお試しセット',
    },
    {
      provider: 'amazon',
      text: 'ラーメン関連書籍ベストセラー',
      url: import.meta.env.VITE_AFF_AMAZON_RAMEN_BOOKS ?? '',
      subText: 'Amazon で人気のラーメン本・レシピ本をチェック',
    },
  ],
  'photo-shop-info': [
    {
      provider: 'a8',
      text: '食べログでこのお店を予約する',
      url: import.meta.env.VITE_AFF_A8_TABELOG ?? '',
      subText: '人気店は予約必須。空席をチェック',
    },
  ],
  footer: [
    {
      provider: 'moshimo',
      text: 'おすすめラーメン本',
      url: import.meta.env.VITE_AFF_MOSHIMO_RAMEN ?? '',
    },
  ],
  'home-bottom': [
    {
      provider: 'rakuten',
      text: '博多一風堂 選べるラーメンセット【2年連続 楽天グルメ大賞】',
      url: import.meta.env.VITE_AFF_RAKUTEN_RAMEN_RANKING || RAKUTEN_IPPUDO_URL,
      imageUrl: RAKUTEN_IPPUDO_IMAGE,
      subText: '1,000円（税込・送料無料）／ 楽天市場で全国の名店ラーメン',
    },
  ],
};
