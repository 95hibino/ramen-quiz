import { Route, Routes } from 'react-router-dom';
import { Header } from '@/components/common/Header';
import { Footer } from '@/components/common/Footer';
import { Home } from '@/pages/Home';
import { KnowledgeQuiz } from '@/pages/KnowledgeQuiz';
import { KnowledgeQuizPlay } from '@/pages/KnowledgeQuizPlay';
import { PhotoQuiz } from '@/pages/PhotoQuiz';
import { PhotoQuizPlay } from '@/pages/PhotoQuizPlay';
import { PhotoSubmit } from '@/pages/PhotoSubmit';
import { Result } from '@/pages/Result';
import { About } from '@/pages/About';
import { NotFound } from '@/pages/NotFound';
import { Signup } from '@/pages/Signup';
import { Login } from '@/pages/Login';
import { Ranking } from '@/pages/Ranking';
import { MyPage } from '@/pages/MyPage';
import { Privacy } from '@/pages/Privacy';
import { Terms } from '@/pages/Terms';
import { Contact } from '@/pages/Contact';
import { Faq } from '@/pages/Faq';
import { Glossary } from '@/pages/Glossary';
import { Regions } from '@/pages/Regions';
import { RegionDetail } from '@/pages/RegionDetail';

function App(): JSX.Element {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
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
      </main>
      <Footer />
    </div>
  );
}

export default App;
