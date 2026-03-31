import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const rootDir = path.resolve(import.meta.dirname, '..', '..');

test('release profiles expose a reusable claw-studio release matrix with standard desktop bundle coverage', async () => {
  const profilePath = path.join(rootDir, 'scripts', 'release', 'release-profiles.mjs');
  assert.equal(existsSync(profilePath), true, 'missing scripts/release/release-profiles.mjs');

  const profiles = await import(pathToFileURL(profilePath).href);
  assert.equal(typeof profiles.resolveReleaseProfile, 'function');
  assert.equal(typeof profiles.resolveDesktopBundleTargets, 'function');
  assert.equal(typeof profiles.buildDesktopReleaseMatrix, 'function');

  const profile = profiles.resolveReleaseProfile('claw-studio');
  const matrix = profiles.buildDesktopReleaseMatrix('claw-studio');

  assert.equal(profile.id, 'claw-studio');
  assert.equal(profile.release.manifestFileName, 'release-manifest.json');
  assert.equal(profile.release.globalChecksumsFileName, 'SHA256SUMS.txt');
  assert.equal(profile.release.enableArtifactAttestations, true);
  assert.equal(matrix.length, 6);
  assert.deepEqual(
    profiles.resolveDesktopBundleTargets({
      profileId: 'claw-studio',
      platform: 'windows',
      arch: 'x64',
    }),
    ['nsis'],
  );
  assert.deepEqual(
    profiles.resolveDesktopBundleTargets({
      profileId: 'claw-studio',
      platform: 'linux',
      arch: 'x64',
    }),
    ['deb', 'rpm', 'appimage'],
  );
  assert.deepEqual(
    profiles.resolveDesktopBundleTargets({
      profileId: 'claw-studio',
      platform: 'macos',
      arch: 'arm64',
    }),
    ['app', 'dmg'],
  );
});
