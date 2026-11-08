export type Color = 'sente' | 'gote';
export type Kind = 'K' | 'R' | 'B' | 'G' | 'S' | 'N' | 'L' | 'P';
export type HandKind = Exclude<Kind, 'K'>;
export interface Piece { readonly kind: Kind; readonly color: Color; readonly promoted: boolean }
export type Hand = Record<HandKind, number>;
export interface Position {
  readonly board: readonly (Piece | null)[];
  readonly hands: Readonly<Record<Color, Readonly<Hand>>>;
  readonly turn: Color;
}
export type Move =
  | { readonly type: 'move'; readonly from: number; readonly to: number; readonly promote: boolean }
  | { readonly type: 'drop'; readonly kind: HandKind; readonly to: number };
export interface HistoryEntry {
  readonly before: Position;
  readonly move: Move;
  readonly mover: Color;
  readonly check: boolean;
  readonly notation: string;
}
export type Result =
  | { readonly reason: 'checkmate' | 'resign' | 'perpetual-check' | 'no-legal-moves' | 'impasse-points'; readonly winner: Color }
  | { readonly reason: 'repetition' | 'impasse' | 'move-limit'; readonly winner: null };
export interface Game {
  readonly position: Position;
  readonly history: readonly HistoryEntry[];
  readonly result: Result | null;
}
export const HAND_KINDS: readonly HandKind[] = ['R', 'B', 'G', 'S', 'N', 'L', 'P'];
export const COLORS: readonly Color[] = ['sente', 'gote'];
export const other = (color: Color): Color => color === 'sente' ? 'gote' : 'sente';
export const row = (square: number): number => Math.floor(square / 9);
export const col = (square: number): number => square % 9;
export const square = (r: number, c: number): number => r * 9 + c;
export const inCamp = (color: Color, r: number): boolean => color === 'sente' ? r <= 2 : r >= 6;
export const emptyHand = (): Hand => ({ R: 0, B: 0, G: 0, S: 0, N: 0, L: 0, P: 0 });
