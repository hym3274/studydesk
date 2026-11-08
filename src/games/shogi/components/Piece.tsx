import { memo } from 'react';
import { pieceLabel } from '../engine/game';
import type { Piece as ShogiPiece } from '../engine/types';
import './board.css';

export const Piece = memo(function Piece({ piece, rotated = false }: { piece: ShogiPiece; rotated?: boolean }) {
  return <span className={`piece${rotated ? ' piece-rotated' : ''}${piece.promoted ? ' piece-promoted' : ''}`} aria-hidden="true">
    <span className="piece-face"><span>{pieceLabel(piece)}</span></span>
  </span>;
});
