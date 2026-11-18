import { createServer } from 'node:http';
import { once } from 'node:events';
import { describe, expect, it } from 'vitest';
import { roomMiddleware } from './http';
import type { Command, Entry, Seat } from './protocol';
import { Rooms } from './rooms';

const pawn = { type: 'move', from: 56, to: 47, promote: false } as const;

function setup(rooms = new Rooms()) {
  const host = rooms.create().seat;
  const guest = rooms.join(host.code).seat;
  const read = (seat: Seat, knownGame?: number) => rooms.contact(seat.code, seat.token, knownGame);
  const send = (seat: Seat, command: Command, revision = read(seat).revision) =>
    rooms.contact(seat.code, seat.token, undefined, command, revision);
  const ready = (seat: Seat) => send(seat, { type: 'ready', ready: true, orderRevision: read(seat).orderRevision });
  return { host, guest, read, send, ready };
}

describe('将棋の通信対戦', () => {
  it('同時に準備しても、サーバーが一度だけランダムに先後を割り当てる', () => {
    let draws = 0;
    const { host, guest, send, read } = setup(new Rooms(undefined, () => { draws++; return 'gote'; }));
    const initial = read(host);
    const command = { type: 'ready', ready: true, orderRevision: initial.orderRevision } as const;
    expect(send(host, command, initial.revision)).toMatchObject({ ready: true, opponentReady: false, color: null });
    expect(send(guest, command, initial.revision)).toMatchObject({ ready: true, opponentReady: true, color: 'sente' });
    expect(read(host).color).toBe('gote');
    expect(draws).toBe(1);
  });

  it('ホストが入室待ちの間だけ先後を指定でき、参加した相手に反映される', () => {
    const rooms = new Rooms();
    const { seat: host, room: initial } = rooms.create();
    const ordered = rooms.contact(host.code, host.token, undefined, { type: 'order', order: 'gote' }, initial.revision);
    const { seat: guest, room: joined } = rooms.join(host.code);
    expect(joined).toMatchObject({ ready: false, opponentReady: false, order: 'gote' });
    for (const player of [host, guest]) {
      expect(() => rooms.contact(player.code, player.token, undefined, { type: 'order', order: 'sente' }, joined.revision)).toThrow(/入室する前/);
    }
    expect(() => rooms.contact(host.code, host.token, undefined, { type: 'ready', ready: true, orderRevision: initial.orderRevision })).toThrow(/先後設定/);
    const ready = { type: 'ready', ready: true, orderRevision: ordered.orderRevision };
    rooms.contact(host.code, host.token, undefined, ready);
    expect(rooms.contact(guest.code, guest.token, undefined, ready).color).toBe('sente');
  });

  it('無効な着手と再送を拒否し、確定した局面を両端末に返す', () => {
    const { host, guest, read, send, ready } = setup(new Rooms(undefined, () => 'sente'));
    expect(() => send(host, { type: 'move', move: pawn })).toThrow();
    ready(host);
    const started = ready(guest);
    expect(() => send(guest, { type: 'move', move: pawn })).toThrow(/相手の手番/);
    expect(() => send(host, { type: 'move', move: { ...pawn, to: 0 } })).toThrow();
    const moved = send(host, { type: 'move', move: pawn }, started.revision);
    expect(moved.game?.position.board[47]).toMatchObject({ kind: 'P', color: 'sente' });
    expect(read(guest).game).toEqual(moved.game);
    expect(read(guest, moved.gameRevision).game).toBeUndefined();
    expect(() => send(host, { type: 'move', move: pawn }, started.revision)).toThrow(/更新/);
  });

  it('待ったには相手の了承が必要で、後手も相手の手番に投了できる', () => {
    const { host, guest, read, send, ready } = setup(new Rooms(undefined, () => 'sente'));
    ready(host);
    ready(guest);
    send(host, { type: 'move', move: pawn });
    send(host, { type: 'propose', kind: 'undo' });
    expect(read(guest).proposal).toEqual({ kind: 'undo', mine: false });
    expect(() => send(host, { type: 'reply', accept: true })).toThrow();
    expect(send(guest, { type: 'reply', accept: true }).game?.history).toHaveLength(0);
    expect(send(guest, { type: 'resign' }).game?.result).toEqual({ reason: 'resign', winner: 'sente' });
  });

  it('途切れた接続が同じ席に戻り、離席が長い場合は部屋が期限切れになる', () => {
    let time = 0;
    const { host, guest, read, send, ready } = setup(new Rooms(() => time, () => 'sente'));
    ready(host);
    ready(guest);
    send(host, { type: 'move', move: pawn });
    time = 9_000;
    expect(read(host).opponentOnline).toBe(false);
    expect(read(guest)).toMatchObject({ color: 'gote', opponentOnline: true, game: { history: [{ move: pawn }] } });
    expect(read(host).opponentOnline).toBe(true);
    expect(() => read({ ...guest, token: 'wrong' })).toThrow(/参加情報/);
    time += 31 * 60_000;
    expect(() => read(guest)).toThrow(/見つかりません/);
  });

  it('ローカルHTMLのオリジンに応答し、HTTP経由で二つの席を発行する', async () => {
    const middleware = roomMiddleware(origin => origin === 'null');
    const server = createServer((req, res) => { void middleware(req, res, () => { res.writeHead(404).end(); }); });
    server.listen(0, '127.0.0.1');
    try {
      await once(server, 'listening');
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('Missing test address');
      const url = `http://127.0.0.1:${address.port}/api/rooms`;
      const health = await fetch(new URL('/health', url), { headers: { Origin: 'null' } });
      expect(health.headers.get('Access-Control-Allow-Origin')).toBe('null');
      expect(await health.text()).toBe('ok');
      const preflight = await fetch(url, { method: 'OPTIONS', headers: { Origin: 'null' } });
      expect(preflight.status).toBe(204);
      expect(preflight.headers.get('Access-Control-Allow-Origin')).toBe('null');
      const post = (body: object, origin = 'null') => fetch(url, { method: 'POST',
        headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      expect((await post({ type: 'create' }, 'https://unknown.example')).status).toBe(403);
      const { seat: host } = await (await post({ type: 'create' })).json() as Entry;
      const { seat: guest } = await (await post({ type: 'join', code: host.code })).json() as Entry;
      expect(guest).toMatchObject({ code: host.code });
      expect(guest.token).not.toBe(host.token);
      expect((await post({ type: 'join', code: host.code })).status).toBe(409);
    } finally {
      await new Promise<void>(resolve => server.close(() => resolve()));
    }
  });
});
