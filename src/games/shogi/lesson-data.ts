import { initialPosition, makeMove, newGame } from './engine/game';
import { isInCheck } from './engine/rules';
import type { Move, Position } from './engine/types';

export interface Lesson {
  title: string;
  start: Position;
  introduction: string;
  steps: readonly { move: Move; explanation: string }[];
}

function checkedKing(position: Position) {
  const king = position.board.findIndex(piece => piece?.kind === 'K' && piece.color === position.turn);
  return king >= 0 && isInCheck(position) ? king : null;
}

export function replayPositions(start: Position, moves: readonly Move[]) {
  let game = newGame(start);
  return [
    { position: game.position, checkedKing: checkedKing(game.position), result: game.result, last: undefined },
    ...moves.map(move => {
      game = makeMove(game, move);
      return { position: game.position, checkedKing: checkedKing(game.position), result: game.result, last: game.history.at(-1) };
    }),
  ];
}

export function replayLesson(lesson: Lesson) {
  return replayPositions(lesson.start, lesson.steps.map(step => step.move)).map((frame, index) => ({
    ...frame, explanation: index === 0 ? lesson.introduction : lesson.steps[index - 1]!.explanation,
  }));
}

export const previewLesson: Lesson = {
  title: '棋譜の再生（試作）',
  start: initialPosition(),
  introduction: '初期配置です。右の矢印を押すと、次の手と解説が表示されます。',
  steps: [
    { move: { type: 'move', from: 56, to: 47, promote: false }, explanation: '先手が歩を一つ進めました。動かしたマスと移動先に印が付きます。' },
    { move: { type: 'move', from: 24, to: 33, promote: false }, explanation: '後手も歩を進めました。二つの歩が動いて、角の通り道が開きました。' },
    { move: { type: 'move', from: 64, to: 16, promote: true }, explanation: '先手が相手の角を取り、馬に成りました。取った角は先手の持ち駒になります。' },
    { move: { type: 'move', from: 6, to: 16, promote: false }, explanation: '後手が銀で馬を取り返しました。取った馬は角に戻って、後手の持ち駒になります。' },
  ],
};
