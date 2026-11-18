import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { CheckboxInput } from '@astryxdesign/core/CheckboxInput';
import { VStack } from '@astryxdesign/core/VStack';
import { ExperimentUI } from '../../ui/ExperimentUI';
import { APP_NAME } from '../../config';
import { Modal } from '../../components/Modal';
import { agreeImpasse, canAgreeImpasse, impassePoints, makeMove, newGame, pieceLabel, playerName, resign, undoMove } from './engine/game';
import { getLegalMoves, isInCheck } from './engine/rules';
import { other, type Color, type Game, type HandKind, type Move, type Result } from './engine/types';
import { browserStorage, loadSession, saveSession, serializeSession, type Preferences, type StoredSession } from './persistence';
import { Board } from './components/Board';
import { HandStand } from './components/HandStand';
import { Piece } from './components/Piece';
import { registerStudySaveGuard } from '../../study-shortcut';
import type { Command, MatchGame, RoomSnapshot } from './online/protocol';
import './shogi.css';

type Selection = { type: 'board'; square: number } | { type: 'hand'; kind: HandKind } | null;
type Panel = 'menu' | 'restart' | 'resign' | 'history' | 'help' | 'impasse' | 'leave' | null;
const resultText: Record<Result['reason'], string> = {
  checkmate: '詰み', resign: '投了', 'perpetual-check': '連続王手の千日手', 'no-legal-moves': '合法手なし',
  repetition: '千日手・指し直し', impasse: '持将棋・指し直し', 'impasse-points': '持将棋・24点未満', 'move-limit': '500手・指し直し',
};

interface OnlineMatch {
  game: MatchGame;
  color: Color;
  active: boolean;
  connected: boolean;
  busy: boolean;
  status: string;
  proposal: RoomSnapshot['proposal'];
  send: (command: Command) => Promise<void>;
  leave: () => Promise<void>;
}

export default function ShogiGame({ initialSession, online }: { initialSession?: StoredSession; online?: OnlineMatch }) {
  const isOnline = !!online;
  const [loaded] = useState(() => loadSession(isOnline ? null : browserStorage()));
  const [localGame, setGame] = useState(initialSession?.game ?? loaded.game), [localPreferences, setPreferences] = useState<Preferences>(initialSession?.preferences ?? loaded.preferences);
  const game = online?.game ?? localGame;
  const preferences = online ? { flipped: online.color === 'gote', faceToFace: false } : localPreferences;
  const [selection, setSelection] = useState<Selection>(null), [panel, setPanel] = useState<Panel>(null);
  const [promotion, setPromotion] = useState<Move[] | null>(null), [hideResult, setHideResult] = useState(false);
  const [notice, setNotice] = useState(loaded.status === 'invalid' ? '保存データを読み込めなかったため、新しい対局を表示しています' : '');
  const [saved, setSaved] = useState(loaded.status !== 'unavailable');
  const [agreement, setAgreement] = useState({ sente: false, gote: false });
  const lastSerialized = useRef(serializeSession({ game: loaded.game, preferences: loaded.preferences }));
  const previousTitle = useRef(document.title);
  useEffect(() => { document.title = APP_NAME; return () => { document.title = previousTitle.current; }; }, []);
  useEffect(() => {
    if (isOnline) return;
    const serialized = serializeSession({ game: localGame, preferences: localPreferences });
    if (serialized === lastSerialized.current) return;
    lastSerialized.current = serialized;
    setSaved(saveSession(browserStorage(), { game: localGame, preferences: localPreferences }));
  }, [isOnline, localGame, localPreferences]);
  useEffect(() => isOnline ? undefined : registerStudySaveGuard(window,
    () => saveSession(browserStorage(), { game: localGame, preferences: localPreferences }),
    () => { setSaved(false); setNotice('対局を保存できないため、検索画面への移動を中止しました'); },
  ), [isOnline, localGame, localPreferences]);
  useEffect(() => {
    if (isOnline) { setSelection(null); setPromotion(null); }
  }, [isOnline, game]);

  const playable = !game.result && (!online || online.active && online.connected && !online.busy && game.position.turn === online.color);
  const legalMoves = useMemo(() => playable ? getLegalMoves(game.position) : [], [game.position, playable]);
  const selectedMoves = useMemo(() => legalMoves.filter(m => selection?.type === 'board'
    ? m.type === 'move' && m.from === selection.square : selection?.type === 'hand' && m.type === 'drop' && m.kind === selection.kind), [legalMoves, selection]);
  const destinations = useMemo(() => new Set(selectedMoves.map(m => m.to)), [selectedMoves]);
  const check = useMemo(() => isInCheck(game.position), [game.position]);
  const topColor = preferences.flipped ? 'sente' : 'gote', bottomColor = other(topColor);
  const upsideDown = preferences.faceToFace && game.position.turn === topColor;
  const last = game.history.at(-1);
  const checkedKing = check ? game.position.board.findIndex(p => p?.kind === 'K' && p.color === game.position.turn) : null;

  function clearInteraction() { setSelection(null); setPromotion(null); setNotice(''); }
  function updateGame(next: Game) { setGame(next); clearInteraction(); setPanel(null); setHideResult(false); }
  function commit(move: Move) {
    if (!playable) return;
    if (online) { clearInteraction(); void online.send({ type: 'move', move }); return; }
    try { updateGame(makeMove(localGame, move)); } catch (error) { clearInteraction(); setNotice(error instanceof Error ? error.message : 'その手は指せません'); }
  }
  function onSquare(s: number) {
    if (!playable || promotion) return;
    const candidates = selectedMoves.filter(m => m.to === s);
    if (candidates.length === 1) { commit(candidates[0]!); return; }
    if (candidates.length > 1) { setPromotion(candidates); return; }
    const p = game.position.board[s];
    if (p?.color === game.position.turn) setSelection(current => current?.type === 'board' && current.square === s ? null : { type: 'board', square: s });
    else setSelection(null);
    setNotice('');
  }
  function selectHand(kind: HandKind) {
    if (!playable) return;
    setSelection(current => current?.type === 'hand' && current.kind === kind ? null : { type: 'hand', kind });
    setNotice('');
  }
  function undo() { updateGame(undoMove(localGame)); }
  function startOver() { updateGame(newGame()); }
  const turn = online ? (online.color === game.position.turn ? 'あなたの手番' : '相手の手番') : `${playerName(game.position.turn)}の番`;
  const turnText = game.result ? game.result.winner ? `${playerName(game.result.winner)}の勝ち` : '指し直し' : `${turn}${check ? '・王手' : ''}`;
  const proposalName = online?.proposal?.kind === 'undo' ? '待った' : '持将棋の合意';
  const resigning = online?.color ?? game.position.turn;
  const canRequest = !!online?.connected && !online.busy && !online.proposal && !game.result;
  function propose(kind: 'undo' | 'impasse') {
    setPanel(null);
    void online?.send({ type: 'propose', kind });
  }
  return <main className="shogi-app">
    <header className="game-toolbar">
      <button className="menu-button" aria-label="メニューを開く" aria-haspopup="dialog" onClick={() => setPanel('menu')}>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M3 5h14M3 10h14M3 15h14" /></svg>
      </button>
      <p className={`turn-status${upsideDown && !game.result ? ' facing-opponent' : ''}`} role="status" aria-live="polite">{turnText}</p>
      <button className="last-action" aria-label="棋譜を見る" onClick={() => setPanel('history')}>
        {last ? <><span>{game.history.length}手目</span><span>{last.notation.replace(/（.*）/, '')}</span></> : <span>0手</span>}
      </button>
    </header>

    {!isOnline && !saved && <p className="storage-warning" role="status">自動保存が使えません。この画面では対局を続けられます</p>}
    {online?.status && <p className="game-notice online-notice" role="status">{online.status}</p>}
    {notice && <p className="game-notice" role="status">{notice}<button onClick={() => setNotice('')} aria-label="通知を閉じる">×</button></p>}
    {online?.proposal && <section className="online-proposal" aria-label={proposalName}>
      <p role="status">{online.proposal.mine ? `${proposalName}：相手の返事を待っています` : `相手が「${proposalName}」を申し出ました`}</p>
      {!online.proposal.mine && <ExperimentUI overlay><VStack gap={2}>
        <Button label="了承する" variant="primary" isDisabled={!online.connected || online.busy} onClick={() => void online.send({ type: 'reply', accept: true })} />
        <Button label="断る" isDisabled={!online.connected || online.busy} onClick={() => void online.send({ type: 'reply', accept: false })} />
      </VStack></ExperimentUI>}
    </section>}

    <div className="play-space">
      <HandStand position={game.position} color={topColor} top faceToFace={preferences.faceToFace} selected={game.position.turn === topColor && selection?.type === 'hand' ? selection.kind : null} onSelect={selectHand} ended={!playable} />
      <Board position={game.position} flipped={preferences.flipped} selected={selection?.type === 'board' ? selection.square : null}
        destinations={destinations} lastMove={last?.move} checkedKing={checkedKing} onSquare={onSquare} onCancel={() => setSelection(null)} />
      <HandStand position={game.position} color={bottomColor} top={false} faceToFace={preferences.faceToFace} selected={game.position.turn === bottomColor && selection?.type === 'hand' ? selection.kind : null} onSelect={selectHand} ended={!playable} />
    </div>
    {game.result && hideResult && <button className="result-reopen" onClick={() => setHideResult(false)}>対局結果</button>}

    {panel === 'menu' && <ExperimentUI overlay><Modal title="将棋" onClose={() => setPanel(null)} className={upsideDown ? 'opponent-modal' : ''}>
      <VStack gap={3}>
        <Button label="待った" onClick={online ? () => propose('undo') : undo} isDisabled={online ? !canRequest || !game.history.length : !game.history.length && !game.result} size="lg" />
        <Button label="投了" onClick={() => setPanel('resign')} isDisabled={!!game.result || !!online && (!online.connected || online.busy)} size="lg" />
        <Button label="持将棋の合意" onClick={() => {
          if (online) { propose('impasse'); return; }
          setAgreement({sente:false,gote:false}); setPanel('impasse');
        }} isDisabled={!!game.result || !canAgreeImpasse(game.position) || !!online && !canRequest} size="lg" />
        {online ? <Button label="部屋を出る" onClick={() => setPanel('leave')} size="lg" /> : <>
          <Button label="最初から" onClick={() => setPanel('restart')} size="lg" />
          <Button href="/tools/01" label="メニューに戻る" size="lg" />
          <VStack hAlign="end"><CheckboxInput width="fit-content" label="対面モード" value={preferences.faceToFace} onChange={checked => setPreferences(p => ({...p,faceToFace:checked}))} /></VStack>
        </>}
      </VStack>
    </Modal></ExperimentUI>}

    {panel === 'restart' && <Modal title="最初から始めますか" onClose={() => setPanel(null)} className={upsideDown ? 'opponent-modal' : ''}>
      <p>現在の対局と棋譜を消して、初期配置に戻します</p>
      <div className="dialog-actions"><button onClick={() => setPanel(null)}>戻る</button><button className="primary" onClick={startOver}>最初から</button></div>
    </Modal>}
    {panel === 'resign' && <Modal title={`${playerName(resigning)}が投了しますか`} onClose={() => setPanel(null)} className={upsideDown ? 'opponent-modal' : ''}>
      <p>投了すると、{playerName(other(resigning))}の勝ちになります</p>
      <div className="dialog-actions"><button onClick={() => setPanel(null)}>戻る</button><button className="primary" onClick={() => {
        if (online) { setPanel(null); void online.send({ type: 'resign' }); }
        else updateGame(resign(localGame));
      }}>投了する</button></div>
    </Modal>}
    {panel === 'leave' && online && <Modal title="部屋を出ますか" onClose={() => setPanel(null)}>
      {!game.result && <p>通信できる状態で部屋を出ると投了になります。</p>}
      <div className="dialog-actions"><button onClick={() => setPanel(null)}>戻る</button><button className="primary" disabled={online.busy} onClick={() => void online.leave()}>部屋を出る</button></div>
    </Modal>}
    {promotion && playable && <Modal title="成りますか" onClose={() => {setPromotion(null);setSelection(null);}} className={`promotion-modal${upsideDown ? ' opponent-modal' : ''}`}>
      <div className="promotion-choices">{[true,false].map(promote => {
        const m = promotion.find(m => m.type === 'move' && m.promote === promote);
        if (!m || m.type !== 'move') return null;
        const p = {...game.position.board[m.from]!,promoted:promote};
        return <button key={String(promote)} onClick={() => commit(m)}><Piece piece={p} /><span>{promote ? '成る' : '成らない'}</span></button>;
      })}</div>
    </Modal>}
    {game.result && !hideResult && !panel && <Modal title={game.result.winner ? `${playerName(game.result.winner)}の勝ち` : '指し直し'} onClose={() => setHideResult(true)}>
      <p className="result-reason">{resultText[game.result.reason]}</p><p>{game.history.length}手まで</p>
      {!online && game.result.winner === null && <p>対局者の先手・後手を交代して、新しい対局を始めてください</p>}
      <div className="dialog-actions"><button onClick={() => setHideResult(true)}>盤面を見る</button><button className="primary" onClick={() => {
        if (online) { void online.leave(); return; }
        if (game.result?.winner === null) setPreferences(p => ({ ...p, flipped: !p.flipped }));
        startOver();
      }}>{online ? '通信対戦に戻る' : 'もう一局'}</button></div>
    </Modal>}
    {panel === 'history' && <Modal title="棋譜" onClose={() => setPanel(null)} className={upsideDown ? 'opponent-modal' : ''}>
      {!game.history.length ? <p>まだ指されていません</p> : <ol className="move-history">{game.history.map((entry,i) => <li key={i}><span>{i+1}</span><span>{playerName(entry.mover)}</span><span>{entry.notation}</span>{entry.check && <span>王手</span>}</li>)}</ol>}
    </Modal>}
    {panel === 'help' && <Modal title="操作とルール" onClose={() => setPanel(null)} className={upsideDown ? 'opponent-modal' : ''}>
      <div className="help-content"><p>自分の駒を選び、印のある移動先をタップします。持ち駒は駒台から選んで打てます</p>
        <p>枠は選択した駒、黒い点は合法手、四隅の印は直前の手を表します。王手の玉には「王手」が表示されます</p>
        <p>対面モードでは、向かい側の持ち駒・手番・メニュー・成りの選択を180度回転します。机に端末を置いて遊ぶときに使ってください</p>
        <p>キーボードでは矢印キーでマスを移動し、EnterまたはSpaceで選択、Escapeで解除します</p>
        <p>二歩・打ち歩詰め・王手放置などの禁手は選べません。千日手と連続王手の千日手を自動判定します。持将棋は双方入玉後に、両者の合意で24点制を適用します</p>
        <p>待ったは気軽に遊ぶための機能です。入玉宣言法・対局時計・CPU対戦・オンライン対戦には対応していません</p>
      </div>
    </Modal>}
    {panel === 'impasse' && <Modal title="持将棋の合意" onClose={() => setPanel(null)}>
      <p>双方の玉が敵陣に入り、どちらも詰ます見込みがないときに合意してください。双方24点以上なら指し直し、24点未満の側は負けになります</p>
      <p>先手 {impassePoints(game.position,'sente')}点 ／ 後手 {impassePoints(game.position,'gote')}点</p>
      {(['sente','gote'] as const).map(c => <label className="agreement" key={c}><input type="checkbox" checked={agreement[c]} onChange={e => setAgreement(a => ({...a,[c]:e.target.checked}))} />{playerName(c)}が合意する</label>)}
      <div className="dialog-actions"><button onClick={() => setPanel(null)}>戻る</button><button className="primary" disabled={!agreement.sente || !agreement.gote} onClick={() => updateGame(agreeImpasse(localGame))}>持将棋を判定</button></div>
    </Modal>}
    <span className="sr-only" aria-live="polite">{selection?.type === 'board' && game.position.board[selection.square] ? `${pieceLabel(game.position.board[selection.square]!)}を選択、移動可能なマスは${destinations.size}か所` : selection?.type === 'hand' ? `持ち駒を選択、打てるマスは${destinations.size}か所` : ''}</span>
  </main>;
}
