import { Link } from 'react-router-dom';
import { Seo } from '@/components/common/Seo';
import { StructuredData } from '@/components/common/StructuredData';
import { buildSiteUrl, SITE_NAME } from '@/config/site';

export function About(): JSX.Element {
  const aboutSchema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    name: `${SITE_NAME} について`,
    description:
      'ラーメンクイズの趣旨・データソース・運営方針・技術構成について説明するページ。',
    url: buildSiteUrl('/about'),
    inLanguage: 'ja',
  };

  return (
    <div className="card space-y-4">
      <Seo
        title="このサイトについて"
        description="ラーメンクイズの趣旨・データソース・運営方針について。ラーメンの歴史・地域文化・製麺技術を 4 択クイズで楽しく学べる無料サービスです。"
        url="/about"
      />
      <StructuredData schema={aboutSchema} />
      <h1 className="text-2xl font-black text-ramen-soy">このサイトについて</h1>
      <p className="text-sm leading-relaxed text-ramen-soy/80">
        本サイトはラーメンの歴史・地域・文化・製麺技術などを楽しく学べる 4 択クイズアプリです。
        Phase 1 (MVP) ではローカルモックデータで動作しており、Supabase・Cloudinary・Google AdSense 等の
        外部サービスは Phase 2 以降で接続予定です。
      </p>
      <p className="text-sm leading-relaxed text-ramen-soy/80">
        問題の内容は一般的に流通しているラーメン知識に基づきますが、店舗・歴史については諸説あります。
        誤りを発見された場合はぜひフィードバックをお寄せください。
      </p>
      <Link to="/" className="btn-secondary inline-flex">
        トップへ戻る
      </Link>
    </div>
  );
}
