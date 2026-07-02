import { Link } from 'react-router-dom';
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
          © {year} Ramen Quiz — Phase 1 MVP (ローカルモック動作中)
        </p>
      </div>
    </footer>
  );
}
