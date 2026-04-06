import fs from 'node:fs';
import path from 'node:path';

export const SHARED_SDK_MODE_ENV_VAR = 'SDKWORK_SHARED_SDK_MODE';

const VALID_SHARED_SDK_MODES = new Set(['source', 'git']);

export function resolveSharedSdkMode(env = process.env) {
  const rawMode = env?.[SHARED_SDK_MODE_ENV_VAR];
  if (typeof rawMode !== 'string' || rawMode.trim() === '') {
    return 'source';
  }

  const normalizedMode = rawMode.trim().toLowerCase();
  if (!VALID_SHARED_SDK_MODES.has(normalizedMode)) {
    throw new Error(
      `Unsupported ${SHARED_SDK_MODE_ENV_VAR} value "${rawMode}". Expected one of: source, git.`,
    );
  }

  return normalizedMode;
}

export function isSharedSdkSourceMode(env = process.env) {
  return resolveSharedSdkMode(env) === 'source';
}

export function resolvePnpmPackageDistEntry(packageName, workspaceRootDir) {
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
