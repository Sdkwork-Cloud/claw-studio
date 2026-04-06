import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function resolveFromWorkspace(specifier) {
  try {
    return require.resolve(specifier);
  } catch {
    return null;
  }
}

function findFirstExistingPath(candidatePaths) {
  for (const candidatePath of candidatePaths) {
    if (candidatePath && existsSync(candidatePath)) {
      return candidatePath;
    }
  }

  return null;
}

function resolveWorkspaceTsc() {
  const packageJsonPath = resolveFromWorkspace('typescript/package.json');
  const packageRoot = packageJsonPath
    ? path.dirname(packageJsonPath)
    : null;
  const resolvedPath = findFirstExistingPath([
    resolveFromWorkspace('typescript/lib/tsc.js'),
    resolveFromWorkspace('typescript/lib/_tsc.js'),
    packageRoot ? path.join(packageRoot, 'lib', 'tsc.js') : null,
    packageRoot ? path.join(packageRoot, 'lib', '_tsc.js') : null,
    packageRoot ? path.join(packageRoot, 'bin', 'tsc') : null,
    path.resolve(
      __dirname,
      '..',
      'node_modules',
      '.ignored',
      'typescript',
      'lib',
      'tsc.js',
    ),
    path.resolve(
      __dirname,
      '..',
      'node_modules',
      '.ignored',
      'typescript',
      'lib',
      '_tsc.js',
    ),
  ]);

  if (resolvedPath) {
    return resolvedPath;
  }

  throw new Error('Unable to resolve workspace TypeScript CLI.');
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
