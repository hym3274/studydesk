import { lazy, Suspense } from 'react';
import { Link, Route, Routes } from 'react-router-dom';
import './study.css';
const Match = lazy(() => import('./ShogiGame'));
const Study = lazy(() => import('./Study'));
export default function ShogiHome() {
  return <Suspense fallback={<main className="loading">読み込み中</main>}><Routes>
    <Route index element={<main className="shogi-home">
      <Link className="study-back" to="/" aria-label="一覧へ">←</Link>
      <div className="shogi-home-content"><h1>将棋</h1><nav aria-label="将棋のメニュー">
        <Link to="match">対人対戦</Link><Link to="puzzles">詰将棋</Link><Link to="lessons">戦法解説</Link>
      </nav></div>
    </main>} />
    <Route path="match" element={<Match />} />
    <Route path="puzzles" element={<Study mode="puzzles" />} />
    <Route path="lessons" element={<Study mode="lessons" />} />
    <Route path="*" element={<main className="not-found"><Link to="/tools/01">将棋へ</Link></main>} />
  </Routes></Suspense>;
}
