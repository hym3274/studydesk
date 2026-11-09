import { describe, expect, it, vi } from 'vitest';
import { initialPosition, makeMove, newGame, resign, undoMove } from './engine/game';
import { loadHomeState } from './home-state';
import { defaultPreferences, serializeSession } from './persistence';
import type { Game } from './engine/types';

const moved = () => makeMove(newGame(), { type: 'move', from: 56, to: 47, promote: false });
function saved(game: Game) {
  return { getItem: () => serializeSession({ game, preferences: { flipped: true, faceToFace: false } }), setItem: vi.fn() };
}
describe('title screen saved match', () => {
  it('shows the actual unfinished position and preferences without writing storage', () => {
    const game = moved(), storage = saved(game), state = loadHomeState(storage);
    expect(state.canResume).toBe(true);
    expect(state.background).toEqual(game.position);
    expect(state.lastMove).toEqual(game.history[0]!.move);
    expect(state.session.preferences).toEqual({ flipped: true, faceToFace: false });
    expect(storage.setItem).not.toHaveBeenCalled();
  });
  it.each([newGame(), undoMove(moved()), resign(moved())])('uses the initial background for an untouched or finished match', game => {
    const state = loadHomeState(saved(game));
    expect(state.canResume).toBe(false);
    expect(state.background).toEqual(initialPosition());
    expect(state.lastMove).toBeUndefined();
  });
  it('handles absent, corrupt and inaccessible storage', () => {
    for (const storage of [null, { getItem: () => null, setItem: vi.fn() }, { getItem: () => '{broken', setItem: vi.fn() }, { getItem: () => {throw Error('denied');}, setItem: vi.fn() }]) {
      const state = loadHomeState(storage);
      expect(state.canResume).toBe(false);
      expect(state.background).toEqual(initialPosition());
      expect(state.session.preferences).toEqual(defaultPreferences);
    }
  });
});
