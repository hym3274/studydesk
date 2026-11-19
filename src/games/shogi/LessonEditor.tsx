import { useMemo, useRef, useState, type ChangeEvent } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { HStack } from '@astryxdesign/core/HStack';
import { Text } from '@astryxdesign/core/Text';
import { TextArea } from '@astryxdesign/core/TextArea';
import { TextInput } from '@astryxdesign/core/TextInput';
import { VStack } from '@astryxdesign/core/VStack';
import { Modal } from '../../components/Modal';
import { Board } from './components/Board';
import { HandStand } from './components/HandStand';
import { Piece } from './components/Piece';
import { playerName } from './engine/game';
import { getLegalMoves } from './engine/rules';
import type { HandKind, Move, Position } from './engine/types';
import { replayPositions } from './lesson-data';
import {
  createDraft, DRAFT_KEY, MAX_COMMENT, MAX_FILE_BYTES, MAX_GENRE, MAX_MOVES, MAX_TITLE,
  parseDraft, recordingIssue, toLesson, truncateDraft, type LessonDraft,
} from './lesson-draft';
import { LessonReplay } from './LessonReplay';
import { LessonSetup } from './LessonSetup';
import { LessonTile } from './LessonTile';

type Selection = { square: number } | { hand: HandKind } | null;
type Dialog = 'setup' | 'promotion' | 'card' | 'replay' | 'truncate' | 'replace' | null;
const noDestinations = new Set<number>();
const ignore = () => {};

function loadDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? { draft: parseDraft(raw), status: '下書きを復元しました' } : { draft: createDraft(), status: '' };
  } catch { return { draft: createDraft(), status: '下書きを読み込めませんでした。書き出したファイルがあれば読み込めます。' }; }
}

export default function LessonEditor() {
  const [loaded] = useState(loadDraft);
  const [draft, setDraft] = useState(loaded.draft);
  const [status, setStatus] = useState(loaded.status);
  const [index, setIndex] = useState(0);
  const [selection, setSelection] = useState<Selection>(null);
  const [promotion, setPromotion] = useState<Move[]>([]);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [replacement, setReplacement] = useState<{ draft: LessonDraft; title: string } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const frames = useMemo(() => replayPositions(draft.start, draft.moves), [draft.start, draft.moves]);
  const issue = useMemo(() => recordingIssue(draft.start), [draft.start]);
  const frame = frames[index]!;
  const atEnd = index === draft.moves.length;
  const canRecord = atEnd && !issue && !frame.result && draft.moves.length < MAX_MOVES;
  const legal = useMemo(() => canRecord ? getLegalMoves(frame.position) : [], [canRecord, frame.position]);
  const choices = legal.filter(move => selection && (move.type === 'move' ? 'square' in selection && move.from === selection.square
    : 'hand' in selection && move.kind === selection.hand));
  const destinations = new Set(choices.map(move => move.to));

  function save(value: LessonDraft) {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(value));
      setStatus('この端末に下書きを保存しました');
    } catch { setStatus('端末に保存できませんでした。「書き出す」でファイルを保存できます。'); }
  }

  function update(value: LessonDraft) {
    setDraft(value);
    save(value);
  }

  function jump(step: number) {
    setIndex(step);
    setSelection(null);
  }

  function record(move: Move) {
    update({ ...draft, moves: [...draft.moves, move], comments: [...draft.comments, ''] });
    jump(draft.moves.length + 1);
    setDialog(null);
  }

  function onSquare(square: number) {
    if (!canRecord) return;
    const candidates = choices.filter(move => move.to === square);
    if (candidates.length > 1) { setPromotion(candidates); setDialog('promotion'); return; }
    if (candidates[0]) { record(candidates[0]); return; }
    setSelection(frame.position.board[square]?.color === frame.position.turn &&
      !(selection && 'square' in selection && selection.square === square) ? { square } : null);
  }

  function applyStart(start: Position) {
    update({ ...truncateDraft(draft, 0), start });
    jump(0);
    setDialog(null);
  }

  async function importDraft(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    try {
      if (file.size > MAX_FILE_BYTES) throw new Error('ファイルが大きすぎます');
      setReplacement({ draft: parseDraft(await file.text()), title: '読み込んだ内容に置き換えますか？' });
      setDialog('replace');
    } catch (failure) {
      setStatus(`読み込めませんでした。 ${failure instanceof Error && !(failure instanceof SyntaxError) ? failure.message : '書き出したJSONファイルを選んでください。'}`);
    }
  }

  function exportDraft() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(draft, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'lesson.json';
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const stepLabel = index ? `${index}手目　${frame.last?.notation ?? ''}` : '開始局面';
  const thumbFrame = frames[draft.thumbnail]!;

  return <VStack gap={5} className="lesson-editor">
    <section className="editor-fields editor-metadata">
      <TextInput label="タイトル" value={draft.title} onChange={title => update({ ...draft, title: title.slice(0, MAX_TITLE) })} placeholder="例：矢倉囲い" />
      <TextInput label="ジャンル" value={draft.genre} onChange={genre => update({ ...draft, genre: genre.slice(0, MAX_GENRE) })} placeholder="例：囲い" />
    </section>
    <HStack gap={2} className="editor-actions">
      <Button label="新規" variant="ghost" onClick={() => { setReplacement({ draft: createDraft(), title: '新しい下書きを始めますか？' }); setDialog('replace'); }} />
      <Button label="読み込む" onClick={() => input.current?.click()} />
      <input ref={input} hidden type="file" accept=".json,application/json" onChange={importDraft} />
      <Button label="書き出す" onClick={exportDraft} />
      <Button label="プレビュー" variant="primary" onClick={() => setDialog('card')} />
    </HStack>
    <section className="editor-workspace">
      <VStack gap={4} className="editor-board-panel">
        <HStack gap={2} className="editor-actions">
          <Button label="開始局面を作る" onClick={() => setDialog('setup')} />
          <Text type="supporting">{issue ? '配置を確認' : `${playerName(frame.position.turn)}の手番`}</Text>
        </HStack>
        <VStack className="lesson-board editor-board">
          <Board position={frame.position} flipped={false} selected={selection && 'square' in selection ? selection.square : null}
            destinations={destinations} lastMove={frame.last?.move} checkedKing={frame.checkedKing}
            onSquare={onSquare} onCancel={() => setSelection(null)} readOnly={!canRecord} />
        </VStack>
        {(['gote', 'sente'] as const).filter(color => Object.values(frame.position.hands[color]).some(count => count > 0)).map(color =>
          <HandStand key={color} position={frame.position} color={color} top={color === 'gote'} faceToFace={false}
            selected={frame.position.turn === color && selection && 'hand' in selection ? selection.hand : null}
            ended={!canRecord} onSelect={hand => setSelection(selection && 'hand' in selection && selection.hand === hand ? null : { hand })} />,
        )}
        <HStack gap={4} hAlign="center" vAlign="center">
          <Button label="←" aria-label="前の手" size="lg" isDisabled={index === 0} onClick={() => jump(index - 1)} />
          <Text className="lesson-count">{index} / {draft.moves.length} 手</Text>
          <Button label="→" aria-label="次の手" size="lg" isDisabled={atEnd} onClick={() => jump(index + 1)} />
        </HStack>
        <Button label={draft.thumbnail === index ? 'この局面がサムネイル' : 'この局面をサムネイルにする'}
          isDisabled={draft.thumbnail === index} onClick={() => update({ ...draft, thumbnail: index })} />
        {issue && <Text type="supporting">{issue}</Text>}
        {!atEnd && <Text type="supporting">手を追加するには、最後の手に移動してください。</Text>}
        {atEnd && (frame.result || draft.moves.length >= MAX_MOVES) && <Text type="supporting">ここまで記録できます。</Text>}
      </VStack>
      <VStack gap={4} className="editor-detail">
        <Text weight="medium">手順</Text>
        <ol className="editor-moves" aria-label="手順">
          {frames.map(({ last }, step) => <li key={step}>
            <button type="button" aria-current={index === step ? 'step' : undefined} onClick={() => jump(step)}>
              {last ? `${step}手目　${last.notation}` : '開始局面'}
            </button>
          </li>)}
        </ol>
        {!atEnd && <Button label="ここから先を削除" variant="ghost" onClick={() => setDialog('truncate')} />}
        <TextArea label={`${stepLabel}の解説`} value={draft.comments[index] ?? ''} onChange={comment => {
          const comments = [...draft.comments];
          comments[index] = comment;
          update({ ...draft, comments });
        }} rows={5} maxLength={MAX_COMMENT} />
        <Button label="下書き保存" onClick={() => save(draft)} />
        {status && <Text type="supporting" role="status">{status}</Text>}
      </VStack>
    </section>
    {dialog === 'setup' && <LessonSetup start={draft.start} hasMoves={draft.moves.length > 0} onApply={applyStart} onClose={() => setDialog(null)} />}
    {dialog === 'promotion' && <Modal title="成りますか" onClose={() => setDialog(null)}>
      <section className="promotion-choices">{promotion.map(move => move.type === 'move' &&
        <button key={String(move.promote)} onClick={() => record(move)}>
          <Piece piece={{ ...frame.position.board[move.from]!, promoted: move.promote }} />{move.promote ? '成る' : '成らない'}
        </button>)}</section>
    </Modal>}
    {dialog === 'card' && <Modal title="カードのプレビュー" onClose={() => setDialog(null)}>
      <LessonTile title={toLesson(draft).title} genre={draft.genre} onOpen={() => setDialog('replay')} thumbnail={
        <VStack className="editor-tile-board" aria-hidden="true" inert>
          <Board position={thumbFrame.position} flipped={false} selected={null} destinations={noDestinations}
            checkedKing={null} onSquare={ignore} onCancel={ignore} readOnly />
        </VStack>
      } />
    </Modal>}
    {dialog === 'replay' && <LessonReplay lesson={toLesson(draft)} onClose={() => setDialog(null)} />}
    {dialog === 'truncate' && <Modal title="この局面から先の手順を削除しますか？" onClose={() => setDialog(null)}>
      <p>{draft.moves.length - index}手と、その解説を削除します。</p>
      <Button label="削除する" variant="primary" onClick={() => { update(truncateDraft(draft, index)); setDialog(null); }} />
    </Modal>}
    {dialog === 'replace' && replacement && <Modal title={replacement.title} onClose={() => setDialog(null)}>
      <p>現在の下書きが置き換わります。残したい場合は、先に書き出してください。</p>
      <Button label="置き換える" variant="primary" onClick={() => {
        update(replacement.draft); jump(0); setReplacement(null); setDialog(null);
      }} />
    </Modal>}
  </VStack>;
}
