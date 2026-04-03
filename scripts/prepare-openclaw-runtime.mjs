import { spawn, spawnSync } from 'node:child_process';
import {
  cp,
  mkdtemp,
  mkdir,
  readdir,
  readFile,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { createWriteStream, existsSync, realpathSync, symlinkSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';

import { resolveDesktopReleaseTarget } from './release/desktop-targets.mjs';
import {
  DEFAULT_NODE_VERSION,
  DEFAULT_OPENCLAW_PACKAGE,
  DEFAULT_OPENCLAW_VERSION,
} from './openclaw-release.mjs';
export {
  DEFAULT_NODE_VERSION,
  DEFAULT_OPENCLAW_PACKAGE,
  DEFAULT_OPENCLAW_VERSION,
} from './openclaw-release.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const DEFAULT_DIRECTORY_CLEANUP_RETRY_COUNT = 3;
const DEFAULT_DIRECTORY_CLEANUP_RETRY_DELAY_MS = 500;
const PREPARED_RUNTIME_MANIFEST_KEYS = [
  'schemaVersion',
  'runtimeId',
  'openclawVersion',
  'nodeVersion',
  'platform',
  'arch',
  'nodeRelativePath',
  'cliRelativePath',
];
const PREPARED_RUNTIME_SIDECAR_MANIFEST_FILENAME = '.sdkwork-openclaw-runtime.json';

export const DEFAULT_RESOURCE_DIR = path.join(
  rootDir,
  'packages',
  'sdkwork-claw-desktop',
  'src-tauri',
  'resources',
  'openclaw',
);
export const DEFAULT_PREPARE_CACHE_DIR = resolveDefaultOpenClawPrepareCacheDir();

export function resolveBundledResourceMirrorRoot(
  workspaceRootDir = rootDir,
  resourceId = 'openclaw',
  platform = process.platform,
) {
  if (platform !== 'win32') {
    return path.join(
      workspaceRootDir,
      'packages',
      'sdkwork-claw-desktop',
      'src-tauri',
      'resources',
      resourceId,
    );
  }

  return path.win32.join(
    path.win32.parse(workspaceRootDir).root,
    '.sdkwork-bc',
    path.win32.basename(workspaceRootDir),
    resourceId,
  );
}

export function resolveOpenClawTarget(platform = process.platform, arch = process.arch) {
  const normalizedPlatform = String(platform ?? '').trim().toLowerCase();
  const platformId =
    normalizedPlatform === 'win32' || normalizedPlatform === 'windows'
      ? 'windows'
      : normalizedPlatform === 'darwin' || normalizedPlatform === 'macos'
        ? 'macos'
        : normalizedPlatform === 'linux'
          ? 'linux'
          : normalizedPlatform;
  const archId = arch === 'x64' ? 'x64' : arch === 'arm64' ? 'arm64' : arch;

  if (!['windows', 'macos', 'linux'].includes(platformId)) {
    throw new Error(`Unsupported platform for bundled OpenClaw runtime: ${platform}`);
  }

  if (!['x64', 'arm64'].includes(archId)) {
    throw new Error(`Unsupported architecture for bundled OpenClaw runtime: ${arch}`);
  }

  if (platformId === 'windows') {
    return {
      platformId,
      archId,
      nodeArchiveExt: 'zip',
      nodeArchiveName(version) {
        return `node-v${version}-win-${archId}.zip`;
      },
      nodeDownloadName(version) {
        return `node-v${version}-win-${archId}`;
      },
      bundledNodePath: 'runtime/node/node.exe',
      bundledCliPath: 'runtime/package/node_modules/openclaw/openclaw.mjs',
    };
  }

  return {
    platformId,
    archId,
    nodeArchiveExt: 'tar.xz',
    nodeArchiveName(version) {
      const platformSlug = platformId === 'macos' ? 'darwin' : 'linux';
      return `node-v${version}-${platformSlug}-${archId}.tar.xz`;
    },
    nodeDownloadName(version) {
      const platformSlug = platformId === 'macos' ? 'darwin' : 'linux';
      return `node-v${version}-${platformSlug}-${archId}`;
    },
    bundledNodePath: 'runtime/node/bin/node',
    bundledCliPath: 'runtime/package/node_modules/openclaw/openclaw.mjs',
  };
}

export function resolveRequestedOpenClawTarget({
  env = process.env,
} = {}) {
  const target = resolveDesktopReleaseTarget({ env });
  return resolveOpenClawTarget(target.platform, target.arch);
}

export function resolveBundledNpmCommand(nodeRuntimeDir, platform = process.platform) {
  const normalizedPlatform =
    platform === 'win32' || platform === 'windows'
      ? 'windows'
      : platform === 'darwin' || platform === 'macos'
        ? 'macos'
        : 'linux';

  if (normalizedPlatform === 'windows') {
    return {
      command: process.env.ComSpec || 'cmd.exe',
      args: ['/d', '/s', '/c', path.win32.join(nodeRuntimeDir, 'npm.cmd')],
    };
  }

  return {
    command: path.join(nodeRuntimeDir, 'bin', 'npm'),
    args: [],
  };
}

export function resolveDefaultOpenClawPrepareCacheDir({
  workspaceRootDir = rootDir,
  platform = process.platform,
  localAppData = process.env.LOCALAPPDATA,
  xdgCacheHome = process.env.XDG_CACHE_HOME,
  homeDir = os.homedir(),
} = {}) {
  if (platform === 'win32') {
    const workspaceName = sanitizePathSegment(path.win32.basename(workspaceRootDir)) || 'workspace';
    const driveRoot = path.win32.parse(workspaceRootDir).root || path.win32.parse(localAppData ?? '').root;

    if (driveRoot) {
      return path.win32.join(driveRoot, '.sdkwork-bc', workspaceName, 'openclaw-cache');
    }

    if (localAppData) {
      return path.join(localAppData, 'sdkwork-claw', 'openclaw-runtime-cache');
    }
  }

  if (platform === 'darwin') {
    return path.join(homeDir, 'Library', 'Caches', 'sdkwork-claw', 'openclaw-runtime-cache');
  }

  if (xdgCacheHome) {
    return path.join(xdgCacheHome, 'sdkwork-claw', 'openclaw-runtime-cache');
  }

  return path.join(homeDir, '.cache', 'sdkwork-claw', 'openclaw-runtime-cache');
}

export function resolveOpenClawPrepareCachePaths({
  cacheDir = DEFAULT_PREPARE_CACHE_DIR,
  openclawVersion,
  nodeVersion,
  target,
}) {
  const nodeCacheKey = `${target.platformId}-${target.archId}-node-v${nodeVersion}`;
  const packageCacheKey = `${target.platformId}-${target.archId}-openclaw-v${openclawVersion}`;

  return {
    cacheDir,
    cachedArchivePath: path.join(cacheDir, 'archives', target.nodeArchiveName(nodeVersion)),
    nodeCacheDir: path.join(cacheDir, 'node', nodeCacheKey),
    packageCacheDir: path.join(cacheDir, 'package', packageCacheKey),
  };
}

export function buildOpenClawManifest({
  openclawVersion,
  nodeVersion,
  target,
  nodeRelativePath = target.bundledNodePath,
  cliRelativePath = target.bundledCliPath,
}) {
  return {
    schemaVersion: 1,
    runtimeId: 'openclaw',
    openclawVersion,
    nodeVersion,
    platform: target.platformId,
    arch: target.archId,
    nodeRelativePath,
    cliRelativePath,
  };
}

export function preparedOpenClawManifestMatches(existingManifest, expectedManifest) {
  if (!existingManifest || typeof existingManifest !== 'object') {
    return false;
  }

  return PREPARED_RUNTIME_MANIFEST_KEYS.every(
    (key) => existingManifest[key] === expectedManifest[key],
  );
}

export async function inspectPreparedOpenClawRuntime({
  resourceDir = DEFAULT_RESOURCE_DIR,
  manifest,
} = {}) {
  const manifestPath = path.join(resourceDir, 'manifest.json');

  let existingManifest;
  try {
    existingManifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  } catch (error) {
    if (manifest) {
      const repairedInspection = await repairPreparedOpenClawRuntimeManifest({
        resourceDir,
        manifest,
      });
      if (repairedInspection.reusable) {
        return repairedInspection;
      }

      return {
        ...repairedInspection,
        manifestPath,
        manifestReadError: error instanceof Error ? error.message : String(error),
      };
    }

    return {
      reusable: false,
      reason: 'manifest-unreadable',
      manifestPath,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  if (manifest && !preparedOpenClawManifestMatches(existingManifest, manifest)) {
    return {
      reusable: false,
      reason: 'manifest-mismatch',
      manifestPath,
      existingManifest,
    };
  }

  try {
    await validatePreparedRuntimeSource(path.join(resourceDir, 'runtime'), manifest ?? existingManifest);
  } catch (error) {
    return {
      reusable: false,
      reason: 'runtime-invalid',
      manifestPath,
      existingManifest,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  return {
    reusable: true,
    reason: 'ready',
    manifestPath,
    manifest: existingManifest,
  };
}

export function shouldReusePreparedOpenClawRuntime({
  inspection,
  forcePrepare = false,
}) {
  return !forcePrepare && Boolean(inspection?.reusable);
}

function parseBooleanFlag(value) {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value !== 'string') {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return ['1', 'true', 'yes', 'on'].includes(normalized);
}

export async function prepareOpenClawRuntimeFromSource({
  sourceRuntimeDir,
  resourceDir = DEFAULT_RESOURCE_DIR,
  openclawVersion = DEFAULT_OPENCLAW_VERSION,
  nodeVersion = DEFAULT_NODE_VERSION,
  target = resolveOpenClawTarget(),
}) {
  const manifest = buildOpenClawManifest({ openclawVersion, nodeVersion, target });
  await validatePreparedRuntimeSource(sourceRuntimeDir, manifest);
  await removeDirectoryWithRetries(resourceDir);
  await mkdir(resourceDir, { recursive: true });
  await copyDirectoryWithWindowsFallback(sourceRuntimeDir, path.join(resourceDir, 'runtime'));
  await writePreparedRuntimeSidecarManifest({
    runtimeDir: path.join(resourceDir, 'runtime'),
    manifest,
  });
  await writeFile(
    path.join(resourceDir, 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8',
  );

  return {
    manifest,
    resourceDir,
  };
}

export async function prepareOpenClawRuntimeFromStagedDirs({
  nodeSourceDir,
  packageSourceDir,
  resourceDir = DEFAULT_RESOURCE_DIR,
  openclawVersion = DEFAULT_OPENCLAW_VERSION,
  nodeVersion = DEFAULT_NODE_VERSION,
  target = resolveOpenClawTarget(),
}) {
  const manifest = buildOpenClawManifest({ openclawVersion, nodeVersion, target });
  await validatePreparedRuntimeArtifacts({ nodeSourceDir, packageSourceDir, manifest });
  await removeDirectoryWithRetries(resourceDir);
  await mkdir(path.join(resourceDir, 'runtime'), { recursive: true });
  await copyDirectoryWithWindowsFallback(nodeSourceDir, path.join(resourceDir, 'runtime', 'node'));
  await copyDirectoryWithWindowsFallback(packageSourceDir, path.join(resourceDir, 'runtime', 'package'));
  await writePreparedRuntimeSidecarManifest({
    runtimeDir: path.join(resourceDir, 'runtime'),
    manifest,
  });
  await writeFile(
    path.join(resourceDir, 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8',
  );
  await validatePreparedRuntimeSource(path.join(resourceDir, 'runtime'), manifest);

  return {
    manifest,
    resourceDir,
  };
}

export async function prepareOpenClawRuntime({
  resourceDir = DEFAULT_RESOURCE_DIR,
  cacheDir = DEFAULT_PREPARE_CACHE_DIR,
  openclawVersion = DEFAULT_OPENCLAW_VERSION,
  nodeVersion = DEFAULT_NODE_VERSION,
  openclawPackage = DEFAULT_OPENCLAW_PACKAGE,
  sourceRuntimeDir = process.env.OPENCLAW_BUNDLED_SOURCE_DIR,
  packageTarball = process.env.OPENCLAW_PACKAGE_TARBALL,
  forcePrepare = parseBooleanFlag(process.env.OPENCLAW_FORCE_PREPARE),
  fetchImpl = globalThis.fetch,
  target = resolveRequestedOpenClawTarget(),
} = {}) {
  const manifest = buildOpenClawManifest({ openclawVersion, nodeVersion, target });
  const canReusePreparedRuntime = !sourceRuntimeDir && !packageTarball;
  const cachePaths = resolveOpenClawPrepareCachePaths({
    cacheDir,
    openclawVersion,
    nodeVersion,
    target,
  });

  if (canReusePreparedRuntime && !forcePrepare) {
    const inspection = await inspectPreparedOpenClawRuntime({
      resourceDir,
      manifest,
    });

    if (shouldReusePreparedOpenClawRuntime({ inspection, forcePrepare })) {
      return await finalizePreparedOpenClawRuntime({
        manifest,
        resourceDir,
        strategy: inspection.repairedManifest ? 'repaired-existing-manifest' : 'reused-existing',
      });
    }

    const cachedRuntime = await inspectCachedOpenClawRuntimeArtifacts({
      nodeSourceDir: cachePaths.nodeCacheDir,
      packageSourceDir: cachePaths.packageCacheDir,
      manifest,
    });

    if (cachedRuntime.reusable) {
      const result = await prepareOpenClawRuntimeFromStagedDirs({
        nodeSourceDir: cachePaths.nodeCacheDir,
        packageSourceDir: cachePaths.packageCacheDir,
        resourceDir,
        openclawVersion,
        nodeVersion,
        target,
      });

      return await finalizePreparedOpenClawRuntime({
        ...result,
        strategy: 'prepared-cache',
      });
    }
  }

  if (sourceRuntimeDir) {
    const result = await prepareOpenClawRuntimeFromSource({
      sourceRuntimeDir,
      resourceDir,
      openclawVersion,
      nodeVersion,
      target,
    });

    return await finalizePreparedOpenClawRuntime({
      ...result,
      strategy: 'prepared-source',
    });
  }

  if (typeof fetchImpl !== 'function') {
    throw new Error('Global fetch is not available and no OPENCLAW_BUNDLED_SOURCE_DIR was provided.');
  }

  const stagingRoot = await mkdtemp(path.join(os.tmpdir(), 'claw-openclaw-runtime-'));
  const packageDir = path.join(stagingRoot, 'runtime-package');

  try {
    const archivePath = await downloadNodeRuntime({
      stagingRoot,
      nodeVersion,
      target,
      fetchImpl,
      cachedArchivePath: cachePaths.cachedArchivePath,
    });
    const extractedNodeDir = await extractNodeRuntimeArchive({
      archivePath,
      stagingRoot,
      target,
      nodeVersion,
      cachedNodeDir: cachePaths.nodeCacheDir,
    });
    await removeDirectoryWithRetries(resourceDir);
    await mkdir(path.join(resourceDir, 'runtime'), { recursive: true });
    await copyDirectoryWithWindowsFallback(extractedNodeDir, path.join(resourceDir, 'runtime', 'node'));

    await mkdir(packageDir, { recursive: true });
    await writeFile(
      path.join(packageDir, 'package.json'),
      `${JSON.stringify({ name: 'bundled-openclaw-runtime', private: true }, null, 2)}\n`,
      'utf8',
    );

    const installSpec = packageTarball || `${openclawPackage}@${openclawVersion}`;
    const bundledNpm = resolveBundledNpmCommand(extractedNodeDir, target.platformId);
    await runCommand(bundledNpm.command, [
      ...bundledNpm.args,
      'install',
      '--omit=dev',
      '--no-package-lock',
      installSpec,
    ], { cwd: packageDir });

    await copyDirectoryWithWindowsFallback(packageDir, path.join(resourceDir, 'runtime', 'package'));
    await refreshCachedOpenClawRuntimeArtifacts({
      nodeSourceDir: extractedNodeDir,
      packageSourceDir: packageDir,
      cachePaths,
    });
    await writePreparedRuntimeSidecarManifest({
      runtimeDir: path.join(resourceDir, 'runtime'),
      manifest,
    });
    await writeFile(
      path.join(resourceDir, 'manifest.json'),
      `${JSON.stringify(manifest, null, 2)}\n`,
      'utf8',
    );
    await validatePreparedRuntimeSource(path.join(resourceDir, 'runtime'), manifest);

    return await finalizePreparedOpenClawRuntime({
      manifest,
      resourceDir,
      strategy: 'prepared-download',
    });
  } finally {
    await removeDirectoryWithRetries(stagingRoot);
  }
}

async function finalizePreparedOpenClawRuntime(result) {
  if (shouldSyncBundledResourceMirror({ resourceDir: result.resourceDir })) {
    await ensureBundledResourceMirror({
      resourceDir: result.resourceDir,
      resourceId: 'openclaw',
    });
  }
  return result;
}

export function shouldSyncBundledResourceMirror({
  resourceDir = DEFAULT_RESOURCE_DIR,
  defaultResourceDir = DEFAULT_RESOURCE_DIR,
} = {}) {
  return path.resolve(resourceDir) === path.resolve(defaultResourceDir);
}

export async function validatePreparedRuntimeSource(sourceRuntimeDir, manifest) {
  const checks = [
    path.join(sourceRuntimeDir, 'node'),
    path.join(sourceRuntimeDir, 'package'),
    path.join(sourceRuntimeDir, manifest.nodeRelativePath.replace(/^runtime[\\/]/, '')),
    path.join(sourceRuntimeDir, manifest.cliRelativePath.replace(/^runtime[\\/]/, '')),
  ];

  for (const absolutePath of checks) {
    try {
      await stat(absolutePath);
    } catch (error) {
      throw new Error(`Prepared OpenClaw runtime is missing ${absolutePath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

async function validatePreparedRuntimeArtifacts({ nodeSourceDir, packageSourceDir, manifest }) {
  const checks = [
    nodeSourceDir,
    packageSourceDir,
    path.join(nodeSourceDir, manifest.nodeRelativePath.replace(/^runtime[\\/]node[\\/]/, '')),
    path.join(packageSourceDir, manifest.cliRelativePath.replace(/^runtime[\\/]package[\\/]/, '')),
  ];

  for (const absolutePath of checks) {
    try {
      await stat(absolutePath);
    } catch (error) {
      throw new Error(`Prepared OpenClaw staged runtime is missing ${absolutePath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

async function inspectCachedOpenClawRuntimeArtifacts({
  nodeSourceDir,
  packageSourceDir,
  manifest,
}) {
  try {
    await validatePreparedRuntimeArtifacts({ nodeSourceDir, packageSourceDir, manifest });
    return {
      reusable: true,
      reason: 'ready',
    };
  } catch (error) {
    return {
      reusable: false,
      reason: 'invalid',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function resolvePreparedRuntimeSidecarManifestPath(runtimeDir) {
  return path.join(runtimeDir, PREPARED_RUNTIME_SIDECAR_MANIFEST_FILENAME);
}

async function writePreparedRuntimeSidecarManifest({
  runtimeDir,
  manifest,
}) {
  await writeFile(
    resolvePreparedRuntimeSidecarManifestPath(runtimeDir),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8',
  );
}

async function readPreparedRuntimeSidecarManifest(runtimeDir) {
  return JSON.parse(
    await readFile(resolvePreparedRuntimeSidecarManifestPath(runtimeDir), 'utf8'),
  );
}

async function inspectCachedNodeRuntimeDir({
  nodeSourceDir,
  target,
  nodeVersion,
}) {
  try {
    await stat(nodeSourceDir);
    const nodeExecutablePath = path.join(
      nodeSourceDir,
      target.bundledNodePath.replace(/^runtime[\\/]node[\\/]/, ''),
    );
    for (const dependencyPath of resolveBundledNodeInstallDependencyPaths(nodeSourceDir, target)) {
      await stat(dependencyPath);
    }
    const preparedNodeVersion = await readPreparedNodeVersion(nodeExecutablePath);
    return {
      reusable: preparedNodeVersion === nodeVersion,
      reason: preparedNodeVersion === nodeVersion ? 'ready' : 'node-version-mismatch',
      preparedNodeVersion,
    };
  } catch (error) {
    return {
      reusable: false,
      reason: 'invalid',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function downloadNodeRuntime({
  stagingRoot,
  nodeVersion,
  target,
  fetchImpl,
  cachedArchivePath,
}) {
  const archiveName = target.nodeArchiveName(nodeVersion);
  const url = `https://nodejs.org/dist/v${nodeVersion}/${archiveName}`;
  const archivePath = cachedArchivePath ?? path.join(stagingRoot, archiveName);

  if (existsSync(archivePath)) {
    return archivePath;
  }

  await mkdir(path.dirname(archivePath), { recursive: true });
  const tempArchivePath = `${archivePath}.downloading`;
  const response = await fetchImpl(url);

  if (!response.ok || !response.body) {
    throw new Error(`Failed to download Node runtime from ${url}: ${response.status} ${response.statusText}`);
  }

  await streamToFile(response.body, tempArchivePath);
  await rm(archivePath, { force: true });
  await cp(tempArchivePath, archivePath);
  await rm(tempArchivePath, { force: true });
  return archivePath;
}

export function resolveNodeArchiveExtractionCommand({
  archivePath,
  extractRoot,
  target,
  hasTarCommand = commandExistsSync('tar'),
}) {
  if (target.nodeArchiveExt === 'zip') {
    if (hasTarCommand) {
      return {
        command: 'tar',
        args: ['-xf', archivePath, '-C', extractRoot],
      };
    }

    return {
      command: 'powershell',
      args: [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        `Expand-Archive -LiteralPath '${archivePath.replace(/'/g, "''")}' -DestinationPath '${extractRoot.replace(/'/g, "''")}' -Force`,
      ],
    };
  }

  return {
    command: 'tar',
    args: ['-xJf', archivePath, '-C', extractRoot],
  };
}

async function extractNodeRuntimeArchive({ archivePath, stagingRoot, target, nodeVersion, cachedNodeDir }) {
  if (cachedNodeDir) {
    const cachedInspection = await inspectCachedNodeRuntimeDir({
      nodeSourceDir: cachedNodeDir,
      target,
      nodeVersion,
    });
    if (cachedInspection.reusable) {
      return cachedNodeDir;
    }
  }

  const extractRoot = path.join(stagingRoot, 'node-extract');
  await mkdir(extractRoot, { recursive: true });
  const extractor = resolveNodeArchiveExtractionCommand({
    archivePath,
    extractRoot,
    target,
  });
  await runCommand(extractor.command, extractor.args);

  const entries = await readdir(extractRoot, { withFileTypes: true });
  const firstDirectory = entries.find((entry) => entry.isDirectory());
  if (!firstDirectory) {
    throw new Error(`Unable to find extracted Node runtime directory inside ${extractRoot}`);
  }

  const extractedNodeDir = path.join(extractRoot, firstDirectory.name);

  if (cachedNodeDir) {
    await removeDirectoryWithRetries(cachedNodeDir);
    await mkdir(path.dirname(cachedNodeDir), { recursive: true });
    await copyDirectoryContents(extractedNodeDir, cachedNodeDir);
    return cachedNodeDir;
  }

  return extractedNodeDir;
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function shouldRetryDirectoryCleanup(error) {
  const errorCode = typeof error === 'object' && error !== null ? error.code : undefined;
  return errorCode === 'EPERM' || errorCode === 'EBUSY' || errorCode === 'ENOTEMPTY';
}

export async function removeDirectoryWithRetries(
  directoryPath,
  {
    removeImpl = rm,
    retryCount = DEFAULT_DIRECTORY_CLEANUP_RETRY_COUNT,
    retryDelayMs = DEFAULT_DIRECTORY_CLEANUP_RETRY_DELAY_MS,
    logger = console.warn,
  } = {},
) {
  let lastError;

  for (let attempt = 1; attempt <= retryCount; attempt += 1) {
    try {
      await removeImpl(directoryPath, { recursive: true, force: true });
      return;
    } catch (error) {
      lastError = error;
      const canRetry = attempt < retryCount && shouldRetryDirectoryCleanup(error);
      if (!canRetry) {
        throw error;
      }

      if (typeof logger === 'function') {
        logger(
          `[prepare-openclaw-runtime] Retrying cleanup of ${directoryPath} after transient Windows file lock (${attempt}/${retryCount - 1}).`,
        );
      }
      await sleep(retryDelayMs * attempt);
    }
  }

  throw lastError;
}

function shouldUseWindowsDirectoryCopyFallback(error, platform = process.platform) {
  const normalizedPlatform = platform === 'windows' ? 'win32' : platform;
  if (normalizedPlatform !== 'win32') {
    return false;
  }

  const errorCode = typeof error === 'object' && error !== null ? error.code : undefined;
  return errorCode === 'ENOENT' || errorCode === 'ENAMETOOLONG' || errorCode === 'EPERM';
}

export async function copyDirectoryWithWindowsFallback(
  sourceDir,
  targetDir,
  {
    copyImpl = cp,
    robocopyImpl = runRobocopyCopy,
    copyOptions = {
      recursive: true,
      // Preserve relative symlink targets from Unix Node runtimes so staged shims
      // like bin/corepack do not get rewritten to deleted temp directories.
      verbatimSymlinks: true,
    },
    platform = process.platform,
  } = {},
) {
  try {
    await copyImpl(sourceDir, targetDir, copyOptions);
  } catch (error) {
    if (!shouldUseWindowsDirectoryCopyFallback(error, platform)) {
      throw error;
    }

    console.warn(
      `[prepare-openclaw-runtime] Falling back to robocopy for ${sourceDir} -> ${targetDir} after fs.cp failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    await robocopyImpl(sourceDir, targetDir);
  }
}

async function runRobocopyCopy(sourceDir, targetDir) {
  await mkdir(path.dirname(targetDir), { recursive: true });
  await new Promise((resolve, reject) => {
    const child = spawn('robocopy', [
      sourceDir,
      targetDir,
      '/E',
      '/NFL',
      '/NDL',
      '/NJH',
      '/NJS',
      '/NP',
      '/R:2',
      '/W:1',
    ], {
      cwd: rootDir,
      stdio: 'inherit',
      env: process.env,
      shell: false,
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (typeof code === 'number' && code >= 0 && code <= 7) {
        resolve();
        return;
      }

      reject(new Error(`Command failed: robocopy ${sourceDir} ${targetDir} (exit ${code ?? 'unknown'})`));
    });
  });
}

async function streamToFile(body, destinationPath) {
  await pipeline(Readable.fromWeb(body), createWriteStream(destinationPath));
}

function resolveBundledNodeInstallDependencyPaths(nodeSourceDir, target) {
  if (target.platformId === 'windows') {
    return [
      path.join(nodeSourceDir, 'npm.cmd'),
      path.join(nodeSourceDir, 'node_modules', 'npm', 'bin', 'npm-cli.js'),
      path.join(nodeSourceDir, 'node_modules', 'npm', 'bin', 'npm-prefix.js'),
    ];
  }

  return [path.join(nodeSourceDir, 'bin', 'npm')];
}

async function repairPreparedOpenClawRuntimeManifest({
  resourceDir,
  manifest,
}) {
  const manifestPath = path.join(resourceDir, 'manifest.json');
  const runtimeDir = path.join(resourceDir, 'runtime');

  try {
    await validatePreparedRuntimeSource(runtimeDir, manifest);
  } catch (error) {
    return {
      reusable: false,
      reason: 'runtime-invalid',
      manifestPath,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  let preparedSidecarManifest;
  try {
    preparedSidecarManifest = await readPreparedRuntimeSidecarManifest(runtimeDir);
  } catch {
    preparedSidecarManifest = null;
  }

  if (preparedOpenClawManifestMatches(preparedSidecarManifest, manifest)) {
    await writeFile(
      manifestPath,
      `${JSON.stringify(manifest, null, 2)}\n`,
      'utf8',
    );

    return {
      reusable: true,
      repairedManifest: true,
      reason: 'repaired-manifest',
      manifestPath,
      manifest,
    };
  }

  if (preparedSidecarManifest && !preparedOpenClawManifestMatches(preparedSidecarManifest, manifest)) {
    return {
      reusable: false,
      reason: 'manifest-mismatch',
      manifestPath,
      existingManifest: preparedSidecarManifest,
    };
  }

  let preparedNodeVersion;
  try {
    preparedNodeVersion = await readPreparedNodeVersion(
      path.join(resourceDir, manifest.nodeRelativePath),
    );
  } catch (error) {
    return {
      reusable: false,
      reason: 'node-version-unreadable',
      manifestPath,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  if (preparedNodeVersion !== manifest.nodeVersion) {
    return {
      reusable: false,
      reason: 'node-version-mismatch',
      manifestPath,
      preparedNodeVersion,
      expectedNodeVersion: manifest.nodeVersion,
    };
  }

  let preparedOpenClawVersion;
  try {
    preparedOpenClawVersion = await readPreparedOpenClawPackageVersion(
      path.join(resourceDir, 'runtime', 'package', 'node_modules', 'openclaw', 'package.json'),
    );
  } catch (error) {
    return {
      reusable: false,
      reason: 'openclaw-version-unreadable',
      manifestPath,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  if (preparedOpenClawVersion !== manifest.openclawVersion) {
    return {
      reusable: false,
      reason: 'openclaw-version-mismatch',
      manifestPath,
      preparedOpenClawVersion,
      expectedOpenClawVersion: manifest.openclawVersion,
    };
  }

  await writeFile(
    manifestPath,
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8',
  );

  return {
    reusable: true,
    repairedManifest: true,
    reason: 'repaired-manifest',
    manifestPath,
    manifest,
  };
}

async function ensureBundledResourceMirror({
  resourceDir,
  resourceId,
  workspaceRootDir = rootDir,
  platform = process.platform,
}) {
  const mirrorRoot = resolveBundledResourceMirrorRoot(workspaceRootDir, resourceId, platform);
  if (path.resolve(mirrorRoot) === path.resolve(resourceDir)) {
    return mirrorRoot;
  }

  const existingResolvedPath = resolveExistingPathTarget(mirrorRoot);
  if (existingResolvedPath && path.resolve(existingResolvedPath) === path.resolve(resourceDir)) {
    return mirrorRoot;
  }

  await removeDirectoryWithRetries(mirrorRoot);
  await mkdir(path.dirname(mirrorRoot), { recursive: true });
  symlinkSync(resourceDir, mirrorRoot, platform === 'win32' ? 'junction' : 'dir');
  return mirrorRoot;
}

function resolveExistingPathTarget(candidatePath) {
  try {
    return realpathSync.native(candidatePath);
  } catch {
    return null;
  }
}

function sanitizePathSegment(value) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '');
}

export async function refreshCachedOpenClawRuntimeArtifacts({
  nodeSourceDir,
  packageSourceDir,
  cachePaths,
}) {
  const refreshNodeCache = path.resolve(nodeSourceDir) !== path.resolve(cachePaths.nodeCacheDir);
  const refreshPackageCache = path.resolve(packageSourceDir) !== path.resolve(cachePaths.packageCacheDir);

  if (refreshNodeCache) {
    await removeDirectoryWithRetries(cachePaths.nodeCacheDir);
    await mkdir(path.dirname(cachePaths.nodeCacheDir), { recursive: true });
    await copyDirectoryContents(nodeSourceDir, cachePaths.nodeCacheDir);
  }

  if (refreshPackageCache) {
    await removeDirectoryWithRetries(cachePaths.packageCacheDir);
    await mkdir(path.dirname(cachePaths.packageCacheDir), { recursive: true });
    await copyDirectoryContents(packageSourceDir, cachePaths.packageCacheDir);
  }
}

async function copyDirectoryContents(sourceDir, destinationDir) {
  await mkdir(destinationDir, { recursive: true });
  const entries = await readdir(sourceDir, { withFileTypes: true });

  for (const entry of entries) {
    await copyDirectoryWithWindowsFallback(
      path.join(sourceDir, entry.name),
      path.join(destinationDir, entry.name),
    );
  }
}

async function readPreparedNodeVersion(nodeExecutablePath) {
  const { stdout } = await runCommandCapture(nodeExecutablePath, ['--version']);
  return stdout.trim().replace(/^v/i, '');
}

async function readPreparedOpenClawPackageVersion(packageJsonPath) {
  const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'));
  if (!packageJson || typeof packageJson.version !== 'string' || packageJson.version.trim().length === 0) {
    throw new Error(`Prepared OpenClaw package.json is missing a version: ${packageJsonPath}`);
  }

  return packageJson.version.trim();
}

async function runCommand(command, args, options = {}) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? rootDir,
      stdio: 'inherit',
      env: process.env,
      shell: false,
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`Command failed: ${command} ${args.join(' ')} (exit ${code ?? 'unknown'})`));
    });
  });
}

function commandExistsSync(command) {
  const result = spawnSync(command, ['--version'], {
    stdio: 'ignore',
    env: process.env,
    shell: false,
  });

  return !result.error && (result.status === 0 || result.status === 1);
}

async function runCommandCapture(command, args, options = {}) {
  return await new Promise((resolve, reject) => {
    const stdoutChunks = [];
    const stderrChunks = [];
    const child = spawn(command, args, {
      cwd: options.cwd ?? rootDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
      shell: false,
    });

    child.stdout?.on('data', (chunk) => {
      stdoutChunks.push(chunk);
    });
    child.stderr?.on('data', (chunk) => {
      stderrChunks.push(chunk);
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve({
          stdout: Buffer.concat(stdoutChunks).toString('utf8'),
          stderr: Buffer.concat(stderrChunks).toString('utf8'),
        });
        return;
      }

      reject(
        new Error(
          `Command failed: ${command} ${args.join(' ')} (exit ${code ?? 'unknown'})\n${Buffer.concat(stderrChunks).toString('utf8')}`,
        ),
      );
    });
  });
}

async function main() {
  const forcePrepare = process.argv.includes('--force');
  const result = await prepareOpenClawRuntime({ forcePrepare });
  const action = result.strategy === 'reused-existing' ? 'Reused' : 'Prepared';
  console.log(
    `${action} bundled OpenClaw runtime ${result.manifest.openclawVersion} for ${result.manifest.platform}-${result.manifest.arch} at ${result.resourceDir} (${result.strategy})`,
  );
}

if (path.resolve(process.argv[1] ?? '') === __filename) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
