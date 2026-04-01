import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: resolve(__dirname), // the 'ui/' folder
  plugins: [react(), viteSingleFile()],
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
    alias: {
      '@assets': resolve(__dirname, './assets'),
      '@worknest/mobile': resolve(__dirname, './src'),
      '@worknest/core': resolve(__dirname, '../../packages/core/src'),
      '@worknest/crdt': resolve(__dirname, '../../packages/crdt/src'),
      '@worknest/client': resolve(__dirname, '../../packages/client/src'),
      '@worknest/ui': resolve(__dirname, '../../packages/ui/src'),
    },
  },
  build: {
    outDir: resolve(__dirname, 'assets/ui'),
    emptyOutDir: true,
    assetsInlineLimit: 100000000, // inline assets
    sourcemap: false,
  },
});
