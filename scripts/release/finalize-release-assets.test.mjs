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
  assert.equal(typeof finalizer.finalizeReleaseAssets, 'function');

  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'claw-release-finalize-'));
  const releaseAssetsDir = path.join(tempRoot, 'release-assets');
  const windowsDir = path.join(releaseAssetsDir, 'desktop', 'windows', 'x64');
  const webDir = path.join(releaseAssetsDir, 'web');

  try {
    mkdirSync(windowsDir, { recursive: true });
    mkdirSync(webDir, { recursive: true });

    const windowsAssetPath = path.join(windowsDir, 'Claw.Studio_0.1.0_x64-setup.exe');
    const webAssetPath = path.join(webDir, 'claw-studio-web-assets-release-2026-03-31-03.tar.gz');

    writeFileSync(windowsAssetPath, 'windows-installer', 'utf8');
    writeFileSync(webAssetPath, 'web-assets', 'utf8');
    writeFileSync(
      path.join(windowsDir, 'release-asset-manifest.json'),
      `${JSON.stringify({
        profileId: 'claw-studio',
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
    assert.match(checksums, /desktop\/windows\/x64\/Claw\.Studio_0\.1\.0_x64-setup\.exe/);
    assert.match(checksums, /web\/claw-studio-web-assets-release-2026-03-31-03\.tar\.gz/);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});
