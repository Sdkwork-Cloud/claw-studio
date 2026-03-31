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
import {
  DEFAULT_RELEASE_PROFILE_ID,
  resolveReleaseProfile,
} from './release-profiles.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');
const webDistDir = path.join(rootDir, 'packages', 'sdkwork-claw-web', 'dist');
const docsDistDir = path.join(rootDir, 'docs', '.vitepress', 'dist');
const desktopTargetDir = path.join(
  rootDir,
  'packages',
  'sdkwork-claw-desktop',
  'src-tauri',
  'target',
);
const desktopTauriConfigPath = path.join(
  rootDir,
  'packages',
  'sdkwork-claw-desktop',
  'src-tauri',
  'tauri.conf.json',
);

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

export function buildDesktopBundleRootCandidates({
  targetTriple = '',
  targetDir = desktopTargetDir,
} = {}) {
  const normalizedTargetTriple = String(targetTriple ?? '').trim();
  const candidates = [];

  if (normalizedTargetTriple.length > 0) {
    candidates.push(path.join(targetDir, normalizedTargetTriple, 'release', 'bundle'));
  }

  candidates.push(path.join(targetDir, 'release', 'bundle'));

  return [...new Set(candidates)];
}

export function resolveDesktopBundleRoot({
  targetTriple = '',
  targetDir = desktopTargetDir,
} = {}) {
  return buildDesktopBundleRootCandidates({
    targetTriple,
    targetDir,
  })[0];
}

export function resolveExistingDesktopBundleRoot({
  targetTriple = '',
  targetDir = desktopTargetDir,
} = {}) {
  const candidates = buildDesktopBundleRootCandidates({
    targetTriple,
    targetDir,
  });

  return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0];
}

function parseArgs(argv) {
  const [mode, ...rest] = argv;
  const options = {
    profileId: DEFAULT_RELEASE_PROFILE_ID,
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

    if (token === '--profile') {
      options.profileId = next ?? DEFAULT_RELEASE_PROFILE_ID;
      index += 1;
      continue;
    }

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
  return checksum;
}

export function readDesktopTauriBundleMetadata(tauriConfigPath = desktopTauriConfigPath) {
  const tauriConfig = JSON.parse(readFileSync(tauriConfigPath, 'utf8'));
  const productName = String(tauriConfig?.productName ?? '').trim();
  const version = String(tauriConfig?.version ?? '').trim();

  if (!productName) {
    throw new Error(`Missing productName in desktop Tauri config: ${tauriConfigPath}`);
  }
  if (!version) {
    throw new Error(`Missing version in desktop Tauri config: ${tauriConfigPath}`);
  }

  return {
    productName,
    version,
  };
}

export function buildMacosAppArchiveBaseName({ appBundleName, version, arch }) {
  const normalizedAppBundleName = String(appBundleName ?? '').trim().replace(/\.app$/i, '');
  const normalizedVersion = String(version ?? '').trim();
  const normalizedArch = normalizeDesktopArch(arch);

  if (!normalizedAppBundleName) {
    throw new Error('appBundleName is required to archive macOS app bundles.');
  }
  if (!normalizedVersion) {
    throw new Error('version is required to archive macOS app bundles.');
  }

  return `${normalizedAppBundleName}_${normalizedVersion}_${normalizedArch}`;
}

function listMacosAppBundleDirectories(macosBundleRoot) {
  if (!existsSync(macosBundleRoot)) {
    return [];
  }

  return readdirSync(macosBundleRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.endsWith('.app'))
    .map((entry) => ({
      name: entry.name,
      absolutePath: path.join(macosBundleRoot, entry.name),
    }));
}

function runZipCommand(archivePath, workingDirectory, entryName) {
  const normalizedEntryName = String(entryName ?? '').trim();
  if (!normalizedEntryName) {
    throw new Error('entryName is required to create a zip archive.');
  }

  const zipResult =
    process.platform === 'win32'
      ? spawnSync(
          'powershell',
          [
            '-NoLogo',
            '-NoProfile',
            '-Command',
            'Compress-Archive -LiteralPath $env:SDKWORK_ZIP_SOURCE -DestinationPath $env:SDKWORK_ZIP_DESTINATION -Force',
          ],
          {
            cwd: rootDir,
            stdio: 'inherit',
            env: {
              ...process.env,
              SDKWORK_ZIP_SOURCE: path.join(workingDirectory, normalizedEntryName),
              SDKWORK_ZIP_DESTINATION: archivePath,
            },
          },
        )
      : spawnSync(
          process.platform === 'darwin' ? 'ditto' : 'zip',
          process.platform === 'darwin'
            ? ['-c', '-k', '--sequesterRsrc', '--keepParent', normalizedEntryName, archivePath]
            : ['-r', '-y', archivePath, normalizedEntryName],
          {
            cwd: workingDirectory,
            stdio: 'inherit',
          },
        );

  if (zipResult.error) {
    throw new Error(`zip failed while packaging ${archivePath}: ${zipResult.error.message}`);
  }
  if (zipResult.status !== 0) {
    throw new Error(`zip failed while packaging ${archivePath} with exit code ${zipResult.status ?? 'unknown'}`);
  }
}

function packageMacosAppArchives({
  desktopBundleRoot,
  platformOutputDir,
  archId,
  tauriConfigPath = desktopTauriConfigPath,
} = {}) {
  const macosBundleRoot = path.join(desktopBundleRoot, 'macos');
  const appBundles = listMacosAppBundleDirectories(macosBundleRoot);
  if (appBundles.length === 0) {
    return [];
  }

  const { version } = readDesktopTauriBundleMetadata(tauriConfigPath);
  const emittedFiles = [];

  for (const appBundle of appBundles) {
    const archiveBaseName = buildMacosAppArchiveBaseName({
      appBundleName: appBundle.name,
      version,
      arch: archId,
    });
    const archivePath = path.join(platformOutputDir, 'macos', `${archiveBaseName}.app.zip`);
    ensureDirectory(path.dirname(archivePath));
    rmSync(archivePath, { force: true });
    rmSync(`${archivePath}.sha256.txt`, { force: true });
    runZipCommand(archivePath, macosBundleRoot, appBundle.name);
    emittedFiles.push({
      archivePath,
      checksum: writeSha256File(archivePath),
      size: statSync(archivePath).size,
    });
  }

  return emittedFiles;
}

export function packageDesktopAssets({
  profileId = DEFAULT_RELEASE_PROFILE_ID,
  platform,
  arch,
  target,
  outputDir,
  targetDir = desktopTargetDir,
  tauriConfigPath = desktopTauriConfigPath,
}) {
  const releaseProfile = resolveReleaseProfile(profileId);
  const targetSpec = resolveDesktopReleaseTarget({
    targetTriple: target,
    platform,
    arch,
  });
  const platformId = normalizePlatformId(targetSpec.platform);
  const archId = normalizeDesktopArch(targetSpec.arch);
  const desktopBundleRoot = resolveExistingDesktopBundleRoot({
    targetTriple: targetSpec.targetTriple,
    targetDir,
  });

  if (!existsSync(desktopBundleRoot)) {
    const candidateMessage = buildDesktopBundleRootCandidates({
      targetTriple: targetSpec.targetTriple,
      targetDir,
    }).join(', ');
    throw new Error(`Missing desktop bundle output directory. Checked: ${candidateMessage}`);
  }

  const bundleFiles = listFilesRecursively(desktopBundleRoot)
    .filter((file) => shouldIncludeDesktopBundleFile(platformId, file.relativePath));

  const platformOutputDir = path.join(outputDir, 'desktop', platformId, archId);
  rmSync(platformOutputDir, { recursive: true, force: true });
  ensureDirectory(platformOutputDir);
  const emittedFiles = [];
  const emittedArtifacts = [];

  if (platformId === 'macos') {
    const macosArchives = packageMacosAppArchives({
        desktopBundleRoot,
        platformOutputDir,
        archId,
        tauriConfigPath,
      });
    emittedFiles.push(...macosArchives.map((archive) => archive.archivePath));
    emittedArtifacts.push(
      ...macosArchives.map((archive) => ({
        name: path.basename(archive.archivePath),
        relativePath: path.relative(outputDir, archive.archivePath).replaceAll('\\', '/'),
        platform: platformId,
        arch: archId,
        kind: 'archive',
        sha256: archive.checksum,
        size: archive.size,
      })),
    );
  }

  for (const bundleFile of bundleFiles) {
    const targetPath = path.join(platformOutputDir, bundleFile.relativePath);
    ensureDirectory(path.dirname(targetPath));
    cpSync(bundleFile.absolutePath, targetPath);
    const checksum = writeSha256File(targetPath);
    emittedFiles.push(targetPath);
    emittedArtifacts.push({
      name: path.basename(targetPath),
      relativePath: path.relative(outputDir, targetPath).replaceAll('\\', '/'),
      platform: platformId,
      arch: archId,
      kind: buildArtifactKind(platformId, bundleFile.relativePath),
      sha256: checksum,
      size: statSync(targetPath).size,
    });
  }

  if (emittedFiles.length === 0) {
    throw new Error(
      `No desktop release assets matched ${platformId} under ${desktopBundleRoot}`,
    );
  }

  writeReleaseAssetManifest({
    manifestPath: path.join(platformOutputDir, releaseProfile.release.partialManifestFileName),
    profileId: releaseProfile.id,
    productName: releaseProfile.productName,
    platform: platformId,
    arch: archId,
    artifacts: emittedArtifacts,
  });
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

function packageWebAssets({
  profileId = DEFAULT_RELEASE_PROFILE_ID,
  releaseTag,
  outputDir,
}) {
  const releaseProfile = resolveReleaseProfile(profileId);
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
    const checksum = writeSha256File(archivePath);
    const webOutputDir = path.join(outputDir, 'web');
    ensureDirectory(webOutputDir);
    writeReleaseAssetManifest({
      manifestPath: path.join(webOutputDir, releaseProfile.release.partialManifestFileName),
      profileId: releaseProfile.id,
      productName: releaseProfile.productName,
      artifacts: [
        {
          name: path.basename(archivePath),
          relativePath: path.relative(outputDir, archivePath).replaceAll('\\', '/'),
          platform: 'web',
          arch: 'any',
          kind: 'archive',
          sha256: checksum,
          size: statSync(archivePath).size,
        },
      ],
    });
  } finally {
    rmSync(stagingRoot, { recursive: true, force: true });
  }
}

function buildArtifactKind(platformId, relativePath) {
  const normalizedPath = relativePath.replaceAll('\\', '/').toLowerCase();
  if (platformId === 'windows' || normalizedPath.endsWith('.dmg')) {
    return 'installer';
  }
  if (normalizedPath.endsWith('.deb') || normalizedPath.endsWith('.rpm') || normalizedPath.endsWith('.appimage')) {
    return 'package';
  }
  return 'archive';
}

function writeReleaseAssetManifest({
  manifestPath,
  profileId,
  productName,
  platform,
  arch,
  artifacts,
}) {
  writeFileSync(
    manifestPath,
    `${JSON.stringify({
      profileId,
      productName,
      platform,
      arch,
      artifacts,
    }, null, 2)}\n`,
    'utf8',
  );
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
