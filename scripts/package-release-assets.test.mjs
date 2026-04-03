import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { gunzipSync } from 'node:zlib';

const rootDir = path.resolve(import.meta.dirname, '..');

function writeSyntheticServerRuntime({
  serverTargetDir,
  targetTriple,
  binaryName,
  webDistDir,
  envExamplePath,
} = {}) {
  const serverBinaryPath = path.join(serverTargetDir, targetTriple, 'release', binaryName);
  mkdirSync(path.dirname(serverBinaryPath), { recursive: true });
  mkdirSync(path.join(webDistDir, 'assets'), { recursive: true });
  writeFileSync(serverBinaryPath, 'synthetic binary\n', 'utf8');
  writeFileSync(path.join(webDistDir, 'index.html'), '<html><body>synthetic web</body></html>\n', 'utf8');
  writeFileSync(path.join(webDistDir, 'assets', 'index.js'), 'console.log("synthetic");\n', 'utf8');
  writeFileSync(
    envExamplePath,
    'CLAW_SERVER_HOST=0.0.0.0\nCLAW_SERVER_PORT=18797\nCLAW_SERVER_WEB_DIST=../sdkwork-claw-web/dist\n',
    'utf8',
  );
}

function parseTarOctal(buffer) {
  const trimmed = buffer.toString('utf8').replace(/\0.*$/, '').trim();
  if (!trimmed) {
    return 0;
  }

  return Number.parseInt(trimmed, 8);
}

function readTarGzEntries(archivePath) {
  const archiveBuffer = gunzipSync(readFileSync(archivePath));
  const entries = new Map();
  let offset = 0;

  while (offset + 512 <= archiveBuffer.length) {
    const header = archiveBuffer.subarray(offset, offset + 512);
    const isEmptyHeader = header.every((value) => value === 0);
    if (isEmptyHeader) {
      break;
    }

    const name = header.subarray(0, 100).toString('utf8').replace(/\0.*$/, '');
    const prefix = header.subarray(345, 500).toString('utf8').replace(/\0.*$/, '');
    const fullName = prefix ? `${prefix}/${name}` : name;
    const size = parseTarOctal(header.subarray(124, 136));
    const typeFlag = header.subarray(156, 157).toString('utf8').replace(/\0.*$/, '');
    const contentStart = offset + 512;
    const contentEnd = contentStart + size;

    entries.set(fullName, {
      type: typeFlag || '0',
      content: archiveBuffer.subarray(contentStart, contentEnd),
    });

    offset = contentStart + Math.ceil(size / 512) * 512;
  }

  return entries;
}

test('release asset packager archives macOS app bundles into release-safe zip assets', async () => {
  const packagerPath = path.join(rootDir, 'scripts', 'release', 'package-release-assets.mjs');
  const packager = await import(pathToFileURL(packagerPath).href);

  assert.equal(typeof packager.packageDesktopAssets, 'function');

  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'claw-release-macos-app-'));
  const targetDir = path.join(tempRoot, 'target');
  const bundleRoot = path.join(targetDir, 'x86_64-apple-darwin', 'release', 'bundle', 'macos');
  const appDir = path.join(bundleRoot, 'Claw Studio.app');
  const outputDir = path.join(tempRoot, 'release-assets');
  const tauriConfigPath = path.join(tempRoot, 'tauri.conf.json');

  try {
    mkdirSync(path.join(appDir, 'Contents', 'MacOS'), { recursive: true });
    writeFileSync(path.join(appDir, 'Contents', 'Info.plist'), '<plist version="1.0"></plist>\n');
    writeFileSync(path.join(appDir, 'Contents', 'MacOS', 'claw-studio'), '#!/bin/sh\n');
    writeFileSync(
      tauriConfigPath,
      `${JSON.stringify({ productName: 'Claw Studio', version: '0.1.0' }, null, 2)}\n`,
      'utf8',
    );

    packager.packageDesktopAssets({
      platform: 'macos',
      arch: 'x64',
      target: 'x86_64-apple-darwin',
      outputDir,
      targetDir,
      tauriConfigPath,
    });

    const archivePath = path.join(
      outputDir,
      'desktop',
      'macos',
      'x64',
      'macos',
      'Claw Studio_0.1.0_x64.app.zip',
    );
    const checksumPath = `${archivePath}.sha256.txt`;
    const manifestPath = path.join(
      outputDir,
      'desktop',
      'macos',
      'x64',
      'release-asset-manifest.json',
    );

    assert.equal(existsSync(archivePath), true, `missing expected archive ${archivePath}`);
    assert.equal(existsSync(checksumPath), true, `missing expected checksum ${checksumPath}`);
    assert.match(
      readFileSync(checksumPath, 'utf8'),
      /Claw Studio_0\.1\.0_x64\.app\.zip/,
    );
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    assert.equal(manifest.artifacts.length, 1);
    assert.equal(manifest.artifacts[0].family, 'desktop');
    assert.equal(
      manifest.artifacts[0].relativePath,
      'desktop/macos/x64/macos/Claw Studio_0.1.0_x64.app.zip',
    );
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('release asset packager exposes desktop, web, server, container, and kubernetes packaging entrypoints', async () => {
  const packagerPath = path.join(rootDir, 'scripts', 'release', 'package-release-assets.mjs');
  const packager = await import(pathToFileURL(packagerPath).href);

  assert.equal(typeof packager.parseArgs, 'function');
  assert.equal(typeof packager.packageDesktopAssets, 'function');
  assert.equal(typeof packager.packageWebAssets, 'function');
  assert.equal(typeof packager.packageServerAssets, 'function');
  assert.equal(typeof packager.packageContainerAssets, 'function');
  assert.equal(typeof packager.packageKubernetesAssets, 'function');
  assert.equal(typeof packager.buildServerArchiveBaseName, 'function');
  assert.equal(typeof packager.buildDeploymentBundleBaseName, 'function');

  assert.equal(
    packager.buildServerArchiveBaseName({
      releaseTag: 'release-2026-04-03-01',
      platform: 'windows',
      arch: 'x64',
    }),
    'claw-studio-server-release-2026-04-03-01-windows-x64',
  );
  assert.equal(
    packager.buildDeploymentBundleBaseName({
      family: 'container',
      releaseTag: 'release-2026-04-03-01',
      platform: 'linux',
      arch: 'arm64',
      accelerator: 'cpu',
    }),
    'claw-studio-container-bundle-release-2026-04-03-01-linux-arm64-cpu',
  );
  assert.equal(
    packager.buildDeploymentBundleBaseName({
      family: 'kubernetes',
      releaseTag: 'release-2026-04-03-01',
      platform: 'linux',
      arch: 'x64',
      accelerator: 'nvidia-cuda',
    }),
    'claw-studio-kubernetes-bundle-release-2026-04-03-01-linux-x64-nvidia-cuda',
  );
  assert.throws(
    () => packager.parseArgs(['server', '--release-tag']),
    /Missing value for --release-tag/,
  );
});

test('web asset packager archives built web and docs outputs with family metadata', async () => {
  const packagerPath = path.join(rootDir, 'scripts', 'release', 'package-release-assets.mjs');
  const packager = await import(pathToFileURL(packagerPath).href);

  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'claw-release-web-'));
  const outputDir = path.join(tempRoot, 'release-assets');
  const webBuildDir = path.join(tempRoot, 'web-dist');
  const docsBuildDir = path.join(tempRoot, 'docs-dist');
  const releaseTag = 'release-2026-04-03-06';

  try {
    mkdirSync(path.join(webBuildDir, 'assets'), { recursive: true });
    mkdirSync(path.join(docsBuildDir, 'guide'), { recursive: true });
    writeFileSync(path.join(webBuildDir, 'index.html'), '<html><body>web</body></html>\n', 'utf8');
    writeFileSync(path.join(webBuildDir, 'assets', 'index.js'), 'console.log("web");\n', 'utf8');
    writeFileSync(path.join(docsBuildDir, 'index.html'), '<html><body>docs</body></html>\n', 'utf8');
    writeFileSync(path.join(docsBuildDir, 'guide', 'intro.html'), '<html><body>guide</body></html>\n', 'utf8');

    packager.packageWebAssets({
      releaseTag,
      outputDir,
      webBuildDir,
      docsBuildDir,
    });

    const archivePath = path.join(
      outputDir,
      `claw-studio-web-assets-${releaseTag}.tar.gz`,
    );
    const manifestPath = path.join(outputDir, 'web', 'release-asset-manifest.json');
    const archiveEntries = readTarGzEntries(archivePath);
    const bundleRoot = `claw-studio-web-assets-${releaseTag}`;

    assert.equal(existsSync(archivePath), true, `missing expected web archive ${archivePath}`);
    assert.equal(existsSync(`${archivePath}.sha256.txt`), true, 'missing expected web checksum');
    assert.equal(archiveEntries.has(`${bundleRoot}/web/dist/index.html`), true);
    assert.equal(archiveEntries.has(`${bundleRoot}/docs/dist/index.html`), true);
    assert.equal(archiveEntries.has(`${bundleRoot}/docs/dist/guide/intro.html`), true);

    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    assert.equal(manifest.artifacts.length, 1);
    assert.equal(manifest.artifacts[0].family, 'web');
    assert.equal(manifest.artifacts[0].platform, 'web');
    assert.equal(manifest.artifacts[0].arch, 'any');
    assert.equal(
      manifest.artifacts[0].relativePath,
      `claw-studio-web-assets-${releaseTag}.tar.gz`,
    );
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('server asset packager bundles the embedded runtime, launchers, and manifest metadata', async () => {
  const packagerPath = path.join(rootDir, 'scripts', 'release', 'package-release-assets.mjs');
  const packager = await import(pathToFileURL(packagerPath).href);

  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'claw-release-server-'));
  const outputDir = path.join(tempRoot, 'release-assets');
  const serverTargetDir = path.join(tempRoot, 'server-target');
  const webDistDir = path.join(tempRoot, 'web-dist');
  const envExamplePath = path.join(tempRoot, '.env.example');
  const releaseTag = 'release-2026-04-03-02';

  try {
    writeSyntheticServerRuntime({
      serverTargetDir,
      targetTriple: 'x86_64-unknown-linux-gnu',
      binaryName: 'sdkwork-claw-server',
      webDistDir,
      envExamplePath,
    });

    packager.packageServerAssets({
      releaseTag,
      platform: 'linux',
      arch: 'x64',
      target: 'x86_64-unknown-linux-gnu',
      outputDir,
      serverBuildTargetDir: serverTargetDir,
      serverWebDistDir: webDistDir,
      serverEnvPath: envExamplePath,
    });

    const archivePath = path.join(
      outputDir,
      'server',
      'linux',
      'x64',
      `claw-studio-server-${releaseTag}-linux-x64.tar.gz`,
    );
    const manifestPath = path.join(
      outputDir,
      'server',
      'linux',
      'x64',
      'release-asset-manifest.json',
    );
    const bundleRoot = `claw-studio-server-${releaseTag}-linux-x64`;
    const archiveEntries = readTarGzEntries(archivePath);

    assert.equal(existsSync(archivePath), true, `missing expected server archive ${archivePath}`);
    assert.equal(existsSync(`${archivePath}.sha256.txt`), true, 'missing expected server checksum');
    assert.equal(archiveEntries.has(`${bundleRoot}/bin/sdkwork-claw-server`), true);
    assert.equal(archiveEntries.has(`${bundleRoot}/web/dist/index.html`), true);
    assert.equal(archiveEntries.has(`${bundleRoot}/.env.example`), true);
    assert.equal(archiveEntries.has(`${bundleRoot}/start-claw-server.sh`), true);
    assert.equal(archiveEntries.has(`${bundleRoot}/README.md`), true);
    assert.match(
      archiveEntries.get(`${bundleRoot}/start-claw-server.sh`).content.toString('utf8'),
      /CLAW_SERVER_WEB_DIST="\$\{CLAW_SERVER_WEB_DIST:-\$SCRIPT_DIR\/web\/dist\}"/,
    );

    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    assert.equal(manifest.platform, 'linux');
    assert.equal(manifest.arch, 'x64');
    assert.equal(manifest.artifacts.length, 1);
    assert.equal(manifest.artifacts[0].family, 'server');
    assert.equal(
      manifest.artifacts[0].relativePath,
      `server/linux/x64/claw-studio-server-${releaseTag}-linux-x64.tar.gz`,
    );
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('container asset packager bundles deployment overlays, app runtime, and release metadata', async () => {
  const packagerPath = path.join(rootDir, 'scripts', 'release', 'package-release-assets.mjs');
  const packager = await import(pathToFileURL(packagerPath).href);

  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'claw-release-container-'));
  const outputDir = path.join(tempRoot, 'release-assets');
  const serverTargetDir = path.join(tempRoot, 'server-target');
  const webDistDir = path.join(tempRoot, 'web-dist');
  const envExamplePath = path.join(tempRoot, '.env.example');
  const deployDir = path.join(tempRoot, 'deploy-docker');
  const releaseTag = 'release-2026-04-03-03';

  try {
    writeSyntheticServerRuntime({
      serverTargetDir,
      targetTriple: 'x86_64-unknown-linux-gnu',
      binaryName: 'sdkwork-claw-server',
      webDistDir,
      envExamplePath,
    });

    mkdirSync(path.join(deployDir, 'profiles'), { recursive: true });
    writeFileSync(path.join(deployDir, 'Dockerfile'), 'FROM scratch\n', 'utf8');
    writeFileSync(path.join(deployDir, 'docker-compose.yml'), 'services: {}\n', 'utf8');
    writeFileSync(path.join(deployDir, 'docker-compose.nvidia-cuda.yml'), 'services: {}\n', 'utf8');
    writeFileSync(path.join(deployDir, 'docker-compose.amd-rocm.yml'), 'services: {}\n', 'utf8');
    writeFileSync(path.join(deployDir, 'profiles', 'default.env'), 'CLAW_SERVER_PORT=18797\n', 'utf8');
    writeFileSync(path.join(deployDir, '.dockerignore'), 'node_modules\n', 'utf8');

    packager.packageContainerAssets({
      releaseTag,
      platform: 'linux',
      arch: 'x64',
      target: 'x86_64-unknown-linux-gnu',
      accelerator: 'nvidia-cuda',
      outputDir,
      serverBuildTargetDir: serverTargetDir,
      serverWebDistDir: webDistDir,
      serverEnvPath: envExamplePath,
      deploymentSourceDir: deployDir,
    });

    const archivePath = path.join(
      outputDir,
      'container',
      'linux',
      'x64',
      'nvidia-cuda',
      `claw-studio-container-bundle-${releaseTag}-linux-x64-nvidia-cuda.tar.gz`,
    );
    const manifestPath = path.join(
      outputDir,
      'container',
      'linux',
      'x64',
      'nvidia-cuda',
      'release-asset-manifest.json',
    );
    const bundleRoot = `claw-studio-container-bundle-${releaseTag}-linux-x64-nvidia-cuda`;
    const archiveEntries = readTarGzEntries(archivePath);

    assert.equal(existsSync(archivePath), true, `missing expected container archive ${archivePath}`);
    assert.equal(existsSync(`${archivePath}.sha256.txt`), true, 'missing expected container checksum');
    assert.equal(archiveEntries.has(`${bundleRoot}/app/bin/sdkwork-claw-server`), true);
    assert.equal(archiveEntries.has(`${bundleRoot}/app/start-claw-server.sh`), true);
    assert.equal(archiveEntries.has(`${bundleRoot}/deploy/Dockerfile`), true);
    assert.equal(archiveEntries.has(`${bundleRoot}/deploy/docker-compose.nvidia-cuda.yml`), true);
    assert.equal(archiveEntries.has(`${bundleRoot}/deploy/profiles/default.env`), true);
    assert.equal(archiveEntries.has(`${bundleRoot}/.dockerignore`), true);
    assert.match(
      archiveEntries.get(`${bundleRoot}/release-metadata.json`).content.toString('utf8'),
      /"accelerator": "nvidia-cuda"/,
    );

    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    assert.equal(manifest.platform, 'linux');
    assert.equal(manifest.arch, 'x64');
    assert.equal(manifest.artifacts[0].family, 'container');
    assert.equal(manifest.artifacts[0].accelerator, 'nvidia-cuda');
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('kubernetes asset packager bundles chart assets and generated release values', async () => {
  const packagerPath = path.join(rootDir, 'scripts', 'release', 'package-release-assets.mjs');
  const packager = await import(pathToFileURL(packagerPath).href);

  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'claw-release-kubernetes-'));
  const outputDir = path.join(tempRoot, 'release-assets');
  const deployDir = path.join(tempRoot, 'deploy-kubernetes');
  const releaseTag = 'release-2026-04-03-04';

  try {
    mkdirSync(path.join(deployDir, 'templates'), { recursive: true });
    writeFileSync(path.join(deployDir, 'Chart.yaml'), 'apiVersion: v2\nname: claw-studio\n', 'utf8');
    writeFileSync(path.join(deployDir, 'values.yaml'), 'replicaCount: 1\n', 'utf8');
    writeFileSync(path.join(deployDir, 'values-amd-rocm.yaml'), 'resources: {}\n', 'utf8');
    writeFileSync(path.join(deployDir, 'templates', 'service.yaml'), 'apiVersion: v1\nkind: Service\n', 'utf8');

    packager.packageKubernetesAssets({
      releaseTag,
      platform: 'linux',
      arch: 'arm64',
      accelerator: 'amd-rocm',
      outputDir,
      deploymentSourceDir: deployDir,
    });

    const archivePath = path.join(
      outputDir,
      'kubernetes',
      'linux',
      'arm64',
      'amd-rocm',
      `claw-studio-kubernetes-bundle-${releaseTag}-linux-arm64-amd-rocm.tar.gz`,
    );
    const manifestPath = path.join(
      outputDir,
      'kubernetes',
      'linux',
      'arm64',
      'amd-rocm',
      'release-asset-manifest.json',
    );
    const bundleRoot = `claw-studio-kubernetes-bundle-${releaseTag}-linux-arm64-amd-rocm`;
    const archiveEntries = readTarGzEntries(archivePath);

    assert.equal(existsSync(archivePath), true, `missing expected kubernetes archive ${archivePath}`);
    assert.equal(existsSync(`${archivePath}.sha256.txt`), true, 'missing expected kubernetes checksum');
    assert.equal(archiveEntries.has(`${bundleRoot}/chart/Chart.yaml`), true);
    assert.equal(archiveEntries.has(`${bundleRoot}/chart/values-amd-rocm.yaml`), true);
    assert.equal(archiveEntries.has(`${bundleRoot}/chart/templates/service.yaml`), true);
    assert.match(
      archiveEntries.get(`${bundleRoot}/values.release.yaml`).content.toString('utf8'),
      /targetArchitecture: arm64/,
    );
    assert.match(
      archiveEntries.get(`${bundleRoot}/values.release.yaml`).content.toString('utf8'),
      /acceleratorProfile: amd-rocm/,
    );
    assert.match(
      archiveEntries.get(`${bundleRoot}/release-metadata.json`).content.toString('utf8'),
      /"family": "kubernetes"/,
    );

    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    assert.equal(manifest.platform, 'linux');
    assert.equal(manifest.arch, 'arm64');
    assert.equal(manifest.artifacts[0].family, 'kubernetes');
    assert.equal(manifest.artifacts[0].accelerator, 'amd-rocm');
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});
