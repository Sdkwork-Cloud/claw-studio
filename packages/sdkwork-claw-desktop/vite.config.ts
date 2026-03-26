import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import { resolveSharedSdkMode } from '../../scripts/shared-sdk-mode.mjs';

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
  const env = loadEnv(mode, '.', '');
  const sharedSdkMode = resolveSharedSdkMode(process.env);
  const useSharedSdkSourceMode = sharedSdkMode === 'source' || sharedSdkMode === 'git';
  // Allow pnpm workspace-linked SDK packages that live above apps/claw-studio.
  const monorepoRoot = path.resolve(__dirname, '../../../../..');
  const sharedAppSdkEntry = path.resolve(
    __dirname,
    '../../../../spring-ai-plus-app-api/sdkwork-sdk-app/sdkwork-app-sdk-typescript/src/index.ts',
  );
  const sharedSdkCommonEntry = path.resolve(
    __dirname,
    '../../../../sdk/sdkwork-sdk-commons/sdkwork-sdk-common-typescript/src/index.ts',
  );

  return {
    base: command === 'build' ? './' : '/',
    plugins: [workspacePackageResolver(), react(), tailwindcss()],
    define: {
      'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || ''),
      'import.meta.env.VITE_ACCESS_TOKEN': JSON.stringify(env.VITE_ACCESS_TOKEN || ''),
    },
    resolve: {
      alias: [
        { find: '@', replacement: path.resolve(__dirname, '.') },
        ...(useSharedSdkSourceMode
          ? [
              { find: '@sdkwork/app-sdk', replacement: sharedAppSdkEntry },
              { find: '@sdkwork/sdk-common', replacement: sharedSdkCommonEntry },
            ]
          : []),
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
