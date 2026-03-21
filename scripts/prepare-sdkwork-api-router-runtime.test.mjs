import { copyFile, mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  buildApiRouterManifest,
  inspectPreparedApiRouterRuntime,
  prepareApiRouterRuntime,
  prepareApiRouterRuntimeFromSource,
  resolveApiRouterTarget,
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
  await copyFile(process.execPath, gatewayPath);
  await copyFile(process.execPath, adminPath);
  await copyFile(process.execPath, portalPath);

  const result = await prepareApiRouterRuntimeFromSource({
    sourceRuntimeDir,
    resourceDir,
    apiRouterVersion: '2026.3.21',
    target,
  });

  await stat(path.join(resourceDir, 'runtime'));
  await stat(path.join(resourceDir, 'manifest.json'));

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

  if (shouldReusePreparedApiRouterRuntime({ inspection, forcePrepare: true })) {
    throw new Error('Expected forcePrepare=true to disable reuse of an otherwise valid prepared runtime');
  }

  const sentinelPath = path.join(resourceDir, 'runtime', 'sentinel.txt');
  await writeFile(sentinelPath, 'keep');

  const reused = await prepareApiRouterRuntime({
    resourceDir,
    apiRouterVersion: '2026.3.21',
    sourceRuntimeDir,
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
    resourceDir: repairableResourceDir,
    apiRouterVersion: '2026.3.21',
    target,
  });
  await rm(path.join(repairableResourceDir, 'manifest.json'));

  const repaired = await prepareApiRouterRuntime({
    resourceDir: repairableResourceDir,
    apiRouterVersion: '2026.3.21',
    sourceRuntimeDir,
    target,
  });

  if (repaired.strategy !== 'repaired-existing-manifest') {
    throw new Error(`Expected a repaired-existing-manifest strategy, received ${repaired.strategy}`);
  }

  console.log('ok - bundled sdkwork-api-router runtime preparation copies runtime files and writes manifest');
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
