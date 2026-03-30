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
const NODE_RUNTIME_PRUNE_RELATIVE_PATHS = [
  'CHANGELOG.md',
  'LICENSE',
  'README.md',
  'corepack',
  'corepack.cmd',
  'corepack.ps1',
  'install_tools.bat',
  'nodevars.bat',
  'npm',
  'npm.cmd',
  'npm.ps1',
  'npx',
  'npx.cmd',
  'npx.ps1',
  path.join('bin', 'corepack'),
  path.join('bin', 'npm'),
  path.join('bin', 'npx'),
  path.join('include'),
  path.join('lib', 'node_modules'),
  path.join('node_modules'),
  path.join('share', 'doc'),
  path.join('share', 'man'),
];
const PACKAGE_PRUNE_DIRECTORY_NAMES = new Set([
  '.github',
  '.vscode',
  '__tests__',
  'benchmark',
  'benchmarks',
  'coverage',
  'doc',
  'docs',
  'example',
  'examples',
  'test',
  'tests',
]);
const OPENCLAW_WORKSPACE_TEMPLATE_RELATIVE_PATH = 'node_modules/openclaw/docs/reference/templates';
const OPENCLAW_WORKSPACE_TEMPLATE_FILE_NAMES = [
  'AGENTS.md',
  'SOUL.md',
  'TOOLS.md',
  'IDENTITY.md',
  'USER.md',
  'HEARTBEAT.md',
  'BOOTSTRAP.md',
];
const PACKAGE_PRUNE_PROTECTED_DIRECTORY_PREFIXES = new Set([
  'node_modules/yaml/dist/doc',
  'node_modules/yaml/doc',
  OPENCLAW_WORKSPACE_TEMPLATE_RELATIVE_PATH,
]);
const PACKAGE_PRUNE_FILE_NAMES = new Set([
  'changelog',
  'changelog.md',
  'changelog.txt',
  'changes',
  'changes.md',
  'changes.txt',
  'contributing',
  'contributing.md',
  'contributing.txt',
  'history',
  'history.md',
  'history.txt',
  'readme',
  'readme.md',
  'readme.txt',
]);
const PACKAGE_PRUNE_FILE_SUFFIXES = ['.d.cts', '.d.mts', '.d.ts', '.map'];
const OPENCLAW_SKILLS_RELATIVE_PATH = 'node_modules/openclaw/skills';
const OPENCLAW_RUNTIME_REQUIRED_PACKAGE_RELATIVE_PATHS = [
  'package/node_modules/axios/package.json',
  'package/node_modules/yaml/dist/doc/directives.js',
  'package/node_modules/yaml/dist/doc/Document.js',
  ...OPENCLAW_WORKSPACE_TEMPLATE_FILE_NAMES.map((fileName) =>
    path.join('package', OPENCLAW_WORKSPACE_TEMPLATE_RELATIVE_PATH, fileName),
  ),
];

export const DEFAULT_OPENCLAW_VERSION = process.env.OPENCLAW_VERSION ?? '2026.3.28';
export const DEFAULT_NODE_VERSION = process.env.OPENCLAW_NODE_VERSION ?? '22.16.0';
export const DEFAULT_OPENCLAW_PACKAGE = process.env.OPENCLAW_PACKAGE_NAME ?? 'openclaw';
export const DEFAULT_RESOURCE_DIR = path.join(
  rootDir,
  'packages',
  'sdkwork-claw-desktop',
  'src-tauri',
  'resources',
  'openclaw-runtime',
);
export const DEFAULT_PREPARE_CACHE_DIR = resolveDefaultOpenClawPrepareCacheDir();

export function resolveBundledResourceMirrorRoot(
  workspaceRootDir = rootDir,
  resourceId = 'openclaw-runtime',
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

export function buildOpenClawPackageInstallArgs(installSpec) {
  return [
    'install',
    '--omit=dev',
    '--omit=peer',
    '--ignore-scripts',
    '--no-package-lock',
    installSpec,
  ];
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

  const expectedManifest = manifest ?? existingManifest;
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
      existingManifest,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  if (preparedOpenClawVersion !== expectedManifest.openclawVersion) {
    return {
      reusable: false,
      reason: 'openclaw-version-mismatch',
      manifestPath,
      existingManifest,
      preparedOpenClawVersion,
      expectedOpenClawVersion: expectedManifest.openclawVersion,
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
  await applyOpenClawRuntimeBootstrapHotfixes(path.join(resourceDir, 'runtime'));
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
  await applyOpenClawRuntimeBootstrapHotfixes(packageSourceDir);
  await copyDirectoryWithWindowsFallback(nodeSourceDir, path.join(resourceDir, 'runtime', 'node'));
  await copyDirectoryWithWindowsFallback(packageSourceDir, path.join(resourceDir, 'runtime', 'package'));
  await applyOpenClawRuntimeBootstrapHotfixes(path.join(resourceDir, 'runtime'));
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
  cacheDir = process.env.OPENCLAW_PREPARE_CACHE_DIR ?? DEFAULT_PREPARE_CACHE_DIR,
  openclawVersion = DEFAULT_OPENCLAW_VERSION,
  nodeVersion = DEFAULT_NODE_VERSION,
  openclawPackage = DEFAULT_OPENCLAW_PACKAGE,
  sourceRuntimeDir = process.env.OPENCLAW_BUNDLED_SOURCE_DIR,
  packageTarball = process.env.OPENCLAW_PACKAGE_TARBALL,
  forcePrepare = parseBooleanFlag(process.env.OPENCLAW_FORCE_PREPARE),
  skipBundledResourceMirror = parseBooleanFlag(process.env.OPENCLAW_SKIP_BUNDLED_MIRROR),
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
      await applyOpenClawRuntimeBootstrapHotfixes(path.join(resourceDir, 'runtime'));
      return await finalizePreparedOpenClawRuntime({
        manifest,
        resourceDir,
        skipBundledResourceMirror,
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
        skipBundledResourceMirror,
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
      skipBundledResourceMirror,
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

    await mkdir(packageDir, { recursive: true });
    await writeFile(
      path.join(packageDir, 'package.json'),
      `${JSON.stringify({ name: 'bundled-openclaw-runtime', private: true }, null, 2)}\n`,
      'utf8',
    );

    const installSpec = packageTarball || `${openclawPackage}@${openclawVersion}`;
    const bundledNpm = resolveBundledNpmCommand(extractedNodeDir, target.platformId);
    await runCommand(
      bundledNpm.command,
      [
        ...bundledNpm.args,
        ...buildOpenClawPackageInstallArgs(installSpec),
      ],
      { cwd: packageDir },
    );
    await prunePreparedOpenClawRuntimeArtifacts({
      nodeSourceDir: extractedNodeDir,
      packageSourceDir: packageDir,
    });
    await applyOpenClawRuntimeBootstrapHotfixes(packageDir);

    await copyDirectoryWithWindowsFallback(extractedNodeDir, path.join(resourceDir, 'runtime', 'node'));
    await copyDirectoryWithWindowsFallback(packageDir, path.join(resourceDir, 'runtime', 'package'));
    await applyOpenClawRuntimeBootstrapHotfixes(path.join(resourceDir, 'runtime'));
    await refreshCachedOpenClawRuntimeArtifacts({
      nodeSourceDir: extractedNodeDir,
      packageSourceDir: packageDir,
      cachePaths,
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
      skipBundledResourceMirror,
      strategy: 'prepared-download',
    });
  } finally {
    await removeDirectoryWithRetries(stagingRoot);
  }
}

async function finalizePreparedOpenClawRuntime(result) {
  if (
    shouldSyncBundledResourceMirror({ resourceDir: result.resourceDir }) &&
    !result.skipBundledResourceMirror
  ) {
    await ensureBundledResourceMirror({
      resourceDir: result.resourceDir,
      resourceId: 'openclaw-runtime',
    });
  }
  return result;
}

export async function applyOpenClawRuntimeBootstrapHotfixes(runtimeRootDir) {
  const gatewayCliPath = await findOpenClawRuntimeBundleFile(
    runtimeRootDir,
    (filePath, name) =>
      name.startsWith('gateway-cli-') &&
      name.endsWith('.js') &&
      toPosixPath(filePath).includes('/dist/'),
  );
  if (!gatewayCliPath) {
    throw new Error(
      `OpenClaw runtime hotfix bundle is missing the gateway CLI asset under ${runtimeRootDir}`,
    );
  }
  await replaceTextInFile(gatewayCliPath, [
    {
      pattern: /assistantAgentId:\s*identity\.agentId,\s*serverVersion:\s*resolveRuntimeServiceVersion\(process\.env\)/,
      to: 'assistantAgentId: identity.agentId,\n\t\t\tgatewayAuthToken: typeof config?.gateway?.auth?.token === "string" ? config.gateway.auth.token.trim() : null,\n\t\t\tserverVersion: resolveRuntimeServiceVersion(process.env)',
      description: 'gateway control-ui-config payload token injection',
    },
  ]);

  const controlUiIndexPath = await findOpenClawRuntimeBundleFile(
    runtimeRootDir,
    (filePath, name) =>
      name.startsWith('index-') &&
      name.endsWith('.js') &&
      toPosixPath(filePath).includes('/control-ui/assets/'),
  );
  if (!controlUiIndexPath) {
    throw new Error(
      `OpenClaw runtime hotfix bundle is missing the control-ui asset under ${runtimeRootDir}`,
    );
  }
  await replaceTextInFile(controlUiIndexPath, [
    {
      from: 'function Po(e){try{let t=Ao();return t?(t.removeItem(xo),(t.getItem(Mo(e))??``).trim()):``}catch{return``}}',
      to: 'function Po(e){let t=typeof globalThis<`u`&&typeof globalThis.__OPENCLAW_CONTROL_UI_BOOTSTRAP__===`object`&&typeof globalThis.__OPENCLAW_CONTROL_UI_BOOTSTRAP__.gatewayAuthToken===`string`?globalThis.__OPENCLAW_CONTROL_UI_BOOTSTRAP__.gatewayAuthToken.trim():``;if(t)try{let n=Ao();n&&(n.removeItem(xo),n.setItem(Mo(e),t))}catch{}return t||(()=>{try{let t=Ao();return t?(t.removeItem(xo),(t.getItem(Mo(e))??``).trim()):``}catch{return``}})()}',
      description: 'control-ui synchronous bootstrap token hydration',
    },
    {
      from: 'e.assistantName=i.name,e.assistantAvatar=i.avatar,e.assistantAgentId=i.agentId??null,e.serverVersion=r.serverVersion??null',
      to: 'e.assistantName=i.name,e.assistantAvatar=i.avatar,e.assistantAgentId=i.agentId??null,(()=>{let o=typeof r.gatewayAuthToken===`string`?r.gatewayAuthToken.trim():``;o&&o!==e.settings.token&&(e.settings.token=o,e.applySettings({...e.settings,token:o}))})(),e.serverVersion=r.serverVersion??null',
      description: 'control-ui async config token hydration',
    },
    {
      pattern:
        /token:(?:\(\(\)=>\{let t=(?:bo|Po)\(e\.settings\.gatewayUrl\);return t\|\|\(e\.settings\.token\.trim\(\)\?e\.settings\.token:void 0\)\}\)\(\)|e\.settings\.token\.trim\(\)\?e\.settings\.token:void 0),password:e\.password\.trim\(\)\?e\.password:void 0,clientName:`openclaw-control-ui`/,
      to: 'token:(()=>{let t=Po(e.settings.gatewayUrl);return t||(e.settings.token.trim()?e.settings.token:void 0)})(),password:e.password.trim()?e.password:void 0,clientName:`openclaw-control-ui`',
      description: 'control-ui connect token bootstrap preference',
    },
  ]);
}

async function findOpenClawRuntimeBundleFile(rootDir, predicate) {
  try {
    const entries = await readdir(rootDir, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = path.join(rootDir, entry.name);
      if (entry.isDirectory()) {
        const nested = await findOpenClawRuntimeBundleFile(entryPath, predicate);
        if (nested) {
          return nested;
        }
        continue;
      }

      if (entry.isFile() && predicate(entryPath, entry.name)) {
        return entryPath;
      }
    }
  } catch {
    return null;
  }

  return null;
}

async function replaceTextInFile(filePath, replacements) {
  const original = await readFile(filePath, 'utf8');
  let next = original;

  for (const replacement of replacements) {
    if (replacement.pattern instanceof RegExp) {
      if (!replacement.pattern.test(next)) {
        if (next.includes(replacement.to)) {
          continue;
        }
        throw new Error(
          `OpenClaw runtime hotfix pattern was not found in ${filePath}: ${replacement.description ?? replacement.pattern.toString()}`,
        );
      }
      next = next.replace(replacement.pattern, replacement.to);
      continue;
    }

    if (typeof replacement.from === 'string') {
      if (!next.includes(replacement.from)) {
        if (next.includes(replacement.to)) {
          continue;
        }
        throw new Error(
          `OpenClaw runtime hotfix pattern was not found in ${filePath}: ${replacement.description ?? replacement.from}`,
        );
      }
      next = next.replace(replacement.from, replacement.to);
    }
  }

  if (next !== original) {
    await writeFile(filePath, next, 'utf8');
  }
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
    ...OPENCLAW_RUNTIME_REQUIRED_PACKAGE_RELATIVE_PATHS.map((relativePath) =>
      path.join(sourceRuntimeDir, relativePath),
    ),
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
    ...OPENCLAW_RUNTIME_REQUIRED_PACKAGE_RELATIVE_PATHS.map((relativePath) =>
      path.join(packageSourceDir, relativePath.replace(/^package[\\/]/, '')),
    ),
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

export async function prunePreparedOpenClawRuntimeArtifacts({
  nodeSourceDir,
  packageSourceDir,
}) {
  if (nodeSourceDir) {
    await pruneBundledNodeRuntime(nodeSourceDir);
  }

  if (packageSourceDir) {
    await pruneBundledPackageRuntime(packageSourceDir);
  }
}

async function pruneBundledNodeRuntime(nodeSourceDir) {
  for (const relativePath of NODE_RUNTIME_PRUNE_RELATIVE_PATHS) {
    await removePathIfPresent(path.join(nodeSourceDir, relativePath));
  }
}

async function pruneBundledPackageRuntime(packageSourceDir) {
  await pruneBundledPackageRuntimeDirectory(packageSourceDir, packageSourceDir);
}

async function pruneBundledPackageRuntimeDirectory(currentDir, packageRootDir) {
  const entries = await readdir(currentDir, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(currentDir, entry.name);
    const relativePath = toPosixPath(path.relative(packageRootDir, entryPath));

    if (isProtectedOpenClawSkillsPath(relativePath)) {
      continue;
    }

    if (entry.isDirectory()) {
      if (shouldRemoveUnprotectedOpenClawDocsPath(relativePath)) {
        await removeDirectoryWithRetries(entryPath);
        continue;
      }

      if (
        PACKAGE_PRUNE_DIRECTORY_NAMES.has(entry.name.toLowerCase()) &&
        !pathIntersectsProtectedDirectoryPrefix(relativePath)
      ) {
        await removeDirectoryWithRetries(entryPath);
        continue;
      }

      await pruneBundledPackageRuntimeDirectory(entryPath, packageRootDir);
      continue;
    }

    if (entry.isFile() || entry.isSymbolicLink()) {
      if (shouldRemoveUnprotectedOpenClawDocsPath(relativePath)) {
        await rm(entryPath, { force: true });
        continue;
      }

      const lowerName = entry.name.toLowerCase();
      if (
        PACKAGE_PRUNE_FILE_NAMES.has(lowerName) ||
        PACKAGE_PRUNE_FILE_SUFFIXES.some((suffix) => lowerName.endsWith(suffix))
      ) {
        await rm(entryPath, { force: true });
      }
    }
  }
}

function isProtectedOpenClawSkillsPath(relativePath) {
  return (
    relativePath === OPENCLAW_SKILLS_RELATIVE_PATH ||
    relativePath.startsWith(`${OPENCLAW_SKILLS_RELATIVE_PATH}/`)
  );
}

function pathIntersectsProtectedDirectoryPrefix(relativePath) {
  for (const protectedPrefix of PACKAGE_PRUNE_PROTECTED_DIRECTORY_PREFIXES) {
    if (
      relativePath === protectedPrefix ||
      relativePath.startsWith(`${protectedPrefix}/`) ||
      protectedPrefix.startsWith(`${relativePath}/`)
    ) {
      return true;
    }
  }

  return false;
}

function shouldRemoveUnprotectedOpenClawDocsPath(relativePath) {
  if (
    relativePath !== 'node_modules/openclaw/docs' &&
    !relativePath.startsWith('node_modules/openclaw/docs/')
  ) {
    return false;
  }

  return !pathIntersectsProtectedDirectoryPrefix(relativePath);
}

function toPosixPath(value) {
  return value.replaceAll('\\', '/');
}

async function removePathIfPresent(targetPath) {
  try {
    await stat(targetPath);
  } catch {
    return;
  }

  await rm(targetPath, {
    force: true,
    recursive: true,
  });
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
    return {
      reusable: true,
      reason: 'ready',
      nodeExecutablePath,
      expectedNodeVersion: nodeVersion,
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
      windowsHide: true,
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
      windowsHide: true,
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
    windowsHide: true,
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
      windowsHide: true,
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
  const result = await prepareOpenClawRuntime({
    forcePrepare,
    cacheDir: process.env.OPENCLAW_PREPARE_CACHE_DIR,
    skipBundledResourceMirror: parseBooleanFlag(process.env.OPENCLAW_SKIP_BUNDLED_MIRROR),
  });
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
