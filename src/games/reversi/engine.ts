export type Color = 'black' | 'white';
export type Cell = Color | null;
export interface Position {
  readonly board: readonly Cell[];
  readonly turn: Color;
  readonly passed: Color | null;
  readonly ended: boolean;
}
export interface Game { readonly position: Position; readonly moves: readonly number[]; readonly history: readonly Position[] }
export const other = (color: Color): Color => color === 'black' ? 'white' : 'black';
export const colorName = (color: Color) => color === 'black' ? '黒' : '白';
const directions = [-1,0,1].flatMap(r => [-1,0,1].filter(c => r !== 0 || c !== 0).map(c => [r,c] as const));
export function initialPosition(): Position {
  const board: Cell[] = Array(64).fill(null);
  board[27] = board[36] = 'white'; board[28] = board[35] = 'black';
  return { board, turn: 'black', passed: null, ended: false };
}
export const newGame = (): Game => ({ position: initialPosition(), moves: [], history: [] });
export function flips(position: Position, square: number, color = position.turn): number[] {
  if (!Number.isInteger(square) || square < 0 || square > 63 || position.board[square] !== null) return [];
  const result: number[] = [], row = Math.floor(square / 8), col = square % 8;
  for (const [dr,dc] of directions) {
    const line: number[] = [];
    let r = row + dr, c = col + dc;
    while (r >= 0 && r < 8 && c >= 0 && c < 8) {
      const piece = position.board[r*8+c];
      if (piece === other(color)) line.push(r*8+c);
      else { if (piece === color && line.length) result.push(...line); break; }
      r += dr; c += dc;
    }
  }
  return result;
}
export function legalMoves(position: Position, color = position.turn): number[] {
  return position.ended ? [] : Array.from({length:64},(_,i) => i).filter(i => flips(position,i,color).length > 0);
}
export function playMove(position: Position, square: number): Position {
  const captured = flips(position,square);
  if (position.ended || !captured.length) throw new Error('そこには置けません');
  const board = position.board.slice();
  for (const index of [square,...captured]) board[index] = position.turn;
  const next: Position = { board, turn: other(position.turn), passed: null, ended: false };
  if (legalMoves(next).length) return next;
  if (legalMoves(next,position.turn).length) return { ...next, turn: position.turn, passed: next.turn };
  return { ...next, ended: true };
}
export function makeMove(game: Game, square: number): Game {
  return { position: playMove(game.position,square), moves: [...game.moves,square], history: [...game.history,game.position] };
}
export function undo(game: Game): Game {
  const before = game.history.at(-1);
  return before ? { position: before, moves: game.moves.slice(0,-1), history: game.history.slice(0,-1) } : game;
}
export function score(position: Position): Record<Color,number> {
  return { black: position.board.filter(x => x === 'black').length, white: position.board.filter(x => x === 'white').length };
}
export function winner(position: Position): Color | null {
  const counts = score(position);
  return counts.black === counts.white ? null : counts.black > counts.white ? 'black' : 'white';
}
