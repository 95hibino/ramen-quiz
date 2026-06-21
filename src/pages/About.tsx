import { Link } from 'react-router-dom';
import { Seo } from '@/components/common/Seo';

export function About(): JSX.Element {
  return (
    <div className="card space-y-4">
      <Seo
        title="このサイトについて"
        description="ラーメンクイズの趣旨・データソース・Phase 計画について。"
      />
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
