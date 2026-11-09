import { describe, expect, it } from 'vitest';
import { puzzles } from './study-data';
import { getLegalMoves, hasLegalMove, isInCheck, playMove } from './engine/rules';
import { HAND_KINDS } from './engine/types';

describe('original one-move problems', () => {
  for (const puzzle of puzzles) it(`${puzzle.name}: legal position and unique mate without spare pieces`, () => {
    const p = puzzle.position;
    expect(isInCheck(p,'sente')).toBe(false);
    expect(isInCheck(p,'gote')).toBe(false);
    const solutions = getLegalMoves(p).filter(m => {
      const next = playMove(p,m);
      return isInCheck(next,'gote') && !hasLegalMove(next);
    });
    expect(solutions).toHaveLength(1);
    const next = playMove(p,solutions[0]!);
    expect(HAND_KINDS.every(k => next.hands.sente[k] === 0)).toBe(true);
    const total = { R: 2, B: 2, G: 4, S: 4, N: 4, L: 4, P: 18 };
    for (const k of HAND_KINDS) expect(p.hands.sente[k]+p.hands.gote[k]+p.board.filter(x => x?.kind === k).length).toBe(total[k]);
  });
});
