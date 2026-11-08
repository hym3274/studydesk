import { readdir, readFile } from 'node:fs/promises';
import { resolve, relative } from 'node:path';

const output = resolve('dist');
const keywords = /game|shogi|chess|reversi|tetris|ゲーム|将棋/i;

async function filesIn(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(entry => entry.isDirectory()
    ? filesIn(resolve(directory, entry.name)) : resolve(directory, entry.name)));
  return nested.flat();
}

const html = await readFile(resolve(output, 'index.html'), 'utf8');
const title = html.match(/<title>(.*?)<\/title>/s)?.[1];
const description = html.match(/<meta\s+name="description"\s+content="([^"]*)"/i)?.[1];
if (!title || !description) throw new Error('Missing title or description');
for (const [label, text] of [['title', title], ['description', description]]) {
  if (keywords.test(text)) throw new Error(`Unexpected public ${label}: ${text}`);
}
const files = await filesIn(output);
for (const file of files) {
  const name = relative(output, file);
  if (keywords.test(name) || name.endsWith('.map')) throw new Error(`Unexpected public filename: ${name}`);
}
console.log(`Public title, description and ${files.length} filenames verified`);
