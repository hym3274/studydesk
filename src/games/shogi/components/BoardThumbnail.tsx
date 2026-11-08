import type { Kind } from '../engine/types';
import { Piece } from './Piece';
import './thumbnail.css';

// Same 9x9 indices as the playing board. Only the lower-left four files and
// four ranks are visible; this display never reads or writes the saved match.
const castle: readonly (readonly [number, Kind])[] = [
  [47, 'P'], [48, 'P'],
  [54, 'P'], [55, 'P'], [56, 'S'], [57, 'G'],
  [64, 'K'], [65, 'G'],
  [72, 'L'], [73, 'N'],
];

export default function BoardThumbnail({ label }: { label: string }) {
  return <div className="board-thumbnail" role="img" aria-label={label}>
    <div className="board-thumbnail-crop" aria-hidden="true">
      <div className="board">
        {castle.map(([square, kind]) => <span className="square" key={square} data-square={square}
          style={{ gridRow: Math.floor(square / 9) + 1, gridColumn: square % 9 + 1 }}>
          <Piece piece={{ kind, color: 'sente', promoted: false }} />
        </span>)}
      </div>
    </div>
  </div>;
}
