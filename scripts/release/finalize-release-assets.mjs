#!/usr/bin/env node

import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import {
  DEFAULT_RELEASE_PROFILE_ID,
  resolveReleaseProfile,
} from './release-profiles.mjs';
import {
  DESKTOP_INSTALLER_SMOKE_REPORT_FILENAME,
  resolveInstallableArtifactRelativePaths,
} from './smoke-desktop-installers.mjs';
import {
  RELEASE_SMOKE_REPORT_FILENAME,
  normalizeReleaseSmokeChecks,
  readReleaseSmokeReport,
} from './release-smoke-contract.mjs';
import {
  assertDesktopOpenClawInstallerContract,
  normalizeDesktopOpenClawInstallerContract,
} from './desktop-openclaw-installer-contract.mjs';
import {
  normalizeDesktopInstallReadyLayout as normalizeInstallReadyLayout,
} from './desktop-install-ready-layout.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');
const supportedDesktopPlatforms = new Set(['windows', 'linux', 'macos']);
const supportedServerPlatforms = new Set(['windows', 'linux', 'macos']);
const supportedDeploymentPlatforms = new Set(['linux']);
const supportedArchIds = new Set(['x64', 'arm64']);
const supportedAccelerators = new Set(['cpu', 'nvidia-cuda', 'amd-rocm']);

function readOptionValue(argv, index, flag) {
  const next = argv[index + 1];
  const normalizedNext = String(next ?? '').trim();

  if (!normalizedNext || normalizedNext.startsWith('--')) {
    throw new Error(`Missing value for ${flag}.`);
  }

  return normalizedNext;
}

function listFilesRecursively(sourceDir, relativePrefix = '') {
  const entries = readdirSync(sourceDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const relativePath = path.join(relativePrefix, entry.name);
    const absolutePath = path.join(sourceDir, entry.name);

    if (entry.isDirectory()) {
      files.push(...listFilesRecursively(absolutePath, relativePath));
      continue;
    }

    if (entry.isFile()) {
      files.push({
        absolutePath,
        relativePath: relativePath.replaceAll('\\', '/'),
      });
    }
  }

  return files;
}

function computeSha256(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

export function parseArgs(argv) {
  const options = {
    profileId: DEFAULT_RELEASE_PROFILE_ID,
    releaseTag: '',
    repository: '',
    releaseAssetsDir: path.resolve('release-assets'),
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === '--profile') {
      options.profileId = readOptionValue(argv, index, '--profile');
      index += 1;
      continue;
    }

    if (token === '--release-tag') {
      options.releaseTag = readOptionValue(argv, index, '--release-tag');
      index += 1;
      continue;
    }

    if (token === '--repository') {
      options.repository = readOptionValue(argv, index, '--repository');
      index += 1;
      continue;
    }

    if (token === '--release-assets-dir') {
      options.releaseAssetsDir = path.resolve(
        readOptionValue(argv, index, '--release-assets-dir'),
      );
      index += 1;
    }
  }

  return options;
}

function readPartialManifest(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function normalizeStringArray(values) {
  return Array.isArray(values)
    ? values
      .map((value) => String(value ?? '').trim())
      .filter(Boolean)
      .sort((left, right) => left.localeCompare(right))
    : [];
}

function normalizeInstallPlanSummaries(values) {
  return Array.isArray(values)
    ? values
      .map((value) => ({
        relativePath: String(value?.relativePath ?? '').trim(),
        format: String(value?.format ?? '').trim(),
        platform: String(value?.platform ?? '').trim(),
        stepCount: Number.isFinite(value?.stepCount) ? value.stepCount : 0,
      }))
      .filter((value) => value.relativePath.length > 0)
      .sort((left, right) => left.relativePath.localeCompare(right.relativePath))
    : [];
}

function resolveExpectedInstallReadyLayoutModeFromInstallerContract(installerContract) {
  const installMode = String(installerContract?.installMode ?? '').trim();
  if (installMode === 'preexpanded-managed-layout') {
    return 'staged-layout';
  }
  if (installMode === 'postinstall-prewarm') {
    return 'simulated-prewarm';
  }
  return '';
}

function buildDesktopInstallerSmokeMetadata({
  releaseAssetsDir,
  manifestPath,
  smokeReportPath,
  smokeReport,
}) {
  return {
    reportRelativePath: path.relative(releaseAssetsDir, smokeReportPath).replaceAll('\\', '/'),
    manifestRelativePath: path.relative(releaseAssetsDir, manifestPath).replaceAll('\\', '/'),
    verifiedAt: String(smokeReport?.verifiedAt ?? '').trim(),
    target: String(smokeReport?.target ?? '').trim(),
    installableArtifactRelativePaths: normalizeStringArray(
      smokeReport?.installableArtifactRelativePaths,
    ),
    requiredCompanionArtifactRelativePaths: normalizeStringArray(
      smokeReport?.requiredCompanionArtifactRelativePaths,
    ),
    ...(normalizeInstallReadyLayout(smokeReport?.installReadyLayout)
      ? { installReadyLayout: normalizeInstallReadyLayout(smokeReport?.installReadyLayout) }
      : {}),
    installPlanSummaries: normalizeInstallPlanSummaries(smokeReport?.installPlanSummaries),
  };
}

function normalizeServerBundleSmokeMetadataChecks(values) {
  return Array.isArray(values)
    ? values
      .map((value) => ({
        id: String(value?.id ?? '').trim(),
        status: String(value?.status ?? '').trim().toLowerCase(),
        detail: String(value?.detail ?? '').trim(),
      }))
      .filter((value) => value.id.length > 0)
    : [];
}

function buildServerBundleSmokeMetadata({
  releaseAssetsDir,
  manifestPath,
  smokeReportPath,
  smokeReport,
}) {
  return {
    reportRelativePath: path.relative(releaseAssetsDir, smokeReportPath).replaceAll('\\', '/'),
    manifestRelativePath: path.relative(releaseAssetsDir, manifestPath).replaceAll('\\', '/'),
    verifiedAt: String(smokeReport?.verifiedAt ?? '').trim(),
    target: String(smokeReport?.target ?? '').trim(),
    smokeKind: String(smokeReport?.smokeKind ?? '').trim(),
    status: String(smokeReport?.status ?? '').trim(),
    launcherRelativePath: String(smokeReport?.launcherRelativePath ?? '').trim(),
    runtimeBaseUrl: String(smokeReport?.runtimeBaseUrl ?? '').trim(),
    artifactRelativePaths: normalizeStringArray(smokeReport?.artifactRelativePaths),
    checks: normalizeServerBundleSmokeMetadataChecks(smokeReport?.checks),
  };
}

function listPartialManifestRecords(releaseAssetsDir, partialManifestFileName) {
  return listFilesRecursively(releaseAssetsDir)
    .filter((file) => (
      file.relativePath.endsWith(`/${partialManifestFileName}`)
      || file.relativePath === partialManifestFileName
    ))
    .map((file) => ({
      file,
      manifest: readPartialManifest(file.absolutePath),
    }));
}

function requireDesktopInstallerSmokeReports({
  workspaceRootDir,
  releaseAssetsDir,
  partialManifestFileName,
  releaseTag = '',
} = {}) {
  const desktopInstallerMetadataByManifestPath = new Map();
  const normalizedReleaseTag = String(releaseTag ?? '').trim();
  const partialManifestRecords = listPartialManifestRecords(
    releaseAssetsDir,
    partialManifestFileName,
  );
  const hasTaggedManifest = normalizedReleaseTag.length > 0
    && partialManifestRecords.some((record) => String(record.manifest?.releaseTag ?? '').trim().length > 0);

  for (const record of partialManifestRecords) {
    const manifest = record.manifest;
    const manifestReleaseTag = String(manifest?.releaseTag ?? '').trim();
    if (hasTaggedManifest && manifestReleaseTag !== normalizedReleaseTag) {
      continue;
    }

    const manifestDir = path.dirname(record.file.absolutePath);
    const relativeManifestDir = path.relative(releaseAssetsDir, manifestDir).replaceAll('\\', '/');
    const [family] = relativeManifestDir.split('/');
    if (family !== 'desktop') {
      continue;
    }

    const expectedPlatform = String(manifest?.platform ?? '').trim();
    const expectedArch = String(manifest?.arch ?? '').trim();
    const smokeReportPath = path.join(
      manifestDir,
      DESKTOP_INSTALLER_SMOKE_REPORT_FILENAME,
    );
    const expectedInstallerContract = assertDesktopOpenClawInstallerContract({
      actualContract: manifest?.openClawInstallerContract,
      workspaceRootDir,
      platform: expectedPlatform,
      contextLabel: `Desktop release asset manifest OpenClaw installer contract at ${record.file.absolutePath}`,
    });

    if (!existsSync(smokeReportPath)) {
      throw new Error(`Missing desktop installer smoke report: ${smokeReportPath}`);
    }

    const smokeReport = JSON.parse(readFileSync(smokeReportPath, 'utf8'));
    if (String(smokeReport?.platform ?? '').trim() !== expectedPlatform) {
      throw new Error(
        `Desktop installer smoke report platform mismatch at ${smokeReportPath}: expected ${expectedPlatform}, received ${smokeReport?.platform ?? 'unknown'}`,
      );
    }
    if (String(smokeReport?.arch ?? '').trim() !== expectedArch) {
      throw new Error(
        `Desktop installer smoke report architecture mismatch at ${smokeReportPath}: expected ${expectedArch}, received ${smokeReport?.arch ?? 'unknown'}`,
      );
    }

    const expectedInstallableArtifactRelativePaths = resolveInstallableArtifactRelativePaths(
      manifest,
      expectedPlatform,
    );
    const reportedInstallableArtifactRelativePaths = normalizeStringArray(
      smokeReport?.installableArtifactRelativePaths,
    );

    if (
      expectedInstallableArtifactRelativePaths.length !== reportedInstallableArtifactRelativePaths.length
      || expectedInstallableArtifactRelativePaths.some(
        (relativePath, index) => relativePath !== reportedInstallableArtifactRelativePaths[index],
      )
    ) {
      throw new Error(
        `Desktop installer smoke report does not match the current installable artifact set: ${smokeReportPath}`,
      );
    }

    if (
      JSON.stringify(normalizeDesktopOpenClawInstallerContract(smokeReport?.openClawInstallerContract))
      !== JSON.stringify(expectedInstallerContract)
    ) {
      throw new Error(
        `Desktop installer smoke report OpenClaw installer contract mismatch at ${smokeReportPath}`,
      );
    }
    const installReadyLayout = normalizeInstallReadyLayout(smokeReport?.installReadyLayout);
    if (!installReadyLayout) {
      throw new Error(
        `Desktop installer smoke report is missing install-ready layout evidence at ${smokeReportPath}`,
      );
    }
    const expectedInstallReadyLayoutMode = resolveExpectedInstallReadyLayoutModeFromInstallerContract(
      expectedInstallerContract,
    );
    if (
      expectedInstallReadyLayoutMode
      && installReadyLayout.mode !== expectedInstallReadyLayoutMode
    ) {
      throw new Error(
        `Desktop installer smoke report installReadyLayout.mode mismatch at ${smokeReportPath}: expected ${expectedInstallReadyLayoutMode}, received ${installReadyLayout.mode}`,
      );
    }

    desktopInstallerMetadataByManifestPath.set(
      record.file.absolutePath,
      {
        openClawInstallerContract: expectedInstallerContract,
        desktopInstallerSmoke: buildDesktopInstallerSmokeMetadata({
          releaseAssetsDir,
          manifestPath: record.file.absolutePath,
          smokeReportPath,
          smokeReport,
        }),
      },
    );
  }

  return desktopInstallerMetadataByManifestPath;
}

function requireServerBundleSmokeReports({
  releaseAssetsDir,
  partialManifestFileName,
  releaseTag = '',
} = {}) {
  const serverBundleSmokeMetadataByManifestPath = new Map();
  const normalizedReleaseTag = String(releaseTag ?? '').trim();
  const partialManifestRecords = listPartialManifestRecords(
    releaseAssetsDir,
    partialManifestFileName,
  );
  const hasTaggedManifest = normalizedReleaseTag.length > 0
    && partialManifestRecords.some((record) => String(record.manifest?.releaseTag ?? '').trim().length > 0);

  for (const record of partialManifestRecords) {
    const manifest = record.manifest;
    const manifestReleaseTag = String(manifest?.releaseTag ?? '').trim();
    if (hasTaggedManifest && manifestReleaseTag !== normalizedReleaseTag) {
      continue;
    }

    const manifestDir = path.dirname(record.file.absolutePath);
    const relativeManifestDir = path.relative(releaseAssetsDir, manifestDir).replaceAll('\\', '/');
    const [family] = relativeManifestDir.split('/');
    if (family !== 'server') {
      continue;
    }

    const expectedPlatform = String(manifest?.platform ?? '').trim();
    const expectedArch = String(manifest?.arch ?? '').trim();
    const expectedArtifactRelativePaths = normalizeStringArray(
      Array.isArray(manifest?.artifacts)
        ? manifest.artifacts.map((artifact) => artifact?.relativePath)
        : [],
    );
    const smokeReportPath = path.join(
      manifestDir,
      RELEASE_SMOKE_REPORT_FILENAME,
    );

    if (!existsSync(smokeReportPath)) {
      throw new Error(`Missing server bundle smoke report: ${smokeReportPath}`);
    }

    const smokeReport = readReleaseSmokeReport(smokeReportPath);
    if (String(smokeReport?.family ?? '').trim() !== 'server') {
      throw new Error(
        `Server bundle smoke report family mismatch at ${smokeReportPath}: expected server, received ${smokeReport?.family ?? 'unknown'}`,
      );
    }
    if (String(smokeReport?.platform ?? '').trim() !== expectedPlatform) {
      throw new Error(
        `Server bundle smoke report platform mismatch at ${smokeReportPath}: expected ${expectedPlatform}, received ${smokeReport?.platform ?? 'unknown'}`,
      );
    }
    if (String(smokeReport?.arch ?? '').trim() !== expectedArch) {
      throw new Error(
        `Server bundle smoke report architecture mismatch at ${smokeReportPath}: expected ${expectedArch}, received ${smokeReport?.arch ?? 'unknown'}`,
      );
    }
    if (String(smokeReport?.status ?? '').trim() !== 'passed') {
      throw new Error(
        `Server bundle smoke report must pass before finalization: ${smokeReportPath}`,
      );
    }
    if (String(smokeReport?.smokeKind ?? '').trim() !== 'bundle-runtime') {
      throw new Error(
        `Server bundle smoke report must describe bundle-runtime verification: ${smokeReportPath}`,
      );
    }
    if (
      path.resolve(String(smokeReport?.manifestPath ?? '').trim() || manifestDir)
      !== path.resolve(record.file.absolutePath)
    ) {
      throw new Error(
        `Server bundle smoke report manifest path mismatch at ${smokeReportPath}`,
      );
    }

    const reportedArtifactRelativePaths = normalizeStringArray(
      smokeReport?.artifactRelativePaths,
    );
    if (
      expectedArtifactRelativePaths.length !== reportedArtifactRelativePaths.length
      || expectedArtifactRelativePaths.some(
        (relativePath, index) => relativePath !== reportedArtifactRelativePaths[index],
      )
    ) {
      throw new Error(
        `Server bundle smoke report does not match the current artifact set: ${smokeReportPath}`,
      );
    }
    if (String(smokeReport?.launcherRelativePath ?? '').trim().length === 0) {
      throw new Error(
        `Server bundle smoke report is missing launcherRelativePath: ${smokeReportPath}`,
      );
    }
    if (String(smokeReport?.runtimeBaseUrl ?? '').trim().length === 0) {
      throw new Error(
        `Server bundle smoke report is missing runtimeBaseUrl: ${smokeReportPath}`,
      );
    }

    const checks = normalizeReleaseSmokeChecks(smokeReport?.checks);
    const passedChecks = new Map(
      checks.map((check) => [check.id, check.status]),
    );
    for (const requiredCheckId of ['health-ready', 'host-endpoints', 'browser-shell']) {
      if (passedChecks.get(requiredCheckId) !== 'passed') {
        throw new Error(
          `Server bundle smoke report is missing a passing ${requiredCheckId} check: ${smokeReportPath}`,
        );
      }
    }

    serverBundleSmokeMetadataByManifestPath.set(
      record.file.absolutePath,
      {
        serverBundleSmoke: buildServerBundleSmokeMetadata({
          releaseAssetsDir,
          manifestPath: record.file.absolutePath,
          smokeReportPath,
          smokeReport,
        }),
      },
    );
  }

  return serverBundleSmokeMetadataByManifestPath;
}

function buildArtifactIndex(
  releaseAssetsDir,
  partialManifestFileName,
  releaseTag = '',
  artifactMetadataByManifestPath = new Map(),
) {
  const files = listFilesRecursively(releaseAssetsDir);
  const partialManifestFiles = files.filter((file) => file.relativePath.endsWith(`/${partialManifestFileName}`) || file.relativePath === partialManifestFileName);
  const assetFiles = files.filter((file) => (
    !file.relativePath.endsWith(`/${partialManifestFileName}`)
    && file.relativePath !== partialManifestFileName
    && path.posix.basename(file.relativePath) !== DESKTOP_INSTALLER_SMOKE_REPORT_FILENAME
    && path.posix.basename(file.relativePath) !== RELEASE_SMOKE_REPORT_FILENAME
    && !file.relativePath.endsWith('.sha256.txt')
    && path.posix.basename(file.relativePath) !== 'SHA256SUMS.txt'
    && path.posix.basename(file.relativePath) !== 'release-manifest.json'
  ));

  const assetFilesByRelativePath = new Map(
    assetFiles.map((file) => [file.relativePath, file]),
  );
  const partialManifestRecords = partialManifestFiles.map((file) => ({
    file,
    manifest: readPartialManifest(file.absolutePath),
  }));
  const normalizedReleaseTag = String(releaseTag ?? '').trim();
  const hasTaggedManifest = normalizedReleaseTag.length > 0
    && partialManifestRecords.some((record) => String(record.manifest?.releaseTag ?? '').trim().length > 0);
  const artifacts = [];

  for (const partialManifestRecord of partialManifestRecords) {
    const partialManifest = partialManifestRecord.manifest;
    const partialManifestReleaseTag = String(partialManifest?.releaseTag ?? '').trim();
    if (hasTaggedManifest && partialManifestReleaseTag !== normalizedReleaseTag) {
      for (const artifact of partialManifest.artifacts ?? []) {
        if (typeof artifact?.relativePath === 'string' && artifact.relativePath.trim().length > 0) {
          assetFilesByRelativePath.delete(artifact.relativePath);
        }
      }
      continue;
    }

    for (const artifact of partialManifest.artifacts ?? []) {
      const assetFile = assetFilesByRelativePath.get(artifact.relativePath);
      if (!assetFile) {
        continue;
      }

      const assetStat = statSync(assetFile.absolutePath);
      const artifactMetadata = artifactMetadataByManifestPath.get(
        partialManifestRecord.file.absolutePath,
      );
      artifacts.push(normalizeArtifactRecord({
        ...artifact,
        ...(artifactMetadata ?? {}),
        sha256: computeSha256(assetFile.absolutePath),
        size: assetStat.size,
      }, assetFile.relativePath));
      assetFilesByRelativePath.delete(assetFile.relativePath);
    }
  }

  for (const remainingAssetFile of assetFilesByRelativePath.values()) {
    if (!isFallbackArtifactEligible(remainingAssetFile.relativePath, normalizedReleaseTag)) {
      continue;
    }

    const assetStat = statSync(remainingAssetFile.absolutePath);
    artifacts.push(normalizeArtifactRecord({
      name: path.posix.basename(remainingAssetFile.relativePath),
      sha256: computeSha256(remainingAssetFile.absolutePath),
      size: assetStat.size,
    }, remainingAssetFile.relativePath));
  }

  return artifacts.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

function normalizeArtifactRecord(artifact, relativePath) {
  const inferredMetadata = inferArtifactMetadata(relativePath);

  return {
    ...artifact,
    relativePath,
    family: artifact.family ?? inferredMetadata.family,
    platform: resolveArtifactPlatform(artifact.platform, inferredMetadata.platform),
    arch: resolveArtifactArch(artifact.arch, inferredMetadata.arch),
    accelerator: artifact.accelerator ?? inferredMetadata.accelerator,
    kind: artifact.kind ?? inferArtifactKind(relativePath),
  };
}

function inferArtifactMetadata(relativePath) {
  return {
    family: inferFamily(relativePath),
    platform: inferPlatformId(relativePath),
    arch: inferArchId(relativePath),
    accelerator: inferAccelerator(relativePath),
  };
}

function resolveArtifactPlatform(platform, inferredPlatform) {
  if (platform === undefined || platform === null || platform === '' || platform === 'unknown') {
    return inferredPlatform;
  }
  return platform;
}

function resolveArtifactArch(arch, inferredArch) {
  if (arch === undefined || arch === null || arch === '') {
    return inferredArch;
  }
  if (arch === 'any' && inferredArch !== 'any') {
    return inferredArch;
  }
  return arch;
}

function inferFamily(relativePath) {
  const [family] = relativePath.split('/');
  if (family === 'desktop' || family === 'web' || family === 'server' || family === 'container' || family === 'kubernetes') {
    return family;
  }
  return undefined;
}

function inferPlatformId(relativePath) {
  const segments = relativePath.split('/');
  if (segments[0] === 'desktop' && segments.length >= 3) {
    return segments[1];
  }
  if (segments[0] === 'server' && segments.length >= 3) {
    return segments[1];
  }
  if ((segments[0] === 'container' || segments[0] === 'kubernetes') && segments.length >= 4) {
    return segments[1];
  }
  if (segments[0] === 'web') {
    return 'web';
  }
  return 'unknown';
}

function inferArchId(relativePath) {
  const segments = relativePath.split('/');
  if (segments[0] === 'desktop' && segments.length >= 3) {
    return segments[2];
  }
  if (segments[0] === 'server' && segments.length >= 3) {
    return segments[2];
  }
  if ((segments[0] === 'container' || segments[0] === 'kubernetes') && segments.length >= 4) {
    return segments[2];
  }
  return 'any';
}

function inferAccelerator(relativePath) {
  const segments = relativePath.split('/');
  if ((segments[0] === 'container' || segments[0] === 'kubernetes') && segments.length >= 5) {
    return segments[3];
  }
  return undefined;
}

function inferArtifactKind(relativePath) {
  const lowerCasePath = relativePath.toLowerCase();
  if (lowerCasePath.endsWith('.exe') || lowerCasePath.endsWith('.msi') || lowerCasePath.endsWith('.dmg')) {
    return 'installer';
  }
  if (lowerCasePath.endsWith('.deb') || lowerCasePath.endsWith('.rpm') || lowerCasePath.endsWith('.appimage')) {
    return 'package';
  }
  return 'archive';
}

function isFallbackArtifactEligible(relativePath, releaseTag = '') {
  const segments = relativePath.split('/');
  const family = inferFamily(relativePath);
  const normalizedReleaseTag = String(releaseTag ?? '').trim();

  if (!family) {
    return false;
  }
  if (normalizedReleaseTag.length > 0 && !relativePath.includes(normalizedReleaseTag)) {
    return false;
  }

  if (family === 'desktop') {
    return (
      segments.length >= 4
      && supportedDesktopPlatforms.has(segments[1])
      && supportedArchIds.has(segments[2])
    );
  }

  if (family === 'server') {
    return (
      segments.length >= 4
      && supportedServerPlatforms.has(segments[1])
      && supportedArchIds.has(segments[2])
    );
  }

  if (family === 'container' || family === 'kubernetes') {
    return (
      segments.length >= 5
      && supportedDeploymentPlatforms.has(segments[1])
      && supportedArchIds.has(segments[2])
      && supportedAccelerators.has(segments[3])
    );
  }

  if (family === 'web') {
    return segments.length >= 2;
  }

  return false;
}

function writeGlobalChecksumManifest({
  releaseAssetsDir,
  fileName,
  artifacts,
}) {
  const outputPath = path.join(releaseAssetsDir, fileName);
  const checksumLines = artifacts
    .map((artifact) => `${artifact.sha256}  ${artifact.relativePath}`)
    .join('\n');

  writeFileSync(outputPath, `${checksumLines}\n`, 'utf8');
}

function writeReleaseManifest({
  releaseAssetsDir,
  fileName,
  profile,
  releaseTag,
  repository,
  artifacts,
}) {
  const outputPath = path.join(releaseAssetsDir, fileName);
  writeFileSync(
    outputPath,
    `${JSON.stringify({
      profileId: profile.id,
      productName: profile.productName,
      releaseTag,
      repository,
      generatedAt: new Date().toISOString(),
      checksumFileName: profile.release.globalChecksumsFileName,
      attestationEnabled: profile.release.enableArtifactAttestations,
      verification: repository
        ? {
            checksumCommand: `sha256sum -c ${profile.release.globalChecksumsFileName}`,
            attestationCommand: `gh attestation verify <asset-path> -R ${repository}`,
          }
        : undefined,
      artifacts,
    }, null, 2)}\n`,
    'utf8',
  );
}

export function finalizeReleaseAssets({
  profileId = DEFAULT_RELEASE_PROFILE_ID,
  releaseTag,
  repository = '',
  releaseAssetsDir = path.resolve('release-assets'),
  workspaceRootDir = rootDir,
} = {}) {
  const profile = resolveReleaseProfile(profileId);
  const normalizedReleaseTag = String(releaseTag ?? '').trim();

  if (!normalizedReleaseTag) {
    throw new Error('releaseTag is required to finalize release assets.');
  }
  if (!existsSync(releaseAssetsDir)) {
    throw new Error(`Missing release assets directory: ${releaseAssetsDir}`);
  }

  mkdirSync(releaseAssetsDir, { recursive: true });
  const desktopInstallerMetadataByManifestPath = requireDesktopInstallerSmokeReports({
    workspaceRootDir,
    releaseAssetsDir,
    partialManifestFileName: profile.release.partialManifestFileName,
    releaseTag: normalizedReleaseTag,
  });
  const serverBundleSmokeMetadataByManifestPath = requireServerBundleSmokeReports({
    releaseAssetsDir,
    partialManifestFileName: profile.release.partialManifestFileName,
    releaseTag: normalizedReleaseTag,
  });
  const artifactMetadataByManifestPath = new Map();
  for (const [manifestPath, metadata] of desktopInstallerMetadataByManifestPath.entries()) {
    artifactMetadataByManifestPath.set(manifestPath, metadata);
  }
  for (const [manifestPath, metadata] of serverBundleSmokeMetadataByManifestPath.entries()) {
    artifactMetadataByManifestPath.set(
      manifestPath,
      {
        ...(artifactMetadataByManifestPath.get(manifestPath) ?? {}),
        ...metadata,
      },
    );
  }
  const artifacts = buildArtifactIndex(
    releaseAssetsDir,
    profile.release.partialManifestFileName,
    normalizedReleaseTag,
    artifactMetadataByManifestPath,
  );
  if (artifacts.length === 0) {
    throw new Error(`No release assets found under ${releaseAssetsDir}`);
  }

  writeGlobalChecksumManifest({
    releaseAssetsDir,
    fileName: profile.release.globalChecksumsFileName,
    artifacts,
  });
  writeReleaseManifest({
    releaseAssetsDir,
    fileName: profile.release.manifestFileName,
    profile,
    releaseTag: normalizedReleaseTag,
    repository: String(repository ?? '').trim(),
    artifacts,
  });
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  finalizeReleaseAssets(options);
}

if (path.resolve(process.argv[1] ?? '') === __filename) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
