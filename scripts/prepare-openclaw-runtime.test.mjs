import { readlinkSync, symlinkSync } from 'node:fs';
import { copyFile, cp, mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  buildOpenClawManifest,
  copyDirectoryWithWindowsFallback,
  DEFAULT_OPENCLAW_VERSION,
  DEFAULT_RESOURCE_DIR,
  inspectPreparedOpenClawRuntime,
  prepareOpenClawRuntime,
  prepareOpenClawRuntimeFromStagedDirs,
  prepareOpenClawRuntimeFromSource,
  removeDirectoryWithRetries,
  refreshCachedOpenClawRuntimeArtifacts,
  resolveNodeArchiveExtractionCommand,
  resolveBundledNpmCommand,
  resolveDefaultOpenClawPrepareCacheDir,
  resolveOpenClawPrepareCachePaths,
  resolveOpenClawTarget,
  resolveRequestedOpenClawTarget,
  shouldRetryDirectoryCleanup,
  shouldSyncBundledResourceMirror,
  shouldReusePreparedOpenClawRuntime,
} from './prepare-openclaw-runtime.mjs';

const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'prepare-openclaw-runtime-test-'));
const actualNodeVersion = process.version.replace(/^v/i, '');
const expectedOpenClawVersion = '2026.3.28';

try {
  if (DEFAULT_OPENCLAW_VERSION !== expectedOpenClawVersion) {
    throw new Error(
      `Expected DEFAULT_OPENCLAW_VERSION=${expectedOpenClawVersion}, received ${DEFAULT_OPENCLAW_VERSION}`,
    );
  }

  const bundledManifest = JSON.parse(
    await readFile(path.join(DEFAULT_RESOURCE_DIR, 'manifest.json'), 'utf8'),
  );
  if (bundledManifest.openclawVersion !== expectedOpenClawVersion) {
    throw new Error(
      `Expected bundled manifest openclawVersion=${expectedOpenClawVersion}, received ${bundledManifest.openclawVersion}`,
    );
  }

  const bundledRuntimePackage = JSON.parse(
    await readFile(path.join(DEFAULT_RESOURCE_DIR, 'runtime', 'package', 'package.json'), 'utf8'),
  );
  const bundledDependencyRange = bundledRuntimePackage.dependencies?.openclaw;
  if (bundledDependencyRange !== `^${expectedOpenClawVersion}`) {
    throw new Error(
      `Expected bundled runtime dependency ^${expectedOpenClawVersion}, received ${bundledDependencyRange}`,
    );
  }

  if (!shouldSyncBundledResourceMirror({ resourceDir: DEFAULT_RESOURCE_DIR })) {
    throw new Error('Expected the default bundled resource directory to keep syncing the Windows mirror');
  }

  if (shouldSyncBundledResourceMirror({ resourceDir: path.join(tempRoot, 'isolated-resource-runtime') })) {
    throw new Error('Expected temporary bundled resource directories to avoid mutating the shared Windows mirror');
  }

  const sourceRuntimeDir = path.join(tempRoot, 'source-runtime');
  const resourceDir = path.join(tempRoot, 'resource-runtime');
  const target = resolveOpenClawTarget('win32', 'x64');
  const manifest = buildOpenClawManifest({
    openclawVersion: expectedOpenClawVersion,
    nodeVersion: '22.16.0',
    target,
  });
  const nodePath = path.join(sourceRuntimeDir, manifest.nodeRelativePath.replace(/^runtime[\\/]/, ''));
  const cliPath = path.join(sourceRuntimeDir, manifest.cliRelativePath.replace(/^runtime[\\/]/, ''));
  const openclawPackageJsonPath = path.join(
    sourceRuntimeDir,
    'package',
    'node_modules',
    'openclaw',
    'package.json',
  );

  await mkdir(path.dirname(nodePath), { recursive: true });
  await mkdir(path.dirname(cliPath), { recursive: true });
  await mkdir(path.dirname(openclawPackageJsonPath), { recursive: true });
  await copyFile(process.execPath, nodePath);
  await writeFile(cliPath, 'console.log("openclaw");');
  await writeFile(
    openclawPackageJsonPath,
    `${JSON.stringify({ name: 'openclaw', version: expectedOpenClawVersion }, null, 2)}\n`,
  );

  const result = await prepareOpenClawRuntimeFromSource({
    sourceRuntimeDir,
    resourceDir,
    openclawVersion: expectedOpenClawVersion,
    nodeVersion: '22.16.0',
    target,
  });

  await stat(path.join(resourceDir, 'runtime'));
  await stat(path.join(resourceDir, 'manifest.json'));

  const copiedManifest = JSON.parse(await readFile(path.join(resourceDir, 'manifest.json'), 'utf8'));
  if (copiedManifest.runtimeId !== 'openclaw') {
    throw new Error(`Expected runtimeId=openclaw, received ${copiedManifest.runtimeId}`);
  }

  if (copiedManifest.openclawVersion !== expectedOpenClawVersion) {
    throw new Error(`Expected openclawVersion=${expectedOpenClawVersion}, received ${copiedManifest.openclawVersion}`);
  }

  if (result.manifest.cliRelativePath !== 'runtime/package/node_modules/openclaw/openclaw.mjs') {
    throw new Error(`Unexpected cliRelativePath ${result.manifest.cliRelativePath}`);
  }

  const windowsNpm = resolveBundledNpmCommand('C:\\runtime\\node', 'win32');
  if (!windowsNpm.command.toLowerCase().endsWith('cmd.exe')) {
    throw new Error(`Expected Windows command processor path, received ${windowsNpm.command}`);
  }
  if (
    windowsNpm.args.length < 4 ||
    windowsNpm.args[0] !== '/d' ||
    windowsNpm.args[1] !== '/s' ||
    windowsNpm.args[2] !== '/c' ||
    windowsNpm.args[3].toLowerCase() !== 'c:\\runtime\\node\\npm.cmd'
  ) {
    throw new Error(`Expected bundled Windows npm.cmd invocation, received ${windowsNpm.args.join(' ')}`);
  }

  const linuxNpm = resolveBundledNpmCommand('/runtime/node', 'linux');
  if (linuxNpm.command.replaceAll('\\', '/') !== '/runtime/node/bin/npm') {
    throw new Error(`Expected bundled Unix npm path, received ${linuxNpm.command}`);
  }
  if (linuxNpm.args.length !== 0) {
    throw new Error(`Expected no extra Unix npm arguments, received ${linuxNpm.args.join(' ')}`);
  }

  const requestedWindowsTarget = resolveRequestedOpenClawTarget({
    env: {
      SDKWORK_DESKTOP_TARGET: 'x86_64-pc-windows-msvc',
      SDKWORK_DESKTOP_TARGET_PLATFORM: 'windows',
      SDKWORK_DESKTOP_TARGET_ARCH: 'x64',
    },
  });
  if (requestedWindowsTarget.platformId !== 'windows' || requestedWindowsTarget.archId !== 'x64') {
    throw new Error(
      `Expected release env target resolution to return windows-x64, received ${requestedWindowsTarget.platformId}-${requestedWindowsTarget.archId}`,
    );
  }

  const windowsCacheDir = resolveDefaultOpenClawPrepareCacheDir({
    workspaceRootDir: 'C:\\workspaces\\claw-studio',
    platform: 'win32',
    localAppData: 'C:\\Users\\admin\\AppData\\Local',
    homeDir: 'C:\\Users\\admin',
  });
  if (windowsCacheDir.toLowerCase() !== 'c:\\.sdkwork-bc\\claw-studio\\openclaw-cache') {
    throw new Error(`Expected short Windows cache dir, received ${windowsCacheDir}`);
  }

  const stagedNodeDir = path.join(tempRoot, 'staged-node');
  const stagedPackageDir = path.join(tempRoot, 'staged-package');
  const stagedNodePath = path.join(stagedNodeDir, 'node.exe');
  const stagedCliPath = path.join(stagedPackageDir, 'node_modules', 'openclaw', 'openclaw.mjs');
  const stagedResourceDir = path.join(tempRoot, 'staged-resource-runtime');

  await mkdir(path.dirname(stagedNodePath), { recursive: true });
  await mkdir(path.dirname(stagedCliPath), { recursive: true });
  await writeFile(stagedNodePath, 'node');
  await writeFile(stagedCliPath, 'console.log(\"openclaw\");');

  await prepareOpenClawRuntimeFromStagedDirs({
    nodeSourceDir: stagedNodeDir,
    packageSourceDir: stagedPackageDir,
    resourceDir: stagedResourceDir,
    openclawVersion: expectedOpenClawVersion,
    nodeVersion: '22.16.0',
    target,
  });

  await stat(path.join(stagedResourceDir, 'runtime', 'node', 'node.exe'));
  await stat(path.join(stagedResourceDir, 'runtime', 'package', 'node_modules', 'openclaw', 'openclaw.mjs'));

  const reusableResourceDir = path.join(tempRoot, 'reusable-resource-runtime');
  await prepareOpenClawRuntimeFromSource({
    sourceRuntimeDir,
    resourceDir: reusableResourceDir,
    openclawVersion: expectedOpenClawVersion,
    nodeVersion: '22.16.0',
    target,
  });

  const inspection = await inspectPreparedOpenClawRuntime({
    resourceDir: reusableResourceDir,
    manifest,
  });
  if (!inspection.reusable) {
    throw new Error(`Expected prepared runtime inspection to be reusable, received ${inspection.reason}`);
  }

  if (shouldReusePreparedOpenClawRuntime({ inspection, forcePrepare: true })) {
    throw new Error('Expected forcePrepare=true to disable reuse of an otherwise valid prepared runtime');
  }

  const sentinelPath = path.join(reusableResourceDir, 'runtime', 'package', 'sentinel.txt');
  await writeFile(sentinelPath, 'keep');

  const reused = await prepareOpenClawRuntime({
    resourceDir: reusableResourceDir,
    openclawVersion: expectedOpenClawVersion,
    nodeVersion: '22.16.0',
    openclawPackage: 'openclaw',
    fetchImpl: async () => {
      throw new Error('prepareOpenClawRuntime should have reused the existing runtime instead of downloading Node');
    },
    target,
  });

  if (reused.strategy !== 'reused-existing') {
    throw new Error(`Expected an existing runtime reuse strategy, received ${reused.strategy}`);
  }

  const sentinelValue = await readFile(sentinelPath, 'utf8');
  if (sentinelValue !== 'keep') {
    throw new Error(`Expected runtime reuse to preserve existing files, received ${sentinelValue}`);
  }

  const repairableResourceDir = path.join(tempRoot, 'repairable-resource-runtime');
  await prepareOpenClawRuntimeFromSource({
    sourceRuntimeDir,
    resourceDir: repairableResourceDir,
    openclawVersion: expectedOpenClawVersion,
    nodeVersion: actualNodeVersion,
    target,
  });
  await rm(path.join(repairableResourceDir, 'manifest.json'));

  const repaired = await prepareOpenClawRuntime({
    resourceDir: repairableResourceDir,
    openclawVersion: expectedOpenClawVersion,
    nodeVersion: actualNodeVersion,
    openclawPackage: 'openclaw',
    fetchImpl: async () => {
      throw new Error('prepareOpenClawRuntime should have repaired the missing manifest instead of downloading Node');
    },
    target,
  });

  if (repaired.strategy !== 'repaired-existing-manifest') {
    throw new Error(`Expected a repaired-existing-manifest strategy, received ${repaired.strategy}`);
  }

  const repairedManifest = JSON.parse(
    await readFile(path.join(repairableResourceDir, 'manifest.json'), 'utf8'),
  );
  if (repairedManifest.openclawVersion !== expectedOpenClawVersion) {
    throw new Error(
      `Expected repaired manifest to restore openclawVersion=${expectedOpenClawVersion}, received ${repairedManifest.openclawVersion}`,
    );
  }

  const cacheDir = path.join(tempRoot, 'persistent-cache');
  const cachePaths = resolveOpenClawPrepareCachePaths({
    cacheDir,
    openclawVersion: expectedOpenClawVersion,
    nodeVersion: '22.16.0',
    target,
  });
  await mkdir(path.dirname(cachePaths.cachedArchivePath), { recursive: true });
  await writeFile(cachePaths.cachedArchivePath, 'cached-archive');
  await cp(path.join(sourceRuntimeDir, 'node'), cachePaths.nodeCacheDir, { recursive: true });
  await cp(path.join(sourceRuntimeDir, 'package'), cachePaths.packageCacheDir, { recursive: true });

  const cachePreparedResourceDir = path.join(tempRoot, 'cache-prepared-resource-runtime');
  const cached = await prepareOpenClawRuntime({
    resourceDir: cachePreparedResourceDir,
    cacheDir,
    openclawVersion: expectedOpenClawVersion,
    nodeVersion: '22.16.0',
    openclawPackage: 'openclaw',
    fetchImpl: async () => {
      throw new Error('prepareOpenClawRuntime should have reused cached artifacts instead of downloading Node');
    },
    target,
  });

  if (cached.strategy !== 'prepared-cache') {
    throw new Error(`Expected a prepared-cache strategy, received ${cached.strategy}`);
  }

  await stat(path.join(cachePreparedResourceDir, 'runtime', 'node', 'node.exe'));
  await stat(
    path.join(
      cachePreparedResourceDir,
      'runtime',
      'package',
      'node_modules',
      'openclaw',
      'openclaw.mjs',
    ),
  );

  const windowsExtractor = resolveNodeArchiveExtractionCommand({
    archivePath: 'C:\\temp\\node-v22.16.0-win-x64.zip',
    extractRoot: 'C:\\temp\\extract-root',
    target,
    hasTarCommand: true,
  });
  if (windowsExtractor.command.toLowerCase() !== 'tar') {
    throw new Error(`Expected Windows zip extraction to prefer tar, received ${windowsExtractor.command}`);
  }

  if (!shouldRetryDirectoryCleanup(Object.assign(new Error('directory not empty'), { code: 'ENOTEMPTY' }))) {
    throw new Error('Expected ENOTEMPTY cleanup failures to be retried');
  }

  if (shouldRetryDirectoryCleanup(Object.assign(new Error('missing'), { code: 'ENOENT' }))) {
    throw new Error('Expected ENOENT cleanup failures to skip retries');
  }

  let transientCleanupAttempts = 0;
  await removeDirectoryWithRetries(path.join(tempRoot, 'transient-cleanup'), {
    retryCount: 3,
    retryDelayMs: 0,
    logger: () => {},
    removeImpl: async () => {
      transientCleanupAttempts += 1;
      if (transientCleanupAttempts === 1) {
        throw Object.assign(new Error('directory not empty'), { code: 'ENOTEMPTY' });
      }
    },
  });

  if (transientCleanupAttempts !== 2) {
    throw new Error(`Expected transient cleanup to retry once, received ${transientCleanupAttempts} attempts`);
  }

  let fatalCleanupAttempts = 0;
  let fatalCleanupError;
  try {
    await removeDirectoryWithRetries(path.join(tempRoot, 'fatal-cleanup'), {
      retryCount: 3,
      retryDelayMs: 0,
      logger: () => {},
      removeImpl: async () => {
        fatalCleanupAttempts += 1;
        throw Object.assign(new Error('bad cleanup'), { code: 'EINVAL' });
      },
    });
    throw new Error('Expected invalid cleanup failures to surface without retries');
  } catch (error) {
    fatalCleanupError = error;
  }

  if (fatalCleanupAttempts !== 1) {
    throw new Error(`Expected fatal cleanup failures to avoid retries, received ${fatalCleanupAttempts} attempts`);
  }

  if (!(fatalCleanupError instanceof Error) || fatalCleanupError.message !== 'bad cleanup') {
    throw new Error(`Expected fatal cleanup error to be preserved, received ${String(fatalCleanupError)}`);
  }

  const aliasedNodeCacheDir = path.join(tempRoot, 'aliased-node-cache');
  const aliasedPackageSourceDir = path.join(tempRoot, 'aliased-package-source');
  const aliasedPackageCacheDir = path.join(tempRoot, 'aliased-package-cache');
  const aliasedNodeExecutable = path.join(aliasedNodeCacheDir, 'node.exe');
  const aliasedPackageJson = path.join(aliasedPackageSourceDir, 'package.json');

  await mkdir(path.dirname(aliasedNodeExecutable), { recursive: true });
  await mkdir(path.dirname(aliasedPackageJson), { recursive: true });
  await writeFile(aliasedNodeExecutable, 'node');
  await writeFile(aliasedPackageJson, '{"name":"openclaw-runtime-cache"}\n');

  await refreshCachedOpenClawRuntimeArtifacts({
    nodeSourceDir: aliasedNodeCacheDir,
    packageSourceDir: aliasedPackageSourceDir,
    cachePaths: {
      nodeCacheDir: aliasedNodeCacheDir,
      packageCacheDir: aliasedPackageCacheDir,
    },
  });

  await stat(aliasedNodeExecutable);
  await stat(path.join(aliasedPackageCacheDir, 'package.json'));

  let fallbackCopyAttempts = 0;
  await copyDirectoryWithWindowsFallback('C:\\temp\\source-package', 'C:\\temp\\target-package', {
    platform: 'win32',
    copyImpl: async () => {
      throw Object.assign(new Error('copy failed'), { code: 'ENOENT' });
    },
    robocopyImpl: async (sourceDir, targetDir) => {
      fallbackCopyAttempts += 1;
      if (sourceDir !== 'C:\\temp\\source-package' || targetDir !== 'C:\\temp\\target-package') {
        throw new Error(`Expected Windows fallback copy paths to be preserved, received ${sourceDir} -> ${targetDir}`);
      }
    },
  });

  if (fallbackCopyAttempts !== 1) {
    throw new Error(`Expected Windows fallback copy to run once, received ${fallbackCopyAttempts}`);
  }

  let nonWindowsCopyError;
  try {
    await copyDirectoryWithWindowsFallback('/tmp/source-package', '/tmp/target-package', {
      platform: 'linux',
      copyImpl: async () => {
        throw Object.assign(new Error('copy failed'), { code: 'ENOENT' });
      },
      robocopyImpl: async () => {
        throw new Error('Non-Windows copies should not invoke robocopy fallback');
      },
    });
    throw new Error('Expected non-Windows copy failures to surface without fallback');
  } catch (error) {
    nonWindowsCopyError = error;
  }

  if (!(nonWindowsCopyError instanceof Error) || nonWindowsCopyError.message !== 'copy failed') {
    throw new Error(`Expected non-Windows copy failure to be preserved, received ${String(nonWindowsCopyError)}`);
  }

  const symlinkSourceDir = path.join(tempRoot, 'symlink-source');
  const symlinkTargetDir = path.join(tempRoot, 'symlink-target');
  const symlinkShimTarget = path.join(
    symlinkSourceDir,
    'lib',
    'node_modules',
    'corepack',
    'dist',
    'corepack.js',
  );
  const symlinkShimPath = path.join(symlinkSourceDir, 'bin', 'corepack');

  await mkdir(path.dirname(symlinkShimTarget), { recursive: true });
  await mkdir(path.dirname(symlinkShimPath), { recursive: true });
  await writeFile(symlinkShimTarget, 'console.log("corepack");\n');
  symlinkSync('../lib/node_modules/corepack/dist/corepack.js', symlinkShimPath);

  await copyDirectoryWithWindowsFallback(symlinkSourceDir, symlinkTargetDir, {
    platform: 'linux',
  });

  const copiedSymlinkPath = path.join(symlinkTargetDir, 'bin', 'corepack');
  const copiedSymlinkTarget = readlinkSync(copiedSymlinkPath).replaceAll('\\', '/');
  if (copiedSymlinkTarget !== '../lib/node_modules/corepack/dist/corepack.js') {
    throw new Error(`Expected copied symlink to preserve its relative target, received ${copiedSymlinkTarget}`);
  }

  await stat(path.join(symlinkTargetDir, 'bin', copiedSymlinkTarget));

  console.log('ok - bundled OpenClaw runtime preparation copies runtime files and writes manifest');
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
