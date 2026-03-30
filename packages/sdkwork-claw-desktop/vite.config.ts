import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import {
  isSharedSdkSourceMode,
  resolvePnpmPackageDistEntry,
} from '../../scripts/shared-sdk-mode.mjs';
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

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, __dirname, '');
  const useSharedSdkSourceMode = isSharedSdkSourceMode(process.env);
  // Allow pnpm workspace-linked SDK packages that live above apps/claw-studio.
  const workspaceRootDir = path.resolve(__dirname, '../..');
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

  return {
    base: command === 'build' ? './' : '/',
    plugins: [workspacePackageResolver(packagesRootDir), react(), tailwindcss()],
    define: {
      'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || ''),
      'import.meta.env.VITE_ACCESS_TOKEN': JSON.stringify(env.VITE_ACCESS_TOKEN || ''),
    },
    resolve: {
      dedupe: [
        'react',
        'react-dom',
        '@sdkwork/claw-infrastructure',
        '@sdkwork/claw-i18n',
        '@sdkwork/sdk-common',
      ],
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
  };
});
