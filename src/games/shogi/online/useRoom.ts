import { useEffect, useRef, useState } from 'react';
import { ROOM_API, ROOM_CODE, ROOM_HEALTH, type Command, type Entry, type RoomSnapshot, type Seat } from './protocol';

const storageKey = 'desk.01.online-seat';
const configured = import.meta.env.VITE_ROOMS_URL?.trim();
export const roomEndpoint = configured ? configured.replace(/\/$/, '') + ROOM_API
  : import.meta.env.DEV ? ROOM_API
  : location.protocol === 'file:' ? 'http://127.0.0.1:8787' + ROOM_API : null;

function readSeat(): Seat | null {
  try {
    const saved: Seat | null = JSON.parse(sessionStorage.getItem(storageKey) ?? 'null');
    return saved && ROOM_CODE.test(saved.code) && /^[a-f0-9]{64}$/.test(saved.token) ? saved : null;
  } catch { return null; }
}

function remember(seat: Seat | null) {
  try {
    if (seat) sessionStorage.setItem(storageKey, JSON.stringify(seat));
    else sessionStorage.removeItem(storageKey);
  } catch { /* The current page keeps its seat in memory. */ }
}

class ResponseError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

async function request<T>(body: object, signal?: AbortSignal): Promise<T> {
  if (!roomEndpoint) throw new Error('通信対戦サーバーが設定されていません');
  const timeout = AbortSignal.timeout(5_000);
  const response = await fetch(roomEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'omit',
    body: JSON.stringify(body),
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string };
    throw new ResponseError(body.error ?? 'サーバーが応答できませんでした', response.status);
  }
  return await response.json() as T;
}

// Only retry the read-only health check, before sending a room creation or join.
async function waitForServer(signal: AbortSignal) {
  if (!roomEndpoint?.startsWith('https://')) return;
  const health = roomEndpoint.slice(0, -ROOM_API.length) + ROOM_HEALTH;
  const deadline = AbortSignal.any([signal, AbortSignal.timeout(75_000)]);
  while (!deadline.aborted) {
    try {
      const response = await fetch(health, {
        credentials: 'omit', cache: 'no-store', signal: AbortSignal.any([deadline, AbortSignal.timeout(8_000)]),
      });
      if (response.ok && await response.text() === 'ok') return;
    } catch { /* An idle hosted server can take a moment to start. */ }
    if (!deadline.aborted) await new Promise(resolve => setTimeout(resolve, 1_500));
  }
  deadline.throwIfAborted();
}

function describe(error: unknown) {
  return error instanceof ResponseError ? error.message : '通信対戦サーバーに接続できませんでした';
}

export function useRoom() {
  const [seat, setSeat] = useState(readSeat);
  const [room, setRoom] = useState<RoomSnapshot | null>(null);
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const latest = useRef<RoomSnapshot | null>(null);
  const activeSeat = useRef(seat);
  const locked = useRef(false);
  const entryRequest = useRef<AbortController | null>(null);

  useEffect(() => () => entryRequest.current?.abort(), []);

  function apply(next: RoomSnapshot) {
    const previous = latest.current;
    if (previous && next.revision < previous.revision) return;
    if (previous && next.revision === previous.revision && next.opponentOnline === previous.opponentOnline) return;
    latest.current = { ...next, game: next.game ?? previous?.game };
    setRoom(latest.current);
  }

  function forget() {
    remember(null);
    activeSeat.current = null;
    latest.current = null;
    setSeat(null);
    setRoom(null);
    setConnected(false);
  }

  useEffect(() => {
    if (!seat) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let delay = 600;
    async function poll() {
      try {
        const current = await request<RoomSnapshot>({ type: 'poll', ...seat, knownGame: latest.current?.gameRevision }, controller.signal);
        if (controller.signal.aborted || activeSeat.current !== seat) return;
        apply(current);
        setConnected(true);
        delay = 600;
      } catch (failure) {
        if (controller.signal.aborted || activeSeat.current !== seat) return;
        if (failure instanceof ResponseError && [403, 404, 410].includes(failure.status)) {
          setError(failure.message);
          forget();
          return;
        }
        setConnected(false);
        delay = Math.min(delay * 2, 3_000);
      }
      if (!controller.signal.aborted) timer = setTimeout(() => { void poll(); }, delay);
    }
    void poll();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [seat]);

  async function enter(code?: string) {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError('');
    const controller = new AbortController();
    entryRequest.current = controller;
    try {
      await waitForServer(controller.signal);
      const entry = await request<Entry>(code === undefined ? { type: 'create' } : { type: 'join', code }, controller.signal);
      if (controller.signal.aborted) return;
      remember(entry.seat);
      activeSeat.current = entry.seat;
      apply(entry.room);
      setSeat(entry.seat);
      setConnected(true);
    } catch (failure) {
      if (!controller.signal.aborted) setError(describe(failure));
    } finally {
      entryRequest.current = null;
      locked.current = false;
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  async function send(command: Command) {
    const current = latest.current;
    if (!seat || !current || locked.current) return;
    locked.current = true;
    setBusy(true);
    setError('');
    try {
      const next = await request<RoomSnapshot>({
        type: 'command', ...seat, command, revision: current.revision, knownGame: current.gameRevision,
      });
      if (activeSeat.current !== seat) return;
      apply(next);
      setConnected(true);
    } catch (failure) {
      if (activeSeat.current === seat) {
        if (failure instanceof ResponseError) setError(failure.message);
        else setConnected(false);
      }
    } finally { locked.current = false; setBusy(false); }
  }

  async function leave() {
    if (locked.current) return;
    if (latest.current) await send({ type: 'leave' });
    forget();
  }

  return { seat, room, connected, busy, error, enter, send, leave };
}
