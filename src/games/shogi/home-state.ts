import { initialPosition } from './engine/game';
import { loadSession, type StoragePort } from './persistence';

export function loadHomeState(storage: StoragePort | null) {
  const session = loadSession(storage);
  const canResume = session.game.history.length > 0 && session.game.result === null;
  return {
    session, canResume,
    background: canResume ? session.game.position : initialPosition(),
    lastMove: canResume ? session.game.history.at(-1)?.move : undefined,
  };
}
