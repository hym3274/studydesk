import { expect, it, vi } from 'vitest';
import { makeMove, newGame, undo } from './engine';
import { defaults, deserialize, load, save, SAVE_KEY, serialize } from './persistence';

it('replays a saved match, preferences and undo history', () => {
  const session={game:makeMove(makeMove(newGame(),19),18),preferences:{flipped:true,faceToFace:false}};
  expect(deserialize(serialize(session))).toEqual(session);
  expect(undo(deserialize(serialize(session)).game)).toEqual(undo(session.game));
});
it.each([
  '{broken', '{}', JSON.stringify({version:2,moves:[],preferences:defaults}),
  JSON.stringify({version:1,moves:[19,19],preferences:defaults}),
  JSON.stringify({version:1,moves:[0],preferences:defaults}),
  JSON.stringify({version:1,moves:['19'],preferences:defaults}),
  JSON.stringify({version:1,moves:[null],preferences:defaults}),
  JSON.stringify({version:1,moves:[],preferences:{flipped:0,faceToFace:true}}),
  JSON.stringify({version:1,moves:Array(61).fill(19),preferences:defaults}), 'x'.repeat(8193),
])('rejects invalid saved data', raw => {expect(() => deserialize(raw)).toThrow();});
it('writes its own storage key and handles write/read restrictions', () => {
  const setItem=vi.fn(), session={game:newGame(),preferences:defaults};
  expect(save({getItem:()=>null,setItem},session)).toBe(true);
  expect(setItem).toHaveBeenCalledWith(SAVE_KEY,serialize(session));
  expect(save(null,session)).toBe(false);
  expect(save({getItem:()=>null,setItem:()=>{throw Error();}},session)).toBe(false);
  expect(load(null).status).toBe('unavailable');
  expect(load({getItem:()=>{throw Error();},setItem}).status).toBe('unavailable');
  expect(load({getItem:()=>'{broken',setItem}).status).toBe('invalid');
  expect(load({getItem:()=>null,setItem}).status).toBe('new');
});
