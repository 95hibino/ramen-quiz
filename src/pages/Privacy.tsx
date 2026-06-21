import { Link } from 'react-router-dom';
import { Seo } from '@/components/common/Seo';
import { PrivacyPolicyContent } from '@/content/privacyPolicy';

/**
 * プライバシーポリシーページ (`/privacy`)。
 *
 * 本文は `content/privacyPolicy.tsx` に集約。
 * SEO 用に noindex は付けない (検索エンジンからのアクセスを許可する)。
 */
export function Privacy(): JSX.Element {
  return (
    <div className="card space-y-6">
      <Seo
        title="プライバシーポリシー"
        description="ラーメンクイズが取得・利用するデータと第三者提供先について説明します。"
        url="/privacy"
      />
      <h1 className="text-2xl font-black text-ramen-soy">プライバシーポリシー</h1>
      <PrivacyPolicyContent />
      <div className="flex flex-wrap gap-4 border-t border-ramen-soy/10 pt-4 text-sm">
        <Link to="/terms" className="font-bold text-ramen-chili hover:underline">
          利用規約 →
        </Link>
        <Link to="/contact" className="font-bold text-ramen-chili hover:underline">
          お問い合わせ →
        </Link>
        <Link to="/" className="text-ramen-soy/70 hover:underline">
          トップへ戻る
        </Link>
      </div>
    </div>
  );
}
