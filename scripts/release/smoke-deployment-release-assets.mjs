#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import os from 'node:os';
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
import {
  fetchJson,
  probeEndpoint,
} from './smoke-server-release-assets.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');
const DEFAULT_RELEASE_ASSETS_DIR = path.join(rootDir, 'artifacts', 'release');
const RELEASE_ASSET_MANIFEST_FILENAME = 'release-asset-manifest.json';

function delay(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function readOptionValue(argv, index, flag) {
  const next = argv[index + 1];
  const normalizedNext = String(next ?? '').trim();

  if (!normalizedNext || normalizedNext.startsWith('--')) {
    throw new Error(`Missing value for ${flag}.`);
  }

  return normalizedNext;
}

function runCommand({
  command,
  args,
  cwd,
  env,
  input,
  label,
} = {}) {
  const result = spawnSync(command, args, {
    cwd,
    env,
    input,
    encoding: 'utf8',
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    const stderr = String(result.stderr ?? '').trim();
    const stdout = String(result.stdout ?? '').trim();
    throw new Error(
      `${label} failed with exit code ${result.status ?? 'unknown'}.${stderr ? `\n${stderr}` : ''}${stdout ? `\n${stdout}` : ''}`,
    );
  }

  return {
    stdout: String(result.stdout ?? ''),
    stderr: String(result.stderr ?? ''),
  };
}

function commandExists(command, args = ['--version']) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
  });

  if (result.error) {
    return false;
  }

  return result.status === 0;
}

export function detectDeploymentSmokeCapabilities({
  family,
} = {}) {
  const normalizedFamily = String(family ?? '').trim().toLowerCase();

  if (normalizedFamily === 'container') {
    return {
      docker: commandExists('docker', ['--version']),
      dockerCompose: commandExists('docker', ['compose', 'version']),
    };
  }

  if (normalizedFamily === 'kubernetes') {
    return {
      helm: commandExists('helm', ['version']),
      kubectl: commandExists('kubectl', ['version', '--client']),
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

function resolveDeploymentArchiveArtifact(manifest, manifestPath) {
  const archiveArtifacts = Array.isArray(manifest?.artifacts)
    ? manifest.artifacts.filter((artifact) => {
      const relativePath = String(artifact?.relativePath ?? '').trim().toLowerCase();
      return relativePath.endsWith('.tar.gz') || relativePath.endsWith('.zip');
    })
    : [];

  if (archiveArtifacts.length === 0) {
    throw new Error(`Missing deployment archive artifact in ${manifestPath}`);
  }

  return archiveArtifacts[0];
}

function resolveArtifactAbsolutePath(releaseAssetsDir, artifact) {
  const relativePath = String(artifact?.relativePath ?? '').trim();
  if (!relativePath) {
    throw new Error('Deployment release asset manifest contains an artifact without relativePath.');
  }

  const absolutePath = path.resolve(releaseAssetsDir, relativePath);
  if (!existsSync(absolutePath)) {
    throw new Error(`Missing deployment release artifact at ${absolutePath}`);
  }

  return absolutePath;
}

export async function extractDeploymentBundle({
  archivePath,
  extractDir,
} = {}) {
  const lowerCaseArchivePath = String(archivePath ?? '').trim().toLowerCase();

  if (lowerCaseArchivePath.endsWith('.zip')) {
    runCommand({
      command: 'tar',
      args: ['-xf', archivePath, '-C', extractDir],
      label: 'Extracting deployment zip archive',
    });
  } else {
    runCommand({
      command: 'tar',
      args: ['-xzf', archivePath, '-C', extractDir],
      label: 'Extracting deployment tar.gz archive',
    });
  }

  const bundleDirectories = readdirSync(extractDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory());
  if (bundleDirectories.length === 0) {
    throw new Error(`Unable to resolve extracted deployment bundle root from ${archivePath}`);
  }

  return path.join(extractDir, bundleDirectories[0].name);
}

function normalizeStringArray(values) {
  return Array.isArray(values)
    ? values
      .map((value) => String(value ?? '').trim())
      .filter(Boolean)
      .sort((left, right) => left.localeCompare(right))
    : [];
}

function resolveContainerComposeFilePaths(accelerator = 'cpu') {
  const composeFiles = ['deploy/docker-compose.yml'];
  const normalizedAccelerator = String(accelerator ?? '').trim().toLowerCase() || 'cpu';

  if (normalizedAccelerator === 'nvidia-cuda') {
    composeFiles.push('deploy/docker-compose.nvidia-cuda.yml');
  }
  if (normalizedAccelerator === 'amd-rocm') {
    composeFiles.push('deploy/docker-compose.amd-rocm.yml');
  }

  return composeFiles;
}

export function runDockerComposeUp({
  bundleRoot,
  accelerator = 'cpu',
  env,
} = {}) {
  const composeFiles = resolveContainerComposeFilePaths(accelerator);
  const args = ['compose'];
  for (const composeFile of composeFiles) {
    args.push('-f', composeFile);
  }
  args.push('up', '-d', '--build');

  runCommand({
    command: 'docker',
    args,
    cwd: bundleRoot,
    env,
    label: 'Starting packaged container deployment smoke',
  });
}

export function runDockerComposeDown({
  bundleRoot,
  accelerator = 'cpu',
  env,
} = {}) {
  const composeFiles = resolveContainerComposeFilePaths(accelerator);
  const args = ['compose'];
  for (const composeFile of composeFiles) {
    args.push('-f', composeFile);
  }
  args.push('down', '-v', '--remove-orphans');

  runCommand({
    command: 'docker',
    args,
    cwd: bundleRoot,
    env,
    label: 'Stopping packaged container deployment smoke',
  });
}

async function waitForSuccessfulEndpoint({
  id,
  baseUrl,
  requestPath,
  probeEndpointFn = probeEndpoint,
  timeoutMs = 30000,
  intervalMs = 500,
} = {}) {
  const startedAt = Date.now();
  let lastResponse = null;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      lastResponse = await probeEndpointFn({
        baseUrl,
        path: requestPath,
      });
      if (lastResponse?.statusCode === 200) {
        return {
          id,
          status: 'passed',
          detail: `${requestPath} returned 200`,
        };
      }
    } catch (error) {
      lastResponse = {
        statusCode: 0,
        body: error instanceof Error ? error.message : String(error),
      };
    }

    await delay(intervalMs);
  }

  throw new Error(
    `Deployment smoke timed out waiting for ${requestPath}. Last response: ${JSON.stringify(lastResponse)}`,
  );
}

async function readHostEndpointCheck({
  baseUrl,
  fetchJsonFn = fetchJson,
} = {}) {
  const response = await fetchJsonFn({
    baseUrl,
    path: '/claw/manage/v1/host-endpoints',
  });
  if (response?.statusCode !== 200) {
    throw new Error(
      `Deployment smoke expected /claw/manage/v1/host-endpoints to return 200, received ${response?.statusCode ?? 'unknown'}.`,
    );
  }
  if (!Array.isArray(response?.json)) {
    throw new Error('Deployment smoke expected /claw/manage/v1/host-endpoints to return a JSON array.');
  }

  return {
    id: 'host-endpoints',
    status: 'passed',
    detail: '/claw/manage/v1/host-endpoints returned canonical endpoints',
  };
}

export async function smokeContainerDeploymentBundle({
  bundleRoot,
  accelerator = 'cpu',
  capabilities = {},
  runDockerComposeUpFn = runDockerComposeUp,
  runDockerComposeDownFn = runDockerComposeDown,
  probeEndpointFn = probeEndpoint,
  fetchJsonFn = fetchJson,
} = {}) {
  const normalizedAccelerator = String(accelerator ?? '').trim().toLowerCase() || 'cpu';
  const baseUrl = 'http://127.0.0.1:18797';
  const env = {
    ...process.env,
    CLAW_SERVER_MANAGE_USERNAME: process.env.CLAW_SERVER_MANAGE_USERNAME || 'claw-admin',
    CLAW_SERVER_MANAGE_PASSWORD: process.env.CLAW_SERVER_MANAGE_PASSWORD || 'claw-smoke-password',
  };
  let started = false;

  try {
    runDockerComposeUpFn({
      bundleRoot,
      accelerator: normalizedAccelerator,
      env,
      capabilities,
    });
    started = true;

    const checks = [
      {
        id: 'docker-compose-up',
        status: 'passed',
        detail: 'docker compose brought the packaged bundle online',
      },
    ];
    checks.push(await waitForSuccessfulEndpoint({
      id: 'health-ready',
      baseUrl,
      requestPath: '/claw/health/ready',
      probeEndpointFn,
    }));
    checks.push(await readHostEndpointCheck({
      baseUrl,
      fetchJsonFn,
    }));
    checks.push(await waitForSuccessfulEndpoint({
      id: 'browser-shell',
      baseUrl,
      requestPath: '/',
      probeEndpointFn,
    }));

    return {
      launcherRelativePath: 'deploy/docker-compose.yml',
      runtimeBaseUrl: baseUrl,
      checks,
    };
  } finally {
    if (started) {
      try {
        runDockerComposeDownFn({
          bundleRoot,
          accelerator: normalizedAccelerator,
          env,
          capabilities,
        });
      } catch {
        // Preserve the original failure while still attempting teardown.
      }
    }
  }
}

function resolveKubernetesOverlayValuesPath(accelerator = 'cpu') {
  const normalizedAccelerator = String(accelerator ?? '').trim().toLowerCase() || 'cpu';

  if (normalizedAccelerator === 'nvidia-cuda') {
    return 'chart/values-nvidia-cuda.yaml';
  }
  if (normalizedAccelerator === 'amd-rocm') {
    return 'chart/values-amd-rocm.yaml';
  }

  return '';
}

function readDeploymentBundleReleaseMetadata(bundleRoot) {
  const metadataPath = path.join(bundleRoot, 'release-metadata.json');
  if (!existsSync(metadataPath)) {
    return {};
  }

  return JSON.parse(readFileSync(metadataPath, 'utf8'));
}

export function runHelmTemplate({
  bundleRoot,
  accelerator = 'cpu',
} = {}) {
  const args = [
    'template',
    'claw-studio',
    './chart',
    '-f',
    'values.release.yaml',
    '--set',
    'auth.manageUsername=claw-admin',
    '--set',
    'auth.managePassword=claw-smoke-password',
  ];
  const overlayValuesPath = resolveKubernetesOverlayValuesPath(accelerator);

  if (overlayValuesPath) {
    args.splice(4, 0, '-f', overlayValuesPath);
  }

  return runCommand({
    command: 'helm',
    args,
    cwd: bundleRoot,
    label: 'Rendering packaged kubernetes chart smoke',
  }).stdout;
}

export function runKubectlClientDryRun({
  renderedManifest,
} = {}) {
  runCommand({
    command: 'kubectl',
    args: ['apply', '--dry-run=client', '--validate=false', '-f', '-'],
    input: renderedManifest,
    label: 'Client-side kubernetes dry-run smoke',
  });
}

export async function smokeKubernetesDeploymentBundle({
  bundleRoot,
  accelerator = 'cpu',
  capabilities = {},
  runHelmTemplateFn = runHelmTemplate,
  runKubectlClientDryRunFn = runKubectlClientDryRun,
} = {}) {
  const releaseMetadata = readDeploymentBundleReleaseMetadata(bundleRoot);
  const renderedManifest = runHelmTemplateFn({
    bundleRoot,
    accelerator,
    capabilities,
  });
  const checks = [
    {
      id: 'helm-template',
      status: 'passed',
      detail: 'helm template rendered the packaged chart successfully',
    },
  ];

  if (!renderedManifest.includes('/claw/health/ready')) {
    throw new Error('Rendered kubernetes manifests must probe /claw/health/ready.');
  }
  checks.push({
    id: 'readiness-probe',
    status: 'passed',
    detail: 'rendered deployment probes /claw/health/ready',
  });

  const normalizedImageRepository = String(releaseMetadata?.imageRepository ?? '').trim();
  const normalizedImageTag = String(releaseMetadata?.imageTag ?? '').trim();
  const normalizedImageDigest = String(releaseMetadata?.imageDigest ?? '').trim();
  const expectedImageReference = normalizedImageDigest
    ? `${normalizedImageRepository}@${normalizedImageDigest}`
    : `${normalizedImageRepository}:${normalizedImageTag}`;
  if (expectedImageReference.trim().length > 0 && !renderedManifest.includes(expectedImageReference)) {
    throw new Error(`Rendered kubernetes manifests must reference ${expectedImageReference}.`);
  }
  checks.push({
    id: 'image-reference',
    status: 'passed',
    detail: 'rendered manifests reference the packaged OCI image coordinates',
  });

  if (capabilities.kubectl) {
    runKubectlClientDryRunFn({
      bundleRoot,
      accelerator,
      capabilities,
      renderedManifest,
    });
    checks.push({
      id: 'kubectl-client-dry-run',
      status: 'passed',
      detail: 'kubectl client-side dry-run accepted the rendered manifests',
    });
  }

  return {
    launcherRelativePath: 'chart/Chart.yaml',
    checks,
  };
}

function buildSkippedReason(family, capabilities) {
  if (family === 'container') {
    return (capabilities.docker && capabilities.dockerCompose)
      ? 'container deployment smoke did not run'
      : 'docker and/or docker compose are unavailable on this host';
  }

  return capabilities.helm
    ? 'kubernetes chart smoke did not run'
    : 'helm is unavailable on this host';
}

function buildFailedSmokeCheck(error) {
  return [
    {
      id: 'smoke-error',
      status: 'failed',
      detail: error instanceof Error ? error.message : String(error),
    },
  ];
}

export async function smokeDeploymentReleaseAssets({
  family,
  releaseAssetsDir = DEFAULT_RELEASE_ASSETS_DIR,
  platform = 'linux',
  arch = process.arch,
  target = '',
  accelerator = 'cpu',
  detectDeploymentSmokeCapabilitiesFn = detectDeploymentSmokeCapabilities,
  extractDeploymentBundleFn = extractDeploymentBundle,
  smokeContainerDeploymentBundleFn = smokeContainerDeploymentBundle,
  smokeKubernetesDeploymentBundleFn = smokeKubernetesDeploymentBundle,
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
  const artifactRelativePaths = normalizeStringArray(
    Array.isArray(manifest?.artifacts)
      ? manifest.artifacts.map((artifact) => artifact?.relativePath)
      : [],
  );
  const capabilities = detectDeploymentSmokeCapabilitiesFn({
    family: normalizedFamily,
  });

  const shouldSkip = normalizedFamily === 'container'
    ? (!capabilities.docker || !capabilities.dockerCompose)
    : !capabilities.helm;
  if (shouldSkip) {
    const report = writeReleaseSmokeReport({
      releaseAssetsDir,
      family: normalizedFamily,
      platform: releasePlatform,
      arch: releaseArch,
      accelerator: normalizedAccelerator,
      target: targetSpec.targetTriple,
      smokeKind: normalizedFamily === 'container' ? 'live-deployment' : 'chart-render',
      status: 'skipped',
      manifestPath,
      artifactRelativePaths,
      skippedReason: buildSkippedReason(normalizedFamily, capabilities),
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

  const archiveArtifact = resolveDeploymentArchiveArtifact(manifest, manifestPath);
  const archivePath = resolveArtifactAbsolutePath(releaseAssetsDir, archiveArtifact);
  const extractDir = mkdtempSync(path.join(
    os.tmpdir(),
    normalizedFamily === 'container'
      ? 'claw-deployment-smoke-container-'
      : 'claw-deployment-smoke-kubernetes-',
  ));

  try {
    const bundleRoot = await extractDeploymentBundleFn({
      archivePath,
      extractDir,
      family: normalizedFamily,
    });
    const smokeResult = normalizedFamily === 'container'
      ? await smokeContainerDeploymentBundleFn({
        bundleRoot,
        accelerator: normalizedAccelerator,
        capabilities,
      })
      : await smokeKubernetesDeploymentBundleFn({
        bundleRoot,
        accelerator: normalizedAccelerator,
        capabilities,
      });
    const report = writeReleaseSmokeReport({
      releaseAssetsDir,
      family: normalizedFamily,
      platform: releasePlatform,
      arch: releaseArch,
      accelerator: normalizedAccelerator,
      target: targetSpec.targetTriple,
      smokeKind: normalizedFamily === 'container' ? 'live-deployment' : 'chart-render',
      status: 'passed',
      manifestPath,
      artifactRelativePaths,
      launcherRelativePath: String(smokeResult?.launcherRelativePath ?? '').trim(),
      runtimeBaseUrl: String(smokeResult?.runtimeBaseUrl ?? '').trim(),
      checks: smokeResult?.checks ?? [],
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
  } catch (error) {
    writeReleaseSmokeReport({
      releaseAssetsDir,
      family: normalizedFamily,
      platform: releasePlatform,
      arch: releaseArch,
      accelerator: normalizedAccelerator,
      target: targetSpec.targetTriple,
      smokeKind: normalizedFamily === 'container' ? 'live-deployment' : 'chart-render',
      status: 'failed',
      manifestPath,
      artifactRelativePaths,
      checks: buildFailedSmokeCheck(error),
      capabilities,
    });
    throw error;
  } finally {
    rmSync(extractDir, { recursive: true, force: true });
  }
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
