import { useRef, useState, type KeyboardEvent } from 'react';
import { pieceLabel, playerName, squareLabel } from '../engine/game';
import type { Color, Move, Position } from '../engine/types';
import { Piece } from './Piece';

export function Board({ position, flipped, selected, destinations, lastMove, checkedKing, onSquare, onCancel }: {
  position: Position; flipped: boolean; selected: number | null; destinations: ReadonlySet<number>;
  lastMove?: Move; checkedKing: number | null; onSquare: (s: number) => void; onCancel: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null), [focused, setFocused] = useState(56);
  const topColor: Color = flipped ? 'sente' : 'gote';
  const squares = Array.from({ length: 81 }, (_, i) => flipped ? 80-i : i);
  function handleKey(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') { onCancel(); return; }
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -9, ArrowDown: 9 }[event.key];
    if (!step) return;
    event.preventDefault();
    const visual = flipped ? 80-focused : focused;
    if (event.key === 'ArrowLeft' && visual % 9 === 0 || event.key === 'ArrowRight' && visual % 9 === 8) return;
    const next = visual + step;
    if (next < 0 || next > 80) return;
    const target = flipped ? 80-next : next;
    ref.current?.querySelector<HTMLButtonElement>(`[data-square="${target}"]`)?.focus();
  }
  return <div className="board-shell">
    <div className="file-labels" aria-hidden="true">{(flipped ? '１２３４５６７８９' : '９８７６５４３２１').split('').map(x => <span key={x}>{x}</span>)}</div>
    <div className="rank-labels" aria-hidden="true">{(flipped ? '九八七六五四三二一' : '一二三四五六七八九').split('').map(x => <span key={x}>{x}</span>)}</div>
    <div ref={ref} className="board" role="group" aria-label="将棋盤。矢印キーで移動、Enterで選択、Escapeで解除" onKeyDown={handleKey}>
      {squares.map(s => {
        const p = position.board[s], legal = destinations.has(s), isSelected = selected === s;
        const last = lastMove?.to === s || lastMove?.type === 'move' && lastMove.from === s;
        const checked = checkedKing === s;
        return <button key={s} type="button" data-square={s} tabIndex={focused === s ? 0 : -1}
          className={`square${isSelected ? ' selected' : ''}${legal ? ' legal' : ''}${last ? ' last-move' : ''}${checked ? ' checked' : ''}`}
          aria-label={`${squareLabel(s)} ${p ? `${playerName(p.color)}の${pieceLabel(p)}` : '空きマス'}${legal ? ' 移動可能' : ''}${checked ? ' 王手' : ''}`}
          aria-pressed={isSelected} onFocus={() => setFocused(s)} onClick={() => onSquare(s)}>
          {p && <Piece piece={p} rotated={p.color === topColor} />}
          {legal && <span className={`legal-indicator${p ? ' capture-indicator' : ''}`} aria-hidden="true" />}
        </button>;
      })}
    </div>
  </div>;
}
