#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import {
  normalizeDesktopArch,
  resolveDesktopReleaseTarget,
} from './desktop-targets.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');
const webDistDir = path.join(rootDir, 'packages', 'sdkwork-claw-web', 'dist');
const docsDistDir = path.join(rootDir, 'docs', '.vitepress', 'dist');

const desktopBundleRules = {
  windows: {
    directories: new Set(['msi', 'nsis']),
    suffixes: ['.msi', '.exe'],
  },
  linux: {
    directories: new Set(['appimage', 'deb', 'rpm']),
    suffixes: ['.appimage', '.deb', '.rpm'],
  },
  macos: {
    directories: new Set(['dmg', 'macos']),
    suffixes: ['.dmg', '.app.tar.gz', '.app.zip', '.zip'],
  },
};

export function normalizePlatformId(platform = process.platform) {
  if (platform === 'win32' || platform === 'windows') {
    return 'windows';
  }
  if (platform === 'darwin' || platform === 'macos') {
    return 'macos';
  }
  if (platform === 'linux') {
    return 'linux';
  }

  throw new Error(`Unsupported release platform: ${platform}`);
}

export function shouldIncludeDesktopBundleFile(platformId, relativePath) {
  const normalizedPlatform = normalizePlatformId(platformId);
  const normalizedPath = relativePath.replaceAll('\\', '/');
  const [topLevelDirectory] = normalizedPath.split('/');
  const rule = desktopBundleRules[normalizedPlatform];
  if (!rule.directories.has(topLevelDirectory)) {
    return false;
  }

  const lowerCasePath = normalizedPath.toLowerCase();
  return rule.suffixes.some((suffix) => lowerCasePath.endsWith(suffix));
}

export function buildWebArchiveBaseName(releaseTag) {
  if (typeof releaseTag !== 'string' || releaseTag.trim().length === 0) {
    throw new Error('releaseTag is required to package web release assets.');
  }

  return `claw-studio-web-assets-${releaseTag.trim()}`;
}

export function resolveDesktopBundleRoot({ targetTriple = '' } = {}) {
  const normalizedTargetTriple = String(targetTriple ?? '').trim();
  const targetSegments = normalizedTargetTriple.length > 0
    ? [normalizedTargetTriple]
    : [];

  return path.join(
    rootDir,
    'packages',
    'sdkwork-claw-desktop',
    'src-tauri',
    'target',
    ...targetSegments,
    'release',
    'bundle',
  );
}

function parseArgs(argv) {
  const [mode, ...rest] = argv;
  const options = {
    mode,
    platform: process.platform,
    arch: process.arch,
    target: '',
    outputDir: path.join(rootDir, 'artifacts', 'release'),
    releaseTag: '',
  };

  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    const next = rest[index + 1];

    if (token === '--platform') {
      options.platform = next;
      index += 1;
      continue;
    }

    if (token === '--output-dir') {
      options.outputDir = path.resolve(next);
      index += 1;
      continue;
    }

    if (token === '--arch') {
      options.arch = next;
      index += 1;
      continue;
    }

    if (token === '--target') {
      options.target = next;
      index += 1;
      continue;
    }

    if (token === '--release-tag') {
      options.releaseTag = next;
      index += 1;
      continue;
    }
  }

  return options;
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
        relativePath,
      });
    }
  }

  return files;
}

function ensureDirectory(directoryPath) {
  mkdirSync(directoryPath, { recursive: true });
}

function writeSha256File(filePath) {
  const checksum = createHash('sha256').update(readFileSync(filePath)).digest('hex');
  writeFileSync(
    `${filePath}.sha256.txt`,
    `${checksum}  ${path.basename(filePath)}\n`,
    'utf8',
  );
}

function packageDesktopAssets({ platform, arch, target, outputDir }) {
  const targetSpec = resolveDesktopReleaseTarget({
    targetTriple: target,
    platform,
    arch,
  });
  const platformId = normalizePlatformId(targetSpec.platform);
  const archId = normalizeDesktopArch(targetSpec.arch);
  const desktopBundleRoot = resolveDesktopBundleRoot({
    targetTriple: targetSpec.targetTriple,
  });

  if (!existsSync(desktopBundleRoot)) {
    throw new Error(`Missing desktop bundle output directory: ${desktopBundleRoot}`);
  }

  const bundleFiles = listFilesRecursively(desktopBundleRoot)
    .filter((file) => shouldIncludeDesktopBundleFile(platformId, file.relativePath));

  if (bundleFiles.length === 0) {
    throw new Error(
      `No desktop release assets matched ${platformId} under ${desktopBundleRoot}`,
    );
  }

  const platformOutputDir = path.join(outputDir, 'desktop', platformId, archId);
  rmSync(platformOutputDir, { recursive: true, force: true });
  ensureDirectory(platformOutputDir);

  for (const bundleFile of bundleFiles) {
    const targetPath = path.join(platformOutputDir, bundleFile.relativePath);
    ensureDirectory(path.dirname(targetPath));
    cpSync(bundleFile.absolutePath, targetPath);
    writeSha256File(targetPath);
  }
}

function runTarCommand(archivePath, workingDirectory, entryName) {
  const result = spawnSync('tar', ['-czf', archivePath, '-C', workingDirectory, entryName], {
    cwd: rootDir,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  if (result.error) {
    throw new Error(`tar failed while packaging ${archivePath}: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`tar failed while packaging ${archivePath} with exit code ${result.status ?? 'unknown'}`);
  }
}

function packageWebAssets({ releaseTag, outputDir }) {
  if (!existsSync(webDistDir)) {
    throw new Error(`Missing Claw web dist directory: ${webDistDir}`);
  }
  if (!existsSync(docsDistDir)) {
    throw new Error(`Missing Claw docs dist directory: ${docsDistDir}`);
  }

  const archiveBaseName = buildWebArchiveBaseName(releaseTag);
  ensureDirectory(outputDir);

  const stagingRoot = mkdtempSync(path.join(os.tmpdir(), 'claw-studio-release-web-'));
  const archiveRoot = path.join(stagingRoot, archiveBaseName);

  try {
    ensureDirectory(path.join(archiveRoot, 'web'));
    ensureDirectory(path.join(archiveRoot, 'docs'));
    cpSync(webDistDir, path.join(archiveRoot, 'web', 'dist'), { recursive: true });
    cpSync(docsDistDir, path.join(archiveRoot, 'docs', 'dist'), { recursive: true });

    const archivePath = path.join(outputDir, `${archiveBaseName}.tar.gz`);
    rmSync(archivePath, { force: true });
    rmSync(`${archivePath}.sha256.txt`, { force: true });
    runTarCommand(archivePath, stagingRoot, archiveBaseName);
    writeSha256File(archivePath);
  } finally {
    rmSync(stagingRoot, { recursive: true, force: true });
  }
}

function printUsage() {
  console.error(
    [
      'Usage:',
      '  node scripts/release/package-release-assets.mjs desktop --platform <windows|linux|macos> --arch <x64|arm64> --target <triple> --output-dir <dir>',
      '  node scripts/release/package-release-assets.mjs web --release-tag <tag> --output-dir <dir>',
    ].join('\n'),
  );
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!options.mode) {
    printUsage();
    process.exit(1);
  }

  ensureDirectory(options.outputDir);

  if (options.mode === 'desktop') {
    packageDesktopAssets(options);
    return;
  }

  if (options.mode === 'web') {
    packageWebAssets(options);
    return;
  }

  console.error(`Unsupported packaging mode: ${options.mode}`);
  printUsage();
  process.exit(1);
}

if (path.resolve(process.argv[1] ?? '') === __filename) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
