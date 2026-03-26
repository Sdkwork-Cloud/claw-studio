import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const rootDir = path.resolve(import.meta.dirname, '..');

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

    assert.equal(existsSync(archivePath), true, `missing expected archive ${archivePath}`);
    assert.equal(existsSync(checksumPath), true, `missing expected checksum ${checksumPath}`);
    assert.match(
      readFileSync(checksumPath, 'utf8'),
      /Claw Studio_0\.1\.0_x64\.app\.zip/,
    );
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});
