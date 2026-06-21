import { Link } from 'react-router-dom';

export function NotFound(): JSX.Element {
  return (
    <div className="card text-center">
      <p className="text-5xl" aria-hidden="true">
        🍥
      </p>
      <h1 className="mt-3 text-2xl font-black text-ramen-soy">ページが見つかりません</h1>
      <p className="mt-2 text-sm text-ramen-soy/70">
        URL をご確認ください。トップページからやり直せます。
      </p>
      <Link to="/" className="btn-primary mt-5 inline-flex">
        トップへ戻る
      </Link>
    </div>
  );
}
