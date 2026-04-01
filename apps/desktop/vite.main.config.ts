/// <reference types="./forge.env.d.ts" />

import path from 'path';

import type { ConfigEnv, UserConfig } from 'vite';
import { defineConfig, mergeConfig } from 'vite';

import {
  external,
  getBuildConfig,
  getBuildDefine,
  pluginHotRestart,
} from './vite.base.config';

// https://vitejs.dev/config
export default defineConfig((env) => {
  const forgeEnv = env as ConfigEnv<'build'>;
  const { forgeConfigSelf } = forgeEnv;
  const define = getBuildDefine(forgeEnv);
  const config: UserConfig = {
    build: {
      lib: {
        entry: forgeConfigSelf.entry!,
        fileName: () => '[name].js',
        formats: ['cjs'],
      },
      rollupOptions: {
        external,
      },
    },
    plugins: [pluginHotRestart('restart')],
    define,
    resolve: {
      // Load the Node.js entry.
      mainFields: ['module', 'jsnext:main', 'jsnext'],
      alias: {
        '@worknest/desktop': path.resolve(__dirname, './src'),
        '@worknest/core': path.resolve(__dirname, '../../packages/core/src'),
        '@worknest/crdt': path.resolve(__dirname, '../../packages/crdt/src'),
        '@worknest/client': path.resolve(
          __dirname,
          '../../packages/client/src'
        ),
        '@worknest/ui': path.resolve(__dirname, '../../packages/ui/src'),
      },
    },
  };

  return mergeConfig(getBuildConfig(forgeEnv), config);
});
