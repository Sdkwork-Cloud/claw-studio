import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

function workspacePackageResolver() {
  return {
    name: 'workspace-package-resolver',
    resolveId(source: string) {
      const match = source.match(/^@sdkwork\/(claw-studio-[^/]+)$/);
      if (!match) {
        return null;
      }

      return path.resolve(__dirname, '../../packages', match[1], 'src/index.ts');
    },
  };
}

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [workspacePackageResolver(), react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
