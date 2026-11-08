import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { APP_NAME } from '../../config';
import { Modal } from '../../components/Modal';
import { agreeImpasse, canAgreeImpasse, impassePoints, makeMove, newGame, pieceLabel, playerName, resign, undoMove } from './engine/game';
import { getLegalMoves, isInCheck } from './engine/rules';
import { other, type Game, type HandKind, type Move, type Result } from './engine/types';
import { browserStorage, loadSession, saveSession, serializeSession, type Preferences } from './persistence';
import { Board } from './components/Board';
import { HandStand } from './components/HandStand';
import { Piece } from './components/Piece';
import './shogi.css';

type Selection = { type: 'board'; square: number } | { type: 'hand'; kind: HandKind } | null;
type Panel = 'menu' | 'restart' | 'resign' | 'history' | 'help' | 'impasse' | null;
const resultText: Record<Result['reason'], string> = {
  checkmate: '詰み', resign: '投了', 'perpetual-check': '連続王手の千日手', 'no-legal-moves': '合法手なし',
  repetition: '千日手・指し直し', impasse: '持将棋・指し直し', 'impasse-points': '持将棋・24点未満', 'move-limit': '500手・指し直し',
};

export default function ShogiGame() {
  const [loaded] = useState(() => loadSession(browserStorage()));
  const [game, setGame] = useState(loaded.game), [preferences, setPreferences] = useState<Preferences>(loaded.preferences);
  const [selection, setSelection] = useState<Selection>(null), [panel, setPanel] = useState<Panel>(null);
  const [promotion, setPromotion] = useState<Move[] | null>(null), [hideResult, setHideResult] = useState(false);
  const [notice, setNotice] = useState(loaded.status === 'invalid' ? '保存データを読み込めなかったため、新しい対局を表示しています' : '');
  const [saved, setSaved] = useState(loaded.status !== 'unavailable');
  const [agreement, setAgreement] = useState({ sente: false, gote: false });
  const lastSerialized = useRef(serializeSession({ game: loaded.game, preferences: loaded.preferences }));
  const previousTitle = useRef(document.title);
  useEffect(() => { document.title = APP_NAME; return () => { document.title = previousTitle.current; }; }, []);
  useEffect(() => {
    const serialized = serializeSession({ game, preferences });
    if (serialized === lastSerialized.current) return;
    lastSerialized.current = serialized;
    setSaved(saveSession(browserStorage(), { game, preferences }));
  }, [game, preferences]);

  const legalMoves = useMemo(() => game.result ? [] : getLegalMoves(game.position), [game.position, game.result]);
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
    try { updateGame(makeMove(game, move)); } catch (error) { clearInteraction(); setNotice(error instanceof Error ? error.message : 'その手は指せません'); }
  }
  function onSquare(s: number) {
    if (game.result || promotion) return;
    const candidates = selectedMoves.filter(m => m.to === s);
    if (candidates.length === 1) { commit(candidates[0]!); return; }
    if (candidates.length > 1) { setPromotion(candidates); return; }
    const p = game.position.board[s];
    if (p?.color === game.position.turn) setSelection(current => current?.type === 'board' && current.square === s ? null : { type: 'board', square: s });
    else setSelection(null);
    setNotice('');
  }
  function selectHand(kind: HandKind) {
    setSelection(current => current?.type === 'hand' && current.kind === kind ? null : { type: 'hand', kind });
    setNotice('');
  }
  function undo() { updateGame(undoMove(game)); }
  function startOver() { updateGame(newGame()); }
  const turnText = game.result ? game.result.winner ? `${playerName(game.result.winner)}の勝ち` : '指し直し' : `${playerName(game.position.turn)}の番${check ? '・王手' : ''}`;
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

    {!saved && <p className="storage-warning" role="status">自動保存が使えません。この画面では対局を続けられます</p>}
    {notice && <p className="game-notice" role="status">{notice}<button onClick={() => setNotice('')} aria-label="通知を閉じる">×</button></p>}

    <div className="play-space">
      <HandStand position={game.position} color={topColor} top faceToFace={preferences.faceToFace} selected={game.position.turn === topColor && selection?.type === 'hand' ? selection.kind : null} onSelect={selectHand} ended={!!game.result} />
      <Board position={game.position} flipped={preferences.flipped} selected={selection?.type === 'board' ? selection.square : null}
        destinations={destinations} lastMove={last?.move} checkedKing={checkedKing} onSquare={onSquare} onCancel={() => setSelection(null)} />
      <HandStand position={game.position} color={bottomColor} top={false} faceToFace={preferences.faceToFace} selected={game.position.turn === bottomColor && selection?.type === 'hand' ? selection.kind : null} onSelect={selectHand} ended={!!game.result} />
    </div>
    {game.result && hideResult && <button className="result-reopen" onClick={() => setHideResult(false)}>対局結果</button>}

    {panel === 'menu' && <Modal title="将棋" onClose={() => setPanel(null)} className={`game-menu${upsideDown ? ' opponent-modal' : ''}`}>
      <nav className="menu-actions" aria-label="対局メニュー">
        <button onClick={undo} disabled={!game.history.length && !game.result}>待った<span>1手戻す</span></button>
        <button onClick={() => { setPreferences(p => ({...p,flipped:!p.flipped})); clearInteraction(); setPanel(null); }}>盤面を反転</button>
        <button onClick={() => setPanel('history')}>棋譜</button>
        <label className="menu-toggle"><span>対面モード</span><input type="checkbox" checked={preferences.faceToFace} onChange={e => setPreferences(p => ({...p,faceToFace:e.target.checked}))} /></label>
        <div className="menu-divider" />
        <button onClick={() => setPanel('resign')} disabled={!!game.result}>投了</button>
        <button onClick={() => {setAgreement({sente:false,gote:false});setPanel('impasse');}} disabled={!!game.result || !canAgreeImpasse(game.position)}>持将棋の合意</button>
        <button onClick={() => setPanel('restart')}>最初から</button>
        <div className="menu-divider" />
        <button onClick={() => setPanel('help')}>操作とルール</button>
        <Link to="/">一覧へ</Link>
      </nav>
      <p className="save-status">{saved ? '指すたびに自動保存' : '自動保存を利用できません'}</p>
    </Modal>}

    {panel === 'restart' && <Modal title="最初から始めますか" onClose={() => setPanel(null)} className={upsideDown ? 'opponent-modal' : ''}>
      <p>現在の対局と棋譜を消して、初期配置に戻します</p>
      <div className="dialog-actions"><button onClick={() => setPanel(null)}>戻る</button><button className="primary" onClick={startOver}>最初から</button></div>
    </Modal>}
    {panel === 'resign' && <Modal title={`${playerName(game.position.turn)}が投了しますか`} onClose={() => setPanel(null)} className={upsideDown ? 'opponent-modal' : ''}>
      <p>投了すると、{playerName(other(game.position.turn))}の勝ちになります</p>
      <div className="dialog-actions"><button onClick={() => setPanel(null)}>戻る</button><button className="primary" onClick={() => updateGame(resign(game))}>投了する</button></div>
    </Modal>}
    {promotion && <Modal title="成りますか" onClose={() => {setPromotion(null);setSelection(null);}} className={`promotion-modal${upsideDown ? ' opponent-modal' : ''}`}>
      <div className="promotion-choices">{[true,false].map(promote => {
        const m = promotion.find(m => m.type === 'move' && m.promote === promote);
        if (!m || m.type !== 'move') return null;
        const p = {...game.position.board[m.from]!,promoted:promote};
        return <button key={String(promote)} onClick={() => commit(m)}><Piece piece={p} /><span>{promote ? '成る' : '成らない'}</span></button>;
      })}</div>
    </Modal>}
    {game.result && !hideResult && !panel && <Modal title={game.result.winner ? `${playerName(game.result.winner)}の勝ち` : '指し直し'} onClose={() => setHideResult(true)}>
      <p className="result-reason">{resultText[game.result.reason]}</p><p>{game.history.length}手まで</p>
      {game.result.winner === null && <p>対局者の先手・後手を交代して、新しい対局を始めてください</p>}
      <div className="dialog-actions"><button onClick={() => setHideResult(true)}>盤面を見る</button><button className="primary" onClick={() => {if(game.result?.winner === null)setPreferences(p => ({...p,flipped:!p.flipped}));startOver();}}>もう一局</button></div>
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
      <div className="dialog-actions"><button onClick={() => setPanel(null)}>戻る</button><button className="primary" disabled={!agreement.sente || !agreement.gote} onClick={() => updateGame(agreeImpasse(game))}>持将棋を判定</button></div>
    </Modal>}
    <span className="sr-only" aria-live="polite">{selection?.type === 'board' ? `${pieceLabel(game.position.board[selection.square]!)}を選択、移動可能なマスは${destinations.size}か所` : selection?.type === 'hand' ? `持ち駒を選択、打てるマスは${destinations.size}か所` : ''}</span>
  </main>;
}
