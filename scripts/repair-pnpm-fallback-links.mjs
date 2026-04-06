#!/usr/bin/env node

import { copyFile, lstat, mkdir, readdir, readFile, realpath, rm, symlink } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import {
  resolveDefaultGlobalPnpmStoreRoot,
  resolveStoreFilePath,
} from './repair-pnpm-store-files.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultWorkspaceRootDir = path.resolve(__dirname, '..');

function compareVersionLike(left, right) {
  return String(left ?? '').localeCompare(String(right ?? ''), undefined, {
    numeric: true,
    sensitivity: 'base',
  });
}

function normalizePackageName(name) {
  return String(name ?? '').trim();
}

function resolvePnpmStoreDir(workspaceRootDir) {
  return path.join(workspaceRootDir, 'node_modules', '.pnpm');
}

function resolveHoistedNodeModulesDir(pnpmStoreDir) {
  return path.join(pnpmStoreDir, 'node_modules');
}

function resolveWorkspaceNodeModulesDir(workspaceRootDir) {
  return path.join(workspaceRootDir, 'node_modules');
}

function splitPackageName(packageName) {
  return normalizePackageName(packageName).startsWith('@')
    ? normalizePackageName(packageName).split('/')
    : [normalizePackageName(packageName)];
}

function extractPinnedVersion(specifier) {
  const normalizedSpecifier = String(specifier ?? '').trim();
  if (
    !normalizedSpecifier
    || normalizedSpecifier.startsWith('workspace:')
    || normalizedSpecifier.startsWith('link:')
    || normalizedSpecifier.startsWith('file:')
  ) {
    return null;
  }

  const match = normalizedSpecifier.match(/\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?/u);
  return match ? match[0] : null;
}

function normalizeDependencySpecifier(specifier) {
  return String(specifier ?? '').trim();
}

function parseSemverTriplet(version) {
  const match = String(version ?? '').trim().match(/^(\d+)\.(\d+)\.(\d+)(?:-[0-9A-Za-z.-]+)?$/u);
  if (!match) {
    return null;
  }

  return {
    major: Number.parseInt(match[1], 10),
    minor: Number.parseInt(match[2], 10),
    patch: Number.parseInt(match[3], 10),
  };
}

function compareResolvedVersion(left, right) {
  return compareVersionLike(String(left ?? ''), String(right ?? ''));
}

function matchesSimpleSemverRange(candidateVersion, specifier) {
  const normalizedSpecifier = normalizeDependencySpecifier(specifier);
  const candidateTriplet = parseSemverTriplet(candidateVersion);
  const baseVersion = extractPinnedVersion(normalizedSpecifier);
  const baseTriplet = parseSemverTriplet(baseVersion);

  if (!normalizedSpecifier || !candidateTriplet || !baseTriplet) {
    return false;
  }

  const comparison = compareResolvedVersion(candidateVersion, baseVersion);
  if (comparison < 0) {
    return false;
  }

  if (normalizedSpecifier.startsWith('^')) {
    if (baseTriplet.major > 0) {
      return candidateTriplet.major === baseTriplet.major;
    }
    if (baseTriplet.minor > 0) {
      return (
        candidateTriplet.major === 0
        && candidateTriplet.minor === baseTriplet.minor
      );
    }
    return (
      candidateTriplet.major === 0
      && candidateTriplet.minor === 0
      && candidateTriplet.patch === baseTriplet.patch
    );
  }

  if (normalizedSpecifier.startsWith('~')) {
    return (
      candidateTriplet.major === baseTriplet.major
      && candidateTriplet.minor === baseTriplet.minor
    );
  }

  return candidateVersion === baseVersion;
}

function collectDependencyRequests(packageJson) {
  const dependencyRequests = [];

  for (const fieldName of ['dependencies', 'optionalDependencies']) {
    const dependencies = packageJson?.[fieldName];
    if (!dependencies || typeof dependencies !== 'object') {
      continue;
    }

    for (const [packageName, specifier] of Object.entries(dependencies)) {
      const normalizedSpecifier = normalizeDependencySpecifier(specifier);
      const version = extractPinnedVersion(normalizedSpecifier);
      if (!version) {
        continue;
      }
      dependencyRequests.push({
        packageName: normalizePackageName(packageName),
        specifier: normalizedSpecifier,
        version,
      });
    }
  }

  return dependencyRequests;
}

async function listPackageRoots(nodeModulesDir) {
  const entries = await readdir(nodeModulesDir, { withFileTypes: true });
  const packageRoots = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    if (entry.name.startsWith('@')) {
      const scopeDir = path.join(nodeModulesDir, entry.name);
      const scopedEntries = await readdir(scopeDir, { withFileTypes: true });
      for (const scopedEntry of scopedEntries) {
        if (scopedEntry.isDirectory()) {
          packageRoots.push(path.join(scopeDir, scopedEntry.name));
        }
      }
      continue;
    }
    packageRoots.push(path.join(nodeModulesDir, entry.name));
  }

  return packageRoots;
}

async function collectPackageCandidates(pnpmStoreDir) {
  const storeEntries = await readdir(pnpmStoreDir, { withFileTypes: true });
  const candidates = [];

  for (const entry of storeEntries) {
    if (!entry.isDirectory() || entry.name === 'node_modules' || entry.name.includes('.bak-')) {
      continue;
    }

    const nodeModulesDir = path.join(pnpmStoreDir, entry.name, 'node_modules');
    try {
      const packageRoots = await listPackageRoots(nodeModulesDir);
      for (const packageRoot of packageRoots) {
        const packageJsonPath = path.join(packageRoot, 'package.json');
        try {
          const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'));
          candidates.push({
            storeName: entry.name,
            packageName: normalizePackageName(packageJson.name),
            version: normalizePackageName(packageJson.version),
            packageRoot,
            packageJson,
          });
        } catch (error) {
          if (
            !(
              error
              && typeof error === 'object'
              && ['ENOENT', 'EPERM', 'EACCES'].includes(error.code)
            )
          ) {
            throw error;
          }
        }
      }
    } catch (error) {
      if (!(error && typeof error === 'object' && error.code === 'ENOENT')) {
        throw error;
      }
    }
  }

  return candidates;
}

function selectPreferredCandidate(candidates) {
  return [...candidates].sort((left, right) => compareVersionLike(right.version, left.version))[0] ?? null;
}

async function recreateLink(linkPath, targetPath, platform = process.platform) {
  await rm(linkPath, { recursive: true, force: true });
  await mkdir(path.dirname(linkPath), { recursive: true });
  await symlink(targetPath, linkPath, platform === 'win32' ? 'junction' : 'dir');
}

async function ensurePackageLink({
  packageName,
  linkBaseDir,
  targetPath,
  platform = process.platform,
}) {
  const linkPath = path.join(linkBaseDir, ...splitPackageName(packageName));
  let shouldCreate = true;

  try {
    const stats = await lstat(linkPath);
    if (stats.isSymbolicLink() || stats.isDirectory()) {
      try {
        const existingTarget = path.resolve(await realpath(linkPath));
        const preferredTarget = path.resolve(await realpath(targetPath));
        if (existingTarget === preferredTarget) {
          shouldCreate = false;
        }
      } catch {
        shouldCreate = true;
      }
    }
  } catch (error) {
    if (!(error && typeof error === 'object' && error.code === 'ENOENT')) {
      throw error;
    }
  }

  if (!shouldCreate) {
    return null;
  }

  await recreateLink(linkPath, targetPath, platform);
  return linkPath;
}

async function loadGlobalStoreMetadataIndex(globalStoreRootDir) {
  if (!globalStoreRootDir) {
    return {
      byKey: new Map(),
      byPackageName: new Map(),
    };
  }

  const metadataIndex = new Map();
  const metadataByPackageName = new Map();
  const indexRootDir = path.join(globalStoreRootDir, 'index');

  async function walkIndexDir(directoryPath) {
    const entries = await readdir(directoryPath, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(directoryPath, entry.name);
      if (entry.isDirectory()) {
        await walkIndexDir(absolutePath);
        continue;
      }
      if (!entry.isFile() || !entry.name.endsWith('.json')) {
        continue;
      }

      try {
        const metadata = JSON.parse(await readFile(absolutePath, 'utf8'));
        const key = `${normalizePackageName(metadata.name)}@${normalizePackageName(metadata.version)}`;
        if (!metadataIndex.has(key)) {
          metadataIndex.set(key, metadata);
        }
        const packageName = normalizePackageName(metadata.name);
        const packageEntries = metadataByPackageName.get(packageName) ?? [];
        packageEntries.push(metadata);
        metadataByPackageName.set(packageName, packageEntries);
      } catch {
        continue;
      }
    }
  }

  try {
    await walkIndexDir(indexRootDir);
  } catch (error) {
    if (!(error && typeof error === 'object' && error.code === 'ENOENT')) {
      throw error;
    }
  }

  for (const [packageName, entries] of metadataByPackageName) {
    metadataByPackageName.set(
      packageName,
      [...entries].sort((left, right) => compareResolvedVersion(right.version, left.version)),
    );
  }

  return {
    byKey: metadataIndex,
    byPackageName: metadataByPackageName,
  };
}

function selectMetadataForDependencyRequest(dependencyRequest, metadataIndex) {
  const exactKey = `${dependencyRequest.packageName}@${dependencyRequest.version}`;
  const exactMatch = metadataIndex.byKey.get(exactKey);
  if (exactMatch) {
    return exactMatch;
  }

  const candidates = metadataIndex.byPackageName.get(dependencyRequest.packageName) ?? [];
  if (candidates.length === 0) {
    return null;
  }

  const simpleRangeMatch = candidates.find((entry) => (
    matchesSimpleSemverRange(entry.version, dependencyRequest.specifier)
  ));
  if (simpleRangeMatch) {
    return simpleRangeMatch;
  }

  return null;
}

async function materializePackageFromMetadata({
  packageName,
  version,
  hoistedNodeModulesDir,
  globalStoreRootDir,
  metadata,
}) {
  if (!metadata?.files || typeof metadata.files !== 'object') {
    return null;
  }

  const packageRoot = path.join(hoistedNodeModulesDir, ...splitPackageName(packageName));
  await rm(packageRoot, { recursive: true, force: true });

  for (const [relativePath, fileMetadata] of Object.entries(metadata.files)) {
    const targetPath = path.join(packageRoot, relativePath);
    const sourcePath = resolveStoreFilePath(globalStoreRootDir, fileMetadata.integrity);
    await mkdir(path.dirname(targetPath), { recursive: true });
    await copyFile(sourcePath, targetPath);
  }

  return {
    packageName,
    version,
    packageRoot,
  };
}

async function materializeMissingHoistedPackages({
  candidates,
  hoistedNodeModulesDir,
  globalStoreRootDir,
  logger = console,
}) {
  if (!globalStoreRootDir) {
    return [];
  }

  const availablePackageNames = new Set(candidates.map((candidate) => candidate.packageName));
  const metadataIndex = await loadGlobalStoreMetadataIndex(globalStoreRootDir);
  const queue = candidates.flatMap((candidate) => collectDependencyRequests(candidate.packageJson));
  const materialized = [];
  const processed = new Set();

  while (queue.length > 0) {
    const dependencyRequest = queue.shift();
    const packageName = normalizePackageName(dependencyRequest.packageName);
    const version = normalizePackageName(dependencyRequest.version);
    const key = `${packageName}@${version}`;

    if (!packageName || !version || processed.has(key)) {
      continue;
    }
    processed.add(key);

    const hoistedPackageJsonPath = path.join(hoistedNodeModulesDir, ...splitPackageName(packageName), 'package.json');
    try {
      const existingPackageJson = JSON.parse(await readFile(hoistedPackageJsonPath, 'utf8'));
      queue.push(...collectDependencyRequests(existingPackageJson));
      availablePackageNames.add(packageName);
      continue;
    } catch (error) {
      if (!(error && typeof error === 'object' && error.code === 'ENOENT')) {
        throw error;
      }
    }

    if (availablePackageNames.has(packageName)) {
      continue;
    }

    const metadata = selectMetadataForDependencyRequest(dependencyRequest, metadataIndex);
    if (!metadata) {
      continue;
    }

    try {
      const entry = await materializePackageFromMetadata({
        packageName,
        version,
        hoistedNodeModulesDir,
        globalStoreRootDir,
        metadata,
      });
      if (!entry) {
        continue;
      }

      materialized.push(entry);
      availablePackageNames.add(packageName);
      const materializedPackageJson = JSON.parse(await readFile(path.join(entry.packageRoot, 'package.json'), 'utf8'));
      queue.push(...collectDependencyRequests(materializedPackageJson));
    } catch (error) {
      if (!(error && typeof error === 'object' && error.code === 'ENOENT')) {
        throw error;
      }
    }
  }

  if (materialized.length > 0) {
    logger.info?.(
      `[repair-pnpm-fallback-links] materialized ${materialized.length} missing package(s) from ${globalStoreRootDir}`,
    );
  }

  return materialized;
}

export async function repairPnpmFallbackLinks({
  workspaceRootDir = defaultWorkspaceRootDir,
  pnpmStoreDir = resolvePnpmStoreDir(workspaceRootDir),
  globalStoreRootDir = resolveDefaultGlobalPnpmStoreRoot(),
  platform = process.platform,
  logger = console,
} = {}) {
  const hoistedNodeModulesDir = resolveHoistedNodeModulesDir(pnpmStoreDir);
  const workspaceNodeModulesDir = resolveWorkspaceNodeModulesDir(workspaceRootDir);
  await mkdir(hoistedNodeModulesDir, { recursive: true });
  await mkdir(workspaceNodeModulesDir, { recursive: true });

  const candidates = await collectPackageCandidates(pnpmStoreDir);
  const materialized = await materializeMissingHoistedPackages({
    candidates,
    hoistedNodeModulesDir,
    globalStoreRootDir,
    logger,
  });
  const groupedCandidates = new Map();

  for (const candidate of candidates) {
    const group = groupedCandidates.get(candidate.packageName) ?? [];
    group.push(candidate);
    groupedCandidates.set(candidate.packageName, group);
  }

  const created = [];
  const rootCreated = [];
  const preferredTargets = new Map();

  for (const [packageName, packageCandidates] of groupedCandidates) {
    const preferredCandidate = selectPreferredCandidate(packageCandidates);
    if (!preferredCandidate) {
      continue;
    }
    preferredTargets.set(packageName, preferredCandidate.packageRoot);

    const linkPath = await ensurePackageLink({
      packageName,
      linkBaseDir: hoistedNodeModulesDir,
      targetPath: preferredCandidate.packageRoot,
      platform,
    });
    if (linkPath) {
      created.push({
        packageName,
        storeName: preferredCandidate.storeName,
        version: preferredCandidate.version,
        linkPath,
      });
    }
  }

  for (const entry of materialized) {
    if (!preferredTargets.has(entry.packageName)) {
      preferredTargets.set(entry.packageName, entry.packageRoot);
    }
  }

  for (const [packageName, targetPath] of preferredTargets) {
    const linkPath = await ensurePackageLink({
      packageName,
      linkBaseDir: workspaceNodeModulesDir,
      targetPath,
      platform,
    });
    if (!linkPath) {
      continue;
    }

    rootCreated.push({
      packageName,
      linkPath,
      targetPath,
    });
  }

  if (created.length > 0) {
    logger.info?.(
      `[repair-pnpm-fallback-links] recreated ${created.length} hoisted fallback link(s) under ${hoistedNodeModulesDir}`,
    );
  }

  if (rootCreated.length > 0) {
    logger.info?.(
      `[repair-pnpm-fallback-links] recreated ${rootCreated.length} workspace fallback link(s) under ${workspaceNodeModulesDir}`,
    );
  }

  return {
    hoistedNodeModulesDir,
    workspaceNodeModulesDir,
    materialized,
    created,
    rootCreated,
  };
}

async function runCli() {
  const report = await repairPnpmFallbackLinks();
  if (report.created.length === 0) {
    console.log('[repair-pnpm-fallback-links] no missing hoisted fallback links detected');
    return;
  }
  console.log(
    `[repair-pnpm-fallback-links] recreated ${report.created.length} hoisted fallback link(s) under ${report.hoistedNodeModulesDir}`,
  );
}

if (path.resolve(process.argv[1] ?? '') === __filename) {
  runCli().catch((error) => {
    console.error(`[repair-pnpm-fallback-links] ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
}
