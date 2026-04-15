#!/usr/bin/env node

import { existsSync } from 'node:fs';
import { readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const rootDir = path.resolve(import.meta.dirname, '..');

export const LEGACY_OPENCLAW_SOURCE_RUNTIME_RELATIVE_DIR = path.join(
  'packages',
  'sdkwork-claw-desktop',
  'src-tauri',
  'resources',
  'openclaw-runtime',
);
export const PREPARED_OPENCLAW_BUNDLED_NODE_RUNTIME_RELATIVE_DIR = path.join(
  'packages',
  'sdkwork-claw-desktop',
  'src-tauri',
  'resources',
  'openclaw',
  'runtime',
  'node',
);

function normalizeVersion(value) {
  const normalized = String(value ?? '').trim();
  return normalized || null;
}

async function tryReadJson(filePath) {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'));
  } catch {
    return null;
  }
}

export async function detectLegacyOpenClawSourceRuntimeResidue({
  workspaceRootDir = rootDir,
} = {}) {
  const legacySourceRuntimeDir = path.join(
    workspaceRootDir,
    LEGACY_OPENCLAW_SOURCE_RUNTIME_RELATIVE_DIR,
  );
  const legacySourceRuntimeDirPresent = existsSync(legacySourceRuntimeDir);
  const preparedBundledNodeRuntimeDir = path.join(
    workspaceRootDir,
    PREPARED_OPENCLAW_BUNDLED_NODE_RUNTIME_RELATIVE_DIR,
  );
  const preparedBundledNodeRuntimeDirPresent = existsSync(preparedBundledNodeRuntimeDir);
  if (!legacySourceRuntimeDirPresent) {
    return {
      legacySourceRuntimeDir,
      legacySourceRuntimeDirPresent,
      legacySourceRuntimeVersion: null,
      preparedBundledNodeRuntimeDir,
      preparedBundledNodeRuntimeDirPresent,
    };
  }

  const [legacyManifest, legacyPackageJson] = await Promise.all([
    tryReadJson(path.join(legacySourceRuntimeDir, 'manifest.json')),
    tryReadJson(
      path.join(
        legacySourceRuntimeDir,
        'runtime',
        'package',
        'node_modules',
        'openclaw',
        'package.json',
      ),
    ),
  ]);

  return {
    legacySourceRuntimeDir,
    legacySourceRuntimeDirPresent,
    legacySourceRuntimeVersion:
      normalizeVersion(legacyManifest?.openclawVersion)
      ?? normalizeVersion(legacyPackageJson?.version),
    preparedBundledNodeRuntimeDir,
    preparedBundledNodeRuntimeDirPresent,
  };
}

export async function cleanupLegacyOpenClawSourceRuntimeResidue({
  workspaceRootDir = rootDir,
  maxRetries = 5,
  retryDelay = 250,
} = {}) {
  const residue = await detectLegacyOpenClawSourceRuntimeResidue({ workspaceRootDir });
  let removedLegacySourceRuntimeDir = false;
  let removedPreparedBundledNodeRuntimeDir = false;

  if (residue.preparedBundledNodeRuntimeDirPresent) {
    await rm(residue.preparedBundledNodeRuntimeDir, {
      recursive: true,
      force: true,
      maxRetries,
      retryDelay,
    });
    if (existsSync(residue.preparedBundledNodeRuntimeDir)) {
      throw new Error(
        `Prepared OpenClaw bundled Node residue still exists after cleanup: ${residue.preparedBundledNodeRuntimeDir}`,
      );
    }
    removedPreparedBundledNodeRuntimeDir = true;
  }

  if (!residue.legacySourceRuntimeDirPresent) {
    return {
      ...residue,
      removed: removedPreparedBundledNodeRuntimeDir,
      removedLegacySourceRuntimeDir,
      removedPreparedBundledNodeRuntimeDir,
    };
  }

  await rm(residue.legacySourceRuntimeDir, {
    recursive: true,
    force: true,
    maxRetries,
    retryDelay,
  });

  if (existsSync(residue.legacySourceRuntimeDir)) {
    throw new Error(
      `Legacy OpenClaw source runtime residue still exists after cleanup: ${residue.legacySourceRuntimeDir}`,
    );
  }
  removedLegacySourceRuntimeDir = true;

  return {
    ...residue,
    removed: true,
    removedLegacySourceRuntimeDir,
    removedPreparedBundledNodeRuntimeDir,
  };
}

export async function main() {
  const result = await cleanupLegacyOpenClawSourceRuntimeResidue();
  if (result.removed) {
    const versionSuffix = result.legacySourceRuntimeVersion
      ? ` (detected version ${result.legacySourceRuntimeVersion})`
      : '';
    console.log(
      `Removed legacy OpenClaw source runtime residue at ${result.legacySourceRuntimeDir}${versionSuffix}`,
    );
    return;
  }

  console.log(`No legacy OpenClaw source runtime residue found at ${result.legacySourceRuntimeDir}`);
}

if (path.resolve(process.argv[1] ?? '') === __filename) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
