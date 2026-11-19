import { expect, it } from 'vitest';
import { previewLesson, replayLesson } from './lesson-data';

it('試作の棋譜を初期配置から再生し、成りと持ち駒を各局面に反映する', () => {
  const frames = replayLesson(previewLesson);
  expect(frames).toHaveLength(5);
  expect(frames[0]?.position.board[47]).toBeNull();
  expect(frames[1]?.position.board[47]).toMatchObject({ kind: 'P', color: 'sente' });
  expect(frames[3]?.position.board[16]).toMatchObject({ kind: 'B', color: 'sente', promoted: true });
  expect(frames[3]?.position.hands.sente.B).toBe(1);
  expect(frames[4]?.position.board[16]).toMatchObject({ kind: 'S', color: 'gote' });
  expect(frames[4]?.position.hands.gote.B).toBe(1);
});
