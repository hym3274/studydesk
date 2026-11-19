import { useMemo, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { HStack } from '@astryxdesign/core/HStack';
import { Text } from '@astryxdesign/core/Text';
import { VStack } from '@astryxdesign/core/VStack';
import { Modal } from '../../components/Modal';
import { Board } from './components/Board';
import { pieceLabel, playerName } from './engine/game';
import { COLORS, HAND_KINDS } from './engine/types';
import { replayLesson, type Lesson } from './lesson-data';

const noDestinations = new Set<number>();
const ignore = () => {};

export function LessonReplay({ lesson, onClose }: { lesson: Lesson; onClose: () => void }) {
  const frames = useMemo(() => replayLesson(lesson), [lesson]);
  const [index, setIndex] = useState(0);
  const end = frames.length - 1;
  const frame = frames[index]!;

  function step(direction: -1 | 1) {
    setIndex(current => Math.min(end, Math.max(0, current + direction)));
  }

  return <Modal title={lesson.title} onClose={onClose} className="lesson-replay">
    <VStack gap={4} onKeyDown={event => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      step(event.key === 'ArrowLeft' ? -1 : 1);
    }}>
      <VStack className="lesson-board">
        <Board position={frame.position} flipped={false} selected={null} destinations={noDestinations}
          lastMove={frame.last?.move} checkedKing={frame.checkedKing} onSquare={ignore} onCancel={ignore} readOnly />
      </VStack>
      <HStack gap={4} hAlign="center" vAlign="center">
        <Button label="←" aria-label="前の手" size="lg" isDisabled={index === 0} onClick={() => step(-1)} />
        <Text className="lesson-count">{index} / {end} 手</Text>
        <Button label="→" aria-label="次の手" size="lg" isDisabled={index === end} onClick={() => step(1)} />
      </HStack>
      <VStack className="lesson-comment" gap={2} role="status" aria-live="polite" aria-atomic="true">
        <Text weight="medium">{frame.last ? `${playerName(frame.last.mover)} ${frame.last.notation}` : '初期配置'}</Text>
        <Text as="p">{frame.explanation}</Text>
        {COLORS.map(color => {
          const pieces = HAND_KINDS.filter(kind => frame.position.hands[color][kind] > 0).map(kind =>
            `${pieceLabel({ kind, color, promoted: false })}${frame.position.hands[color][kind]}枚`);
          return pieces.length > 0 && <Text key={color} type="supporting">{playerName(color)}の持ち駒　{pieces.join('、')}</Text>;
        })}
      </VStack>
    </VStack>
  </Modal>;
}
