import { lazy, Suspense } from 'react';
import { Link, Route, Routes } from 'react-router-dom';
import { Button } from '@astryxdesign/core/Button';
import { VStack } from '@astryxdesign/core/VStack';
import { ExperimentUI } from '../../ui/ExperimentUI';
import './study.css';
const Match = lazy(() => import('./ShogiGame'));
const Study = lazy(() => import('./Study'));
export default function ShogiHome() {
  return <Suspense fallback={<main className="loading">読み込み中</main>}><Routes>
    <Route index element={<ExperimentUI><main className="experiment-home">
      <Button className="experiment-back" href="/" label="一覧へ" variant="ghost" />
      <VStack className="experiment-home-content" gap={10}>
        <h1 className="experiment-title">将棋</h1><nav aria-label="将棋のメニュー"><VStack gap={3}>
          <Button href="/tools/01/match" label="対人対戦" variant="primary" size="lg" width="100%" />
          <Button href="/tools/01/puzzles" label="詰将棋" variant="secondary" size="lg" width="100%" />
          <Button href="/tools/01/lessons" label="戦法解説" variant="secondary" size="lg" width="100%" />
        </VStack></nav>
      </VStack>
    </main></ExperimentUI>} />
    <Route path="match" element={<Match />} />
    <Route path="puzzles" element={<Study mode="puzzles" />} />
    <Route path="lessons" element={<Study mode="lessons" />} />
    <Route path="*" element={<main className="not-found"><Link to="/tools/01">将棋へ</Link></main>} />
  </Routes></Suspense>;
}
