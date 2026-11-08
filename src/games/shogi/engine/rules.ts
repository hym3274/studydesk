import { col, HAND_KINDS, inCamp, other, row, square, type Color, type Move, type Piece, type Position } from './types';

type Vector = readonly [number, number];
const kingSteps: readonly Vector[] = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
const goldSteps: readonly Vector[] = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,0]];
const diagonals: readonly Vector[] = [[-1,-1],[-1,1],[1,-1],[1,1]];
const orthogonals: readonly Vector[] = [[-1,0],[1,0],[0,-1],[0,1]];
const validSquare = (s: number) => Number.isInteger(s) && s >= 0 && s < 81;

function vectors(piece: Piece): { steps: readonly Vector[]; rays: readonly Vector[] } {
  if (piece.promoted && ['S','N','L','P'].includes(piece.kind)) return { steps: goldSteps, rays: [] };
  switch (piece.kind) {
    case 'K': return { steps: kingSteps, rays: [] };
    case 'G': return { steps: goldSteps, rays: [] };
    case 'S': return { steps: [[-1,-1],[-1,0],[-1,1],[1,-1],[1,1]], rays: [] };
    case 'N': return { steps: [[-2,-1],[-2,1]], rays: [] };
    case 'L': return { steps: [], rays: [[-1,0]] };
    case 'P': return { steps: [[-1,0]], rays: [] };
    case 'R': return { steps: piece.promoted ? diagonals : [], rays: orthogonals };
    case 'B': return { steps: piece.promoted ? orthogonals : [], rays: diagonals };
  }
}

/** Geometric attacks include friendly occupied destinations, for king safety. */
export function attacksFrom(position: Position, from: number): number[] {
  const piece = position.board[from];
  if (!piece) return [];
  const { steps, rays } = vectors(piece);
  const direction = piece.color === 'sente' ? 1 : -1;
  const result: number[] = [];
  for (const [dr, dc] of steps) {
    const r = row(from) + dr * direction, c = col(from) + dc * direction;
    if (r >= 0 && r < 9 && c >= 0 && c < 9) result.push(square(r, c));
  }
  for (const [dr, dc] of rays) {
    let r = row(from) + dr * direction, c = col(from) + dc * direction;
    while (r >= 0 && r < 9 && c >= 0 && c < 9) {
      const to = square(r, c);
      result.push(to);
      if (position.board[to]) break;
      r += dr * direction; c += dc * direction;
    }
  }
  return result;
}

export function isInCheck(position: Position, color: Color = position.turn): boolean {
  const king = position.board.findIndex(p => p?.kind === 'K' && p.color === color);
  if (king < 0) throw new Error('玉のない局面です');
  return position.board.some((p, from) => p?.color === other(color) && attacksFrom(position, from).includes(king));
}

function deadRank(kind: string, color: Color, r: number): boolean {
  const distance = color === 'sente' ? r : 8 - r;
  return (['P','L'].includes(kind) && distance === 0) || (kind === 'N' && distance < 2);
}

/** Internal application assumes a generated move. Public callers use playMove. */
function applyUnchecked(position: Position, move: Move): Position {
  const board = position.board.slice();
  const hands = { sente: { ...position.hands.sente }, gote: { ...position.hands.gote } };
  const color = position.turn;
  if (move.type === 'drop') {
    hands[color][move.kind]--;
    board[move.to] = { kind: move.kind, color, promoted: false };
  } else {
    const piece = board[move.from]!;
    const captured = board[move.to];
    if (captured && captured.kind !== 'K') hands[color][captured.kind]++;
    board[move.from] = null;
    board[move.to] = { ...piece, promoted: piece.promoted || move.promote };
  }
  return { board, hands, turn: other(color) };
}

function* pseudoMoves(position: Position, boardOnly: boolean): Generator<Move> {
  const color = position.turn;
  for (let from = 0; from < 81; from++) {
    const piece = position.board[from];
    if (!piece || piece.color !== color) continue;
    for (const to of attacksFrom(position, from)) {
      const target = position.board[to];
      // Kings are never captured; checkmate ends the game before that point.
      if (target && (target.color === color || target.kind === 'K')) continue;
      const promotable = !piece.promoted && !['K','G'].includes(piece.kind);
      if (promotable && (inCamp(color, row(from)) || inCamp(color, row(to)))) {
        yield { type: 'move', from, to, promote: true };
        if (!deadRank(piece.kind, color, row(to))) yield { type: 'move', from, to, promote: false };
      } else yield { type: 'move', from, to, promote: false };
    }
  }
  if (boardOnly) return;
  for (const kind of HAND_KINDS) {
    if (position.hands[color][kind] < 1) continue;
    const pawnFiles = new Set<number>();
    if (kind === 'P') position.board.forEach((p, i) => {
      if (p?.color === color && p.kind === 'P' && !p.promoted) pawnFiles.add(col(i));
    });
    for (let to = 0; to < 81; to++) {
      if (position.board[to] || deadRank(kind, color, row(to)) || pawnFiles.has(col(to))) continue;
      yield { type: 'drop', kind, to };
    }
  }
}

function* legalMoves(position: Position, boardOnly = false): Generator<Move> {
  for (const move of pseudoMoves(position, boardOnly)) {
    const next = applyUnchecked(position, move);
    if (isInCheck(next, position.turn)) continue;
    if (move.type === 'drop' && move.kind === 'P') {
      const forward = position.turn === 'sente' ? -9 : 9;
      const target = next.board[move.to + forward];
      if (target?.kind === 'K' && target.color === next.turn) {
        // An adjacent pawn check cannot be blocked by a drop. Only board
        // moves can answer it, so no recursive pawn-drop search is needed.
        if (legalMoves(next, true).next().done) continue;
      }
    }
    yield move;
  }
}

export const getLegalMoves = (position: Position): Move[] => [...legalMoves(position)];
export const hasLegalMove = (position: Position): boolean => !legalMoves(position).next().done;
export const sameMove = (a: Move, b: Move): boolean => a.type === b.type && a.to === b.to && (
  a.type === 'drop' ? b.type === 'drop' && a.kind === b.kind
    : b.type === 'move' && a.from === b.from && a.promote === b.promote
);

export function playMove(position: Position, move: Move): Position {
  if (!validSquare(move.to) || (move.type === 'move' && !validSquare(move.from))) throw new Error('不正なマスです');
  const legal = [...legalMoves(position)].find(candidate => sameMove(candidate, move));
  if (!legal) throw new Error('その手は指せません');
  return applyUnchecked(position, legal);
}

/** Stable identity includes turn and BOTH hands, but excludes the move number. */
export function positionKey(position: Position): string {
  return position.board.map(p => p ? `${p.color[0]}${p.kind}${p.promoted ? '+' : ''}` : '.').join(',')
    + '|' + position.turn + '|' + ['sente','gote'].map(c => HAND_KINDS.map(k => position.hands[c as Color][k]).join(',')).join('|');
}
