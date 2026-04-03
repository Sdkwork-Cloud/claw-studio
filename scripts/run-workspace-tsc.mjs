import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import process from 'node:process';
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

export function createWorkspaceTscPlan({
  argv = process.argv.slice(2),
  cwd = process.cwd(),
  execPath = process.execPath,
} = {}) {
  const tscPath = resolveWorkspaceTsc();

  return {
    command: execPath,
    args: [tscPath, ...(Array.isArray(argv) ? argv : [])],
    cwd,
  };
}

export function runWorkspaceTsc({
  argv = process.argv.slice(2),
  cwd = process.cwd(),
  execPath = process.execPath,
  spawnSyncImpl = spawnSync,
} = {}) {
  const plan = createWorkspaceTscPlan({ argv, cwd, execPath });
  const result = spawnSyncImpl(plan.command, plan.args, {
    stdio: 'inherit',
    cwd: plan.cwd,
  });

  if (result.error) {
    throw new Error(`Failed to execute workspace TypeScript CLI: ${result.error.message}`);
  }

  if (result.signal) {
    throw new Error(`Workspace TypeScript CLI exited with signal ${result.signal}`);
  }

  if (typeof result.status === 'number') {
    return result.status;
  }

  return 1;
}

function main() {
  process.exit(runWorkspaceTsc());
}

if (path.resolve(process.argv[1] ?? '') === __filename) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
