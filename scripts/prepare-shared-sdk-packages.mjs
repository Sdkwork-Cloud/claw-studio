import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { ensureSharedSdkGitSources } from './prepare-shared-sdk-git-sources.mjs';
import { resolveSharedSdkMode } from './shared-sdk-mode.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const scriptWorkspaceRoot = path.resolve(__dirname, '..');

export function resolveWorkspaceRootDir(currentWorkingDir = process.cwd()) {
  let candidateDir = path.resolve(currentWorkingDir);

  while (true) {
    const packageJsonPath = path.join(candidateDir, 'package.json');
    const workspaceManifestPath = path.join(candidateDir, 'pnpm-workspace.yaml');

    if (fs.existsSync(packageJsonPath) && fs.existsSync(workspaceManifestPath)) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        if (packageJson?.name === '@sdkwork/claw-workspace') {
          return candidateDir;
        }
      } catch {
        // Ignore parse failures and continue walking upward.
      }
    }

    const parentDir = path.dirname(candidateDir);
    if (parentDir === candidateDir) {
      break;
    }

    candidateDir = parentDir;
  }

  return scriptWorkspaceRoot;
}

export function createSharedSdkPackageContext({
  currentWorkingDir = process.cwd(),
  env = process.env,
} = {}) {
  const workspaceRoot = resolveWorkspaceRootDir(currentWorkingDir);

  return {
    workspaceRoot,
    sharedAppSdkRoot: path.resolve(
      workspaceRoot,
      '../../spring-ai-plus-app-api/sdkwork-sdk-app/sdkwork-app-sdk-typescript',
    ),
    sharedSdkCommonRoot: path.resolve(
      workspaceRoot,
      '../../sdk/sdkwork-sdk-commons/sdkwork-sdk-common-typescript',
    ),
    mode: resolveSharedSdkMode(env),
  };
}

function exists(targetPath) {
  return fs.existsSync(targetPath);
}

function statMtimeMs(targetPath) {
  return exists(targetPath) ? fs.statSync(targetPath).mtimeMs : 0;
}

function latestMtimeMs(targetPath) {
  if (!exists(targetPath)) {
    return 0;
  }

  const stat = fs.statSync(targetPath);
  if (!stat.isDirectory()) {
    return stat.mtimeMs;
  }

  return fs.readdirSync(targetPath).reduce((latest, entry) => {
    return Math.max(latest, latestMtimeMs(path.join(targetPath, entry)));
  }, stat.mtimeMs);
}

function run(command, args, workspaceRoot) {
  const result = spawnSync(command, args, {
    cwd: workspaceRoot,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function assertPackageRootExists(packageRoot, packageName) {
  if (exists(packageRoot)) {
    return;
  }

  throw new Error(
    `[prepare-shared-sdk-packages] Missing ${packageName} source at ${packageRoot}. ` +
      'Clone the sibling SDK workspace locally or set SDKWORK_SHARED_SDK_MODE=git to materialize it from the remote trunk.',
  );
}

function ensureWorkspaceLinks(workspaceRoot, sharedAppSdkRoot) {
  const appSdkCommonLink = path.join(
    sharedAppSdkRoot,
    'node_modules',
    '@sdkwork',
    'sdk-common',
  );

  if (exists(appSdkCommonLink)) {
    return;
  }

  console.log('[prepare-shared-sdk-packages] Refreshing pnpm workspace links.');
  run('pnpm', ['install'], workspaceRoot);
}

function shouldBuildPackage(packageRoot) {
  const distEntry = path.join(packageRoot, 'dist', 'index.js');
  if (!exists(distEntry)) {
    return true;
  }

  const sourceMtimeMs = Math.max(
    latestMtimeMs(path.join(packageRoot, 'src')),
    statMtimeMs(path.join(packageRoot, 'package.json')),
    statMtimeMs(path.join(packageRoot, 'tsconfig.json')),
    statMtimeMs(path.join(packageRoot, 'vite.config.ts')),
  );

  return sourceMtimeMs > statMtimeMs(distEntry);
}

function ensurePackageBuilt(filterName, packageRoot, workspaceRoot) {
  if (!shouldBuildPackage(packageRoot)) {
    return;
  }

  console.log(`[prepare-shared-sdk-packages] Building ${filterName}.`);
  run('pnpm', ['--filter', filterName, 'build'], workspaceRoot);
}

export function prepareSharedSdkPackages({
  currentWorkingDir = process.cwd(),
  env = process.env,
  syncExistingRepos = false,
} = {}) {
  const context = createSharedSdkPackageContext({
    currentWorkingDir,
    env,
  });

  if (context.mode === 'git') {
    console.log('[prepare-shared-sdk-packages] Ensuring git-backed shared SDK sources are available.');
    ensureSharedSdkGitSources({
      workspaceRootDir: context.workspaceRoot,
      env,
      syncExistingRepos,
    });
  }

  assertPackageRootExists(context.sharedSdkCommonRoot, '@sdkwork/sdk-common');
  assertPackageRootExists(context.sharedAppSdkRoot, '@sdkwork/app-sdk');
  ensureWorkspaceLinks(context.workspaceRoot, context.sharedAppSdkRoot);
  ensurePackageBuilt('@sdkwork/sdk-common', context.sharedSdkCommonRoot, context.workspaceRoot);
  ensurePackageBuilt('@sdkwork/app-sdk', context.sharedAppSdkRoot, context.workspaceRoot);

  return context;
}

function main() {
  prepareSharedSdkPackages();
}

if (path.resolve(process.argv[1] ?? '') === __filename) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
