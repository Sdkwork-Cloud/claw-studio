import { existsSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function normalizePermissionPath(filePath) {
  if (process.platform === 'win32' && filePath.startsWith('\\\\?\\')) {
    return filePath.slice(4);
  }

  return filePath;
}

function collectPermissionManifestFiles(targetDir) {
  const manifestFiles = [];
  const pending = [targetDir];

  while (pending.length > 0) {
    const currentDir = pending.pop();
    const entries = readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        pending.push(entryPath);
        continue;
      }

      if (entry.isFile() && entry.name.endsWith('permission-files')) {
        manifestFiles.push(entryPath);
      }
    }
  }

  return manifestFiles;
}

function readPermissionEntries(manifestPath) {
  const contents = readFileSync(manifestPath, 'utf8');
  const parsed = JSON.parse(contents);

  if (!Array.isArray(parsed)) {
    throw new Error('permission manifest must be a JSON array');
  }

  return parsed;
}

export function inspectTauriTarget(srcTauriDir = 'src-tauri') {
  const resolvedSrcTauriDir = path.resolve(srcTauriDir);
  const targetDir = path.join(resolvedSrcTauriDir, 'target');

  if (!existsSync(targetDir)) {
    return {
      targetDir,
      manifestFiles: [],
      staleEntries: [],
      stale: false,
    };
  }

  const manifestFiles = collectPermissionManifestFiles(targetDir);
  const staleEntries = [];

  for (const manifestPath of manifestFiles) {
    let entries;

    try {
      entries = readPermissionEntries(manifestPath);
    } catch (error) {
      staleEntries.push({
        manifestPath,
        entryPath: '<invalid-manifest>',
        reason: error instanceof Error ? error.message : String(error),
      });
      continue;
    }

    for (const entryPath of entries) {
      if (typeof entryPath !== 'string' || entryPath.trim().length === 0) {
        staleEntries.push({
          manifestPath,
          entryPath: String(entryPath),
          reason: 'permission entry must be a non-empty string',
        });
        continue;
      }

      const normalizedPath = normalizePermissionPath(entryPath);
      if (!existsSync(normalizedPath)) {
        staleEntries.push({
          manifestPath,
          entryPath,
          reason: 'referenced permission file does not exist',
        });
      }
    }
  }

  return {
    targetDir,
    manifestFiles,
    staleEntries,
    stale: staleEntries.length > 0,
  };
}

export function ensureTauriTargetClean(srcTauriDir = 'src-tauri') {
  const inspection = inspectTauriTarget(srcTauriDir);

  if (inspection.stale && existsSync(inspection.targetDir)) {
    rmSync(inspection.targetDir, { recursive: true, force: true });
  }

  return {
    ...inspection,
    removedTarget: inspection.stale,
  };
}

function runCli() {
  const srcTauriDir = process.argv[2] ?? 'src-tauri';
  const result = ensureTauriTargetClean(srcTauriDir);

  if (result.removedTarget) {
    console.log(
      `cleaned stale Tauri target cache at ${result.targetDir} after detecting ${result.staleEntries.length} invalid permission references`,
    );
    return;
  }

  if (result.manifestFiles.length === 0) {
    console.log(`no Tauri permission manifests found under ${result.targetDir}; continuing`);
    return;
  }

  console.log(`Tauri target cache is clean: ${result.manifestFiles.length} permission manifests validated`);
}

const invokedScriptPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
const currentModulePath = fileURLToPath(import.meta.url);

if (invokedScriptPath && invokedScriptPath === currentModulePath) {
  runCli();
}
