import { useRef, useState, type KeyboardEvent } from 'react';
import { VStack } from '@astryxdesign/core/VStack';
import { colorName, initialPosition, type Position } from './engine';
import './reversi.css';
const initial = initialPosition();
export function Disc({ color }: { color: 'black' | 'white' }) {
  return <i className={`rv-disc rv-${color}`} aria-hidden="true" />;
}
export function Board({ position, flipped = false, legal = [], last, onMove, decorative = false }: {
  position: Position; flipped?: boolean; legal?: readonly number[]; last?: number;
  onMove?: (square: number) => void; decorative?: boolean;
}) {
  const root = useRef<HTMLElement>(null), [focused,setFocused] = useState(19);
  const squares = Array.from({length:64},(_,i) => flipped ? 63-i : i);
  function keydown(event: KeyboardEvent<HTMLElement>) {
    const delta = {ArrowLeft:-1,ArrowRight:1,ArrowUp:-8,ArrowDown:8}[event.key];
    if (!delta) return;
    event.preventDefault();
    const visual = flipped ? 63-focused : focused, next = visual+delta;
    if (next < 0 || next > 63 || event.key === 'ArrowLeft' && visual%8 === 0 || event.key === 'ArrowRight' && visual%8 === 7) return;
    root.current?.querySelector<HTMLButtonElement>(`[data-cell="${flipped ? 63-next : next}"]`)?.focus();
  }
  return <VStack ref={root} className="rv-board" role={decorative ? undefined : 'group'} aria-label={decorative ? undefined : 'オセロ盤。矢印キーで移動、Enterで置く'} onKeyDown={keydown}>
    {squares.map(s => {
      const cell = position.board[s], available = legal.includes(s);
      const className = `rv-square${last === s ? ' rv-last' : ''}`;
      const content = cell ? <Disc color={cell} /> : available ? <i className="rv-legal" aria-hidden="true" /> : null;
      return decorative ? <i key={s} className={className}>{content}</i> : <button key={s} className={className} data-cell={s}
        aria-label={`${'ABCDEFGH'[s%8]}${Math.floor(s/8)+1} ${cell ? colorName(cell) : '空きマス'}${available ? ' 置けます' : ''}`}
        aria-disabled={!available} tabIndex={focused === s ? 0 : -1} onFocus={() => setFocused(s)}
        onClick={() => {if (available) onMove?.(s);}}>{content}</button>;
    })}
  </VStack>;
}
export default function Thumbnail({ label }: { label: string }) {
  return <section className="rv-thumbnail" role="img" aria-label={label}><Board position={initial} decorative /></section>;
}
