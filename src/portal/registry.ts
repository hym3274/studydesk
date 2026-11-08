import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import BoardThumbnail from '../games/shogi/components/BoardThumbnail';

export interface GameRegistration {
  id: string;
  name: string;
  description: string;
  genre: string;
  players: string;
  thumbnail: string | ComponentType<{ label: string }>;
  thumbnailAlt: string;
  component: LazyExoticComponent<ComponentType>;
}

export const games: readonly GameRegistration[] = [{
  id: '01', name: '将棋', description: '相手を追い詰めると勝ちのボードゲーム',
  genre: 'ボードゲーム', players: '2人', thumbnail: BoardThumbnail,
  thumbnailAlt: '先手陣の左下4×4マスを拡大した矢倉囲い',
  component: lazy(() => import('../games/shogi/ShogiGame')),
}];
