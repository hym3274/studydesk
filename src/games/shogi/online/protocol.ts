import type { Color, Game, HistoryEntry, Move } from '../engine/types';

export interface Seat {
  code: string;
  token: string;
}

export type Order = 'random' | Color;
export type ProposalKind = 'undo' | 'impasse';
export type Command =
  | { type: 'order'; order: Order }
  | { type: 'ready'; ready: boolean; orderRevision: number }
  | { type: 'move'; move: Move }
  | { type: 'resign' }
  | { type: 'propose'; kind: ProposalKind }
  | { type: 'reply'; accept: boolean }
  | { type: 'leave' };

export type MatchGame = Omit<Game, 'history'> & { history: readonly Omit<HistoryEntry, 'before'>[] };

export interface RoomSnapshot {
  code: string;
  host: boolean;
  joined: boolean;
  opponentOnline: boolean;
  ready: boolean;
  opponentReady: boolean;
  order: Order;
  orderRevision: number;
  color: Color | null;
  revision: number;
  gameRevision: number;
  game?: MatchGame;
  proposal: { kind: ProposalKind; mine: boolean } | null;
}

export interface Entry {
  seat: Seat;
  room: RoomSnapshot;
}

export const ROOM_API = '/api/rooms';
export const ROOM_HEALTH = '/health';
export const ROOM_CODE = /^[0-9]{6}$/;
