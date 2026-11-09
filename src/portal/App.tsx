import { Suspense } from 'react';
import { Link, Route, Routes } from 'react-router-dom';
import { games } from './registry';
import { APP_NAME, toolPath } from '../config';
import { Card } from '@astryxdesign/core/Card';
import { Heading } from '@astryxdesign/core/Heading';
import { Text } from '@astryxdesign/core/Text';
import { VStack } from '@astryxdesign/core/VStack';
import { HStack } from '@astryxdesign/core/HStack';
import { ExperimentUI } from '../ui/ExperimentUI';

function Portal() {
  return <ExperimentUI><main className="experiment-portal">
    <header className="experiment-header"><Text weight="medium">{APP_NAME}</Text></header>
    <VStack gap={8}>
    <Heading level={1}>便利ツール一覧</Heading>
    <VStack className="experiment-catalog" gap={6}>{games.map(game => {
      const Thumbnail = game.thumbnail;
      return <Link key={game.id} to={toolPath(game.id)} className="experiment-tool-link"><Card className="experiment-tool" padding={0}>
      <VStack className="experiment-thumbnail">{typeof Thumbnail === 'string'
        ? <img src={Thumbnail} alt={game.thumbnailAlt} width="640" height="440" />
        : <Thumbnail label={game.thumbnailAlt} />}</VStack>
      <VStack padding={6} gap={3}>
        <Heading level={2}>{game.name}</Heading>
        <Text type="supporting">{game.description}</Text>
        <HStack gap={4}><Text type="supporting">{game.genre}</Text><Text type="supporting">{game.players}</Text></HStack>
      </VStack>
    </Card></Link>;
    })}</VStack></VStack>
  </main></ExperimentUI>;
}

export default function App() {
  return <Suspense fallback={<main className="loading" role="status">読み込み中</main>}>
    <Routes>
      <Route path="/" element={<Portal />} />
      {games.map(({ id, component: Game }) => <Route key={id} path={`${toolPath(id)}/*`} element={<Game />} />)}
      <Route path="*" element={<main className="not-found"><h1>ページが見つかりません</h1><Link to="/">一覧へ</Link></main>} />
    </Routes>
  </Suspense>;
}
