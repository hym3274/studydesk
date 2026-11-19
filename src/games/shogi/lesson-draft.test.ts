import { expect, it } from 'vitest';
import { createDraft, parseDraft, toLesson, truncateDraft } from './lesson-draft';
import { replayLesson } from './lesson-data';

it('書き出した下書きから開始局面、解説、サムネイルを復元し、手順の削除を反映する', () => {
  const draft = parseDraft(JSON.stringify({
    ...createDraft(), title: '試作', genre: '囲い',
    moves: [{ type: 'move', from: 56, to: 47, promote: false }],
    comments: ['開始局面', '歩を進める'], thumbnail: 1,
  }));
  expect(replayLesson(toLesson(draft))[1]).toMatchObject({ explanation: '歩を進める' });
  expect(draft.thumbnail).toBe(1);
  expect(truncateDraft(draft, 0)).toMatchObject({ moves: [], comments: ['開始局面'], thumbnail: 0 });
});

it('合法手でない棋譜を拒否し、玉のない盤面でも図だけの解説を保存できる', () => {
  const draft = createDraft();
  expect(() => parseDraft(JSON.stringify({
    ...draft, moves: [{ type: 'move', from: 56, to: 0, promote: false }], comments: ['', ''],
  }))).toThrow();
  const diagram = parseDraft(JSON.stringify({
    ...draft, start: { ...draft.start, board: draft.start.board.map(piece => piece?.kind === 'K' ? null : piece) },
  }));
  expect(replayLesson(toLesson(diagram))).toHaveLength(1);
});
