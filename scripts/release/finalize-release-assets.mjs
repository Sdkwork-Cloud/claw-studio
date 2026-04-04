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

const __filename = fileURLToPath(import.meta.url);
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

function buildArtifactIndex(releaseAssetsDir, partialManifestFileName, releaseTag = '') {
  const files = listFilesRecursively(releaseAssetsDir);
  const partialManifestFiles = files.filter((file) => file.relativePath.endsWith(`/${partialManifestFileName}`) || file.relativePath === partialManifestFileName);
  const assetFiles = files.filter((file) => (
    !file.relativePath.endsWith(`/${partialManifestFileName}`)
    && file.relativePath !== partialManifestFileName
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
      artifacts.push(normalizeArtifactRecord({
        ...artifact,
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
  const artifacts = buildArtifactIndex(
    releaseAssetsDir,
    profile.release.partialManifestFileName,
    normalizedReleaseTag,
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
