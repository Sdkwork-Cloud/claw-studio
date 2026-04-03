import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import {
  isSharedSdkSourceMode,
  resolvePnpmPackageDistEntry,
} from '../../scripts/shared-sdk-mode.mjs';
import {
  createDesktopManualChunks,
  DESKTOP_DEDUPE_PACKAGES,
  resolveDesktopModulePreloadDependencies,
} from './viteBuildOptimization.ts';

function workspacePackageResolver() {
  return {
    name: 'workspace-package-resolver',
    resolveId(source: string) {
      const match = source.match(/^@sdkwork\/(claw-[^/]+)$/);
      if (!match) {
        return null;
      }

      const dirName = `sdkwork-${match[1]}`;
      return path.resolve(__dirname, '../../packages', dirName, 'src/index.ts');
    },
  };
}

export default defineConfig(({ command, mode }) => {
  const useSharedSdkSourceMode = isSharedSdkSourceMode(process.env);
  // Allow pnpm workspace-linked SDK packages that live above apps/claw-studio.
  const workspaceRootDir = path.resolve(__dirname, '../..');
  const env = loadEnv(mode, workspaceRootDir, '');
  const monorepoRoot = path.resolve(__dirname, '../../../../..');
  const sharedAppSdkSourceEntry = path.resolve(
    __dirname,
    '../../../../spring-ai-plus-app-api/sdkwork-sdk-app/sdkwork-app-sdk-typescript/src/index.ts',
  );
  const sharedSdkCommonSourceEntry = path.resolve(
    __dirname,
    '../../../../sdk/sdkwork-sdk-commons/sdkwork-sdk-common-typescript/src/index.ts',
  );
  const sharedAppSdkDistEntry = resolvePnpmPackageDistEntry('@sdkwork/app-sdk', workspaceRootDir) ?? path.resolve(
    __dirname,
    '../../../../spring-ai-plus-app-api/sdkwork-sdk-app/sdkwork-app-sdk-typescript/dist/index.js',
  );
  const sharedSdkCommonDistEntry = resolvePnpmPackageDistEntry('@sdkwork/sdk-common', workspaceRootDir) ?? path.resolve(
    __dirname,
    '../../../../sdk/sdkwork-sdk-commons/sdkwork-sdk-common-typescript/dist/index.js',
  );
  const sharedAppSdkChunkEntry = useSharedSdkSourceMode
    ? sharedAppSdkSourceEntry
    : sharedAppSdkDistEntry;

  return {
    base: command === 'build' ? './' : '/',
    envDir: workspaceRootDir,
    plugins: [workspacePackageResolver(), react(), tailwindcss()],
    define: {
      'import.meta.env.VITE_ACCESS_TOKEN': JSON.stringify(env.VITE_ACCESS_TOKEN || ''),
    },
    resolve: {
      dedupe: [...DESKTOP_DEDUPE_PACKAGES],
      alias: [
        { find: '@', replacement: path.resolve(__dirname, '.') },
        ...(useSharedSdkSourceMode
          ? [
              { find: '@sdkwork/app-sdk', replacement: sharedAppSdkSourceEntry },
              { find: '@sdkwork/sdk-common', replacement: sharedSdkCommonSourceEntry },
            ]
          : [
              { find: '@sdkwork/app-sdk', replacement: sharedAppSdkDistEntry },
              { find: '@sdkwork/sdk-common', replacement: sharedSdkCommonDistEntry },
            ]),
      ],
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      fs: {
        allow: [monorepoRoot],
      },
    },
    build: {
      modulePreload: {
        resolveDependencies: (_filename, deps, context) =>
          resolveDesktopModulePreloadDependencies(deps, context),
      },
      rollupOptions: {
        output: {
          manualChunks: createDesktopManualChunks(sharedAppSdkChunkEntry),
        },
      },
    },
  };
});
