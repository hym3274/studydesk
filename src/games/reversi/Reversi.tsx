import { useEffect, useMemo, useRef, useState } from 'react';
import { Route, Routes, useNavigate } from 'react-router-dom';
import { Button } from '@astryxdesign/core/Button';
import { VStack } from '@astryxdesign/core/VStack';
import { HStack } from '@astryxdesign/core/HStack';
import { Text } from '@astryxdesign/core/Text';
import { CheckboxInput } from '@astryxdesign/core/CheckboxInput';
import { ExperimentUI } from '../../ui/ExperimentUI';
import { Modal } from '../../components/Modal';
import { registerStudySaveGuard } from '../../study-shortcut';
import { Board, Disc } from './Board';
import { colorName, legalMoves, makeMove, newGame, score, undo, winner, type Color } from './engine';
import { browserStorage, load, save, serialize, type Session } from './persistence';

export default function Reversi() {
  const [start,setStart] = useState<Session>();
  return <Routes><Route index element={<Home onStart={setStart} />} />
    <Route path="match" element={<Match initial={start} />} />
    <Route path="*" element={<ExperimentUI><Button href="/tools/02" label="オセロへ" /></ExperimentUI>} />
  </Routes>;
}
function Home({onStart}: {onStart: (value: Session | undefined) => void}) {
  const [session] = useState(() => load(browserStorage()));
  const [confirm,setConfirm] = useState(false), navigate = useNavigate();
  const resumable = session.game.moves.length > 0 && !session.game.position.ended;
  const background = resumable ? session.game.position : newGame().position;
  function fresh() { onStart({game:newGame(),preferences:session.preferences}); }
  return <ExperimentUI><main className="experiment-home rv-home">
    <VStack className="experiment-backdrop rv-backdrop" aria-hidden="true" inert>
      <Board position={background} flipped={resumable && session.preferences.flipped} decorative />
    </VStack>
    <Button href="/" className="experiment-back" label="一覧へ" variant="ghost" />
    <VStack className="experiment-home-content" gap={10}><h1 className="rv-title">オセロ</h1>
      <nav aria-label="オセロのメニュー"><VStack gap={3}>
        <Button href="/tools/02/match" label={resumable ? '対人対戦 / 続きから' : '対人対戦'} onClick={() => resumable ? onStart(undefined) : fresh()} variant="primary" size="lg" width="100%" />
        {resumable && <Button label="対人対戦 / はじめから" onClick={() => setConfirm(true)} size="lg" width="100%" />}
      </VStack></nav>
    </VStack>
    {confirm && <Modal title="はじめから始めますか" onClose={() => setConfirm(false)}><VStack gap={5}>
      <Text>保存されている対局を新しい対局に置き換えます</Text>
      <HStack gap={3}><Button label="戻る" onClick={() => setConfirm(false)} /><Button label="はじめから始める" variant="primary" onClick={() => {fresh();navigate('/tools/02/match');}} /></HStack>
    </VStack></Modal>}
  </main></ExperimentUI>;
}
function Match({initial}: {initial?: Session}) {
  const [loaded] = useState(() => load(browserStorage()));
  const [game,setGame] = useState(initial?.game ?? loaded.game);
  const [preferences,setPreferences] = useState(initial?.preferences ?? loaded.preferences);
  const [panel,setPanel] = useState<'menu'|'restart'|'rules'|null>(null);
  const [hideResult,setHideResult] = useState(false);
  const [saved,setSaved] = useState(loaded.status !== 'unavailable');
  const [notice,setNotice] = useState(loaded.status === 'invalid' ? '保存データを読み込めなかったため、新しい対局を表示しています' : '');
  const last = useRef(serialize({game:loaded.game,preferences:loaded.preferences}));
  useEffect(() => {
    const value = serialize({game,preferences});
    if (last.current === value) return;
    last.current = value; setSaved(save(browserStorage(),{game,preferences}));
  },[game,preferences]);
  useEffect(() => registerStudySaveGuard(window, () => save(browserStorage(),{game,preferences}), () => {
    setSaved(false);setNotice('対局を保存できないため、検索画面への移動を中止しました');
  }),[game,preferences]);
  const moves = useMemo(() => legalMoves(game.position),[game.position]);
  const counts = score(game.position), top: Color = preferences.flipped ? 'black' : 'white';
  const facing = preferences.faceToFace && game.position.turn === top && !game.position.ended;
  const outcome = winner(game.position), result = outcome ? `${colorName(outcome)}の勝ち` : '引き分け';
  function move(square: number) { setGame(current => makeMove(current,square));setNotice('');setHideResult(false); }
  function restart() {setGame(newGame());setPanel(null);setHideResult(false);setNotice('');}
  return <ExperimentUI><main className="rv-match">
    <header className="rv-toolbar">
      <Button label="メニューを開く" isIconOnly icon={<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M3 5h14M3 10h14M3 15h14" /></svg>} variant="primary" size="lg" onClick={() => setPanel('menu')} />
      <Text className={facing ? 'rv-facing' : ''}>{game.position.ended ? result : `${colorName(game.position.turn)}の番`}</Text>
      <Text type="supporting">{game.moves.length}手目</Text>
    </header>
    <VStack className="rv-play">
      {(['top','bottom'] as const).map(side => {
        const color: Color = side === 'top' ? top : top === 'white' ? 'black' : 'white';
        return <HStack key={side} gap={3} className={`rv-player rv-player-${side}${side === 'top' && preferences.faceToFace ? ' rv-facing' : ''}`} aria-label={colorName(color)}>
          <Disc color={color} /><Text>{colorName(color)}</Text>
        </HStack>;
      })}
      <Board position={game.position} legal={moves} flipped={preferences.flipped} last={game.moves.at(-1)} onMove={move} />
    </VStack>
    <VStack className={`rv-notices${facing ? ' rv-facing' : ''}`} gap={2} role="status">
      {game.position.passed && !game.position.ended && <Text>{colorName(game.position.passed)}は置けないためパス。{colorName(game.position.turn)}の番です</Text>}
      {notice && <Text>{notice}</Text>}
      {!saved && <Text type="supporting">自動保存を利用できません</Text>}
    </VStack>
    {panel && <Modal title={panel === 'menu' ? 'オセロ' : panel === 'restart' ? '最初から始めますか' : '操作とルール'} onClose={() => setPanel(null)} className={facing ? 'rv-facing' : ''}>
      {panel === 'menu' ? <VStack gap={3}>
        <Button label="待った" isDisabled={!game.moves.length} onClick={() => {setGame(undo(game));setHideResult(false);setPanel(null);}} size="lg" />
        <Button label="盤面を反転" onClick={() => {setPreferences(p => ({...p,flipped:!p.flipped}));setPanel(null);}} size="lg" />
        <CheckboxInput label="対面モード" value={preferences.faceToFace} onChange={checked => setPreferences(p => ({...p,faceToFace:checked}))} />
        <Button label="最初から" onClick={() => setPanel('restart')} size="lg" />
        <Button label="操作とルール" onClick={() => setPanel('rules')} size="lg" />
        <Button href="/tools/02" label="オセロのメニューへ" size="lg" />
        <Text type="supporting">{saved ? '置くたびに自動保存' : '自動保存を利用できません'}</Text>
      </VStack> : panel === 'restart' ? <VStack gap={5}><Text>現在の対局を新しい対局に置き換えます</Text><HStack gap={3}><Button label="戻る" onClick={() => setPanel('menu')} /><Button label="はじめから始める" variant="primary" onClick={restart} /></HStack></VStack>
        : <VStack gap={4}><Text>黒が先手です。点のあるマスをタップすると、縦・横・斜めにはさんだ相手の石がすべて裏返ります</Text>
          <Text>置ける場所がないときだけ自動でパスします。両者とも置けなくなると終局し、盤上の石が多い側の勝ちです。同数は引き分けです</Text>
          <Text>矢印キーでマスを移動し、EnterまたはSpaceで石を置けます。枠は最後に置いた石を示します</Text></VStack>}
    </Modal>}
    {game.position.ended && !hideResult && !panel && <Modal title={result} onClose={() => setHideResult(true)}>
      <VStack gap={5}><Text>黒 {counts.black}枚 ／ 白 {counts.white}枚</Text><Text>両者とも置ける場所がなくなりました</Text>
        <HStack gap={3}><Button label="盤面を見る" onClick={() => setHideResult(true)} /><Button label="もう一局" variant="primary" onClick={restart} /></HStack></VStack>
    </Modal>}
  </main></ExperimentUI>;
}
