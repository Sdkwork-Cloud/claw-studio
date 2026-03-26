import { spawn } from 'node:child_process';
import { cp, mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { existsSync, realpathSync, symlinkSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { resolveDesktopReleaseTarget } from './release/desktop-targets.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const DEFAULT_WORKSPACE_INSTALL_RETRY_COUNT = 3;
const DEFAULT_WORKSPACE_INSTALL_RETRY_DELAY_MS = 500;
const PREPARED_RUNTIME_MANIFEST_KEYS = [
  'schemaVersion',
  'runtimeId',
  'routerVersion',
  'platform',
  'arch',
  'gatewayRelativePath',
  'adminRelativePath',
  'portalRelativePath',
];

export const DEFAULT_API_ROUTER_VERSION = process.env.SDKWORK_API_ROUTER_VERSION ?? '0.1.0';
export const DEFAULT_RESOURCE_DIR = path.join(
  rootDir,
  'packages',
  'sdkwork-claw-desktop',
  'src-tauri',
  'resources',
  'sdkwork-api-router-runtime',
);

export function resolveBundledResourceMirrorRoot(
  workspaceRootDir = rootDir,
  resourceId = 'sdkwork-api-router-runtime',
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

export function resolveApiRouterTarget(platform = process.platform, arch = process.arch) {
  const platformId =
    platform === 'win32' ? 'windows' : platform === 'darwin' ? 'macos' : platform === 'linux' ? 'linux' : platform;
  const archId = arch === 'x64' ? 'x64' : arch === 'arm64' ? 'arm64' : arch;

  if (!['windows', 'macos', 'linux'].includes(platformId)) {
    throw new Error(`Unsupported platform for bundled sdkwork-api-router runtime: ${platform}`);
  }

  if (!['x64', 'arm64'].includes(archId)) {
    throw new Error(`Unsupported architecture for bundled sdkwork-api-router runtime: ${arch}`);
  }

  const executableExt = platformId === 'windows' ? '.exe' : '';
  return {
    platformId,
    archId,
    gatewayBinaryName: `gateway-service${executableExt}`,
    adminBinaryName: `admin-api-service${executableExt}`,
    portalBinaryName: `portal-api-service${executableExt}`,
    gatewayRelativePath: `runtime/gateway-service${executableExt}`,
    adminRelativePath: `runtime/admin-api-service${executableExt}`,
    portalRelativePath: `runtime/portal-api-service${executableExt}`,
  };
}

export function resolveRequestedApiRouterTarget({
  env = process.env,
} = {}) {
  const target = resolveDesktopReleaseTarget({ env });
  return resolveApiRouterTarget(target.platform, target.arch);
}

export function buildApiRouterManifest({
  apiRouterVersion = DEFAULT_API_ROUTER_VERSION,
  target = resolveApiRouterTarget(),
  gatewayRelativePath = target.gatewayRelativePath,
  adminRelativePath = target.adminRelativePath,
  portalRelativePath = target.portalRelativePath,
} = {}) {
  return {
    schemaVersion: 1,
    runtimeId: 'sdkwork-api-router',
    routerVersion: apiRouterVersion,
    platform: target.platformId,
    arch: target.archId,
    gatewayRelativePath,
    adminRelativePath,
    portalRelativePath,
  };
}

export function preparedApiRouterManifestMatches(existingManifest, expectedManifest) {
  if (!existingManifest || typeof existingManifest !== 'object') {
    return false;
  }

  return PREPARED_RUNTIME_MANIFEST_KEYS.every(
    (key) => existingManifest[key] === expectedManifest[key],
  );
}

export async function inspectPreparedApiRouterRuntime({
  resourceDir = DEFAULT_RESOURCE_DIR,
  manifest,
} = {}) {
  const manifestPath = path.join(resourceDir, 'manifest.json');

  let existingManifest;
  try {
    existingManifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  } catch (error) {
    if (manifest) {
      const repairedInspection = await repairPreparedApiRouterRuntimeManifest({
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

  if (manifest && !preparedApiRouterManifestMatches(existingManifest, manifest)) {
    return {
      reusable: false,
      reason: 'manifest-mismatch',
      manifestPath,
      existingManifest,
    };
  }

  try {
    await validatePreparedApiRouterRuntimeSource(
      path.join(resourceDir, 'runtime'),
      manifest ?? existingManifest,
    );
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

export function shouldReusePreparedApiRouterRuntime({ inspection, forcePrepare = false }) {
  return !forcePrepare && Boolean(inspection?.reusable);
}

export async function prepareApiRouterRuntimeFromSource({
  sourceRuntimeDir,
  sourceAdminSiteDir,
  sourcePortalSiteDir,
  resourceDir = DEFAULT_RESOURCE_DIR,
  apiRouterVersion = DEFAULT_API_ROUTER_VERSION,
  target = resolveApiRouterTarget(),
} = {}) {
  if (!sourceRuntimeDir) {
    throw new Error('sourceRuntimeDir is required to prepare the bundled sdkwork-api-router runtime.');
  }

  const manifest = buildApiRouterManifest({ apiRouterVersion, target });
  const stagingRoot = await mkdtemp(path.join(os.tmpdir(), 'sdkwork-api-router-bundled-runtime-'));
  const stagedRuntimeDir = path.join(stagingRoot, 'runtime');

  try {
    await validatePreparedApiRouterBinaryArtifacts(sourceRuntimeDir, manifest);
    await cp(sourceRuntimeDir, stagedRuntimeDir, { recursive: true });
    await stageApiRouterSiteBundle({
      stagedRuntimeDir,
      siteLabel: 'admin',
      sourceSiteDir: await resolveApiRouterSiteBundleSource({
        siteLabel: 'admin',
        sourceRuntimeDir,
        sourceSiteDir: sourceAdminSiteDir,
      }),
    });
    await stageApiRouterSiteBundle({
      stagedRuntimeDir,
      siteLabel: 'portal',
      sourceSiteDir: await resolveApiRouterSiteBundleSource({
        siteLabel: 'portal',
        sourceRuntimeDir,
        sourceSiteDir: sourcePortalSiteDir,
      }),
    });
    await validatePreparedApiRouterRuntimeSource(stagedRuntimeDir, manifest);
    await rm(resourceDir, { recursive: true, force: true });
    await mkdir(resourceDir, { recursive: true });
    await cp(stagedRuntimeDir, path.join(resourceDir, 'runtime'), { recursive: true });
    await writeFile(
      path.join(resourceDir, 'manifest.json'),
      `${JSON.stringify(manifest, null, 2)}\n`,
      'utf8',
    );
    await writeGeneratedResourceMetadata(resourceDir);
  } finally {
    await rm(stagingRoot, { recursive: true, force: true });
  }

  return {
    manifest,
    resourceDir,
  };
}

export async function prepareApiRouterRuntime({
  resourceDir = DEFAULT_RESOURCE_DIR,
  apiRouterVersion = DEFAULT_API_ROUTER_VERSION,
  sourceRuntimeDir = process.env.SDKWORK_API_ROUTER_BUNDLED_SOURCE_DIR,
  sourceAdminSiteDir = process.env.SDKWORK_API_ROUTER_ADMIN_SITE_SOURCE_DIR,
  sourcePortalSiteDir = process.env.SDKWORK_API_ROUTER_PORTAL_SITE_SOURCE_DIR,
  sourceRepoDir = process.env.SDKWORK_API_ROUTER_SOURCE_REPO_DIR ?? resolveDefaultApiRouterWorkspaceDir(),
  forcePrepare = parseBooleanFlag(process.env.SDKWORK_API_ROUTER_FORCE_PREPARE),
  profile = process.env.SDKWORK_API_ROUTER_BUILD_PROFILE ?? 'release',
  target = resolveRequestedApiRouterTarget(),
} = {}) {
  const manifest = buildApiRouterManifest({ apiRouterVersion, target });

  if (!forcePrepare) {
    const inspection = await inspectPreparedApiRouterRuntime({
      resourceDir,
      manifest,
    });

    if (shouldReusePreparedApiRouterRuntime({ inspection, forcePrepare })) {
      return await finalizePreparedApiRouterRuntime({
        manifest,
        resourceDir,
        strategy: inspection.repairedManifest ? 'repaired-existing-manifest' : 'reused-existing',
      });
    }
  }

  if (sourceRuntimeDir) {
    const result = await prepareApiRouterRuntimeFromSource({
      sourceRuntimeDir,
      sourceAdminSiteDir,
      sourcePortalSiteDir,
      resourceDir,
      apiRouterVersion,
      target,
    });

    return await finalizePreparedApiRouterRuntime({
      ...result,
      strategy: 'prepared-source',
    });
  }

  if (!sourceRepoDir || !existsSync(sourceRepoDir)) {
    throw new Error(
      'Unable to prepare sdkwork-api-router runtime. Set SDKWORK_API_ROUTER_BUNDLED_SOURCE_DIR to a prebuilt runtime directory or SDKWORK_API_ROUTER_SOURCE_REPO_DIR to a source checkout.',
    );
  }

  const { sourceRuntimeDir: builtRuntimeDir, cleanup } = await buildApiRouterRuntimeFromWorkspace({
    sourceRepoDir,
    sourceAdminSiteDir,
    sourcePortalSiteDir,
    profile,
    target,
  });

  try {
    const result = await prepareApiRouterRuntimeFromSource({
      sourceRuntimeDir: builtRuntimeDir,
      resourceDir,
      apiRouterVersion,
      target,
    });

    return await finalizePreparedApiRouterRuntime({
      ...result,
      strategy: 'prepared-workspace',
    });
  } finally {
    await cleanup();
  }
}

async function finalizePreparedApiRouterRuntime(result) {
  await ensureBundledResourceMirror({
    resourceDir: result.resourceDir,
    resourceId: 'sdkwork-api-router-runtime',
  });
  return result;
}

export async function validatePreparedApiRouterRuntimeSource(sourceRuntimeDir, manifest) {
  await validatePreparedApiRouterBinaryArtifacts(sourceRuntimeDir, manifest);
  for (const siteLabel of ['admin', 'portal']) {
    await validateApiRouterSiteBundle(path.join(sourceRuntimeDir, 'sites', siteLabel), siteLabel);
  }
}

async function validatePreparedApiRouterBinaryArtifacts(sourceRuntimeDir, manifest) {
  const requiredRelativePaths = [manifest.gatewayRelativePath, manifest.adminRelativePath]
    .concat(typeof manifest.portalRelativePath === 'string' ? [manifest.portalRelativePath] : []);

  for (const relativePath of requiredRelativePaths) {
    const absolutePath = path.join(
      sourceRuntimeDir,
      relativePath.replace(/^runtime[\\/]/, ''),
    );
    try {
      await stat(absolutePath);
    } catch (error) {
      throw new Error(
        `Prepared sdkwork-api-router runtime is missing ${absolutePath}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

async function validateApiRouterSiteBundle(siteDir, siteLabel) {
  try {
    await stat(siteDir);
    await stat(path.join(siteDir, 'index.html'));
  } catch (error) {
    throw new Error(
      `Prepared sdkwork-api-router ${siteLabel} site bundle is missing ${path.join(siteDir, 'index.html')}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function repairPreparedApiRouterRuntimeManifest({
  resourceDir,
  manifest,
}) {
  const manifestPath = path.join(resourceDir, 'manifest.json');
  const runtimeDir = path.join(resourceDir, 'runtime');

  try {
    await validatePreparedApiRouterRuntimeSource(runtimeDir, manifest);
  } catch (error) {
    return {
      reusable: false,
      reason: 'runtime-invalid',
      manifestPath,
      error: error instanceof Error ? error.message : String(error),
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

async function buildApiRouterRuntimeFromWorkspace({
  sourceRepoDir,
  sourceAdminSiteDir,
  sourcePortalSiteDir,
  profile = 'release',
  target = resolveApiRouterTarget(),
}) {
  const cargoArgs = ['build'];
  if (profile === 'release') {
    cargoArgs.push('--release');
  } else if (profile !== 'debug') {
    throw new Error(`Unsupported sdkwork-api-router build profile: ${profile}`);
  }
  cargoArgs.push(
    '-p',
    'admin-api-service',
    '-p',
    'gateway-service',
    '-p',
    'portal-api-service',
  );
  const cargoTargetDir = resolveBundledApiRouterCargoTargetDir(rootDir, process.platform);
  await runCommand('cargo', cargoArgs, {
    cwd: sourceRepoDir,
    env: withSupportedWindowsCmakeGenerator({
      ...process.env,
      CARGO_TARGET_DIR: cargoTargetDir,
    }),
  });

  const builtArtifactsDir = path.join(cargoTargetDir, profile === 'release' ? 'release' : 'debug');
  const stagingRoot = await mkdtemp(path.join(os.tmpdir(), 'sdkwork-api-router-runtime-'));
  const runtimeDir = path.join(stagingRoot, 'runtime');
  await mkdir(runtimeDir, { recursive: true });

  for (const binaryName of [
    target.gatewayBinaryName,
    target.adminBinaryName,
    target.portalBinaryName,
  ]) {
    await cp(path.join(builtArtifactsDir, binaryName), path.join(runtimeDir, binaryName));
  }
  await stageApiRouterSiteBundle({
    stagedRuntimeDir: runtimeDir,
    siteLabel: 'admin',
    sourceSiteDir: await resolveWorkspaceApiRouterSiteBundle({
      sourceRepoDir,
      siteLabel: 'admin',
      sourceSiteDir: sourceAdminSiteDir,
    }),
  });
  await stageApiRouterSiteBundle({
    stagedRuntimeDir: runtimeDir,
    siteLabel: 'portal',
    sourceSiteDir: await resolveWorkspaceApiRouterSiteBundle({
      sourceRepoDir,
      siteLabel: 'portal',
      sourceSiteDir: sourcePortalSiteDir,
    }),
  });
  await validatePreparedApiRouterRuntimeSource(
    runtimeDir,
    buildApiRouterManifest({ apiRouterVersion: DEFAULT_API_ROUTER_VERSION, target }),
  );

  return {
    sourceRuntimeDir: runtimeDir,
    cleanup: async () => {
      await rm(stagingRoot, { recursive: true, force: true });
    },
  };
}

async function resolveApiRouterSiteBundleSource({
  siteLabel,
  sourceRuntimeDir,
  sourceSiteDir,
}) {
  const candidates = [];

  if (typeof sourceSiteDir === 'string' && sourceSiteDir.trim().length > 0) {
    candidates.push(path.resolve(sourceSiteDir.trim()));
  }

  if (sourceRuntimeDir) {
    candidates.push(path.join(sourceRuntimeDir, 'sites', siteLabel));
  }

  for (const candidate of candidates) {
    try {
      await validateApiRouterSiteBundle(candidate, siteLabel);
      return candidate;
    } catch {}
  }

  throw new Error(
    `Unable to resolve sdkwork-api-router ${siteLabel} site bundle. Provide SDKWORK_API_ROUTER_${siteLabel.toUpperCase()}_SITE_SOURCE_DIR or include sites/${siteLabel}/index.html inside ${sourceRuntimeDir}.`,
  );
}

async function stageApiRouterSiteBundle({
  stagedRuntimeDir,
  siteLabel,
  sourceSiteDir,
}) {
  const targetSiteDir = path.join(stagedRuntimeDir, 'sites', siteLabel);
  await rm(targetSiteDir, { recursive: true, force: true });
  await mkdir(path.dirname(targetSiteDir), { recursive: true });
  await cp(sourceSiteDir, targetSiteDir, { recursive: true });
}

async function resolveWorkspaceApiRouterSiteBundle({
  sourceRepoDir,
  siteLabel,
  sourceSiteDir,
}) {
  if (typeof sourceSiteDir === 'string' && sourceSiteDir.trim().length > 0) {
    const explicitSiteDir = path.resolve(sourceSiteDir.trim());
    await validateApiRouterSiteBundle(explicitSiteDir, siteLabel);
    return explicitSiteDir;
  }

  const appDir = path.join(
    sourceRepoDir,
    'apps',
    siteLabel === 'admin' ? 'sdkwork-router-admin' : 'sdkwork-router-portal',
  );
  const distDir = path.join(appDir, 'dist');
  await buildWorkspaceApiRouterSiteBundle({ appDir, siteLabel });
  await validateApiRouterSiteBundle(distDir, siteLabel);
  return distDir;
}

async function buildWorkspaceApiRouterSiteBundle({ appDir, siteLabel }) {
  if (!existsSync(appDir)) {
    throw new Error(`Unable to build sdkwork-api-router ${siteLabel} site bundle: missing ${appDir}`);
  }

  await ensureWorkspaceInstallReady({ appDir, siteLabel });
  await runCommand('pnpm', ['build'], { cwd: appDir });
}

export async function inspectWorkspaceInstall(appDir) {
  const manifestPath = path.join(appDir, 'package.json');
  const nodeModulesDir = path.join(appDir, 'node_modules');

  let packageManifest;
  try {
    packageManifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  } catch (error) {
    return {
      healthy: false,
      reason: 'manifest-unreadable',
      manifestPath,
      nodeModulesDir,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  const directPackageNames = collectWorkspaceDirectPackageNames(packageManifest);
  if (!existsSync(nodeModulesDir)) {
    return {
      healthy: false,
      reason: 'missing-node-modules',
      manifestPath,
      nodeModulesDir,
      missingPackages: directPackageNames,
    };
  }

  const missingPackages = directPackageNames.filter((packageName) => {
    return !existsSync(resolveNodeModulesPackageEntry(nodeModulesDir, packageName));
  });

  if (missingPackages.length > 0) {
    return {
      healthy: false,
      reason: 'missing-direct-dependencies',
      manifestPath,
      nodeModulesDir,
      missingPackages,
    };
  }

  return {
    healthy: true,
    reason: 'ready',
    manifestPath,
    nodeModulesDir,
    packageManifest,
  };
}

async function ensureWorkspaceInstallReady({ appDir, siteLabel }) {
  const inspection = await inspectWorkspaceInstall(appDir);
  if (inspection.healthy) {
    return inspection;
  }

  if (inspection.reason === 'manifest-unreadable') {
    throw new Error(
      `Unable to inspect sdkwork-api-router ${siteLabel} workspace manifest at ${inspection.manifestPath}: ${inspection.error}`,
    );
  }

  console.warn(
    `[prepare-sdkwork-api-router-runtime] Repairing sdkwork-api-router ${siteLabel} workspace dependencies in ${appDir} (${inspection.reason}).`,
  );
  await removeDirectoryWithRetries(inspection.nodeModulesDir);
  await installWorkspaceDependencies(appDir);

  const repairedInspection = await inspectWorkspaceInstall(appDir);
  if (repairedInspection.healthy) {
    return repairedInspection;
  }

  throw new Error(
    `Unable to prepare sdkwork-api-router ${siteLabel} workspace dependencies in ${appDir}. Missing packages after install: ${(repairedInspection.missingPackages ?? []).join(', ') || repairedInspection.reason}`,
  );
}

export function shouldRetryWorkspaceInstallWithoutLockfile(errorText) {
  if (typeof errorText !== 'string' || errorText.trim().length === 0) {
    return false;
  }

  return errorText.includes('ERR_PNPM_OUTDATED_LOCKFILE')
    || errorText.includes('Cannot install with "frozen-lockfile"');
}

export function shouldRetryWorkspaceInstallAfterTransientLock(errorText) {
  if (typeof errorText !== 'string' || errorText.trim().length === 0) {
    return false;
  }

  return (
    errorText.includes('EPERM')
    && errorText.includes('operation not permitted')
    && errorText.includes('unlink')
  ) || (
    errorText.includes('EBUSY')
    && errorText.includes('resource busy or locked')
  );
}

export function buildNonInteractiveInstallEnv(baseEnv = process.env) {
  return {
    ...baseEnv,
    CI: 'true',
    npm_config_yes: 'true',
  };
}

export function withSupportedWindowsCmakeGenerator(
  baseEnv = process.env,
  platform = process.platform,
) {
  const env = { ...baseEnv };
  if (platform !== 'win32') {
    return env;
  }

  const requestedGenerator = String(env.CMAKE_GENERATOR ?? '').trim();
  if (requestedGenerator.length > 0 && !requestedGenerator.includes('2026')) {
    return env;
  }

  env.CMAKE_GENERATOR = 'Visual Studio 17 2022';
  env.HOST_CMAKE_GENERATOR = 'Visual Studio 17 2022';
  return env;
}

export function resolveBundledApiRouterCargoTargetDir(
  workspaceRootDir = rootDir,
  platform = process.platform,
) {
  if (platform !== 'win32') {
    return path.posix.join(
      workspaceRootDir,
      '.cache',
      'bundled-components',
      'targets',
      'sdkwork-api-router',
    );
  }

  const workspaceName = sanitizePathSegment(path.win32.basename(workspaceRootDir)) || 'workspace';
  const driveRoot = path.win32.parse(workspaceRootDir).root;
  if (!driveRoot) {
    return path.win32.join(
      workspaceRootDir,
      '.cache',
      'bundled-components',
      'targets',
      'sdkwork-api-router',
    );
  }

  // Keep this Cargo target intentionally short to avoid Windows
  // MSBuild/FileTracker failures inside nested CMake scratch paths.
  return path.win32.join(driveRoot, '.sdkwork-bc', workspaceName, 'sdkrouter');
}

async function installWorkspaceDependencies(appDir) {
  const installEnv = buildNonInteractiveInstallEnv();

  try {
    await runWorkspaceInstall(['install', '--frozen-lockfile'], {
      cwd: appDir,
      echoOutput: true,
      env: installEnv,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!shouldRetryWorkspaceInstallWithoutLockfile(message)) {
      throw error;
    }

    console.warn(
      `[prepare-sdkwork-api-router-runtime] Detected an outdated pnpm lockfile in ${appDir}; retrying install with --lockfile=false for bundled site preparation.`,
    );
    await runWorkspaceInstall(['install', '--lockfile=false', '--force'], {
      cwd: appDir,
      echoOutput: true,
      env: installEnv,
    });
  }
}

async function runWorkspaceInstall(args, options) {
  let lastError;

  for (let attempt = 1; attempt <= DEFAULT_WORKSPACE_INSTALL_RETRY_COUNT; attempt += 1) {
    try {
      return await runCommandCapture('pnpm', args, options);
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      const canRetryTransientLock =
        attempt < DEFAULT_WORKSPACE_INSTALL_RETRY_COUNT
        && shouldRetryWorkspaceInstallAfterTransientLock(message);

      if (!canRetryTransientLock) {
        throw error;
      }

      console.warn(
        `[prepare-sdkwork-api-router-runtime] Retrying pnpm ${args.join(' ')} after transient Windows file lock (${attempt}/${DEFAULT_WORKSPACE_INSTALL_RETRY_COUNT - 1}).`,
      );
      await sleep(DEFAULT_WORKSPACE_INSTALL_RETRY_DELAY_MS * attempt);
    }
  }

  throw lastError;
}

async function writeGeneratedResourceMetadata(resourceDir) {
  await writeFile(
    path.join(resourceDir, 'README.md'),
    [
      '# Bundled sdkwork-api-router Runtime',
      '',
      'This directory is generated by `scripts/prepare-sdkwork-api-router-runtime.mjs`.',
      'Commit the metadata files here, but keep the runtime binaries and manifest as generated packaging artifacts.',
      '',
      'To refresh the bundled runtime:',
      '',
      '- `node scripts/prepare-sdkwork-api-router-runtime.mjs`',
    ].join('\n') + '\n',
    'utf8',
  );
  await writeFile(
    path.join(resourceDir, '.gitignore'),
    ['runtime/', 'manifest.json'].join('\n') + '\n',
    'utf8',
  );
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

  await rm(mirrorRoot, { recursive: true, force: true });
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

function parseBooleanFlag(value) {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value !== 'string') {
    return false;
  }

  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

function sanitizePathSegment(value) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '');
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function removeDirectoryWithRetries(directoryPath) {
  let lastError;

  for (let attempt = 1; attempt <= DEFAULT_WORKSPACE_INSTALL_RETRY_COUNT; attempt += 1) {
    try {
      await rm(directoryPath, { recursive: true, force: true });
      return;
    } catch (error) {
      lastError = error;
      const canRetry =
        attempt < DEFAULT_WORKSPACE_INSTALL_RETRY_COUNT
        && shouldRetryDirectoryCleanup(error);

      if (!canRetry) {
        throw error;
      }

      console.warn(
        `[prepare-sdkwork-api-router-runtime] Retrying cleanup of ${directoryPath} after transient Windows file lock (${attempt}/${DEFAULT_WORKSPACE_INSTALL_RETRY_COUNT - 1}).`,
      );
      await sleep(DEFAULT_WORKSPACE_INSTALL_RETRY_DELAY_MS * attempt);
    }
  }

  throw lastError;
}

function shouldRetryDirectoryCleanup(error) {
  const errorCode = typeof error === 'object' && error !== null ? error.code : undefined;
  if (errorCode === 'EPERM' || errorCode === 'EBUSY' || errorCode === 'ENOTEMPTY') {
    return true;
  }

  const errorText = error instanceof Error ? error.message : String(error);
  return shouldRetryWorkspaceInstallAfterTransientLock(errorText);
}

function collectWorkspaceDirectPackageNames(packageManifest) {
  const sections = [
    packageManifest?.dependencies,
    packageManifest?.devDependencies,
    packageManifest?.optionalDependencies,
  ];

  return Array.from(
    new Set(
      sections.flatMap((section) => {
        if (!section || typeof section !== 'object') {
          return [];
        }
        return Object.keys(section);
      }),
    ),
  );
}

function resolveNodeModulesPackageEntry(nodeModulesDir, packageName) {
  return path.join(nodeModulesDir, ...packageName.split('/'));
}

export function resolveDefaultApiRouterWorkspaceDir(workspaceRootDir = rootDir) {
  const candidates = [
    path.join(workspaceRootDir, '..', 'sdkwork-api-router'),
    path.join(workspaceRootDir, '.codex-tools', 'sdkwork-api-router'),
    path.join(
      workspaceRootDir,
      '.cache',
      'bundled-components',
      'upstreams',
      'sdkwork-api-router',
    ),
    path.join(workspaceRootDir, '.codex-tools', 'sdkwork-api-router-ref'),
  ];

  return candidates.find((candidate) => existsSync(candidate));
}

async function runCommand(command, args, options = {}) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? rootDir,
      stdio: 'inherit',
      env: options.env ?? process.env,
      shell: false,
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(`Command failed: ${command} ${args.join(' ')} (exit ${code ?? 'unknown'})`),
      );
    });
  });
}

async function runCommandCapture(command, args, options = {}) {
  const result = await new Promise((resolve, reject) => {
    const stdoutChunks = [];
    const stderrChunks = [];
    const child = spawn(command, args, {
      cwd: options.cwd ?? rootDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: options.env ?? process.env,
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
      const stdout = Buffer.concat(stdoutChunks).toString('utf8');
      const stderr = Buffer.concat(stderrChunks).toString('utf8');
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }

      reject(
        new Error(
          `Command failed: ${command} ${args.join(' ')} (exit ${code ?? 'unknown'})\n${stdout}${stderr}`.trim(),
        ),
      );
    });
  });

  if (options.echoOutput !== false) {
    if (result.stdout) {
      process.stdout.write(result.stdout);
    }
    if (result.stderr) {
      process.stderr.write(result.stderr);
    }
  }

  return result;
}

async function main() {
  const forcePrepare = process.argv.includes('--force');
  const result = await prepareApiRouterRuntime({ forcePrepare });
  const action = result.strategy === 'reused-existing' ? 'Reused' : 'Prepared';
  console.log(
    `${action} bundled sdkwork-api-router runtime ${result.manifest.routerVersion} for ${result.manifest.platform}-${result.manifest.arch} at ${result.resourceDir} (${result.strategy})`,
  );
}

if (path.resolve(process.argv[1] ?? '') === __filename) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
