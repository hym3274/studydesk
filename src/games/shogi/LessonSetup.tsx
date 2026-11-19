import { useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { CheckboxInput } from '@astryxdesign/core/CheckboxInput';
import { HStack } from '@astryxdesign/core/HStack';
import { VStack } from '@astryxdesign/core/VStack';
import { Modal } from '../../components/Modal';
import { Board } from './components/Board';
import { initialPosition, pieceLabel, playerName } from './engine/game';
import { COLORS, emptyHand, HAND_KINDS, type Color, type HandKind, type Kind, type Position } from './engine/types';
import { PIECE_KINDS, validateSetup } from './lesson-draft';

const noDestinations = new Set<number>();
const ignore = () => {};

export function LessonSetup({ start, hasMoves, onApply, onClose }: {
  start: Position; hasMoves: boolean; onApply: (position: Position) => void; onClose: () => void;
}) {
  const [position, setPosition] = useState(start);
  const [color, setColor] = useState<Color>('sente');
  const [kind, setKind] = useState<Kind | 'erase'>('P');
  const [promoted, setPromoted] = useState(false);
  const [error, setError] = useState('');
  const promotable = kind !== 'erase' && kind !== 'K' && kind !== 'G';

  function place(square: number) {
    const board = position.board.slice();
    board[square] = kind === 'erase' ? null : { kind, color, promoted: promotable && promoted };
    setPosition({ ...position, board });
    setError('');
  }

  function setHand(side: Color, piece: HandKind, count: number) {
    setPosition({ ...position, hands: { ...position.hands, [side]: { ...position.hands[side], [piece]: count } } });
    setError('');
  }

  function apply() {
    try { validateSetup(position); } catch (failure) {
      setError(failure instanceof Error ? failure.message : '配置を確認してください');
      return;
    }
    onApply(position);
  }

  return <Modal title="開始局面を作る" className="editor-setup" onClose={onClose}>
    <VStack gap={4}>
      <HStack gap={2} className="editor-actions">
        <Button label="初期配置にする" onClick={() => { setPosition(initialPosition()); setError(''); }} />
        <Button label="盤と持ち駒を空にする" onClick={() => {
          setPosition({ board: Array(81).fill(null), hands: { sente: emptyHand(), gote: emptyHand() }, turn: 'sente' });
          setError('');
        }} />
      </HStack>
      <section className="editor-fields">
        <label>駒の向き<select value={color} onChange={event => setColor(event.target.value as Color)}>
          {COLORS.map(side => <option key={side} value={side}>{playerName(side)}</option>)}
        </select></label>
        <label>置く駒<select value={kind} onChange={event => { setKind(event.target.value as Kind | 'erase'); setPromoted(false); }}>
          {PIECE_KINDS.map(piece => <option key={piece} value={piece}>{pieceLabel({ kind: piece, color, promoted: false })}</option>)}
          <option value="erase">駒を消す</option>
        </select></label>
        <label>最初の手番<select value={position.turn} onChange={event => { setPosition({ ...position, turn: event.target.value as Color }); setError(''); }}>
          {COLORS.map(side => <option key={side} value={side}>{playerName(side)}</option>)}
        </select></label>
      </section>
      <CheckboxInput label="成駒として置く" value={promotable && promoted} isDisabled={!promotable} onChange={setPromoted} />
      <VStack className="lesson-board editor-setup-board">
        <Board position={position} flipped={false} selected={null} destinations={noDestinations} checkedKing={null} onSquare={place} onCancel={ignore} />
      </VStack>
      <details>
        <summary>持ち駒を設定</summary>
        <section className="editor-fields editor-hand-settings">
          {COLORS.map(side => <fieldset key={side}><legend>{playerName(side)}</legend>
            {HAND_KINDS.map(piece => {
              const name = pieceLabel({ kind: piece, color: side, promoted: false });
              return <label key={piece}>{name}<input aria-label={`${playerName(side)}の持ち駒 ${name}`} type="number"
                min={0} max={18} value={position.hands[side][piece]}
                onChange={event => setHand(side, piece, Math.min(18, Math.max(0, Math.trunc(Number(event.target.value)) || 0)))} /></label>;
            })}
          </fieldset>)}
        </section>
      </details>
      {hasMoves && <p>開始局面を変更すると、記録済みの手順が削除されます。</p>}
      {error && <p role="alert">{error}</p>}
      <Button label={hasMoves ? '配置を確定して手順を消す' : '配置を確定'} variant="primary" onClick={apply} />
    </VStack>
  </Modal>;
}
