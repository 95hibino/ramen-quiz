import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { Header } from '@/components/common/Header';
import { Footer } from '@/components/common/Footer';
import { LoadingFallback } from '@/components/common/LoadingFallback';

// Route-based code splitting
// -------------------------------------------------------------
// 各ページを React.lazy でチャンク分割し、初回ロードを軽量化する。
// 全ページが named export のため、default export に橋渡しする形で lazy 化。
// 破壊的変更を避けるため、各ページ側の export 形式 (export function Xxx()) はそのまま維持。
//
// 主要ページ (Home / KnowledgeQuiz) は preload 対象。手動 preload は
// リンクホバー時に import() を叩くパターンもあるが、ここでは Vite の
// prefetch 挙動と初期表示のバランスを重視して静的な lazy のみで開始。
const Home = lazy(() => import('@/pages/Home').then((m) => ({ default: m.Home })));
const KnowledgeQuiz = lazy(() =>
  import('@/pages/KnowledgeQuiz').then((m) => ({ default: m.KnowledgeQuiz })),
);
const KnowledgeQuizPlay = lazy(() =>
  import('@/pages/KnowledgeQuizPlay').then((m) => ({ default: m.KnowledgeQuizPlay })),
);
const PhotoQuiz = lazy(() => import('@/pages/PhotoQuiz').then((m) => ({ default: m.PhotoQuiz })));
const PhotoQuizPlay = lazy(() =>
  import('@/pages/PhotoQuizPlay').then((m) => ({ default: m.PhotoQuizPlay })),
);
const PhotoSubmit = lazy(() =>
  import('@/pages/PhotoSubmit').then((m) => ({ default: m.PhotoSubmit })),
);
const Result = lazy(() => import('@/pages/Result').then((m) => ({ default: m.Result })));
const About = lazy(() => import('@/pages/About').then((m) => ({ default: m.About })));
const NotFound = lazy(() => import('@/pages/NotFound').then((m) => ({ default: m.NotFound })));
const Signup = lazy(() => import('@/pages/Signup').then((m) => ({ default: m.Signup })));
const Login = lazy(() => import('@/pages/Login').then((m) => ({ default: m.Login })));
const Ranking = lazy(() => import('@/pages/Ranking').then((m) => ({ default: m.Ranking })));
const MyPage = lazy(() => import('@/pages/MyPage').then((m) => ({ default: m.MyPage })));
const Privacy = lazy(() => import('@/pages/Privacy').then((m) => ({ default: m.Privacy })));
const Terms = lazy(() => import('@/pages/Terms').then((m) => ({ default: m.Terms })));
const Contact = lazy(() => import('@/pages/Contact').then((m) => ({ default: m.Contact })));
const Faq = lazy(() => import('@/pages/Faq').then((m) => ({ default: m.Faq })));
const Glossary = lazy(() => import('@/pages/Glossary').then((m) => ({ default: m.Glossary })));
const Regions = lazy(() => import('@/pages/Regions').then((m) => ({ default: m.Regions })));
const RegionDetail = lazy(() =>
  import('@/pages/RegionDetail').then((m) => ({ default: m.RegionDetail })),
);

function App(): JSX.Element {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/quiz/knowledge" element={<KnowledgeQuiz />} />
            <Route path="/quiz/knowledge/:categoryId" element={<KnowledgeQuizPlay />} />
            <Route path="/quiz/photo" element={<PhotoQuiz />} />
            <Route path="/quiz/photo/play" element={<PhotoQuizPlay />} />
            <Route path="/quiz/photo/submit" element={<PhotoSubmit />} />
            <Route path="/result" element={<Result />} />
            <Route path="/about" element={<About />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/login" element={<Login />} />
            <Route path="/ranking" element={<Ranking />} />
            <Route path="/mypage" element={<MyPage />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/faq" element={<Faq />} />
            <Route path="/glossary" element={<Glossary />} />
            <Route path="/regions" element={<Regions />} />
            <Route path="/regions/:prefectureSlug" element={<RegionDetail />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}

export default App;
