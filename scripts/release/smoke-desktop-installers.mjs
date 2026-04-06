#!/usr/bin/env node

import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import {
  createInstallPlan,
  detectFormat,
} from '../../packages/sdkwork-claw-desktop/src-tauri/vendor/hub-installer/dist/index.mjs';
import {
  resolveOpenClawTarget,
} from '../prepare-openclaw-runtime.mjs';
import {
  verifyDesktopOpenClawReleaseAssets,
} from '../verify-desktop-openclaw-release-assets.mjs';
import {
  normalizeDesktopArch,
  normalizeDesktopPlatform,
  resolveDesktopReleaseTarget,
} from './desktop-targets.mjs';
import {
  normalizeDesktopInstallReadyLayout,
} from './desktop-install-ready-layout.mjs';
import {
  normalizeDesktopOpenClawInstallerContract,
  readDesktopOpenClawInstallerContract,
} from './desktop-openclaw-installer-contract.mjs';
import {
  DESKTOP_INSTALLER_SMOKE_REPORT_FILENAME,
  resolveDesktopInstallerSmokeReportPath,
  resolveInstallableArtifactRelativePaths,
} from './desktop-installer-smoke-contract.mjs';
export {
  DESKTOP_INSTALLER_SMOKE_REPORT_FILENAME,
  resolveDesktopInstallerSmokeReportPath,
  resolveInstallableArtifactRelativePaths,
} from './desktop-installer-smoke-contract.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');
const DEFAULT_RELEASE_ASSETS_DIR = path.join(rootDir, 'artifacts', 'release');
const RELEASE_ASSET_MANIFEST_FILENAME = 'release-asset-manifest.json';

const MACOS_COMPANION_ARCHIVE_SUFFIXES = ['.app.zip', '.app.tar.gz'];

function readOptionValue(argv, index, flag) {
  const next = argv[index + 1];
  const normalizedNext = String(next ?? '').trim();

  if (!normalizedNext || normalizedNext.startsWith('--')) {
    throw new Error(`Missing value for ${flag}.`);
  }

  return normalizedNext;
}

function endsWithAny(value, suffixes) {
  const normalizedValue = String(value ?? '').trim().toLowerCase();
  return suffixes.some((suffix) => normalizedValue.endsWith(suffix));
}

export function resolveDesktopReleaseAssetManifestPath({
  releaseAssetsDir = DEFAULT_RELEASE_ASSETS_DIR,
  platform,
  arch,
} = {}) {
  const platformId = normalizeDesktopPlatform(platform);
  const archId = normalizeDesktopArch(arch);

  return path.join(
    releaseAssetsDir,
    'desktop',
    platformId,
    archId,
    RELEASE_ASSET_MANIFEST_FILENAME,
  );
}

export function readDesktopReleaseAssetManifest({
  releaseAssetsDir = DEFAULT_RELEASE_ASSETS_DIR,
  platform,
  arch,
} = {}) {
  const manifestPath = resolveDesktopReleaseAssetManifestPath({
    releaseAssetsDir,
    platform,
    arch,
  });

  if (!existsSync(manifestPath)) {
    throw new Error(`Missing desktop release asset manifest: ${manifestPath}`);
  }

  try {
    return {
      manifestPath,
      manifest: JSON.parse(readFileSync(manifestPath, 'utf8')),
    };
  } catch (error) {
    throw new Error(
      `Unable to read desktop release asset manifest at ${manifestPath}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function assertDesktopManifestMatchesTarget({
  manifest,
  manifestPath,
  platform,
  arch,
}) {
  if (!manifest || typeof manifest !== 'object') {
    throw new Error(`Desktop release asset manifest must be a JSON object: ${manifestPath}`);
  }
  if (!Array.isArray(manifest.artifacts)) {
    throw new Error(`Desktop release asset manifest is missing artifacts[]: ${manifestPath}`);
  }
  if (String(manifest.platform ?? '').trim() !== platform) {
    throw new Error(
      `Desktop release asset manifest platform mismatch at ${manifestPath}: expected ${platform}, received ${manifest.platform ?? 'unknown'}`,
    );
  }
  if (String(manifest.arch ?? '').trim() !== arch) {
    throw new Error(
      `Desktop release asset manifest architecture mismatch at ${manifestPath}: expected ${arch}, received ${manifest.arch ?? 'unknown'}`,
    );
  }
}

function resolveArtifactAbsolutePath(releaseAssetsDir, artifact) {
  const relativePath = String(artifact?.relativePath ?? '').trim();
  if (!relativePath) {
    throw new Error('Desktop release asset manifest contains an artifact without relativePath.');
  }

  const absolutePath = path.resolve(releaseAssetsDir, relativePath);
  if (!existsSync(absolutePath)) {
    throw new Error(`Missing desktop release artifact at ${absolutePath}`);
  }

  return absolutePath;
}

function resolveInstallableArtifacts(manifest, releasePlatform) {
  const installableArtifactRelativePaths = new Set(
    resolveInstallableArtifactRelativePaths(manifest, releasePlatform),
  );

  return manifest.artifacts.filter((artifact) => installableArtifactRelativePaths.has(
    String(artifact?.relativePath ?? '').trim(),
  ));
}

function resolveMacosCompanionArtifacts(manifest) {
  return manifest.artifacts.filter((artifact) =>
    endsWithAny(
      String(artifact?.relativePath ?? ''),
      MACOS_COMPANION_ARCHIVE_SUFFIXES,
    ));
}

function resolveExpectedInstallReadyLayoutMode(releasePlatform) {
  return releasePlatform === 'macos'
    ? 'staged-layout'
    : 'simulated-prewarm';
}

export function resolveHubInstallerPlatform(releasePlatform) {
  if (releasePlatform === 'linux') {
    return 'ubuntu';
  }

  if (releasePlatform === 'windows' || releasePlatform === 'macos') {
    return releasePlatform;
  }

  throw new Error(`Unsupported desktop smoke platform: ${releasePlatform}`);
}

export function writeDesktopInstallerSmokeReport({
  releaseAssetsDir = DEFAULT_RELEASE_ASSETS_DIR,
  platform,
  arch,
  target = '',
  manifestPath = '',
  installPlans = [],
  requiredCompanionArtifacts = [],
  openClawInstallerContract,
  installReadyLayout = null,
} = {}) {
  const reportPath = resolveDesktopInstallerSmokeReportPath({
    releaseAssetsDir,
    platform,
    arch,
  });
  mkdirSync(path.dirname(reportPath), { recursive: true });

  const report = {
    platform: normalizeDesktopPlatform(platform),
    arch: normalizeDesktopArch(arch),
    target: String(target ?? '').trim(),
    manifestPath: path.resolve(manifestPath),
    verifiedAt: new Date().toISOString(),
    installableArtifactRelativePaths: installPlans
      .map((entry) => String(entry?.artifact?.relativePath ?? '').trim())
      .filter(Boolean)
      .sort((left, right) => left.localeCompare(right)),
    requiredCompanionArtifactRelativePaths: requiredCompanionArtifacts
      .map((artifact) => String(artifact?.relativePath ?? '').trim())
      .filter(Boolean)
      .sort((left, right) => left.localeCompare(right)),
    ...(normalizeDesktopInstallReadyLayout(installReadyLayout)
      ? { installReadyLayout: normalizeDesktopInstallReadyLayout(installReadyLayout) }
      : {}),
    openClawInstallerContract,
    installPlanSummaries: installPlans.map((entry) => ({
      relativePath: String(entry?.artifact?.relativePath ?? '').trim(),
      format: String(entry?.plan?.request?.format ?? '').trim(),
      platform: String(entry?.plan?.request?.platform ?? '').trim(),
      stepCount: Array.isArray(entry?.plan?.steps) ? entry.plan.steps.length : 0,
    })),
  };

  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return {
    reportPath,
    report,
  };
}

export async function smokeDesktopInstallers({
  workspaceRootDir = rootDir,
  releaseAssetsDir = DEFAULT_RELEASE_ASSETS_DIR,
  platform = process.platform,
  arch = process.arch,
  target = '',
  verifyDesktopOpenClawReleaseAssetsFn = verifyDesktopOpenClawReleaseAssets,
  readDesktopOpenClawInstallerContractFn = readDesktopOpenClawInstallerContract,
  createInstallPlanFn = createInstallPlan,
  detectFormatFn = detectFormat,
} = {}) {
  const targetSpec = resolveDesktopReleaseTarget({
    targetTriple: target,
    platform,
    arch,
  });
  const releasePlatform = normalizeDesktopPlatform(targetSpec.platform);
  const releaseArch = normalizeDesktopArch(targetSpec.arch);
  const { manifestPath, manifest } = readDesktopReleaseAssetManifest({
    releaseAssetsDir,
    platform: releasePlatform,
    arch: releaseArch,
  });

  assertDesktopManifestMatchesTarget({
    manifest,
    manifestPath,
    platform: releasePlatform,
    arch: releaseArch,
  });
  const openClawInstallerContract = normalizeDesktopOpenClawInstallerContract(
    await readDesktopOpenClawInstallerContractFn({
      workspaceRootDir,
      platform: releasePlatform,
    }),
  );
  assert.deepEqual(
    normalizeDesktopOpenClawInstallerContract(manifest.openClawInstallerContract),
    openClawInstallerContract,
    `Desktop release asset manifest OpenClaw installer contract at ${manifestPath} must match the current installer contract for ${releasePlatform}.`,
  );

  const openclawTarget = resolveOpenClawTarget(releasePlatform, releaseArch);
  const verificationResult = await verifyDesktopOpenClawReleaseAssetsFn({
    workspaceRootDir,
    target: openclawTarget,
  });
  const installReadyLayout = normalizeDesktopInstallReadyLayout(
    verificationResult?.installReadyLayout,
  );
  if (!installReadyLayout) {
    throw new Error(
      `Desktop OpenClaw verification must prove an install-ready layout for ${releasePlatform}-${releaseArch}. Missing installReadyLayout evidence.`,
    );
  }
  const expectedInstallReadyLayoutMode = resolveExpectedInstallReadyLayoutMode(releasePlatform);
  if (installReadyLayout.mode !== expectedInstallReadyLayoutMode) {
    throw new Error(
      `Desktop OpenClaw verification installReadyLayout.mode mismatch for ${releasePlatform}-${releaseArch}: expected ${expectedInstallReadyLayoutMode}, received ${installReadyLayout.mode}.`,
    );
  }

  const installableArtifacts = resolveInstallableArtifacts(manifest, releasePlatform);
  if (installableArtifacts.length === 0) {
    throw new Error(
      `Missing installable desktop artifacts for ${releasePlatform}-${releaseArch} in ${manifestPath}`,
    );
  }

  const requiredCompanionArtifacts =
    releasePlatform === 'macos'
      ? resolveMacosCompanionArtifacts(manifest)
      : [];
  if (releasePlatform === 'macos' && requiredCompanionArtifacts.length === 0) {
    throw new Error(
      `Missing macOS desktop app archive companion in ${manifestPath}. Expected one of: ${MACOS_COMPANION_ARCHIVE_SUFFIXES.join(', ')}`,
    );
  }

  const installerPlatform = resolveHubInstallerPlatform(releasePlatform);
  const installPlans = [];

  for (const artifact of installableArtifacts) {
    const absolutePath = resolveArtifactAbsolutePath(releaseAssetsDir, artifact);
    const format = detectFormatFn(absolutePath);
    const plan = await createInstallPlanFn({
      source: absolutePath,
      platform: installerPlatform,
      format,
      dryRun: true,
    });

    installPlans.push({
      artifact,
      absolutePath,
      plan,
    });
  }

  for (const artifact of requiredCompanionArtifacts) {
    resolveArtifactAbsolutePath(releaseAssetsDir, artifact);
  }

  const smokeReport = writeDesktopInstallerSmokeReport({
    releaseAssetsDir,
    platform: releasePlatform,
    arch: releaseArch,
    target: targetSpec.targetTriple,
    manifestPath,
    installPlans,
    requiredCompanionArtifacts,
    openClawInstallerContract,
    installReadyLayout,
  });

  return {
    platform: releasePlatform,
    arch: releaseArch,
    target: targetSpec.targetTriple,
    manifestPath,
    manifest,
    verificationResult,
    installPlans,
    requiredCompanionArtifacts,
    smokeReportPath: smokeReport.reportPath,
  };
}

export function parseArgs(argv) {
  const options = {
    platform: process.platform,
    arch: process.arch,
    target: '',
    releaseAssetsDir: DEFAULT_RELEASE_ASSETS_DIR,
    workspaceRootDir: rootDir,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

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

    if (token === '--release-assets-dir') {
      options.releaseAssetsDir = path.resolve(readOptionValue(argv, index, '--release-assets-dir'));
      index += 1;
      continue;
    }

    if (token === '--workspace-root-dir') {
      options.workspaceRootDir = path.resolve(readOptionValue(argv, index, '--workspace-root-dir'));
      index += 1;
    }
  }

  return options;
}

export async function main(argv = process.argv.slice(2)) {
  const result = await smokeDesktopInstallers(parseArgs(argv));
  console.log(
    `Smoke-verified desktop installers for ${result.platform}-${result.arch} using ${result.installPlans.length} install plan(s).`,
  );
  return result;
}

if (path.resolve(process.argv[1] ?? '') === __filename) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
