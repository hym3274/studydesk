import { pieceLabel, playerName } from '../engine/game';
import { HAND_KINDS, type Color, type HandKind, type Position } from '../engine/types';
import { Piece } from './Piece';

export function HandStand({ position, color, top, faceToFace, selected, onSelect, ended }: {
  position: Position; color: Color; top: boolean; faceToFace: boolean; selected: HandKind | null;
  onSelect: (kind: HandKind) => void; ended: boolean;
}) {
  return <div className={`hand-stand ${top ? 'hand-top' : 'hand-bottom'}${top && faceToFace ? ' stand-facing' : ''}`}
    role="group" aria-label={`${playerName(color)}の駒台`}>
    <span className="player-marker" data-player={color} aria-hidden="true">
      <svg width="20" height="28" viewBox="0 0 20 28" fill="none">
        <path d="M10 1 17 5.5 19 27H1L3 5.5Z"
          fill={color === 'sente' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
      <span className="player-marker-label">{playerName(color)}</span>
    </span>
    <div className="hand-pieces">{HAND_KINDS.filter(kind => position.hands[color][kind] > 0).map(kind => {
      const count = position.hands[color][kind], piece = { kind, color, promoted: false };
      return <button key={kind} className={`hand-piece${selected === kind ? ' selected' : ''}${count > 1 ? ' stacked' : ''}`}
        aria-label={`${playerName(color)}の持ち駒 ${pieceLabel(piece)} ${count}枚`} aria-pressed={selected === kind}
        disabled={ended || position.turn !== color} onClick={() => onSelect(kind)}>
        <Piece piece={piece} />{count > 1 && <span className="piece-count" aria-hidden="true">{count}</span>}
      </button>;
    })}</div>
  </div>;
}
