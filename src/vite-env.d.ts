/// <reference types="vite/client" />

/**
 * Vite が `import.meta.env` に注入する環境変数の型定義。
 * `VITE_` プレフィックス付き変数のみクライアントに公開される。
 */
interface ImportMetaEnv {
  /** 本番デプロイ時のサイト絶対 URL (例: `https://ramen-quiz.example.com`)。 */
  readonly VITE_SITE_URL?: string;
  /** Supabase プロジェクト URL (例: `https://xxxx.supabase.co`)。 */
  readonly VITE_SUPABASE_URL?: string;
  /** Supabase anon キー (公開鍵)。 */
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** Supabase Storage バケット名 (デフォルト `photo-quiz-user`)。 */
  readonly VITE_SUPABASE_STORAGE_BUCKET?: string;
  /** Google AdSense パブリッシャー ID (例: `ca-pub-XXXXXXXXXXXXXXXX`)。未設定なら広告は全プレースホルダ表示。 */
  readonly VITE_ADSENSE_CLIENT_ID?: string;
  /** AdSense スロット ID: ホーム top の Leaderboard 枠 (728×90)。 */
  readonly VITE_ADSENSE_SLOT_HOME_TOP?: string;
  /** AdSense スロット ID: 知識クイズカテゴリ画面 top の Leaderboard 枠 (728×90)。 */
  readonly VITE_ADSENSE_SLOT_KNOWLEDGE_TOP?: string;
  /** AdSense スロット ID: 結果画面の Medium Rectangle 枠 (300×250)。 */
  readonly VITE_ADSENSE_SLOT_RESULT?: string;
  /** AdSense スロット ID: フッターのモバイルバナー枠 (320×50)。 */
  readonly VITE_ADSENSE_SLOT_FOOTER?: string;
  /** AdSense スロット ID: プレイ中インフィード枠 (Responsive)。 */
  readonly VITE_ADSENSE_SLOT_IN_FEED?: string;
  /** プライバシーポリシー等に表示する運営者名。未設定なら `src/content/legalMeta.ts` のデフォルト値。 */
  readonly VITE_OPERATOR_NAME?: string;
  /** プライバシーポリシー等に表示する運営者連絡先 (メールアドレス)。 */
  readonly VITE_OPERATOR_CONTACT?: string;
  /** アフィリエイト URL: 楽天アフィリエイト・お取り寄せラーメンランキング。未設定なら該当枠は非表示。 */
  readonly VITE_AFF_RAKUTEN_RAMEN_RANKING?: string;
  /** アフィリエイト URL: A8.net・食べログ予約。未設定なら該当枠は非表示。 */
  readonly VITE_AFF_A8_TABELOG?: string;
  /** アフィリエイト URL: もしもアフィリエイト・ラーメン関連商品。未設定なら該当枠は非表示。 */
  readonly VITE_AFF_MOSHIMO_RAMEN?: string;
  /** アフィリエイト URL: Amazon アソシエイト・ラーメン関連書籍。未設定なら該当枠は非表示。 */
  readonly VITE_AFF_AMAZON_RAMEN_BOOKS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/**
 * Google AdSense が `window` に追加する `adsbygoogle` キュー。
 *
 * AdSense のスニペットは `(window.adsbygoogle = window.adsbygoogle || []).push({})`
 * を実行するため、配列および `push` のシグネチャを宣言する。
 */
interface Window {
  adsbygoogle?: Array<Record<string, unknown>>;
}
