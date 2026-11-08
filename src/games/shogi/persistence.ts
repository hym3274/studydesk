import { agreeImpasse, makeMove, newGame, resign } from './engine/game';
import { positionKey } from './engine/rules';
import { HAND_KINDS, type Game, type HandKind, type Move } from './engine/types';

export const SAVE_KEY = 'minigames.shogi.v1';
export interface Preferences { readonly flipped: boolean; readonly faceToFace: boolean }
export const defaultPreferences: Preferences = { flipped: false, faceToFace: true };
export interface StoredSession { game: Game; preferences: Preferences }
export interface StoragePort { getItem(key: string): string | null; setItem(key: string, value: string): void }
export type LoadStatus = 'restored' | 'new' | 'invalid' | 'unavailable';
export interface LoadedSession extends StoredSession { status: LoadStatus }

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function parseMove(value: unknown): Move {
  if (!isObject(value) || !Number.isInteger(value.to) || Number(value.to) < 0 || Number(value.to) > 80) throw new Error('不正な指し手');
  if (value.type === 'drop' && HAND_KINDS.includes(value.kind as HandKind)) return { type: 'drop', kind: value.kind as HandKind, to: value.to as number };
  if (value.type === 'move' && Number.isInteger(value.from) && Number(value.from) >= 0 && Number(value.from) <= 80 && typeof value.promote === 'boolean') {
    return { type: 'move', from: value.from as number, to: value.to as number, promote: value.promote };
  }
  throw new Error('不正な指し手');
}

/** Persist a compact move log; derived boards/check flags are never trusted. */
export function serializeSession({ game, preferences }: StoredSession): string {
  return JSON.stringify({ version: 1, moves: game.history.map(e => e.move),
    ending: game.result?.reason === 'resign' ? 'resign' : game.result && ['impasse','impasse-points'].includes(game.result.reason) ? 'impasse' : null,
    key: positionKey(game.position), preferences });
}

export function deserializeSession(raw: string): StoredSession {
  if (raw.length > 512_000) throw new Error('保存データが大きすぎます');
  const data: unknown = JSON.parse(raw);
  if (!isObject(data) || data.version !== 1 || !Array.isArray(data.moves) || data.moves.length > 2048) throw new Error('未対応の保存データ');
  if (!isObject(data.preferences) || typeof data.preferences.flipped !== 'boolean' || typeof data.preferences.faceToFace !== 'boolean') throw new Error('不正な設定');
  if (data.ending !== null && data.ending !== 'resign' && data.ending !== 'impasse') throw new Error('不正な終局情報');
  let game = newGame();
  for (const value of data.moves) game = makeMove(game, parseMove(value));
  if (data.ending === 'resign') game = resign(game);
  if (data.ending === 'impasse') game = agreeImpasse(game);
  if (data.key !== positionKey(game.position)) throw new Error('保存データの局面が一致しません');
  return { game, preferences: { flipped: data.preferences.flipped, faceToFace: data.preferences.faceToFace } };
}

export function loadSession(storage: StoragePort | null): LoadedSession {
  const fallback = { game: newGame(), preferences: defaultPreferences };
  if (!storage) return { ...fallback, status: 'unavailable' };
  let raw: string | null;
  try { raw = storage.getItem(SAVE_KEY); } catch { return { ...fallback, status: 'unavailable' }; }
  if (raw === null) return { ...fallback, status: 'new' };
  try { return { ...deserializeSession(raw), status: 'restored' }; } catch { return { ...fallback, status: 'invalid' }; }
}

export function saveSession(storage: StoragePort | null, session: StoredSession): boolean {
  try {
    if (!storage) return false;
    storage.setItem(SAVE_KEY, serializeSession(session));
    return true;
  } catch { return false; }
}

export function browserStorage(): StoragePort | null {
  try { return window.localStorage; } catch { return null; }
}
