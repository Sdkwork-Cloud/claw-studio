import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(__dirname, '..');

const bannedFragments = Object.freeze([
  ['hub', 'installer'].join('-'),
  ['hub', 'installer'].join(' '),
  ['Hub', 'Install'].join(''),
  ['Hub', 'Installer'].join(''),
  ['hub', 'Install'].join(''),
  ['hub', 'install'].join('_'),
  ['clawhub', 'install'].join(' '),
  ['clawhub', 'installation'].join(' '),
  ['clawhub', 'installs'].join(' '),
  ['ClawHub', 'install'].join(' '),
  ['ClawHub', 'installation'].join(' '),
  ['ClawHub', 'installs'].join(' '),
  ['legacy', 'installer'].join('-'),
  ['legacy', 'installer'].join(' '),
  ['retired', 'installer', 'runtime'].join('-'),
  ['retired', 'installer', 'runtime'].join(' '),
  ['LEGACY', 'OPENCLAW', 'INSTALL', 'RECORDS', 'HOME', 'NAME'].join('_'),
]);

const bannedRemovedInstallPackageFragments = Object.freeze([
  ['@sdkwork', ['claw', 'install'].join('-')].join('/'),
  ['packages', ['sdkwork', 'claw', 'install'].join('-')].join('/'),
  ['sdkwork', 'claw', 'install'].join('-'),
  ['claw', 'studio', 'install'].join('-'),
]);

const gitMetadataRoots = ['.git/config', '.git/packed-refs', '.git/modules', '.git/refs', '.git/logs/refs'];
const skippedWorkspaceDirectories = new Set([
  '.cache',
  '.codex-tools',
  '.codex-tmp',
  '.git',
  '.n',
  '.pnpm-store',
  '.worktrees',
  'artifacts',
  'backup',
  'dist',
  'node_modules',
  'target',
  'upgrade',
]);

test('workspace removes forbidden installer identifiers from tracked files and local git metadata', () => {
  const files = new Set(listWorkspaceFiles());

  for (const metadataPath of gitMetadataRoots) {
    const absolutePath = path.join(workspaceRoot, metadataPath);
    if (!existsSync(absolutePath)) {
      continue;
    }
    for (const discovered of collectScannableFiles(absolutePath)) {
      files.add(path.relative(workspaceRoot, discovered));
    }
  }

  const violations = [];
  for (const relativePath of [...files].sort()) {
    const normalizedPath = relativePath.replace(/\\/g, '/');
    if (matchesBannedIdentifier(normalizedPath)) {
      violations.push(`path:${normalizedPath}`);
      continue;
    }

    const absolutePath = path.join(workspaceRoot, relativePath);
    if (!isTextFile(absolutePath)) {
      continue;
    }

    const source = readFileSync(absolutePath, 'utf8');
    if (matchesBannedIdentifier(source)) {
      violations.push(`content:${normalizedPath}`);
    }
  }

  assert.deepStrictEqual(
    violations.slice(0, 200),
    [],
    `forbidden installer identifiers remain:\n${violations.slice(0, 200).join('\n')}${
      violations.length > 200 ? `\n... ${violations.length - 200} more` : ''
    }`,
  );
});

test('workspace removes references to deleted install feature package names', () => {
  const violations = [];
  for (const relativePath of listWorkspaceFiles()) {
    const absolutePath = path.join(workspaceRoot, relativePath);
    if (!isTextFile(absolutePath)) {
      continue;
    }

    const source = readFileSync(absolutePath, 'utf8');
    if (bannedRemovedInstallPackageFragments.some((fragment) => source.includes(fragment))) {
      violations.push(relativePath.replace(/\\/g, '/'));
    }
  }

  assert.deepStrictEqual(
    violations.slice(0, 200),
    [],
    `docs still reference removed install package names:\n${violations.slice(0, 200).join('\n')}${
      violations.length > 200 ? `\n... ${violations.length - 200} more` : ''
    }`,
  );
});

function listWorkspaceFiles() {
  return collectWorkspaceFiles(workspaceRoot).map((absolutePath) =>
    path.relative(workspaceRoot, absolutePath),
  );
}

function collectWorkspaceFiles(targetPath) {
  let stats;
  try {
    stats = statSync(targetPath);
  } catch {
    return [];
  }
  if (stats.isFile()) {
    return [targetPath];
  }

  if (!stats.isDirectory()) {
    return [];
  }

  const entries = [];
  for (const name of readdirSync(targetPath)) {
    if (skippedWorkspaceDirectories.has(name)) {
      continue;
    }

    const absoluteChildPath = path.join(targetPath, name);
    entries.push(...collectWorkspaceFiles(absoluteChildPath));
  }

  return entries;
}

function collectScannableFiles(targetPath) {
  let stats;
  try {
    stats = statSync(targetPath);
  } catch {
    return [];
  }
  if (stats.isFile()) {
    return [targetPath];
  }

  if (!stats.isDirectory()) {
    return [];
  }

  const entries = [];
  for (const name of readdirSync(targetPath)) {
    if (name === 'objects') {
      continue;
    }

    const absoluteChildPath = path.join(targetPath, name);
    entries.push(...collectScannableFiles(absoluteChildPath));
  }
  return entries;
}

function isTextFile(targetPath) {
  let stats;
  try {
    stats = statSync(targetPath);
  } catch {
    return false;
  }
  if (!stats.isFile() || stats.size > 1_000_000) {
    return false;
  }

  let buffer;
  try {
    buffer = readFileSync(targetPath);
  } catch {
    return false;
  }
  return !buffer.includes(0);
}

function matchesBannedIdentifier(value) {
  return bannedFragments.some((fragment) => value.includes(fragment));
}
