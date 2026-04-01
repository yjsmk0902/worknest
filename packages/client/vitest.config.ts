import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: rootDir,
  resolve: {
    alias: {
      '@worknest/client': path.resolve(rootDir, 'src'),
      '@worknest/core': path.resolve(rootDir, '../core/src'),
      '@worknest/crdt': path.resolve(rootDir, '../crdt/src'),
    },
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
});
