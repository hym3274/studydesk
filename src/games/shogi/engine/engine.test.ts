import { describe, expect, it } from 'vitest';
import { agreeImpasse, canAgreeImpasse, impassePoints, initialPosition, makeMove, newGame, resign, undoMove } from './game';
import { attacksFrom, getLegalMoves, isInCheck, playMove, positionKey } from './rules';
import { emptyHand, other, type Color, type Game, type HandKind, type Kind, type Move, type Piece, type Position } from './types';

const piece = (kind: Kind, color: Color = 'sente', promoted = false): Piece => ({ kind, color, promoted });
function position(entries: [number, Piece][] = [], turn: Color = 'sente', hand: Partial<Record<HandKind, number>> = {}): Position {
  const board: (Piece | null)[] = Array.from({ length: 81 }, () => null);
  board[80] = piece('K'); board[0] = piece('K', 'gote');
  for (const [s, p] of entries) {
    if (p.kind === 'K') for (let i = 0; i < 81; i++) if (board[i]?.kind === 'K' && board[i]?.color === p.color) board[i] = null;
    board[s] = p;
  }
  return { board, hands: { sente: { ...emptyHand(), ...hand }, gote: emptyHand() }, turn };
}
const move = (from: number, to: number, promote = false): Move => ({ type: 'move', from, to, promote });
const drop = (kind: HandKind, to: number): Move => ({ type: 'drop', kind, to });
const includes = (p: Position, m: Move) => getLegalMoves(p).some(candidate => JSON.stringify(candidate) === JSON.stringify(m));
function cycle(game: Game, moves: Move[], times: number): Game {
  for (let i = 0; i < times; i++) for (const m of moves) game = makeMove(game, m);
  return game;
}

describe('初期配置', () => {
  it('40枚・双方20枚、飛角の向きと先手番', () => {
    const p = initialPosition();
    expect(p.board).toHaveLength(81);
    for (const color of ['sente','gote']) expect(p.board.filter(x => x?.color === color)).toHaveLength(20);
    expect(p.board[70]?.kind).toBe('R'); expect(p.board[64]?.kind).toBe('B');
    expect(p.board[10]?.kind).toBe('R'); expect(p.board[16]?.kind).toBe('B');
    expect(p.turn).toBe('sente'); expect(getLegalMoves(p)).toHaveLength(30);
  });
  it('初期局面の2手深さは900局面', () => {
    const p = initialPosition();
    expect(getLegalMoves(p).reduce((n, m) => n + getLegalMoves(playMove(p, m)).length, 0)).toBe(900);
  });
});

describe('各駒と成駒の移動', () => {
  const cases: [Kind, boolean, number[]][] = [
    ['K', false, [30,31,32,39,41,48,49,50]],
    ['G', false, [30,31,32,39,41,49]],
    ['S', false, [30,31,32,48,50]],
    ['N', false, [21,23]], ['L', false, [4,13,22,31]], ['P', false, [31]],
    ['R', false, [4,13,22,31,36,37,38,39,41,42,43,44,49,58,67,76]],
    ['B', false, [0,8,10,16,20,24,30,32,48,50,56,60,64,70,72,80]],
    ['S', true, [30,31,32,39,41,49]], ['N', true, [30,31,32,39,41,49]],
    ['L', true, [30,31,32,39,41,49]], ['P', true, [30,31,32,39,41,49]],
    ['R', true, [4,13,22,30,31,32,36,37,38,39,41,42,43,44,48,49,50,58,67,76]],
    ['B', true, [0,8,10,16,20,24,30,31,32,39,41,48,49,50,56,60,64,70,72,80]],
  ];
  it.each(cases)('%s 成り=%s の全移動先', (kind, promoted, expected) => {
    expect(attacksFrom(position([[40, piece(kind, 'sente', promoted)]]), 40).sort((a,b) => a-b)).toEqual(expected);
  });
  it.each(cases)('%s 成り=%s の後手方向', (kind, promoted, expected) => {
    expect(attacksFrom(position([[40, piece(kind, 'gote', promoted)]]), 40).sort((a,b) => a-b)).toEqual(expected.map(s => 80-s).sort((a,b) => a-b));
  });
  it('盤外に歩・桂・香は進めない', () => {
    for (const kind of ['P','L','N'] as const) expect(attacksFrom(position([[4, piece(kind)]]), 4)).toEqual([]);
  });
  it('飛車は味方と敵のどちらも飛び越せず、味方を取れない', () => {
    const p = position([[40,piece('R')],[22,piece('P')],[42,piece('S','gote')]]);
    const destinations = getLegalMoves(p).filter(m => m.type === 'move' && m.from === 40).map(m => m.to);
    expect(destinations).toContain(31); expect(destinations).not.toContain(22); expect(destinations).not.toContain(13);
    expect(destinations).toContain(42); expect(destinations).not.toContain(43);
  });
  it('角・香の経路が遮断される', () => {
    expect(attacksFrom(position([[40,piece('B')],[30,piece('P')]]), 40)).not.toContain(20);
    expect(attacksFrom(position([[40,piece('L')],[31,piece('P','gote')]]), 40)).toEqual([31]);
  });
  it('桂馬は駒を飛び越せる', () => {
    expect(includes(position([[40,piece('N')],[31,piece('P')]]), move(40,21,true))).toBe(true);
  });
});

describe('成り・捕獲・持ち駒', () => {
  it('敵陣に入るときと出るとき、陣内で成りを選択できる', () => {
    for (const [from,to] of [[31,22],[22,31],[22,13]] as const) {
      const p = position([[from,piece('R')]]);
      expect(includes(p,move(from,to,true))).toBe(true); expect(includes(p,move(from,to,false))).toBe(true);
    }
  });
  it('敵陣に関係しない移動と金・玉の成りは禁止', () => {
    expect(includes(position([[40,piece('R')]]),move(40,31,true))).toBe(false);
    expect(includes(position([[13,piece('G')]]),move(13,4,true))).toBe(false);
    expect(includes(position([[13,piece('K')]]),move(13,4,true))).toBe(false);
  });
  it.each([['P',13,4],['L',13,4],['N',22,3],['N',31,12]] as const)('%s の行き所のない移動は強制成り', (kind,from,to) => {
    const p = position([[from,piece(kind)]]);
    expect(includes(p,move(from,to,false))).toBe(false); expect(includes(p,move(from,to,true))).toBe(true);
  });
  it('後手も最終段で強制成り', () => {
    const p = position([[67,piece('P','gote')]], 'gote');
    expect(includes(p,move(67,76))).toBe(false); expect(includes(p,move(67,76,true))).toBe(true);
  });
  it('成駒を捕獲すると不成の持ち駒になり、入力局面は変わらない', () => {
    const p = position([[40,piece('R')],[31,piece('S','gote',true)]]), before = JSON.stringify(p);
    const next = playMove(p,move(40,31));
    expect(next.hands.sente.S).toBe(1); expect(next.board[40]).toBeNull();
    expect(next.board[31]).toEqual(piece('R')); expect(JSON.stringify(p)).toBe(before);
  });
  it('成りを維持し、二重の成りは不可', () => {
    const p = position([[40,piece('P','sente',true)]]);
    expect(playMove(p,move(40,31)).board[31]?.promoted).toBe(true);
    expect(includes(p,move(40,31,true))).toBe(false);
  });
  it('持ち駒を打つと一枚減り、手番が変わる', () => {
    const next = playMove(position([], 'sente', { S: 2 }), drop('S',40));
    expect(next.hands.sente.S).toBe(1); expect(next.board[40]).toEqual(piece('S')); expect(next.turn).toBe('gote');
  });
  it('持っていない駒・占有マスへの駒打ちを拒否', () => {
    expect(includes(position(),drop('R',40))).toBe(false);
    expect(includes(position([], 'sente', { G: 1 }),drop('G',80))).toBe(false);
  });
  it.each([['P',4],['L',4],['N',4],['N',13]] as const)('%s を行き所のない %s へ打てない', (kind,to) => {
    expect(includes(position([], 'sente', { [kind]: 1 }),drop(kind,to))).toBe(false);
  });
  it('二歩は禁止、相手の歩や自分のと金は二歩に数えない', () => {
    expect(includes(position([[58,piece('P')]], 'sente', { P: 1 }),drop('P',40))).toBe(false);
    expect(includes(position([[58,piece('P','sente',true)]], 'sente', { P: 1 }),drop('P',40))).toBe(true);
    expect(includes(position([[58,piece('P','gote')]], 'sente', { P: 1 }),drop('P',40))).toBe(true);
  });
});

describe('王手・自玉・詰み・打ち歩詰め', () => {
  it('王手放置と玉の危険な移動を拒否', () => {
    const p = position([[76,piece('K')],[4,piece('R','gote')],[72,piece('G')]]);
    expect(isInCheck(p)).toBe(true); expect(includes(p,move(72,63))).toBe(false);
    expect(includes(p,move(76,67))).toBe(false); expect(includes(p,move(76,75))).toBe(true);
  });
  it('自玉の前の駒を外して王手にする手は不可', () => {
    const p = position([[76,piece('K')],[67,piece('R')],[4,piece('R','gote')]]);
    expect(includes(p,move(67,66))).toBe(false); expect(includes(p,move(67,58))).toBe(true);
  });
  it('王手に合駒を打って応対できる', () => {
    const p = position([[76,piece('K')],[4,piece('R','gote')]],'sente',{G:1});
    expect(includes(p,drop('G',40))).toBe(true); expect(includes(p,drop('G',41))).toBe(false);
  });
  it('玉同士は隣接できず、玉を取る手は生成しない', () => {
    const p = position([[40,piece('K')],[22,piece('K','gote')]]);
    expect(includes(p,move(40,31))).toBe(false);
    expect(getLegalMoves(position([[9,piece('R')]])).some(m => m.to === 0)).toBe(false);
  });
  function pawnNet(escape = false): Position {
    return position([[4,piece('K','gote')], ...(!escape ? [[3,piece('P','gote')]] as [number,Piece][] : []),
      [5,piece('P','gote')],[22,piece('G')]],'sente',{P:1});
  }
  it('逃げ道も取り返しもない打ち歩詰めを禁止', () => {
    expect(includes(pawnNet(),drop('P',13))).toBe(false);
    expect(() => playMove(pawnNet(),drop('P',13))).toThrow();
  });
  it('玉に逃げ道がある歩の王手は合法', () => {
    expect(includes(pawnNet(true),drop('P',13))).toBe(true);
  });
  it('玉以外が歩を取れるなら打ち歩詰めではない', () => {
    const p = pawnNet(), board = p.board.slice(); board[12] = piece('R','gote');
    expect(includes({...p,board},drop('P',13))).toBe(true);
  });
  it('盤上の歩を進めて詰ます手は合法、王は盤上に残る', () => {
    const p = position([[4,piece('K','gote')],[3,piece('P','gote')],[5,piece('P','gote')],
      [21,piece('G')],[23,piece('G')],[22,piece('P')]]);
    const game = makeMove(newGame(p),move(22,13));
    expect(game.result).toEqual({reason:'checkmate',winner:'sente'});
    expect(game.position.board.filter(p => p?.kind === 'K')).toHaveLength(2);
    expect(() => makeMove(game,move(4,3))).toThrow();
  });
  it('二重王手には玉の応手だけが残る', () => {
    const p = position([[76,piece('K')],[4,piece('R','gote')],[36,piece('B','gote')],[72,piece('G')]]);
    expect(getLegalMoves(p).every(m => m.type === 'move' && m.from === 76)).toBe(true);
  });
});

describe('履歴・千日手・終局', () => {
  const kings = () => position([[76,piece('K')],[4,piece('K','gote')]]);
  const kingCycle = [move(76,75),move(4,3),move(75,76),move(3,4)];
  it('同一局面が4回出現すると千日手、3回では続行', () => {
    const three = cycle(newGame(kings()),kingCycle,2); expect(three.result).toBeNull();
    const four = cycle(three,kingCycle,1); expect(four.result).toEqual({reason:'repetition',winner:null});
  });
  it('局面キーには双方の持ち駒と手番、成りが含まれる', () => {
    const p = kings();
    expect(positionKey(p)).not.toBe(positionKey({...p,turn:other(p.turn)}));
    expect(positionKey(p)).not.toBe(positionKey({...p,hands:{...p.hands,gote:{...emptyHand(),P:1}}}));
    expect(positionKey(position([[40,piece('P')]]))).not.toBe(positionKey(position([[40,piece('P','sente',true)]])));
  });
  it('連続王手は王手した側の負け（王手をかけた局面で成立）', () => {
    const p = position([[76,piece('K')],[4,piece('K','gote')],[13,piece('R')]],'gote');
    const game = cycle(newGame(p),[move(4,3),move(13,12),move(3,4),move(12,13)],3);
    expect(game.result).toEqual({reason:'perpetual-check',winner:'gote'});
  });
  it('連続王手は王手を解除した局面で成立しても同じ判定', () => {
    const p = position([[76,piece('K')],[4,piece('K','gote')],[12,piece('R')]]);
    const game = cycle(newGame(p),[move(12,13),move(4,3),move(13,12),move(3,4)],3);
    expect(game.result).toEqual({reason:'perpetual-check',winner:'gote'});
  });
  it('王手が途中で途切れる循環は、連続王手負けにならない', () => {
    const p = position([[76,piece('K')],[4,piece('K','gote')],[12,piece('R')]]);
    const sequence = [move(12,13),move(4,3),move(13,22),move(3,2),move(22,21),move(2,1),
      move(21,12),move(1,2),move(12,11),move(2,3),move(11,12),move(3,4)];
    expect(cycle(newGame(p),sequence,3).result).toEqual({reason:'repetition',winner:null});
  });
  it('捕獲・成り・持ち駒・手番まで待ったで戻る', () => {
    const p = position([[31,piece('R')],[22,piece('S','gote',true)]]), game = newGame(p);
    expect(undoMove(makeMove(game,move(31,22,true)))).toEqual(game);
    expect(undoMove(game)).toBe(game);
  });
  it('千日手の終局を待ったで解除して別の手を選べる', () => {
    const game = cycle(newGame(kings()),kingCycle,3), undone = undoMove(game);
    expect(undone.result).toBeNull(); expect(undone.history).toHaveLength(11);
    expect(makeMove(undone,move(3,2)).result).toBeNull();
  });
  it('投了は相手の勝ち、投了直後の待ったは投了だけ取り消す', () => {
    const game = newGame(); expect(resign(game).result).toEqual({reason:'resign',winner:'gote'});
    expect(undoMove(resign(game))).toEqual(game);
  });
  it('持将棋の点数は成駒も元の駒で数える', () => {
    expect(impassePoints(position([[40,piece('R','sente',true)]],'sente',{B:1,P:2}),'sente')).toBe(12);
    expect(canAgreeImpasse(initialPosition())).toBe(false);
    expect(() => agreeImpasse(newGame())).toThrow();
  });
  it('双方入玉・合意した24点制の持将棋', () => {
    const p = position([[4,piece('K')],[76,piece('K','gote')]],'sente',{R:2,B:2,G:4});
    const full = {...p,hands:{...p.hands,gote:{...emptyHand(),P:24}}};
    expect(canAgreeImpasse(full)).toBe(true); expect(agreeImpasse(newGame(full)).result).toEqual({reason:'impasse',winner:null});
    expect(agreeImpasse(newGame(p)).result).toEqual({reason:'impasse-points',winner:'sente'});
  });
  it('不正な入力・手番・マスを公開APIで拒否', () => {
    for (const m of [move(18,27),move(54,-1),move(54,45,true),move(54,NaN),move(1.5,3)]) expect(() => playMove(initialPosition(),m)).toThrow();
  });
  it('120手の合法対局で駒数・駒種・玉の安全・巻き戻しを保つ', () => {
    let game = newGame(), seed = 90421;
    const counts: Record<Kind,number> = {K:2,R:2,B:2,G:4,S:4,N:4,L:4,P:18};
    for (let i = 0; i < 120 && !game.result; i++) {
      const before = game, legal = getLegalMoves(game.position);
      seed = (Math.imul(seed,1664525) + 1013904223) >>> 0;
      game = makeMove(game,legal[seed % legal.length]!);
      expect(isInCheck(game.position,before.position.turn)).toBe(false);
      expect(undoMove(game).position).toEqual(before.position);
      for (const kind of Object.keys(counts) as Kind[]) {
        let n = game.position.board.filter(p => p?.kind === kind).length;
        if (kind !== 'K') n += game.position.hands.sente[kind] + game.position.hands.gote[kind];
        expect(n).toBe(counts[kind]);
      }
    }
    expect(game.history.length).toBeGreaterThan(30);
  });
});
