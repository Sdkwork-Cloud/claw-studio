import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import { resolveSharedSdkMode } from '../../scripts/shared-sdk-mode.mjs';
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

function normalizePath(filePath: string) {
  return filePath.replace(/\\/g, '/');
}

function createManualChunks(sharedAppSdkEntry: string) {
  const normalizedSharedAppSdkEntry = normalizePath(sharedAppSdkEntry);

  return function manualChunks(id: string) {
    const normalizedId = normalizePath(id);

    if (
      normalizedId.includes('/packages/sdkwork-claw-infrastructure/src/services/studioMockService.ts')
    ) {
      return 'claw-studio-mock';
    }

    if (
      normalizedId === normalizedSharedAppSdkEntry ||
      normalizedId.includes('/packages/sdkwork-claw-infrastructure/src/')
    ) {
      return 'claw-infrastructure';
    }

    if (
      // Keep the app vendor chunk stable for react-router-dom and @tanstack/react-query.
      /\/node_modules\/(?:react(?:-dom)?(?:\/|$)|scheduler(?:\/|$)|react-router-dom(?:\/|$)|react-router(?:\/|$)|@tanstack\/react-query(?:\/|$)|@tanstack\/query-core(?:\/|$)|i18next(?:\/|$)|react-i18next(?:\/|$)|sonner(?:\/|$)|motion(?:\/|$)|zustand(?:\/|$)|@radix-ui\/react-[^/]+(?:\/|$))/.test(
        normalizedId,
      )
    ) {
      return 'app-vendor';
    }

    if (/\/node_modules\/(?:@tiptap|prosemirror-|prosemirror\/|lowlight|highlight\.js)/.test(
      normalizedId,
    )) {
      return 'community-editor';
    }

    if (
      /\/node_modules\/(?:react-markdown|remark-gfm|remark-parse|remark-rehype|rehype-raw|unified|mdast-util-|micromark|hast-util-|parse5|property-information|space-separated-tokens|comma-separated-tokens|web-namespaces|react-syntax-highlighter|refractor|prismjs)/.test(
        normalizedId,
      )
    ) {
      return 'markdown-runtime';
    }

    return undefined;
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const sharedSdkMode = resolveSharedSdkMode(process.env);
  const useSharedSdkSourceMode = sharedSdkMode === 'source' || sharedSdkMode === 'git';
  // Allow pnpm workspace-linked SDK packages that live above apps/claw-studio.
  const monorepoRoot = path.resolve(__dirname, '../../../../..');
  const packagesRootDir = path.resolve(__dirname, '../../packages');
  const sharedAppSdkEntry = path.resolve(
    __dirname,
    '../../../../spring-ai-plus-app-api/sdkwork-sdk-app/sdkwork-app-sdk-typescript/src/index.ts',
  );
  const sharedSdkCommonEntry = path.resolve(
    __dirname,
    '../../../../sdk/sdkwork-sdk-commons/sdkwork-sdk-common-typescript/src/index.ts',
  );

  return {
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
    build: {
      modulePreload: {
        resolveDependencies: (_filename, deps, context) => {
          if (context.hostType !== 'html') {
            return deps;
          }

          return deps.filter((dependency) => (
            !dependency.includes('community-editor') &&
            !dependency.includes('markdown-runtime') &&
            !dependency.includes('claw-studio-mock')
          ));
        },
      },
      rollupOptions: {
        output: {
          manualChunks: createManualChunks(sharedAppSdkEntry),
        },
      },
    },
  };
});
