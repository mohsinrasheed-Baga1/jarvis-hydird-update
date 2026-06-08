import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  root: __dirname,
  plugins: [react()],
  base: './',
  cacheDir: path.resolve(__dirname, 'node_modules/.vite'),
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
