import { build } from 'vite';

await build({
  configFile: false,
  publicDir: false,
  build: {
    ssr: 'src/games/shogi/online/server.ts',
    target: 'node22',
    outDir: 'dist-rooms',
  },
});
