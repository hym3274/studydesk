import { emptyHand, type HandKind, type Kind, type Piece, type Position } from './engine/types';

// Original introductory one-move problems. All remaining non-king pieces
// belong to the defender, as in standard tsume rules. Keep the attacking king
// far away so the unmodified match engine can validate every move.
function problem(edge: boolean, hand: HandKind): Position {
  const board: (Piece | null)[] = Array(81).fill(null);
  const put = (s: number, kind: Kind, color: Piece['color']) => { board[s] = { kind, color, promoted: false }; };
  put(80, 'K', 'sente'); put(edge ? 8 : 4, 'K', 'gote');
  put(edge ? 25 : 22, 'S', 'sente');
  for (const s of edge ? [7] : [3,5]) put(s, 'L', 'gote');
  for (const s of edge ? [16] : [12,14]) put(s, 'P', 'gote');
  const hands = { sente: emptyHand(), gote: { R: 2, B: 2, G: 4, S: 4, N: 4, L: 4, P: 18 } };
  hands.sente[hand] = 1;
  hands.gote[hand]--;
  for (const p of board) if (p && p.kind !== 'K') hands.gote[p.kind]--;
  return { board, hands, turn: 'sente' };
}
export const puzzles = [
  { name: '第1問', position: problem(false, 'G'), hint: '玉の正面に金を打つ形を考えてみましょう', explanation: '５二金打。金が逃げ道をふさぎ、５三の銀が金を支えています' },
  { name: '第2問', position: problem(true, 'G'), hint: '盤の端を壁として使いましょう', explanation: '１二金打。端には逃げられず、２三の銀が金を守っています' },
  { name: '第3問', position: problem(false, 'R'), hint: '飛車を玉の近くで使います', explanation: '５二飛打。玉の隣から王手をかけるので、合駒では防げません' },
] as const;


