import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { roomMiddleware } from './src/games/shogi/online/http';

export default defineConfig({
  // Relative URLs also work under arbitrary GitHub Pages repository paths.
  base: process.env.VITE_BASE_PATH || './',
  plugins: [react(), {
    name: 'local-rooms',
    apply: 'serve',
    configureServer(server) {
      const rooms = roomMiddleware((origin, req) => origin === `http://${req.headers.host}`);
      server.middlewares.use((req, res, next) => { void rooms(req, res, next); });
    },
  }],
  resolve: { alias: {
    // Astryx's default loader uses Google Fonts. Keep downloads and Pages
    // self-contained; ExperimentUI also overrides the theme family to Noto.
    '@astryxdesign/theme-neutral/fonts.css': fileURLToPath(new URL('./src/ui/local-fonts.css', import.meta.url)),
  } },
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        hashCharacters: 'hex',
        entryFileNames: 'assets/[hash].js',
        chunkFileNames: 'assets/[hash].js',
        assetFileNames: 'assets/[hash][extname]',
      },
    },
  },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
