import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function resolveWorkspaceTsc() {
  try {
    return require.resolve('typescript/lib/tsc.js');
  } catch {
    const ignoredPath = path.resolve(
      __dirname,
      '..',
      'node_modules',
      '.ignored',
      'typescript',
      'lib',
      'tsc.js',
    );

    if (existsSync(ignoredPath)) {
      return ignoredPath;
    }

    throw new Error('Unable to resolve workspace TypeScript CLI.');
  }
}

const tscPath = resolveWorkspaceTsc();

const result = spawnSync(process.execPath, [tscPath, ...process.argv.slice(2)], {
  stdio: 'inherit',
  cwd: process.cwd(),
});

if (typeof result.status === 'number') {
  process.exit(result.status);
}

process.exit(1);
