import { lazy, Suspense, useState } from 'react';
import { Link, Route, Routes, useNavigate } from 'react-router-dom';
import { Button } from '@astryxdesign/core/Button';
import { VStack } from '@astryxdesign/core/VStack';
import { ExperimentUI } from '../../ui/ExperimentUI';
import { Board } from './components/Board';
import { HandStand } from './components/HandStand';
import { newGame } from './engine/game';
import { browserStorage, type StoredSession } from './persistence';
import { loadHomeState } from './home-state';
import { Modal } from '../../components/Modal';
import { HStack } from '@astryxdesign/core/HStack';
import { Text } from '@astryxdesign/core/Text';
import './shogi.css';
import './study.css';
const Match = lazy(() => import('./ShogiGame'));
const Study = lazy(() => import('./Study'));
const noDestinations = new Set<number>();
const ignoreBackdropInput = () => {};
function BoardBackdrop({ state }: { state: ReturnType<typeof loadHomeState> }) {
  const { background: position, lastMove, session: { preferences } } = state;
  const flipped = state.canResume && preferences.flipped;
  return <VStack className="experiment-backdrop" aria-hidden="true" inert>
    <VStack className="play-space experiment-backdrop-board">
      <Board position={position} flipped={flipped} selected={null} destinations={noDestinations} lastMove={lastMove}
        checkedKing={null} onSquare={ignoreBackdropInput} onCancel={ignoreBackdropInput} />
      <HandStand position={position} color={flipped ? 'sente' : 'gote'} top faceToFace={preferences.faceToFace} selected={null} ended onSelect={ignoreBackdropInput} />
      <HandStand position={position} color={flipped ? 'gote' : 'sente'} top={false} faceToFace={preferences.faceToFace} selected={null} ended onSelect={ignoreBackdropInput} />
    </VStack>
  </VStack>;
}
export default function ShogiHome() {
  const [initialSession, setInitialSession] = useState<StoredSession>();
  return <Suspense fallback={<main className="loading">読み込み中</main>}><Routes>
    <Route index element={<HomeMenu onResume={() => setInitialSession(undefined)} onNew={setInitialSession} />} />
    <Route path="match" element={<Match initialSession={initialSession} />} />
    <Route path="puzzles" element={<Study mode="puzzles" />} />
    <Route path="lessons" element={<Study mode="lessons" />} />
    <Route path="*" element={<main className="not-found"><Link to="/tools/01">将棋へ</Link></main>} />
  </Routes></Suspense>;
}
function HomeMenu({ onResume, onNew }: { onResume: () => void; onNew: (session: StoredSession) => void }) {
  const [state] = useState(() => loadHomeState(browserStorage()));
  const [confirmNew, setConfirmNew] = useState(false);
  const navigate = useNavigate();
  function startNew() {
    onNew({ game: newGame(), preferences: state.session.preferences });
    navigate('/tools/01/match');
  }
  return <ExperimentUI><main className="experiment-home">
      <BoardBackdrop state={state} />
      <Button className="experiment-back" href="/" label="一覧へ" variant="ghost" />
      <VStack className="experiment-home-content" gap={10}>
        <h1 className="experiment-title">将棋</h1><nav aria-label="将棋のメニュー"><VStack gap={3}>
          <Button href="/tools/01/match" onClick={state.canResume ? onResume : () => onNew({ game: newGame(), preferences: state.session.preferences })} label={state.canResume ? '対人対戦 / 続きから' : '対人対戦'} variant="primary" size="lg" width="100%" />
          {state.canResume && <Button onClick={() => setConfirmNew(true)} label="対人対戦 / はじめから" variant="secondary" size="lg" width="100%" />}
          <Button href="/tools/01/puzzles" label="詰将棋" variant="secondary" size="lg" width="100%" />
          <Button href="/tools/01/lessons" label="戦法解説" variant="secondary" size="lg" width="100%" />
        </VStack></nav>
      </VStack>
      {confirmNew && <Modal title="はじめから始めますか" onClose={() => setConfirmNew(false)}>
        <VStack gap={5}><Text>保存されている対局を新しい対局に置き換えます</Text>
          <HStack gap={3}><Button label="戻る" onClick={() => setConfirmNew(false)} />
            <Button label="はじめから始める" variant="primary" onClick={startNew} /></HStack></VStack>
      </Modal>}
    </main></ExperimentUI>;
}
