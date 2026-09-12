import { Link } from 'react-router-dom';
import { SITE_NAME, X_ACCOUNT_URL } from '@/config/site';
import { OPERATOR_NAME } from '@/content/legalMeta';
import { AdBanner } from './AdBanner';
import { AffiliateBanner } from './AffiliateBanner';

/**
 * フッター。
 *
 * - モバイルバナー広告
 * - 法務リンク (プライバシーポリシー / 利用規約 / お問い合わせ / このサイトについて)
 * - コピーライト
 */
export function Footer(): JSX.Element {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-12 border-t border-ramen-soy/10 bg-white/60">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 px-4 py-6">
        {/* design §3.3: フッター 320x50 モバイルバナー */}
        <AdBanner slot="footer" size="mobile-banner" />
        {/* 小さく目立たないアフィリエイト枠（環境変数未設定なら非表示）。 */}
        <div className="w-full max-w-sm text-xs">
          <AffiliateBanner slot="footer" />
        </div>
        <a
          href={X_ACCOUNT_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-xl bg-black px-4 py-2 text-sm font-bold text-white shadow-md transition hover:brightness-125 active:scale-95"
        >
          <XIcon />
          <span>毎日クイズを配信中 (@ramen_quiz_jp)</span>
        </a>
        <nav
          aria-label="法務・運営情報"
          className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs"
        >
          <Link to="/about" className="text-ramen-soy/80 hover:text-ramen-chili hover:underline">
            このサイトについて
          </Link>
          <span aria-hidden="true" className="text-ramen-soy/30">|</span>
          <Link to="/faq" className="text-ramen-soy/80 hover:text-ramen-chili hover:underline">
            FAQ / よくある質問
          </Link>
          <span aria-hidden="true" className="text-ramen-soy/30">|</span>
          <Link to="/articles" className="text-ramen-soy/80 hover:text-ramen-chili hover:underline">
            読みもの
          </Link>
          <span aria-hidden="true" className="text-ramen-soy/30">|</span>
          <Link to="/glossary" className="text-ramen-soy/80 hover:text-ramen-chili hover:underline">
            用語辞典
          </Link>
          <span aria-hidden="true" className="text-ramen-soy/30">|</span>
          <Link to="/regions" className="text-ramen-soy/80 hover:text-ramen-chili hover:underline">
            ご当地ラーメン
          </Link>
          <span aria-hidden="true" className="text-ramen-soy/30">|</span>
          <Link to="/privacy" className="text-ramen-soy/80 hover:text-ramen-chili hover:underline">
            プライバシーポリシー
          </Link>
          <span aria-hidden="true" className="text-ramen-soy/30">|</span>
          <Link to="/terms" className="text-ramen-soy/80 hover:text-ramen-chili hover:underline">
            利用規約
          </Link>
          <span aria-hidden="true" className="text-ramen-soy/30">|</span>
          <Link to="/contact" className="text-ramen-soy/80 hover:text-ramen-chili hover:underline">
            お問い合わせ
          </Link>
        </nav>
        <p className="text-xs text-ramen-soy/70">
          © {year} {SITE_NAME} / {OPERATOR_NAME}
        </p>
      </div>
    </footer>
  );
}

/** X (旧 Twitter) ロゴ。ShareButtons.tsx の同名アイコンと同一定義。 */
function XIcon(): JSX.Element {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zM17.083 19.77h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}
