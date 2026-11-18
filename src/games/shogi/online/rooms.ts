import { randomBytes, randomInt } from 'node:crypto';
import { agreeImpasse, canAgreeImpasse, makeMove, newGame, resign, undoMove } from '../engine/game';
import { other, type Color, type Game } from '../engine/types';
import { parseMove } from '../persistence';
import { ROOM_CODE, type Entry, type MatchGame, type Order, type ProposalKind, type RoomSnapshot } from './protocol';

interface Player { token: string; seen: number; ready: boolean; left: boolean }
interface Room {
  code: string;
  host: Player;
  guest?: Player;
  order: Order;
  orderRevision: number;
  hostColor: Color | null;
  game: Game;
  view: MatchGame;
  revision: number;
  gameRevision: number;
  activity: number;
  proposal: { kind: ProposalKind; player: Player } | null;
}

export class RoomError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}

const ONLINE_WINDOW = 8_000;
const ROOM_LIFETIME = 30 * 60_000;

export class Rooms {
  private rooms = new Map<string, Room>();

  constructor(private readonly now = Date.now, private readonly pickColor = (): Color => randomInt(2) ? 'sente' : 'gote') {}

  private newPlayer(): Player {
    return { token: randomBytes(32).toString('hex'), seen: this.now(), ready: false, left: false };
  }

  private prune() {
    for (const [code, room] of this.rooms) {
      if (this.now() - room.activity > ROOM_LIFETIME) this.rooms.delete(code);
    }
  }

  create(): Entry {
    this.prune();
    if (this.rooms.size >= 128) throw new RoomError('部屋がいっぱいです。時間をおいてお試しください', 503);
    let code: string;
    do { code = String(randomInt(1_000_000)).padStart(6, '0'); } while (this.rooms.has(code));
    const host = this.newPlayer();
    const game = newGame();
    const room: Room = {
      code, host, order: 'random', orderRevision: 0, hostColor: null, game, view: game,
      revision: 0, gameRevision: 0, activity: this.now(), proposal: null,
    };
    this.rooms.set(code, room);
    return this.entry(room, host);
  }

  private find(code: unknown): Room {
    this.prune();
    const room = typeof code === 'string' && ROOM_CODE.test(code) ? this.rooms.get(code) : undefined;
    if (!room) throw new RoomError('部屋が見つかりません。コードを確認してください', 404);
    return room;
  }

  join(code: unknown): Entry {
    const room = this.find(code);
    if (room.guest) throw new RoomError('この部屋は満員です', 409);
    if (room.host.left) throw new RoomError('この部屋は閉じられました', 410);
    room.guest = this.newPlayer();
    room.host.ready = false;
    room.revision++;
    room.activity = this.now();
    return this.entry(room, room.guest);
  }

  private entry(room: Room, player: Player): Entry {
    return { seat: { code: room.code, token: player.token }, room: this.snapshot(room, player) };
  }

  private snapshot(room: Room, player: Player, knownGame?: unknown): RoomSnapshot {
    const host = room.host === player;
    const opponent = host ? room.guest : room.host;
    return {
      code: room.code, host, joined: !!opponent,
      opponentOnline: !!opponent && !opponent.left && this.now() - opponent.seen < ONLINE_WINDOW,
      ready: player.ready, opponentReady: opponent?.ready ?? false,
      order: room.order, orderRevision: room.orderRevision, color: room.hostColor && (host ? room.hostColor : other(room.hostColor)),
      revision: room.revision, gameRevision: room.gameRevision,
      ...(knownGame !== room.gameRevision && { game: room.view }),
      proposal: room.proposal && { kind: room.proposal.kind, mine: room.proposal.player === player },
    };
  }

  contact(code: unknown, token: unknown, knownGame: unknown, command?: Record<string, unknown>, revision?: unknown): RoomSnapshot {
    const room = this.find(code);
    const player = token === room.host.token ? room.host : token === room.guest?.token ? room.guest : undefined;
    if (!player || player.left) throw new RoomError('この部屋の参加情報が無効です', 403);
    if (!room.hostColor) {
      for (const seat of [room.host, room.guest]) {
        if (seat?.ready && this.now() - seat.seen >= ONLINE_WINDOW) {
          seat.ready = false;
          room.revision++;
        }
      }
    }
    player.seen = this.now();
    room.activity = player.seen;
    if (command) {
      if (command.type !== 'leave' && command.type !== 'ready' && revision !== room.revision) throw new RoomError('対局情報が更新されました。もう一度お試しください', 409);
      this.apply(room, player, command);
      room.revision++;
    }
    return this.snapshot(room, player, knownGame);
  }

  private apply(room: Room, player: Player, command: Record<string, unknown>) {
    if (command.type === 'leave') {
      player.left = true;
      if (!room.hostColor && player === room.guest) {
        room.guest = undefined;
        room.host.ready = false;
        room.orderRevision++;
      } else if (!room.hostColor) this.rooms.delete(room.code);
      else if (!room.game.result) this.updateGame(room, resign(room.game, player === room.host ? room.hostColor : other(room.hostColor)));
      return;
    }
    const host = player === room.host;
    const opponent = host ? room.guest : room.host;
    if (command.type === 'order' && host && !room.guest && (command.order === 'random' || command.order === 'sente' || command.order === 'gote')) {
      room.order = command.order;
      room.orderRevision++;
      return;
    }
    if (!opponent || opponent.left) throw new RoomError('相手が部屋にいません', 409);
    if (!room.hostColor) {
      if (command.type === 'order') throw new RoomError('先後を指定できるのは相手が入室する前です', 409);
      if (command.type === 'ready' && typeof command.ready === 'boolean') {
        if (command.orderRevision !== room.orderRevision) throw new RoomError('先後設定が変わりました。確認してから準備してください', 409);
        player.ready = command.ready;
        if (player.ready && opponent.ready && this.now() - opponent.seen < ONLINE_WINDOW) {
          room.hostColor = room.order === 'random' ? this.pickColor() : room.order;
        }
        return;
      }
      throw new RoomError('対局はまだ始まっていません');
    }
    if (room.game.result) throw new RoomError('対局は終了しています');
    const color = host ? room.hostColor : other(room.hostColor);
    switch (command.type) {
      case 'move':
        if (room.game.position.turn !== color) throw new RoomError('相手の手番です', 409);
        this.updateGame(room, makeMove(room.game, parseMove(command.move)));
        return;
      case 'resign':
        this.updateGame(room, resign(room.game, color));
        return;
      case 'propose':
        if (room.proposal) throw new RoomError('確認中の申し出があります', 409);
        if (!(command.kind === 'undo' && room.game.history.length
          || command.kind === 'impasse' && canAgreeImpasse(room.game.position))) throw new RoomError('現在の局面では申し出できません');
        room.proposal = { kind: command.kind, player };
        return;
      case 'reply':
        if (!room.proposal || room.proposal.player === player || typeof command.accept !== 'boolean') throw new RoomError('応答できる申し出がありません');
        if (command.accept) this.updateGame(room, room.proposal.kind === 'undo' ? undoMove(room.game) : agreeImpasse(room.game));
        else room.proposal = null;
        return;
      default: throw new RoomError('不明な操作です');
    }
  }

  private updateGame(room: Room, game: Game) {
    room.game = game;
    room.view = {
      position: game.position, result: game.result,
      history: game.history.map(({ move, mover, check, notation }) => ({ move, mover, check, notation })),
    };
    room.gameRevision++;
    room.proposal = null;
  }
}
