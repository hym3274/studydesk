import type { IncomingMessage, ServerResponse } from 'node:http';
import { ROOM_API, ROOM_HEALTH } from './protocol';
import { RoomError, Rooms } from './rooms';

const MAX_BODY = 4096;
const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

async function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let length = 0;
  // A bounded stream avoids buffering oversized requests.
  for await (const chunk of req.iterator({ destroyOnReturn: false })) {
    const bytes = Buffer.from(chunk);
    length += bytes.length;
    if (length > MAX_BODY) {
      req.resume();
      throw new RoomError('リクエストが大きすぎます', 413);
    }
    chunks.push(bytes);
  }
  let body: unknown;
  try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new RoomError('不正なリクエストです'); }
  if (!object(body)) throw new RoomError('不正なリクエストです');
  return body;
}

export function roomMiddleware(allowsOrigin: (origin: string, req: IncomingMessage) => boolean) {
  const rooms = new Rooms();
  const attempts = new Map<string, { count: number; until: number }>();

  function limitEntry(req: IncomingMessage) {
    const now = Date.now();
    const ip = req.socket.remoteAddress ?? '';
    for (const [key, value] of attempts) if (value.until <= now) attempts.delete(key);
    const attempt = attempts.get(ip) ?? { count: 0, until: now + 60_000 };
    if (attempt.count >= 40 || !attempts.has(ip) && attempts.size >= 4096) {
      throw new RoomError('試行回数が多すぎます。少し待ってからお試しください', 429);
    }
    attempt.count++;
    attempts.set(ip, attempt);
  }

  function send(res: ServerResponse, status: number, body: unknown) {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(body));
  }

  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    if (req.url !== ROOM_API && req.url !== ROOM_HEALTH) { next(); return; }
    const origin = req.headers.origin;
    if (origin !== undefined) {
      if (!allowsOrigin(origin, req)) { send(res, 403, { error: 'このページからの接続は許可されていません' }); return; }
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    }
    if (req.url === ROOM_HEALTH && (req.method === 'GET' || req.method === 'HEAD')) {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end('ok');
      return;
    }
    if (req.url !== ROOM_API) { next(); return; }
    if (req.method === 'OPTIONS') {
      res.writeHead(204, { 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '600' });
      res.end();
      return;
    }
    if (req.method !== 'POST' || req.headers['content-type'] !== 'application/json') {
      send(res, 415, { error: 'JSONで送信してください' });
      return;
    }
    try {
      const request = await readBody(req);
      switch (request.type) {
        case 'create':
          limitEntry(req);
          send(res, 200, rooms.create());
          return;
        case 'join':
          limitEntry(req);
          send(res, 200, rooms.join(request.code));
          return;
        case 'poll':
          send(res, 200, rooms.contact(request.code, request.token, request.knownGame));
          return;
        case 'command':
          if (!object(request.command)) throw new RoomError('不正な操作です');
          send(res, 200, rooms.contact(request.code, request.token, request.knownGame, request.command, request.revision));
          return;
        default: throw new RoomError('不明なリクエストです');
      }
    } catch (error) {
      if (res.destroyed) return;
      if (!(error instanceof RoomError)) {
        send(res, 400, { error: 'その操作は現在の局面では実行できません' });
        return;
      }
      send(res, error.status, { error: error.message });
    }
  };
}
