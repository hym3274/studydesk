import type { ReactNode } from 'react';
import { Card } from '@astryxdesign/core/Card';
import { Text } from '@astryxdesign/core/Text';
import { VStack } from '@astryxdesign/core/VStack';

export function LessonTile({ title, genre, thumbnail, onOpen }: {
  title: string; genre: string; thumbnail: ReactNode; onOpen: () => void;
}) {
  return <Card className="lesson-tile" padding={4}>
    <VStack gap={2}>
      <Text type="supporting">{genre ? `解説　${genre}` : '解説'}</Text>
      {thumbnail}
      <button type="button" className="lesson-tile-trigger" aria-haspopup="dialog" onClick={onOpen}>{title}</button>
    </VStack>
  </Card>;
}
