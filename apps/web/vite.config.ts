import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@worknest/shared': path.resolve(__dirname, '../../packages/shared/src'),
      '@worknest/ui': path.resolve(__dirname, '../../packages/ui/src'),
      '@worknest/editor': path.resolve(__dirname, '../../packages/editor/src'),
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
});
