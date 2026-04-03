import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import {
  isSharedSdkSourceMode,
  resolvePnpmPackageDistEntry,
} from '../../scripts/shared-sdk-mode.mjs';
import {
  CLAW_VITE_DEDUPE_PACKAGES,
  createClawManualChunks,
  resolveClawModulePreloadDependencies,
} from '../../scripts/viteBuildOptimization.ts';
import {
  remapWorktreeWorkspaceImport,
  resolveWorkspacePackageEntry,
} from './viteWorkspaceResolver.ts';

function workspacePackageResolver(packagesRootDir: string) {
  return {
    name: 'workspace-package-resolver',
    enforce: 'pre' as const,
    resolveId(source: string, importer?: string) {
      return (
        resolveWorkspacePackageEntry(source, packagesRootDir) ??
        remapWorktreeWorkspaceImport(source, importer, packagesRootDir)
      );
    },
  };
}

export default defineConfig(({ mode }) => {
  const useSharedSdkSourceMode = isSharedSdkSourceMode(process.env);
  // Allow pnpm workspace-linked SDK packages that live above apps/claw-studio.
  const workspaceRootDir = path.resolve(__dirname, '../..');
  const env = loadEnv(mode, workspaceRootDir, '');
  const monorepoRoot = path.resolve(__dirname, '../../../../..');
  const packagesRootDir = path.resolve(__dirname, '../../packages');
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
    envDir: workspaceRootDir,
    plugins: [workspacePackageResolver(packagesRootDir), react(), tailwindcss()],
    define: {
      'import.meta.env.VITE_ACCESS_TOKEN': JSON.stringify(env.VITE_ACCESS_TOKEN || ''),
    },
    resolve: {
      dedupe: [...CLAW_VITE_DEDUPE_PACKAGES],
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
          resolveClawModulePreloadDependencies(deps, context),
      },
      rollupOptions: {
        output: {
          manualChunks: createClawManualChunks(sharedAppSdkChunkEntry),
        },
      },
    },
  };
});
