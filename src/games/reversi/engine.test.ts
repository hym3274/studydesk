import { describe, expect, it } from 'vitest';
import { flips, initialPosition, legalMoves, makeMove, newGame, other, playMove, score, undo, winner, type Cell, type Position } from './engine';

function position(board: Cell[], turn: Position['turn'] = 'black'): Position { return {board,turn,passed:null,ended:false}; }
describe('reversi rules', () => {
  it('starts with the standard four discs and four black moves', () => {
    const p = initialPosition();
    expect(p.board[27]).toBe('white'); expect(p.board[28]).toBe('black');
    expect(p.board[35]).toBe('black'); expect(p.board[36]).toBe('white');
    expect(score(p)).toEqual({black:2,white:2});
    expect(legalMoves(p)).toEqual([19,26,37,44]);
    expect(legalMoves(p).reduce((sum,m) => sum+legalMoves(playMove(p,m)).length,0)).toBe(12);
  });
  for (const dr of [-1,0,1]) for (const dc of [-1,0,1]) if (dr || dc) {
    it(`flips the bracketed line in direction ${dr},${dc}`, () => {
      const board: Cell[] = Array(64).fill(null), near=(3+dr)*8+3+dc, far=(3+2*dr)*8+3+2*dc;
      board[near]='white';board[far]='black';
      expect(flips(position(board),27)).toEqual([near]);
      expect(playMove(position(board),27).board[near]).toBe('black');
      board[near]='black';board[far]='white';
      expect(flips(position(board,'white'),27)).toEqual([near]);
    });
  }
  it('flips all eight directions at once and preserves the original position', () => {
    const board: Cell[] = Array(64).fill(null);
    for (const dr of [-1,0,1]) for (const dc of [-1,0,1]) if(dr||dc) {board[(3+dr)*8+3+dc]='white';board[(3+2*dr)*8+3+2*dc]='black';}
    const p=position(board), snapshot=JSON.stringify(p), next=playMove(p,27);
    expect(flips(p,27)).toHaveLength(8);
    expect(score(next)).toEqual({black:17,white:0});
    expect(JSON.stringify(p)).toBe(snapshot);
  });
  it('does not wrap across a row or jump over empty/own squares', () => {
    const board: Cell[] = Array(64).fill(null);board[7]='white';board[8]='black';
    expect(flips(position(board),6)).toEqual([]);
    board[7]=null;board[8]=null;board[1]='white';board[3]='black';
    expect(flips(position(board),0)).toEqual([]);
    board[1]='black';board[2]='white';
    expect(flips(position(board),0)).toEqual([]);
  });
  it('captures a whole line from a corner', () => {
    const board: Cell[] = Array(64).fill(null);for(let i=1;i<7;i++)board[i]='white';board[7]='black';
    expect(flips(position(board),0)).toEqual([1,2,3,4,5,6]);
  });
  it.each([-1,64,1.5,NaN,Infinity,27,0])('rejects illegal square %s', square => {
    expect(() => playMove(initialPosition(),square)).toThrow();
  });
  it('automatically passes only the player who cannot move, and undo restores that turn', () => {
    const board: Cell[] = Array(64).fill('black');board[0]=board[3]=null;board[1]=board[4]='white';
    const p=position(board), game=makeMove({position:p,moves:[],history:[]},0);
    expect(game.position.turn).toBe('black');expect(game.position.passed).toBe('white');
    expect(game.position.ended).toBe(false);expect(legalMoves(game.position)).toEqual([3]);
    expect(undo(game).position).toEqual(p);
    expect(makeMove(game,3).position.ended).toBe(true);
  });
  it('ends with empty squares when neither player can move', () => {
    const board: Cell[] = Array(64).fill('black');board[0]=board[63]=null;board[1]='white';
    const next=playMove(position(board),0);
    expect(next.ended).toBe(true);expect(next.board[63]).toBeNull();
    expect(winner(next)).toBe('black');expect(legalMoves(next)).toEqual([]);
    expect(() => playMove(next,63)).toThrow();
  });
  it('scores a full-board draw', () => {
    const board: Cell[] = Array(64).fill('white');board[0]=null;for(let i=2;i<=31;i++)board[i]='black';
    const next=playMove(position(board),0);
    expect(next.ended).toBe(true);expect(score(next)).toEqual({black:32,white:32});expect(winner(next)).toBeNull();
  });
  it('keeps piece count, legal turns and undo correct through complete matches', () => {
    for(let seed=1;seed<=30;seed++) {
      let game=newGame(), random=seed;
      while(!game.position.ended) {
        const available=legalMoves(game.position);expect(available.length).toBeGreaterThan(0);
        random=(random*1664525+1013904223)>>>0;
        const before=game, move=available[random%available.length]!;
        game=makeMove(game,move);
        expect(undo(game)).toEqual(before);
        const counts=score(game.position);expect(counts.black+counts.white).toBe(4+game.moves.length);
        expect(game.moves.length).toBeLessThanOrEqual(60);
        if(game.position.passed)expect(legalMoves(game.position,other(game.position.turn))).toEqual([]);
      }
      expect(legalMoves({...game.position,ended:false},'black')).toEqual([]);
      expect(legalMoves({...game.position,ended:false},'white')).toEqual([]);
    }
    expect(undo(newGame())).toEqual(newGame());
  });
});
