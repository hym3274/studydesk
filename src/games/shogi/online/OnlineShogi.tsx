import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { CheckboxInput } from '@astryxdesign/core/CheckboxInput';
import { Heading } from '@astryxdesign/core/Heading';
import { Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { VStack } from '@astryxdesign/core/VStack';
import { ExperimentUI } from '../../../ui/ExperimentUI';
import { newGame, playerName } from '../engine/game';
import { other } from '../engine/types';
import ShogiGame from '../ShogiGame';
import { ROOM_CODE, type Order } from './protocol';
import { roomEndpoint, useRoom } from './useRoom';
import './online.css';

const initialGame = newGame();
const revealTime = 500;
const options: readonly Order[] = ['random', 'sente', 'gote'];

export default function OnlineShogi() {
  const { room, seat, connected, busy, error, enter, send, leave } = useRoom();
  const [code, setCode] = useState('');
  const [copied, setCopied] = useState('');
  const [revealed, setRevealed] = useState(false);
  const board = useRef<HTMLElement>(null);
  const started = !!room?.color;
  const active = started && revealed;
  const order = room?.order ?? 'random';
  const previewColor = order === 'random' ? 'sente' : room?.host ? order : other(order);
  const canAct = connected && !busy && !!room?.opponentOnline;

  useEffect(() => {
    if (!started) { setRevealed(false); return; }
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timer = window.setTimeout(() => setRevealed(true), reducedMotion ? 0 : revealTime);
    return () => window.clearTimeout(timer);
  }, [started]);
  useEffect(() => {
    if (active) board.current?.querySelector<HTMLButtonElement>('.square[tabindex="0"]')?.focus({ preventScroll: true });
  }, [active]);

  async function copyCode(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied('コードをコピーしました');
    } catch { setCopied('表示された6桁の数字を相手に伝えてください'); }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (ROOM_CODE.test(code)) void enter(code);
  }

  function exit() {
    setCopied('');
    return leave();
  }

  return <section className="online-shogi">
    <section ref={board} className={`online-board${started ? '' : ' experiment-board-muted'}`} inert={!active} aria-label="通信対戦の盤面">
      <ShogiGame online={{
        game: room?.game ?? initialGame, color: room?.color ?? previewColor,
        active: active && !!room?.opponentOnline, connected, busy, proposal: room?.proposal ?? null,
        status: active ? error || (!connected ? '再接続中…' : !room?.opponentOnline && !room?.game?.result ? '相手の再接続を待ってます' : '') : '',
        send, leave: exit,
      }} />
    </section>
    {!active && <section className={`online-lobby${started ? ' is-revealing' : ''}`} aria-hidden={started || undefined} inert={started}>
      <ExperimentUI overlay>
        <VStack className="online-lobby-wrap" gap={4}>
          {!room && !seat && <Button href="/tools/01" label="将棋へ戻る" variant="ghost" className="online-back" />}
          <Card className="online-lobby-card" padding={6}>
            <VStack gap={5}>
              {!room?.joined && <Heading level={1}>通信対戦</Heading>}
              {error && <p className="online-message" role="alert">{error}</p>}
              {!room ? seat ? <>
                <p className="online-message" role="status">部屋に再接続しています…</p>
                <Button label="接続をやめる" onClick={() => void exit()} />
              </> : roomEndpoint ? <>
                {busy && <p className="online-message" role="status">対戦サーバーに接続中…</p>}
                <Button label="部屋を作る" variant="primary" size="lg" width="100%" isDisabled={busy} onClick={() => void enter()} />
                <form onSubmit={submit}>
                  <VStack gap={3}>
                    <TextInput label="部屋コード" value={code} onChange={value => setCode(value.normalize('NFKC').replace(/[^0-9]/g, '').slice(0, 6))} inputMode="numeric" autoComplete="off" placeholder="6桁の数字" size="lg" />
                    <Button label="参加する" type="submit" size="lg" width="100%" isDisabled={busy || !ROOM_CODE.test(code)} />
                  </VStack>
                </form>
              </> : <p className="online-message" role="status">この配布版には通信対戦サーバーが設定されていません。</p>
              : <>
                {!room.joined ? <>
                  <VStack gap={2} hAlign="center">
                    <Text type="supporting">部屋コード</Text>
                    <p className="online-code">{room.code}</p>
                    <Button label="コピー" variant="ghost" size="sm" onClick={() => void copyCode(room.code)} />
                    {copied && <p className="online-message" role="status">{copied}</p>}
                  </VStack>
                  <VStack gap={2} role="group" aria-label="先後設定">
                    <Text weight="medium">先後設定</Text>
                    {options.map(value => <CheckboxInput key={value} label={value === 'random' ? 'ランダム' : `自分が${playerName(value)}`}
                      value={order === value} isDisabled={!connected || busy} onChange={checked => {
                        if (checked && value !== order) void send({ type: 'order', order: value });
                      }} />)}
                  </VStack>
                  <p className="online-message" role="status">{connected ? '相手の参加を待っています' : '再接続中…'}</p>
                </> : <>
                  <Heading level={1} className="online-player-order">あなたは {order === 'random' ? 'ランダム' : playerName(previewColor)} です！</Heading>
                  <Button label={room.ready ? '準備おｋ！' : '準備おｋ？'} variant="primary" size="lg" width="100%"
                    className={room.ready ? 'online-ready-confirmed' : undefined} isDisabled={!canAct}
                    onClick={() => void send({ type: 'ready', ready: !room.ready, orderRevision: room.orderRevision })} />
                  {(!connected || !room.opponentOnline) && <p className="online-message" role="status">{connected ? '相手の再接続を待ってます' : '再接続中…'}</p>}
                </>}
                <Button label="部屋を出る" variant="ghost" isDisabled={busy} onClick={() => void exit()} />
              </>}
            </VStack>
          </Card>
        </VStack>
      </ExperimentUI>
    </section>}
  </section>;
}
