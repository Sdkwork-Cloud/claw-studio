import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const workspaceRoot = process.cwd();
const sharedAppSdkRoot = path.resolve(
  workspaceRoot,
  '../../spring-ai-plus-app-api/sdkwork-sdk-app/sdkwork-app-sdk-typescript',
);
const sharedSdkCommonRoot = path.resolve(
  workspaceRoot,
  '../../sdk/sdkwork-sdk-commons/sdkwork-sdk-common-typescript',
);

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

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: workspaceRoot,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function ensureWorkspaceLinks() {
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
  run('pnpm', ['install']);
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

function ensurePackageBuilt(filterName, packageRoot) {
  if (!shouldBuildPackage(packageRoot)) {
    return;
  }

  console.log(`[prepare-shared-sdk-packages] Building ${filterName}.`);
  run('pnpm', ['--filter', filterName, 'build']);
}

ensureWorkspaceLinks();
ensurePackageBuilt('@sdkwork/sdk-common', sharedSdkCommonRoot);
ensurePackageBuilt('@sdkwork/app-sdk', sharedAppSdkRoot);

