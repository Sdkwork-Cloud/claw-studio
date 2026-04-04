import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const rootDir = path.resolve(import.meta.dirname, '..', '..');

test('release asset finalizer writes a global checksum manifest and release manifest from partial package outputs', async () => {
  const finalizerPath = path.join(rootDir, 'scripts', 'release', 'finalize-release-assets.mjs');
  assert.equal(existsSync(finalizerPath), true, 'missing scripts/release/finalize-release-assets.mjs');

  const finalizer = await import(pathToFileURL(finalizerPath).href);
  assert.equal(typeof finalizer.parseArgs, 'function');
  assert.equal(typeof finalizer.finalizeReleaseAssets, 'function');
  assert.throws(
    () => finalizer.parseArgs(['--release-tag']),
    /Missing value for --release-tag/,
  );

  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'claw-release-finalize-'));
  const releaseAssetsDir = path.join(tempRoot, 'release-assets');
  const windowsDir = path.join(releaseAssetsDir, 'desktop', 'windows', 'x64');
  const legacyWindowsDir = path.join(releaseAssetsDir, 'desktop', 'windows', 'nsis');
  const staleArm64WindowsDir = path.join(releaseAssetsDir, 'desktop', 'windows', 'arm64');
  const webDir = path.join(releaseAssetsDir, 'web');

  try {
    mkdirSync(windowsDir, { recursive: true });
    mkdirSync(legacyWindowsDir, { recursive: true });
    mkdirSync(staleArm64WindowsDir, { recursive: true });
    mkdirSync(webDir, { recursive: true });

    const windowsAssetPath = path.join(windowsDir, 'Claw.Studio_0.1.0_x64-setup.exe');
    const webAssetPath = path.join(webDir, 'claw-studio-web-assets-release-2026-03-31-03.tar.gz');
    const staleLegacyWindowsAssetPath = path.join(
      legacyWindowsDir,
      'Claw.Studio_0.1.0_x64-setup.exe',
    );
    const staleTopLevelWebAssetPath = path.join(
      releaseAssetsDir,
      'claw-studio-web-assets-release-2026-03-20-legacy.tar.gz',
    );
    const staleArm64WindowsAssetPath = path.join(
      staleArm64WindowsDir,
      'Claw.Studio_0.1.0_arm64-setup.exe',
    );

    writeFileSync(windowsAssetPath, 'windows-installer', 'utf8');
    writeFileSync(webAssetPath, 'web-assets', 'utf8');
    writeFileSync(staleLegacyWindowsAssetPath, 'stale-desktop-installer', 'utf8');
    writeFileSync(staleTopLevelWebAssetPath, 'stale-web-assets', 'utf8');
    writeFileSync(staleArm64WindowsAssetPath, 'stale-arm64-installer', 'utf8');
    writeFileSync(
      path.join(windowsDir, 'release-asset-manifest.json'),
      `${JSON.stringify({
        profileId: 'claw-studio',
        releaseTag: 'release-2026-03-31-03',
        platform: 'windows',
        arch: 'x64',
        artifacts: [
          {
            name: 'Claw.Studio_0.1.0_x64-setup.exe',
            relativePath: 'desktop/windows/x64/Claw.Studio_0.1.0_x64-setup.exe',
            platform: 'windows',
            arch: 'x64',
            kind: 'installer',
            sha256: 'placeholder',
            size: 17,
          },
        ],
      }, null, 2)}\n`,
      'utf8',
    );
    writeFileSync(
      path.join(webDir, 'release-asset-manifest.json'),
      `${JSON.stringify({
        profileId: 'claw-studio',
        releaseTag: 'release-2026-03-31-03',
        artifacts: [
          {
            name: 'claw-studio-web-assets-release-2026-03-31-03.tar.gz',
            relativePath: 'web/claw-studio-web-assets-release-2026-03-31-03.tar.gz',
            platform: 'web',
            arch: 'any',
            kind: 'archive',
            sha256: 'placeholder',
            size: 10,
          },
        ],
      }, null, 2)}\n`,
      'utf8',
    );
    writeFileSync(
      path.join(staleArm64WindowsDir, 'release-asset-manifest.json'),
      `${JSON.stringify({
        profileId: 'claw-studio',
        platform: 'windows',
        arch: 'arm64',
        artifacts: [
          {
            name: 'Claw.Studio_0.1.0_arm64-setup.exe',
            relativePath: 'desktop/windows/arm64/Claw.Studio_0.1.0_arm64-setup.exe',
            platform: 'windows',
            arch: 'arm64',
            kind: 'installer',
            sha256: 'placeholder',
            size: 21,
          },
        ],
      }, null, 2)}\n`,
      'utf8',
    );

    finalizer.finalizeReleaseAssets({
      profileId: 'claw-studio',
      releaseTag: 'release-2026-03-31-03',
      repository: 'Sdkwork-Cloud/claw-studio',
      releaseAssetsDir,
    });

    const manifestPath = path.join(releaseAssetsDir, 'release-manifest.json');
    const checksumPath = path.join(releaseAssetsDir, 'SHA256SUMS.txt');

    assert.equal(existsSync(manifestPath), true, 'missing release manifest');
    assert.equal(existsSync(checksumPath), true, 'missing global checksum manifest');

    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    const checksums = readFileSync(checksumPath, 'utf8');

    assert.equal(manifest.profileId, 'claw-studio');
    assert.equal(manifest.releaseTag, 'release-2026-03-31-03');
    assert.equal(manifest.repository, 'Sdkwork-Cloud/claw-studio');
    assert.equal(manifest.artifacts.length, 2);
    assert.doesNotMatch(
      checksums,
      /desktop\/windows\/nsis\/Claw\.Studio_0\.1\.0_x64-setup\.exe/,
    );
    assert.doesNotMatch(
      checksums,
      /claw-studio-web-assets-release-2026-03-20-legacy\.tar\.gz/,
    );
    assert.doesNotMatch(
      checksums,
      /desktop\/windows\/arm64\/Claw\.Studio_0\.1\.0_arm64-setup\.exe/,
    );
    assert.deepEqual(
      manifest.artifacts.map((artifact) => ({
        relativePath: artifact.relativePath,
        family: artifact.family,
        platform: artifact.platform,
        arch: artifact.arch,
        kind: artifact.kind,
      })),
      [
        {
          relativePath: 'desktop/windows/x64/Claw.Studio_0.1.0_x64-setup.exe',
          family: 'desktop',
          platform: 'windows',
          arch: 'x64',
          kind: 'installer',
        },
        {
          relativePath: 'web/claw-studio-web-assets-release-2026-03-31-03.tar.gz',
          family: 'web',
          platform: 'web',
          arch: 'any',
          kind: 'archive',
        },
      ],
    );
    assert.match(checksums, /desktop\/windows\/x64\/Claw\.Studio_0\.1\.0_x64-setup\.exe/);
    assert.match(checksums, /web\/claw-studio-web-assets-release-2026-03-31-03\.tar\.gz/);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('release asset finalizer infers multi-family metadata when fallback assets do not have partial manifests', async () => {
  const finalizerPath = path.join(rootDir, 'scripts', 'release', 'finalize-release-assets.mjs');
  const finalizer = await import(pathToFileURL(finalizerPath).href);

  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'claw-release-finalize-fallback-'));
  const releaseAssetsDir = path.join(tempRoot, 'release-assets');
  const serverDir = path.join(releaseAssetsDir, 'server', 'linux', 'x64');
  const containerDir = path.join(releaseAssetsDir, 'container', 'linux', 'arm64', 'cpu');
  const kubernetesDir = path.join(releaseAssetsDir, 'kubernetes', 'linux', 'x64', 'nvidia-cuda');

  try {
    mkdirSync(serverDir, { recursive: true });
    mkdirSync(containerDir, { recursive: true });
    mkdirSync(kubernetesDir, { recursive: true });

    writeFileSync(
      path.join(serverDir, 'claw-studio-server-release-2026-04-03-05-linux-x64.tar.gz'),
      'server-asset',
      'utf8',
    );
    writeFileSync(
      path.join(containerDir, 'claw-studio-container-bundle-release-2026-04-03-05-linux-arm64-cpu.tar.gz'),
      'container-asset',
      'utf8',
    );
    writeFileSync(
      path.join(kubernetesDir, 'claw-studio-kubernetes-bundle-release-2026-04-03-05-linux-x64-nvidia-cuda.tar.gz'),
      'kubernetes-asset',
      'utf8',
    );

    finalizer.finalizeReleaseAssets({
      profileId: 'claw-studio',
      releaseTag: 'release-2026-04-03-05',
      repository: 'Sdkwork-Cloud/claw-studio',
      releaseAssetsDir,
    });

    const manifest = JSON.parse(
      readFileSync(path.join(releaseAssetsDir, 'release-manifest.json'), 'utf8'),
    );

    assert.deepEqual(
      manifest.artifacts.map((artifact) => ({
        relativePath: artifact.relativePath,
        family: artifact.family,
        platform: artifact.platform,
        arch: artifact.arch,
        accelerator: artifact.accelerator,
        kind: artifact.kind,
      })),
      [
        {
          relativePath: 'container/linux/arm64/cpu/claw-studio-container-bundle-release-2026-04-03-05-linux-arm64-cpu.tar.gz',
          family: 'container',
          platform: 'linux',
          arch: 'arm64',
          accelerator: 'cpu',
          kind: 'archive',
        },
        {
          relativePath: 'kubernetes/linux/x64/nvidia-cuda/claw-studio-kubernetes-bundle-release-2026-04-03-05-linux-x64-nvidia-cuda.tar.gz',
          family: 'kubernetes',
          platform: 'linux',
          arch: 'x64',
          accelerator: 'nvidia-cuda',
          kind: 'archive',
        },
        {
          relativePath: 'server/linux/x64/claw-studio-server-release-2026-04-03-05-linux-x64.tar.gz',
          family: 'server',
          platform: 'linux',
          arch: 'x64',
          accelerator: undefined,
          kind: 'archive',
        },
      ],
    );
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});
