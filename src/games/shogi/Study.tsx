import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Board } from './components/Board';
import { HandStand } from './components/HandStand';
import { Modal } from '../../components/Modal';
import { Piece } from './components/Piece';
import { getLegalMoves, hasLegalMove, isInCheck, playMove } from './engine/rules';
import { type HandKind, type Move } from './engine/types';
import { puzzles } from './study-data';
import './shogi.css';
import './study.css';

export default function Study({ mode }: { mode: 'puzzles' | 'lessons' }) {
  return <main className="shogi-app study-page"><header className="study-header">
    <Link to="/tools/01" className="study-back" aria-label="将棋のメニューへ">←</Link>
    <h1>{mode === 'puzzles' ? '詰将棋' : '戦法解説'}</h1>
  </header>{mode === 'lessons' ? <p className="study-pending">準備中</p> : <PuzzleCollection />}</main>;
}
function PuzzleCollection() {
  const [index, setIndex] = useState(0);
  return <><nav className="study-tabs" aria-label="問題を選択">{puzzles.map((p,i) => <button key={p.name}
    aria-current={index === i ? 'page' : undefined} onClick={() => setIndex(i)}>{p.name}</button>)}</nav>
    <Puzzle key={index} index={index} /></>;
}
function Puzzle({ index }: { index: number }) {
  const puzzle = puzzles[index]!;
  const [position, setPosition] = useState(puzzle.position);
  const [selected, setSelected] = useState<number | null>(null);
  const [hand, setHand] = useState<HandKind | null>(null);
  const [promotion, setPromotion] = useState<Move[]>([]);
  const [last, setLast] = useState<Move>();
  const [message, setMessage] = useState('１手詰');
  const [solved, setSolved] = useState(false);
  const legal = useMemo(() => solved ? [] : getLegalMoves(position), [position,solved]);
  const choices = legal.filter(m => m.type === 'drop' ? m.kind === hand : m.from === selected);
  function cancel() { setSelected(null); setHand(null); }
  function attempt(move: Move) {
    setPromotion([]);
    const next = playMove(position,move);
    if (isInCheck(next,'gote') && !hasLegalMove(next)) {
      setPosition(next); setSolved(true); setLast(move); setMessage('正解');
    } else setMessage(isInCheck(next,'gote') ? '逃げ道が残っています' : '王手をかけてください');
    cancel();
  }
  function onSquare(to: number) {
    if (solved) return;
    const moves = choices.filter(m => m.to === to);
    if (moves.length > 1) { setPromotion(moves); return; }
    if (moves[0]) { attempt(moves[0]); return; }
    if (position.board[to]?.color === 'sente') { setHand(null); setSelected(selected === to ? null : to); }
    else cancel();
  }
  function reset() { setPosition(puzzle.position); setSolved(false); setMessage('１手詰'); setLast(undefined); cancel(); }
  return <>
    <div className="study-feedback" role="status">{message}</div>
    <div className="play-space study-play-space">
      <Board position={position} flipped={false} selected={selected} destinations={new Set(choices.map(m => m.to))}
        lastMove={last} checkedKing={solved ? position.board.findIndex(p => p?.kind === 'K' && p.color === 'gote') : null}
        onSquare={onSquare} onCancel={cancel} />
      <HandStand position={position} color="sente" top={false} faceToFace={false} selected={hand}
        onSelect={kind => {setSelected(null);setHand(hand === kind ? null : kind);}} ended={solved} />
    </div>
    <div className="study-controls"><button onClick={() => setMessage(puzzle.hint)}>ヒント</button><button onClick={reset}>やり直す</button></div>
    {solved && <p className="study-explanation">{puzzle.explanation}</p>}
    <details className="study-rules"><summary>ルール</summary><p>先手で王手をかけ、１手で詰ませてください。玉方の持ち駒は盤上と攻め方の持ち駒を除く残り全部です。二歩・打ち歩詰めなどの禁手は選べません。自玉は盤面の右下に置いています。</p></details>
    {promotion.length > 0 && <Modal title="成りますか" onClose={() => setPromotion([])}><div className="promotion-choices">
      {promotion.map(m => m.type === 'move' && <button key={String(m.promote)} onClick={() => attempt(m)}>
        <Piece piece={{...position.board[m.from]!,promoted:m.promote}} /><span>{m.promote ? '成る' : '成らない'}</span></button>)}
    </div></Modal>}
  </>;
}
