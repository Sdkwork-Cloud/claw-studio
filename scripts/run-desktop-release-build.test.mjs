import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const rootDir = path.resolve(import.meta.dirname, '..');

test('desktop release build helper rejects missing CLI option values instead of silently falling back', async () => {
  const modulePath = path.join(rootDir, 'scripts', 'run-desktop-release-build.mjs');
  const helper = await import(pathToFileURL(modulePath).href);

  assert.equal(typeof helper.parseArgs, 'function');
  assert.throws(
    () => helper.parseArgs(['--profile']),
    /Missing value for --profile/,
  );
  assert.throws(
    () => helper.parseArgs(['--target']),
    /Missing value for --target/,
  );
  assert.throws(
    () => helper.parseArgs(['--phase']),
    /Missing value for --phase/,
  );
  assert.throws(
    () => helper.parseArgs(['--vite-mode']),
    /Missing value for --vite-mode/,
  );
  assert.throws(
    () => helper.parseArgs(['--bundles']),
    /Missing value for --bundles/,
  );
});

test('desktop release build cli wraps the entrypoint with a top-level error handler', () => {
  const source = readFileSync(
    path.join(rootDir, 'scripts', 'run-desktop-release-build.mjs'),
    'utf8',
  );

  assert.match(
    source,
    /if \(path\.resolve\(process\.argv\[1\] \?\? ''\) === __filename\) \{\s*try \{\s*runCli\(\);\s*\} catch \(error\) \{\s*console\.error\(error instanceof Error \? error\.message : String\(error\)\);\s*process\.exit\(1\);\s*\}\s*\}/s,
  );
});

test('desktop release build helper creates an OpenClaw release-asset preflight for bundle-capable phases', async () => {
  const modulePath = path.join(rootDir, 'scripts', 'run-desktop-release-build.mjs');
  const helper = await import(pathToFileURL(modulePath).href);

  assert.equal(typeof helper.buildDesktopReleaseBuildPreflightPlan, 'function');
  assert.equal(
    helper.buildDesktopReleaseBuildPreflightPlan({ phase: 'sync' }),
    null,
  );

  const bundlePreflight = helper.buildDesktopReleaseBuildPreflightPlan({
    phase: 'bundle',
    targetTriple: 'aarch64-unknown-linux-gnu',
  });
  assert.equal(bundlePreflight.command, process.execPath);
  assert.deepEqual(
    bundlePreflight.args,
    ['scripts/verify-desktop-openclaw-release-assets.mjs'],
  );
  assert.equal(bundlePreflight.env.SDKWORK_DESKTOP_TARGET, 'aarch64-unknown-linux-gnu');
  assert.equal(bundlePreflight.env.SDKWORK_DESKTOP_TARGET_PLATFORM, 'linux');
  assert.equal(bundlePreflight.env.SDKWORK_DESKTOP_TARGET_ARCH, 'arm64');

  const allPreflight = helper.buildDesktopReleaseBuildPreflightPlan({
    phase: 'all',
    platform: 'darwin',
    hostArch: 'arm64',
  });
  assert.equal(allPreflight.env.SDKWORK_DESKTOP_TARGET_PLATFORM, 'macos');
  assert.equal(allPreflight.env.SDKWORK_DESKTOP_TARGET_ARCH, 'arm64');
});

test('desktop release build all-phase plan forwards bundle customization flags into the desktop package script', async () => {
  const modulePath = path.join(rootDir, 'scripts', 'run-desktop-release-build.mjs');
  const helper = await import(pathToFileURL(modulePath).href);

  assert.equal(typeof helper.createDesktopReleaseBuildPlan, 'function');

  const plan = helper.createDesktopReleaseBuildPlan({
    phase: 'all',
    profileId: 'claw-studio',
    viteMode: 'test',
    bundleTargets: ['nsis', 'msi'],
    targetTriple: 'aarch64-pc-windows-msvc',
    platform: 'win32',
    hostArch: 'x64',
  });

  assert.equal(plan.command, 'pnpm');
  assert.deepEqual(
    plan.args,
    [
      '--filter',
      '@sdkwork/claw-desktop',
      'run',
      'tauri:build',
      '--',
      '--profile',
      'claw-studio',
      '--vite-mode',
      'test',
      '--bundles',
      'nsis,msi',
      '--target',
      'aarch64-pc-windows-msvc',
    ],
    'run-desktop-release-build must forward profile, vite mode, bundle target list, and target triple when phase=all delegates into the desktop package build script',
  );
});

test('desktop release build cli runs the OpenClaw release-asset preflight before spawning the bundle command', () => {
  const source = readFileSync(
    path.join(rootDir, 'scripts', 'run-desktop-release-build.mjs'),
    'utf8',
  );

  assert.match(
    source,
    /const preflightPlan = buildDesktopReleaseBuildPreflightPlan\(/,
    'run-desktop-release-build must derive a preflight plan before invoking bundle-capable commands',
  );
  assert.match(
    source,
    /spawnSync\(\s*preflightPlan\.command,\s*preflightPlan\.args,/s,
    'run-desktop-release-build must execute the OpenClaw release-asset preflight synchronously before spawning the build command',
  );
});
