import { makeMove, newGame, type Game } from './engine';
export interface StoragePort { getItem(key: string): string | null; setItem(key: string, value: string): void }
export function browserStorage(): StoragePort | null { try { return window.localStorage; } catch { return null; } }
export const SAVE_KEY = 'desk.discs.v1';
export interface Preferences { readonly flipped: boolean; readonly faceToFace: boolean }
export interface Session { readonly game: Game; readonly preferences: Preferences }
export const defaults: Preferences = { flipped: false, faceToFace: true };
export function serialize(session: Session): string {
  return JSON.stringify({version:1,moves:session.game.moves,preferences:session.preferences});
}
export function deserialize(raw: string): Session {
  if (raw.length > 8192) throw Error('保存データが大きすぎます');
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== 'object' || !('version' in value) || value.version !== 1 || !('moves' in value)
    || !Array.isArray(value.moves) || value.moves.length > 60 || !('preferences' in value)) throw Error('不正な保存形式');
  const preferences = value.preferences;
  if (!preferences || typeof preferences !== 'object' || !('flipped' in preferences) || typeof preferences.flipped !== 'boolean'
    || !('faceToFace' in preferences) || typeof preferences.faceToFace !== 'boolean') throw Error('不正な表示設定');
  let game = newGame();
  for (const square of value.moves) {
    if (typeof square !== 'number') throw Error('不正な指し手');
    game = makeMove(game,square);
  }
  return { game, preferences: { flipped: preferences.flipped, faceToFace: preferences.faceToFace } };
}
export function load(storage: StoragePort | null): Session & { status: 'new' | 'restored' | 'invalid' | 'unavailable' } {
  const fallback = { game: newGame(), preferences: defaults };
  let raw: string | null;
  try {
    if (!storage) return {...fallback,status:'unavailable'};
    raw = storage.getItem(SAVE_KEY);
  } catch { return {...fallback,status:'unavailable'}; }
  if (raw === null) return {...fallback,status:'new'};
  try { return {...deserialize(raw),status:'restored'}; } catch { return {...fallback,status:'invalid'}; }
}
export function save(storage: StoragePort | null, session: Session): boolean {
  try { if (!storage) return false; storage.setItem(SAVE_KEY,serialize(session)); return true; } catch { return false; }
}
