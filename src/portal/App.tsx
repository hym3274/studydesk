import { Suspense } from 'react';
import { Link, Route, Routes } from 'react-router-dom';
import { games } from './registry';
import { APP_NAME, toolPath } from '../config';

function Portal() {
  return <main className="portal">
    <header className="portal-header"><span className="wordmark">{APP_NAME}</span></header>
    <h1>便利ツール一覧</h1>
    <div className="game-grid">{games.map(game => {
      const Thumbnail = game.thumbnail;
      return <Link className="game-card" key={game.id} to={toolPath(game.id)}>
      <div className="game-thumbnail">{typeof Thumbnail === 'string'
        ? <img src={Thumbnail} alt={game.thumbnailAlt} width="640" height="440" />
        : <Thumbnail label={game.thumbnailAlt} />}</div>
      <div className="game-card-content"><h2>{game.name}<span aria-hidden="true">↗</span></h2>
        <p>{game.description}</p><div className="game-meta"><span>{game.genre}</span><span>{game.players}</span></div>
      </div>
    </Link>;
    })}</div>
  </main>;
}

export default function App() {
  return <Suspense fallback={<main className="loading" role="status">読み込み中</main>}>
    <Routes>
      <Route path="/" element={<Portal />} />
      {games.map(({ id, component: Game }) => <Route key={id} path={toolPath(id)} element={<Game />} />)}
      <Route path="*" element={<main className="not-found"><h1>ページが見つかりません</h1><Link to="/">一覧へ</Link></main>} />
    </Routes>
  </Suspense>;
}
