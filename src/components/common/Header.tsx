import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';

export function Header(): JSX.Element {
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.currentUser);
  const logout = useAuthStore((s) => s.logout);

  const handleLogout = () => {
    logout();
    navigate('/', { replace: true });
  };

  return (
    <header className="sticky top-0 z-20 border-b border-ramen-soy/10 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Link to="/" className="flex items-center gap-2 text-lg font-black text-ramen-soy">
          <span aria-hidden="true" className="text-2xl">
            🍜
          </span>
          <span>ラーメンクイズ</span>
        </Link>
        <nav className="flex flex-wrap items-center gap-4 text-sm font-bold">
          <Link to="/quiz/knowledge" className="text-ramen-chili hover:underline">
            知識クイズ
          </Link>
          <Link to="/quiz/photo" className="text-ramen-chili hover:underline">
            写真当てクイズ
          </Link>
          <Link to="/ranking" className="text-ramen-soy hover:underline">
            ランキング
          </Link>
          {currentUser ? (
            <>
              <Link to="/quiz/photo/submit" className="text-ramen-chili hover:underline">
                投稿する
              </Link>
              <Link to="/mypage" className="text-ramen-soy hover:underline">
                マイページ
              </Link>
              <span className="text-ramen-soy/70">
                ようこそ <span className="text-ramen-soy">{currentUser.username}</span> さん
              </span>
              <button
                type="button"
                onClick={handleLogout}
                className="text-ramen-soy/70 hover:text-ramen-chili hover:underline"
              >
                ログアウト
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="text-ramen-soy hover:underline">
                ログイン
              </Link>
              <Link to="/signup" className="text-ramen-soy hover:underline">
                新規登録
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
