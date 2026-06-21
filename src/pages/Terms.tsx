import { Link } from 'react-router-dom';
import { Seo } from '@/components/common/Seo';
import { TermsOfServiceContent } from '@/content/termsOfService';

/**
 * 利用規約ページ (`/terms`)。
 *
 * 本文は `content/termsOfService.tsx` に集約。
 */
export function Terms(): JSX.Element {
  return (
    <div className="card space-y-6">
      <Seo
        title="利用規約"
        description="ラーメンクイズの利用条件・禁止事項・投稿コンテンツの取扱いについて定めます。"
        url="/terms"
      />
      <h1 className="text-2xl font-black text-ramen-soy">利用規約</h1>
      <TermsOfServiceContent />
      <div className="flex flex-wrap gap-4 border-t border-ramen-soy/10 pt-4 text-sm">
        <Link to="/privacy" className="font-bold text-ramen-chili hover:underline">
          プライバシーポリシー →
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
