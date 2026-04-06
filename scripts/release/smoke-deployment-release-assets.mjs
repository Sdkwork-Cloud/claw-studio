#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import {
  normalizeDesktopArch,
  normalizeDesktopPlatform,
  resolveDesktopReleaseTarget,
} from './desktop-targets.mjs';
import {
  writeReleaseSmokeReport,
} from './release-smoke-contract.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');
const DEFAULT_RELEASE_ASSETS_DIR = path.join(rootDir, 'artifacts', 'release');
const RELEASE_ASSET_MANIFEST_FILENAME = 'release-asset-manifest.json';

function readOptionValue(argv, index, flag) {
  const next = argv[index + 1];
  const normalizedNext = String(next ?? '').trim();

  if (!normalizedNext || normalizedNext.startsWith('--')) {
    throw new Error(`Missing value for ${flag}.`);
  }

  return normalizedNext;
}

function commandExists(command, spawnSyncFn = spawnSync) {
  const result = spawnSyncFn(command, ['--version'], {
    encoding: 'utf8',
  });

  if (result.error) {
    return false;
  }

  return result.status === 0;
}

export function detectDeploymentSmokeCapabilities({
  family,
  commandExistsFn = commandExists,
} = {}) {
  const normalizedFamily = String(family ?? '').trim().toLowerCase();

  if (normalizedFamily === 'container') {
    return {
      docker: commandExistsFn('docker'),
    };
  }

  if (normalizedFamily === 'kubernetes') {
    return {
      helm: commandExistsFn('helm'),
      kubectl: commandExistsFn('kubectl'),
    };
  }

  throw new Error(`Unsupported deployment smoke family: ${family}`);
}

function resolveDeploymentReleaseAssetManifestPath({
  releaseAssetsDir = DEFAULT_RELEASE_ASSETS_DIR,
  family,
  platform,
  arch,
  accelerator = 'cpu',
} = {}) {
  return path.join(
    releaseAssetsDir,
    family,
    normalizeDesktopPlatform(platform),
    normalizeDesktopArch(arch),
    String(accelerator ?? '').trim().toLowerCase() || 'cpu',
    RELEASE_ASSET_MANIFEST_FILENAME,
  );
}

function readDeploymentReleaseAssetManifest({
  releaseAssetsDir = DEFAULT_RELEASE_ASSETS_DIR,
  family,
  platform,
  arch,
  accelerator = 'cpu',
} = {}) {
  const manifestPath = resolveDeploymentReleaseAssetManifestPath({
    releaseAssetsDir,
    family,
    platform,
    arch,
    accelerator,
  });

  if (!existsSync(manifestPath)) {
    throw new Error(`Missing ${family} release asset manifest: ${manifestPath}`);
  }

  return {
    manifestPath,
    manifest: JSON.parse(readFileSync(manifestPath, 'utf8')),
  };
}

export async function smokeDeploymentReleaseAssets({
  family,
  releaseAssetsDir = DEFAULT_RELEASE_ASSETS_DIR,
  platform = 'linux',
  arch = process.arch,
  target = '',
  accelerator = 'cpu',
  detectDeploymentSmokeCapabilitiesFn = detectDeploymentSmokeCapabilities,
} = {}) {
  const normalizedFamily = String(family ?? '').trim().toLowerCase();
  if (normalizedFamily !== 'container' && normalizedFamily !== 'kubernetes') {
    throw new Error(`Unsupported deployment smoke family: ${family}`);
  }

  const targetSpec = resolveDesktopReleaseTarget({
    targetTriple: target,
    platform,
    arch,
  });
  const releasePlatform = normalizeDesktopPlatform(targetSpec.platform);
  const releaseArch = normalizeDesktopArch(targetSpec.arch);
  const normalizedAccelerator = String(accelerator ?? '').trim().toLowerCase() || 'cpu';
  const { manifestPath, manifest } = readDeploymentReleaseAssetManifest({
    releaseAssetsDir,
    family: normalizedFamily,
    platform: releasePlatform,
    arch: releaseArch,
    accelerator: normalizedAccelerator,
  });
  const artifactRelativePaths = Array.isArray(manifest?.artifacts)
    ? manifest.artifacts
      .map((artifact) => String(artifact?.relativePath ?? '').trim())
      .filter(Boolean)
      .sort((left, right) => left.localeCompare(right))
    : [];
  const capabilities = detectDeploymentSmokeCapabilitiesFn({
    family: normalizedFamily,
  });
  const skippedReason = normalizedFamily === 'container'
    ? (capabilities.docker
      ? 'container live smoke is available on this host but is not yet wired into the local wrapper execution path'
      : 'docker is unavailable on this host')
    : ((capabilities.helm && capabilities.kubectl)
      ? 'kubernetes live smoke requires an attached cluster context and remains opt-in'
      : 'helm and/or kubectl are unavailable on this host');
  const report = writeReleaseSmokeReport({
    releaseAssetsDir,
    family: normalizedFamily,
    platform: releasePlatform,
    arch: releaseArch,
    accelerator: normalizedAccelerator,
    target: targetSpec.targetTriple,
    smokeKind: 'live-deployment',
    status: 'skipped',
    manifestPath,
    artifactRelativePaths,
    skippedReason,
    capabilities,
  });

  return {
    family: normalizedFamily,
    platform: releasePlatform,
    arch: releaseArch,
    target: targetSpec.targetTriple,
    accelerator: normalizedAccelerator,
    manifestPath,
    report,
  };
}

export function parseArgs(argv) {
  const options = {
    family: '',
    platform: 'linux',
    arch: process.arch,
    target: '',
    accelerator: 'cpu',
    releaseAssetsDir: DEFAULT_RELEASE_ASSETS_DIR,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === '--family') {
      options.family = readOptionValue(argv, index, '--family');
      index += 1;
      continue;
    }
    if (token === '--platform') {
      options.platform = readOptionValue(argv, index, '--platform');
      index += 1;
      continue;
    }
    if (token === '--arch') {
      options.arch = readOptionValue(argv, index, '--arch');
      index += 1;
      continue;
    }
    if (token === '--target') {
      options.target = readOptionValue(argv, index, '--target');
      index += 1;
      continue;
    }
    if (token === '--accelerator') {
      options.accelerator = readOptionValue(argv, index, '--accelerator');
      index += 1;
      continue;
    }
    if (token === '--release-assets-dir') {
      options.releaseAssetsDir = path.resolve(readOptionValue(argv, index, '--release-assets-dir'));
      index += 1;
    }
  }

  return options;
}

export async function main(argv = process.argv.slice(2)) {
  const result = await smokeDeploymentReleaseAssets(parseArgs(argv));
  console.log(
    `Recorded ${result.family} deployment smoke evidence for ${result.platform}-${result.arch}-${result.accelerator}.`,
  );
  return result;
}

if (path.resolve(process.argv[1] ?? '') === __filename) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
