import { hasLegalMove, isInCheck, playMove, positionKey } from './rules';
import { COLORS, emptyHand, HAND_KINDS, inCamp, other, row, type Color, type Game, type HistoryEntry, type Kind, type Move, type Piece, type Position, type Result } from './types';

export function initialPosition(): Position {
  const board: (Piece | null)[] = Array.from({ length: 81 }, () => null);
  const back: readonly Kind[] = ['L','N','S','G','K','G','S','N','L'];
  for (const color of COLORS) {
    const r = color === 'sente' ? 8 : 0, pawns = color === 'sente' ? 6 : 2;
    back.forEach((kind, c) => { board[r * 9 + c] = { kind, color, promoted: false }; });
    for (let c = 0; c < 9; c++) board[pawns * 9 + c] = { kind: 'P', color, promoted: false };
    board[color === 'sente' ? 70 : 10] = { kind: 'R', color, promoted: false };
    board[color === 'sente' ? 64 : 16] = { kind: 'B', color, promoted: false };
  }
  return { board, hands: { sente: emptyHand(), gote: emptyHand() }, turn: 'sente' };
}

export const newGame = (position: Position = initialPosition()): Game => ({ position, history: [], result: null });
export const playerName = (color: Color): string => color === 'sente' ? '先手' : '後手';
const plain: Record<Kind, string> = { K: '玉', R: '飛', B: '角', G: '金', S: '銀', N: '桂', L: '香', P: '歩' };
const promoted: Partial<Record<Kind, string>> = { R: '龍', B: '馬', S: '全', N: '圭', L: '杏', P: 'と' };
export const pieceLabel = (piece: Piece): string => piece.promoted ? promoted[piece.kind] ?? plain[piece.kind] : piece.kind === 'K' && piece.color === 'gote' ? '王' : plain[piece.kind];
export const squareLabel = (s: number): string => `${'９８７６５４３２１'[s % 9]}${'一二三四五六七八九'[row(s)]}`;

export function moveNotation(position: Position, move: Move): string {
  if (move.type === 'drop') return `${squareLabel(move.to)}${plain[move.kind]}打`;
  const piece = position.board[move.from]!;
  return `${squareLabel(move.to)}${pieceLabel(piece)}${move.promote ? '成' : ''}（${squareLabel(move.from)}）`;
}

export function repetitionResult(position: Position, history: readonly HistoryEntry[]): Result | null {
  const key = positionKey(position);
  const matches: number[] = [];
  history.forEach((entry, i) => { if (positionKey(entry.before) === key) matches.push(i); });
  // Current position is the fourth occurrence; history stores earlier ones.
  if (matches.length < 3) return null;
  const interval = history.slice(matches[matches.length - 3]!);
  for (const color of COLORS) {
    const turns = interval.filter(e => e.mover === color);
    if (turns.length && turns.every(e => e.check)) return { reason: 'perpetual-check', winner: other(color) };
  }
  return { reason: 'repetition', winner: null };
}

export function makeMove(game: Game, move: Move): Game {
  if (game.result) throw new Error('対局は終了しています');
  const position = playMove(game.position, move);
  const check = isInCheck(position);
  const history = [...game.history, { before: game.position, move, mover: game.position.turn, check, notation: moveNotation(game.position, move) }];
  let result = repetitionResult(position, history);
  if (!result && !hasLegalMove(position)) result = { reason: check ? 'checkmate' : 'no-legal-moves', winner: other(position.turn) };
  if (!result && history.length >= 500 && !check) result = { reason: 'move-limit', winner: null };
  return { position, history, result };
}

export function undoMove(game: Game): Game {
  if (game.result && ['resign','impasse','impasse-points'].includes(game.result.reason)) return { ...game, result: null };
  const last = game.history.at(-1);
  return last ? { position: last.before, history: game.history.slice(0, -1), result: null } : game;
}

export function resign(game: Game): Game {
  if (game.result) throw new Error('対局は終了しています');
  return { ...game, result: { reason: 'resign', winner: other(game.position.turn) } };
}

export function impassePoints(position: Position, color: Color): number {
  const value = (kind: Kind) => kind === 'K' ? 0 : ['R','B'].includes(kind) ? 5 : 1;
  return position.board.reduce((sum, p) => sum + (p?.color === color ? value(p.kind) : 0), 0)
    + HAND_KINDS.reduce((sum, kind) => sum + position.hands[color][kind] * value(kind), 0);
}

export function canAgreeImpasse(position: Position): boolean {
  return COLORS.every(color => {
    const king = position.board.findIndex(p => p?.color === color && p.kind === 'K');
    return king >= 0 && inCamp(color, row(king)) && !isInCheck(position, color);
  });
}

/** Call only after both players explicitly agree that neither can mate. */
export function agreeImpasse(game: Game): Game {
  if (game.result || !canAgreeImpasse(game.position)) throw new Error('持将棋の条件を満たしていません');
  const sente = impassePoints(game.position, 'sente'), gote = impassePoints(game.position, 'gote');
  if (sente < 24 && gote < 24) throw new Error('駒数の不整合があります');
  const result: Result = sente >= 24 && gote >= 24 ? { reason: 'impasse', winner: null }
    : { reason: 'impasse-points', winner: sente >= 24 ? 'sente' : 'gote' };
  return { ...game, result };
}
