import fs from 'node:fs';
import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

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

function resolvePnpmPackageDistEntry(packageName: string, workspaceRootDir: string) {
  const pnpmRootDir = path.resolve(workspaceRootDir, 'node_modules/.pnpm');
  if (!fs.existsSync(pnpmRootDir)) {
    return null;
  }

  const packageDirPrefix = packageName.replace('/', '+');
  const matchedPackageDir = fs
    .readdirSync(pnpmRootDir)
    .filter((entry) => entry.startsWith(`${packageDirPrefix}@`))
    .sort()
    .at(-1);

  if (!matchedPackageDir) {
    return null;
  }

  const packageRootDir = path.resolve(
    pnpmRootDir,
    matchedPackageDir,
    'node_modules',
    ...packageName.split('/'),
  );
  const distEntry = path.resolve(packageRootDir, 'dist/index.js');

  return fs.existsSync(distEntry) ? distEntry : null;
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  // Allow pnpm workspace-linked SDK packages that live above apps/claw-studio.
  const monorepoRoot = path.resolve(__dirname, '../../../../..');
  const workspaceRootDir = path.resolve(__dirname, '../..');
  const sharedAppSdkEntry = path.resolve(
    __dirname,
    '../../../../spring-ai-plus-app-api/sdkwork-sdk-app/sdkwork-app-sdk-typescript/src/index.ts',
  );
  const sharedSdkCommonEntry = resolvePnpmPackageDistEntry(
    '@sdkwork/sdk-common',
    workspaceRootDir,
  );

  return {
    plugins: [workspacePackageResolver(), react(), tailwindcss()],
    define: {
      'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || ''),
      'import.meta.env.VITE_ACCESS_TOKEN': JSON.stringify(env.VITE_ACCESS_TOKEN || ''),
    },
    resolve: {
      alias: [
        { find: '@', replacement: path.resolve(__dirname, '.') },
        { find: '@sdkwork/app-sdk', replacement: sharedAppSdkEntry },
        ...(sharedSdkCommonEntry
          ? [{ find: '@sdkwork/sdk-common', replacement: sharedSdkCommonEntry }]
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
