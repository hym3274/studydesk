import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Relative URLs also work under arbitrary GitHub Pages repository paths.
  base: process.env.VITE_BASE_PATH || './',
  plugins: [react()],
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
