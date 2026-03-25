import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const rootDir = path.resolve(import.meta.dirname, '..');

function read(relativePath) {
  return readFileSync(path.join(rootDir, relativePath), 'utf8');
}

test('repository exposes a cross-platform claw-studio release workflow', () => {
  const workflowPath = path.join(rootDir, '.github', 'workflows', 'release.yml');
  assert.equal(existsSync(workflowPath), true, 'missing .github/workflows/release.yml');

  const workflow = read('.github/workflows/release.yml');

  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /push:\s*[\s\S]*tags:\s*[\s\S]*release-\*/);
  assert.match(workflow, /windows-latest/);
  assert.match(workflow, /ubuntu-22\.04|ubuntu-latest/);
  assert.match(workflow, /macos-latest/);
  assert.match(workflow, /pnpm install --frozen-lockfile/);
  assert.match(workflow, /pnpm build/);
  assert.match(workflow, /pnpm docs:build/);
  assert.match(workflow, /node scripts\/run-desktop-release-build\.mjs/);
  assert.match(workflow, /node scripts\/release\/package-release-assets\.mjs desktop/);
  assert.match(workflow, /node scripts\/release\/package-release-assets\.mjs web/);
  assert.match(workflow, /softprops\/action-gh-release@/);
  assert.match(workflow, /CMAKE_GENERATOR:\s*Visual Studio 17 2022/);
});

test('root package exposes release helper scripts for desktop and asset packaging', () => {
  const rootPackage = JSON.parse(read('package.json'));

  assert.match(rootPackage.scripts['release:desktop'], /node scripts\/run-desktop-release-build\.mjs/);
  assert.match(rootPackage.scripts['release:package:desktop'], /node scripts\/release\/package-release-assets\.mjs desktop/);
  assert.match(rootPackage.scripts['release:package:web'], /node scripts\/release\/package-release-assets\.mjs web/);
});

test('desktop release build runner injects the supported Visual Studio generator only on Windows', async () => {
  const runnerPath = path.join(rootDir, 'scripts', 'run-desktop-release-build.mjs');
  assert.equal(existsSync(runnerPath), true, 'missing scripts/run-desktop-release-build.mjs');

  const runner = await import(pathToFileURL(runnerPath).href);
  assert.equal(typeof runner.createDesktopReleaseBuildPlan, 'function');

  const windowsPlan = runner.createDesktopReleaseBuildPlan({
    platform: 'win32',
    env: {},
  });
  const linuxPlan = runner.createDesktopReleaseBuildPlan({
    platform: 'linux',
    env: {},
  });

  assert.equal(windowsPlan.command, 'pnpm');
  assert.deepEqual(windowsPlan.args, ['--filter', '@sdkwork/claw-desktop', 'run', 'tauri:build']);
  assert.equal(windowsPlan.env.CMAKE_GENERATOR, 'Visual Studio 17 2022');
  assert.equal(windowsPlan.env.HOST_CMAKE_GENERATOR, 'Visual Studio 17 2022');

  assert.equal(linuxPlan.command, 'pnpm');
  assert.deepEqual(linuxPlan.args, ['--filter', '@sdkwork/claw-desktop', 'run', 'tauri:build']);
  assert.equal(Object.hasOwn(linuxPlan.env, 'CMAKE_GENERATOR'), false);
});

test('release asset packager knows how to filter desktop bundle outputs and name web archives', async () => {
  const packagerPath = path.join(rootDir, 'scripts', 'release', 'package-release-assets.mjs');
  assert.equal(existsSync(packagerPath), true, 'missing scripts/release/package-release-assets.mjs');

  const packager = await import(pathToFileURL(packagerPath).href);
  assert.equal(typeof packager.normalizePlatformId, 'function');
  assert.equal(typeof packager.shouldIncludeDesktopBundleFile, 'function');
  assert.equal(typeof packager.buildWebArchiveBaseName, 'function');

  assert.equal(packager.normalizePlatformId('win32'), 'windows');
  assert.equal(packager.normalizePlatformId('darwin'), 'macos');
  assert.equal(packager.normalizePlatformId('linux'), 'linux');

  assert.equal(
    packager.shouldIncludeDesktopBundleFile('windows', 'nsis/Claw Studio_0.1.0_x64-setup.exe'),
    true,
  );
  assert.equal(
    packager.shouldIncludeDesktopBundleFile('windows', 'deb/claw-studio_0.1.0_amd64.deb'),
    false,
  );
  assert.equal(
    packager.shouldIncludeDesktopBundleFile('linux', 'deb/claw-studio_0.1.0_amd64.deb'),
    true,
  );
  assert.equal(
    packager.shouldIncludeDesktopBundleFile('macos', 'dmg/Claw Studio_0.1.0_aarch64.dmg'),
    true,
  );

  assert.equal(
    packager.buildWebArchiveBaseName('release-2026-03-26'),
    'claw-studio-web-assets-release-2026-03-26',
  );
});
