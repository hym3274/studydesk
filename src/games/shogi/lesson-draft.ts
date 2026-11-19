import { initialPosition } from './engine/game';
import { isInCheck } from './engine/rules';
import { COLORS, HAND_KINDS, emptyHand, type Kind, type Move, type Position } from './engine/types';
import { replayPositions, type Lesson } from './lesson-data';
import { parseMove } from './persistence';

export const EDITOR_PATH = '/tools/01/lessons/editor';
export const DRAFT_KEY = 'desk.01.lesson-draft.v1';
export const MAX_MOVES = 500;
export const MAX_COMMENT = 1000;
export const MAX_TITLE = 80;
export const MAX_GENRE = 32;
export const MAX_FILE_BYTES = 2_000_000;
export const PIECE_KINDS: readonly Kind[] = ['K', ...HAND_KINDS];
const stock: Record<Kind, number> = { K: 2, R: 2, B: 2, G: 4, S: 4, N: 4, L: 4, P: 18 };

export interface LessonDraft {
  version: 1;
  title: string;
  genre: string;
  start: Position;
  moves: readonly Move[];
  comments: readonly string[];
  thumbnail: number;
}

export function createDraft(): LessonDraft {
  return { version: 1, title: '', genre: '', start: initialPosition(), moves: [], comments: [''], thumbnail: 0 };
}

export function toLesson(draft: LessonDraft): Lesson {
  return {
    title: draft.title.trim() || 'タイトル未入力', start: draft.start, introduction: draft.comments[0]!,
    steps: draft.moves.map((move, index) => ({ move, explanation: draft.comments[index + 1]! })),
  };
}

export function truncateDraft(draft: LessonDraft, index: number): LessonDraft {
  return { ...draft, moves: draft.moves.slice(0, index), comments: draft.comments.slice(0, index + 1),
    thumbnail: Math.min(index, draft.thumbnail) };
}

export function validateSetup(position: Position) {
  for (const color of COLORS) {
    if (position.board.filter(piece => piece?.kind === 'K' && piece.color === color).length > 1) {
      throw new Error('同じ側の玉は1枚までです');
    }
  }
  for (const kind of HAND_KINDS) {
    const total = position.hands.sente[kind] + position.hands.gote[kind] + position.board.filter(piece => piece?.kind === kind).length;
    if (total > stock[kind]) throw new Error('盤上と持ち駒を合わせた駒数が多すぎます');
  }
}

export function recordingIssue(position: Position): string {
  if (!COLORS.every(color => position.board.some(piece => piece?.kind === 'K' && piece.color === color))) {
    return '手を記録するには、先手と後手の玉を1枚ずつ置いてください。';
  }
  const waiting = position.turn === 'sente' ? 'gote' : 'sente';
  if (isInCheck(position, waiting)) return '手番ではない側の玉に王手がかかっています。配置か手番を変えてください。';
  return '';
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('ファイルの形式が正しくありません');
  return value as Record<string, unknown>;
}

function text(value: unknown, limit: number): string {
  if (typeof value !== 'string' || value.length > limit) throw new Error('文字数が上限を超えているか、テキストの形式が正しくありません');
  return value;
}

function parsePosition(value: unknown): Position {
  const raw = record(value);
  const turn = raw.turn;
  if ((turn !== 'sente' && turn !== 'gote') || !Array.isArray(raw.board) || raw.board.length !== 81) throw new Error('開始局面の形式が正しくありません');
  const board = raw.board.map(entry => {
    if (entry === null) return null;
    const { color, kind, promoted } = record(entry);
    if ((color !== 'sente' && color !== 'gote') || !PIECE_KINDS.includes(kind as Kind) || typeof promoted !== 'boolean'
      || (promoted && (kind === 'K' || kind === 'G'))) throw new Error('不正な駒が含まれています');
    return { color, kind: kind as Kind, promoted } as const;
  });
  const hands = { sente: emptyHand(), gote: emptyHand() };
  const rawHands = record(raw.hands);
  for (const color of COLORS) {
    const hand = record(rawHands[color]);
    for (const kind of HAND_KINDS) {
      const count = hand[kind];
      if (typeof count !== 'number' || !Number.isInteger(count) || count < 0 || count > stock[kind]) throw new Error('不正な持ち駒の枚数です');
      hands[color][kind] = count;
    }
  }
  const position: Position = { board, hands, turn };
  validateSetup(position);
  return position;
}

export function parseDraft(raw: string): LessonDraft {
  if (raw.length > MAX_FILE_BYTES) throw new Error('ファイルが大きすぎます');
  const data = record(JSON.parse(raw));
  if (data.version !== 1 || !Array.isArray(data.moves) || data.moves.length > MAX_MOVES
    || !Array.isArray(data.comments) || data.comments.length !== data.moves.length + 1
    || typeof data.thumbnail !== 'number' || !Number.isInteger(data.thumbnail) || data.thumbnail < 0 || data.thumbnail > data.moves.length) {
    throw new Error('このファイルは解説エディターで読み込めません');
  }
  const start = parsePosition(data.start);
  const moves = data.moves.map(parseMove);
  if (moves.length) {
    const issue = recordingIssue(start);
    if (issue) throw new Error(issue);
    replayPositions(start, moves);
  }
  return {
    version: 1, title: text(data.title, MAX_TITLE), genre: text(data.genre, MAX_GENRE), start, moves,
    comments: data.comments.map(comment => text(comment, MAX_COMMENT)), thumbnail: data.thumbnail,
  };
}
