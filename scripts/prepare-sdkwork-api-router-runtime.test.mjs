import { copyFile, mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  buildNonInteractiveInstallEnv,
  buildApiRouterManifest,
  inspectWorkspaceInstall,
  inspectPreparedApiRouterRuntime,
  prepareApiRouterRuntime,
  prepareApiRouterRuntimeFromSource,
  resolveDefaultApiRouterWorkspaceDir,
  resolveApiRouterTarget,
  resolveBundledApiRouterCargoTargetDir,
  withSupportedWindowsCmakeGenerator,
  shouldRetryWorkspaceInstallAfterTransientLock,
  shouldRetryWorkspaceInstallWithoutLockfile,
  shouldReusePreparedApiRouterRuntime,
} from './prepare-sdkwork-api-router-runtime.mjs';

const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'prepare-sdkwork-api-router-runtime-test-'));

try {
  const sourceRuntimeDir = path.join(tempRoot, 'source-runtime');
  const resourceDir = path.join(tempRoot, 'resource-runtime');
  const target = resolveApiRouterTarget('win32', 'x64');
  const manifest = buildApiRouterManifest({
    apiRouterVersion: '2026.3.21',
    target,
  });
  const adminSiteDir = path.join(tempRoot, 'source-admin-site');
  const portalSiteDir = path.join(tempRoot, 'source-portal-site');
  const gatewayPath = path.join(
    sourceRuntimeDir,
    manifest.gatewayRelativePath.replace(/^runtime[\\/]/, ''),
  );
  const adminPath = path.join(
    sourceRuntimeDir,
    manifest.adminRelativePath.replace(/^runtime[\\/]/, ''),
  );
  const portalPath = path.join(
    sourceRuntimeDir,
    manifest.portalRelativePath.replace(/^runtime[\\/]/, ''),
  );

  await mkdir(path.dirname(gatewayPath), { recursive: true });
  await mkdir(path.dirname(adminPath), { recursive: true });
  await mkdir(path.dirname(portalPath), { recursive: true });
  await mkdir(adminSiteDir, { recursive: true });
  await mkdir(portalSiteDir, { recursive: true });
  await copyFile(process.execPath, gatewayPath);
  await copyFile(process.execPath, adminPath);
  await copyFile(process.execPath, portalPath);
  await writeFile(path.join(adminSiteDir, 'index.html'), '<!doctype html><title>admin</title>');
  await writeFile(path.join(portalSiteDir, 'index.html'), '<!doctype html><title>portal</title>');

  const result = await prepareApiRouterRuntimeFromSource({
    sourceRuntimeDir,
    sourceAdminSiteDir: adminSiteDir,
    sourcePortalSiteDir: portalSiteDir,
    resourceDir,
    apiRouterVersion: '2026.3.21',
    target,
  });

  await stat(path.join(resourceDir, 'runtime'));
  await stat(path.join(resourceDir, 'manifest.json'));
  await stat(path.join(resourceDir, 'runtime', 'sites', 'admin', 'index.html'));
  await stat(path.join(resourceDir, 'runtime', 'sites', 'portal', 'index.html'));

  const copiedManifest = JSON.parse(await readFile(path.join(resourceDir, 'manifest.json'), 'utf8'));
  if (copiedManifest.runtimeId !== 'sdkwork-api-router') {
    throw new Error(`Expected runtimeId=sdkwork-api-router, received ${copiedManifest.runtimeId}`);
  }

  if (copiedManifest.routerVersion !== '2026.3.21') {
    throw new Error(`Expected routerVersion=2026.3.21, received ${copiedManifest.routerVersion}`);
  }

  if (result.manifest.gatewayRelativePath !== 'runtime/gateway-service.exe') {
    throw new Error(
      `Unexpected gatewayRelativePath ${result.manifest.gatewayRelativePath}`,
    );
  }

  const inspection = await inspectPreparedApiRouterRuntime({
    resourceDir,
    manifest,
  });
  if (!inspection.reusable) {
    throw new Error(
      `Expected prepared api router runtime inspection to be reusable, received ${inspection.reason}`,
    );
  }

  const missingSitesResourceDir = path.join(tempRoot, 'missing-sites-resource-runtime');
  await prepareApiRouterRuntimeFromSource({
    sourceRuntimeDir,
    sourceAdminSiteDir: adminSiteDir,
    sourcePortalSiteDir: portalSiteDir,
    resourceDir: missingSitesResourceDir,
    apiRouterVersion: '2026.3.21',
    target,
  });
  await rm(path.join(missingSitesResourceDir, 'runtime', 'sites'), {
    recursive: true,
    force: true,
  });

  const missingSitesInspection = await inspectPreparedApiRouterRuntime({
    resourceDir: missingSitesResourceDir,
    manifest,
  });
  if (missingSitesInspection.reusable) {
    throw new Error('Expected a prepared runtime without admin and portal sites to be rejected');
  }
  if (missingSitesInspection.reason !== 'runtime-invalid') {
    throw new Error(
      `Expected missing site bundles to produce runtime-invalid, received ${missingSitesInspection.reason}`,
    );
  }

  if (shouldReusePreparedApiRouterRuntime({ inspection, forcePrepare: true })) {
    throw new Error('Expected forcePrepare=true to disable reuse of an otherwise valid prepared runtime');
  }

  const sentinelPath = path.join(resourceDir, 'runtime', 'sentinel.txt');
  await writeFile(sentinelPath, 'keep');

  const reused = await prepareApiRouterRuntime({
    resourceDir,
    apiRouterVersion: '2026.3.21',
    sourceRuntimeDir,
    sourceAdminSiteDir: adminSiteDir,
    sourcePortalSiteDir: portalSiteDir,
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
  await prepareApiRouterRuntimeFromSource({
    sourceRuntimeDir,
    sourceAdminSiteDir: adminSiteDir,
    sourcePortalSiteDir: portalSiteDir,
    resourceDir: repairableResourceDir,
    apiRouterVersion: '2026.3.21',
    target,
  });
  await rm(path.join(repairableResourceDir, 'manifest.json'));

  const repaired = await prepareApiRouterRuntime({
    resourceDir: repairableResourceDir,
    apiRouterVersion: '2026.3.21',
    sourceRuntimeDir,
    sourceAdminSiteDir: adminSiteDir,
    sourcePortalSiteDir: portalSiteDir,
    target,
  });

  if (repaired.strategy !== 'repaired-existing-manifest') {
    throw new Error(`Expected a repaired-existing-manifest strategy, received ${repaired.strategy}`);
  }

  const workspaceRoot = path.join(tempRoot, 'workspace-root');
  await mkdir(path.join(workspaceRoot, '.codex-tools', 'sdkwork-api-router'), {
    recursive: true,
  });

  const discoveredRepoDir = resolveDefaultApiRouterWorkspaceDir(workspaceRoot);
  if (discoveredRepoDir !== path.join(workspaceRoot, '.codex-tools', 'sdkwork-api-router')) {
    throw new Error(
      `Expected resolveDefaultApiRouterWorkspaceDir() to prefer .codex-tools/sdkwork-api-router, received ${discoveredRepoDir}`,
    );
  }

  const syncedWorkspaceRoot = path.join(tempRoot, 'synced-workspace-root');
  await mkdir(
    path.join(
      syncedWorkspaceRoot,
      '.cache',
      'bundled-components',
      'upstreams',
      'sdkwork-api-router',
    ),
    {
      recursive: true,
    },
  );

  const discoveredSyncedRepoDir = resolveDefaultApiRouterWorkspaceDir(syncedWorkspaceRoot);
  if (
    discoveredSyncedRepoDir
    !== path.join(
      syncedWorkspaceRoot,
      '.cache',
      'bundled-components',
      'upstreams',
      'sdkwork-api-router',
    )
  ) {
    throw new Error(
      `Expected resolveDefaultApiRouterWorkspaceDir() to fall back to .cache/bundled-components/upstreams/sdkwork-api-router, received ${discoveredSyncedRepoDir}`,
    );
  }

  if (!shouldRetryWorkspaceInstallWithoutLockfile('ERR_PNPM_OUTDATED_LOCKFILE Cannot install with "frozen-lockfile"')) {
    throw new Error('Expected outdated pnpm lockfile errors to enable the relaxed install retry');
  }
  if (shouldRetryWorkspaceInstallWithoutLockfile('Command failed: pnpm build (exit 1)')) {
    throw new Error('Expected unrelated pnpm failures to avoid the relaxed install retry');
  }
  if (
    !shouldRetryWorkspaceInstallAfterTransientLock(
      "EPERM: operation not permitted, unlink 'D:/repo/node_modules/native-addon.node'",
    )
  ) {
    throw new Error('Expected transient Windows unlink lock errors to trigger a retry');
  }
  if (shouldRetryWorkspaceInstallAfterTransientLock('ERR_PNPM_OUTDATED_LOCKFILE')) {
    throw new Error('Expected outdated lockfile failures to avoid the transient lock retry path');
  }

  const nonInteractiveEnv = buildNonInteractiveInstallEnv({
    PATH: 'C:/pnpm',
    CI: 'false',
    npm_config_yes: 'false',
  });
  if (nonInteractiveEnv.CI !== 'true') {
    throw new Error(`Expected non-interactive install env to force CI=true, received ${nonInteractiveEnv.CI}`);
  }
  if (nonInteractiveEnv.npm_config_yes !== 'true') {
    throw new Error(
      `Expected non-interactive install env to force npm_config_yes=true, received ${nonInteractiveEnv.npm_config_yes}`,
    );
  }
  if (nonInteractiveEnv.PATH !== 'C:/pnpm') {
    throw new Error(`Expected non-interactive install env to preserve PATH, received ${nonInteractiveEnv.PATH}`);
  }

  const windowsCmakeEnv = withSupportedWindowsCmakeGenerator({ PATH: 'C:/cmake' }, 'win32');
  if (windowsCmakeEnv.CMAKE_GENERATOR !== 'Visual Studio 17 2022') {
    throw new Error(
      `Expected Windows bundled api-router builds to default CMAKE_GENERATOR=Visual Studio 17 2022, received ${windowsCmakeEnv.CMAKE_GENERATOR}`,
    );
  }
  if (windowsCmakeEnv.HOST_CMAKE_GENERATOR !== 'Visual Studio 17 2022') {
    throw new Error(
      `Expected Windows bundled api-router builds to default HOST_CMAKE_GENERATOR=Visual Studio 17 2022, received ${windowsCmakeEnv.HOST_CMAKE_GENERATOR}`,
    );
  }

  const rewrittenGeneratorEnv = withSupportedWindowsCmakeGenerator(
    { CMAKE_GENERATOR: 'Visual Studio 18 2026' },
    'win32',
  );
  if (rewrittenGeneratorEnv.CMAKE_GENERATOR !== 'Visual Studio 17 2022') {
    throw new Error(
      `Expected unsupported Visual Studio 18 2026 generator values to be rewritten, received ${rewrittenGeneratorEnv.CMAKE_GENERATOR}`,
    );
  }

  const preservedNinjaEnv = withSupportedWindowsCmakeGenerator(
    { CMAKE_GENERATOR: 'Ninja' },
    'win32',
  );
  if (preservedNinjaEnv.CMAKE_GENERATOR !== 'Ninja') {
    throw new Error(
      `Expected explicit non-Visual-Studio generators to be preserved, received ${preservedNinjaEnv.CMAKE_GENERATOR}`,
    );
  }

  const windowsCargoTargetDir = resolveBundledApiRouterCargoTargetDir(
    'D:\\workspace\\claw-studio',
    'win32',
  );
  if (windowsCargoTargetDir !== 'D:\\.sdkwork-bc\\claw-studio\\sdkrouter') {
    throw new Error(
      `Expected Windows bundled api-router cargo targets to use a short root-level cache, received ${windowsCargoTargetDir}`,
    );
  }

  const linuxCargoTargetDir = resolveBundledApiRouterCargoTargetDir(
    '/workspace/claw-studio',
    'linux',
  );
  if (linuxCargoTargetDir !== '/workspace/claw-studio/.cache/bundled-components/targets/sdkwork-api-router') {
    throw new Error(
      `Expected non-Windows bundled api-router cargo targets to stay under the repo cache, received ${linuxCargoTargetDir}`,
    );
  }

  const incompleteWorkspaceDir = path.join(tempRoot, 'incomplete-workspace');
  await mkdir(path.join(incompleteWorkspaceDir, 'node_modules', '.pnpm'), { recursive: true });
  await writeFile(
    path.join(incompleteWorkspaceDir, 'package.json'),
    JSON.stringify({
      name: 'incomplete-workspace',
      private: true,
      dependencies: {
        react: '^19.0.0',
      },
      devDependencies: {
        '@tailwindcss/vite': '^4.1.12',
      },
    }, null, 2),
  );
  await writeFile(path.join(incompleteWorkspaceDir, 'node_modules', '.pnpm-workspace-state.json'), '{}');

  const incompleteWorkspaceInspection = await inspectWorkspaceInstall(incompleteWorkspaceDir);
  if (incompleteWorkspaceInspection.healthy) {
    throw new Error('Expected a workspace missing direct dependency entries to be reported as unhealthy');
  }
  if (incompleteWorkspaceInspection.reason !== 'missing-direct-dependencies') {
    throw new Error(
      `Expected missing direct dependency entries to produce missing-direct-dependencies, received ${incompleteWorkspaceInspection.reason}`,
    );
  }
  if (!incompleteWorkspaceInspection.missingPackages.includes('react')) {
    throw new Error('Expected inspectWorkspaceInstall() to report missing unscoped direct dependencies');
  }
  if (!incompleteWorkspaceInspection.missingPackages.includes('@tailwindcss/vite')) {
    throw new Error('Expected inspectWorkspaceInstall() to report missing scoped direct dependencies');
  }

  const healthyWorkspaceDir = path.join(tempRoot, 'healthy-workspace');
  await mkdir(path.join(healthyWorkspaceDir, 'node_modules', '@tailwindcss'), { recursive: true });
  await mkdir(path.join(healthyWorkspaceDir, 'node_modules', 'react'), { recursive: true });
  await writeFile(
    path.join(healthyWorkspaceDir, 'package.json'),
    JSON.stringify({
      name: 'healthy-workspace',
      private: true,
      dependencies: {
        react: '^19.0.0',
      },
      devDependencies: {
        '@tailwindcss/vite': '^4.1.12',
      },
    }, null, 2),
  );
  await writeFile(path.join(healthyWorkspaceDir, 'node_modules', '@tailwindcss', 'vite'), '');

  const healthyWorkspaceInspection = await inspectWorkspaceInstall(healthyWorkspaceDir);
  if (!healthyWorkspaceInspection.healthy) {
    throw new Error(
      `Expected a workspace with direct dependency entries to be healthy, received ${healthyWorkspaceInspection.reason}`,
    );
  }

  console.log('ok - bundled sdkwork-api-router runtime preparation copies runtime files and writes manifest');
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
