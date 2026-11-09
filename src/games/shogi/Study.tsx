import { useMemo, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Heading } from '@astryxdesign/core/Heading';
import { HStack } from '@astryxdesign/core/HStack';
import { VStack } from '@astryxdesign/core/VStack';
import { Text } from '@astryxdesign/core/Text';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { ExperimentUI } from '../../ui/ExperimentUI';
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
  return <ExperimentUI><main className="shogi-app study-page experiment-study"><header className="experiment-study-header">
    <Button href="/tools/01" label="将棋へ" variant="ghost" />
    <Heading level={1}>{mode === 'puzzles' ? '詰将棋' : '戦法解説'}</Heading>
  </header>{mode === 'lessons' ? <VStack className="experiment-pending" hAlign="center"><Text type="supporting">準備中</Text></VStack> : <PuzzleCollection />}</main></ExperimentUI>;
}
function PuzzleCollection() {
  const [index, setIndex] = useState(0);
  return <><HStack className="experiment-problems" hAlign="center"><SegmentedControl label="問題を選択" size="lg" value={String(index)} onChange={value => setIndex(Number(value))}>
    {puzzles.map((p,i) => <SegmentedControlItem key={p.name} value={String(i)} label={p.name} />)}
    </SegmentedControl></HStack>
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
    <HStack hAlign="center" className="study-feedback"><Text role="status">{message}</Text></HStack>
    <VStack className="play-space study-play-space">
      <Board position={position} flipped={false} selected={selected} destinations={new Set(choices.map(m => m.to))}
        lastMove={last} checkedKing={solved ? position.board.findIndex(p => p?.kind === 'K' && p.color === 'gote') : null}
        onSquare={onSquare} onCancel={cancel} />
      <HandStand position={position} color="sente" top={false} faceToFace={false} selected={hand}
        onSelect={kind => {setSelected(null);setHand(hand === kind ? null : kind);}} ended={solved} />
    </VStack>
    <HStack className="experiment-controls" hAlign="center" gap={3}><Button label="ヒント" onClick={() => setMessage(puzzle.hint)} variant="primary" size="lg" /><Button label="やり直す" onClick={reset} size="lg" /></HStack>
    {solved && <Text as="p" className="study-explanation">{puzzle.explanation}</Text>}
    <details className="study-rules"><summary>ルール</summary><p>先手で王手をかけ、１手で詰ませてください。玉方の持ち駒は盤上と攻め方の持ち駒を除く残り全部です。二歩・打ち歩詰めなどの禁手は選べません。自玉は盤面の右下に置いています。</p></details>
    {promotion.length > 0 && <Modal title="成りますか" onClose={() => setPromotion([])}><div className="promotion-choices">
      {promotion.map(m => m.type === 'move' && <button key={String(m.promote)} onClick={() => attempt(m)}>
        <Piece piece={{...position.board[m.from]!,promoted:m.promote}} /><span>{m.promote ? '成る' : '成らない'}</span></button>)}
    </div></Modal>}
  </>;
}
