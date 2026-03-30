import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { DEFAULT_OPENCLAW_VERSION } from './prepare-openclaw-runtime.mjs';

const rootDir = path.resolve(import.meta.dirname, '..');
const syncModulePath = path.join(rootDir, 'scripts', 'sync-bundled-components.mjs');
const syncModuleSource = readFileSync(syncModulePath, 'utf8');
const syncModule = await import(pathToFileURL(syncModulePath).href);
assert.equal(
  typeof syncModule.createTauriBundleOverlayConfig,
  'function',
  'sync-bundled-components must export createTauriBundleOverlayConfig',
);
assert.equal(
  typeof syncModule.createComponentExecutionPlan,
  'function',
  'sync-bundled-components must export createComponentExecutionPlan',
);
assert.equal(
  typeof syncModule.shouldResetBundledRoot,
  'function',
  'sync-bundled-components must export shouldResetBundledRoot',
);
assert.equal(
  typeof syncModule.createCommandEnv,
  'function',
  'sync-bundled-components must export createCommandEnv',
);
assert.equal(
  typeof syncModule.resolveBundledComponentVersion,
  'function',
  'sync-bundled-components must export resolveBundledComponentVersion',
);
assert.equal(
  typeof syncModule.listStaleWindowsTauriBundleBridgeDirNames,
  'function',
  'sync-bundled-components must export listStaleWindowsTauriBundleBridgeDirNames',
);

const overlay = syncModule.createTauriBundleOverlayConfig({
  workspaceRootDir: 'D:\\workspace\\claw-studio',
  platform: 'win32',
});

assert.equal(typeof overlay, 'object');
assert.equal(typeof overlay.bundle, 'object');
assert.equal(typeof overlay.bundle.resources, 'object');

const resources = overlay.bundle.resources;

assert.ok(
  syncModuleSource.indexOf("const desktopSrcTauriPathSegments = ['packages', 'sdkwork-claw-desktop', 'src-tauri'];") <
    syncModuleSource.indexOf('const bundledRoot = resolveBundledBuildRoot(rootDir, process.platform, devMode);'),
  'desktopSrcTauriPathSegments must be initialized before bundledRoot for non-Windows module loading',
);

for (const [resourceId, expectedSource, expectedTarget] of [
  ['bundled', 'generated/br/b/', 'generated/bundled/'],
  ['openclaw-runtime', 'generated/br/o/', 'resources/openclaw-runtime/'],
]) {
  assert.equal(
    resources[expectedSource],
    expectedTarget,
    `missing overlay bridge mapping for ${resourceId}`,
  );
  assert.doesNotMatch(
    expectedSource,
    /^[a-zA-Z]:[\\/]/,
    `overlay bridge source must stay repo-relative for ${resourceId}`,
  );
  assert.equal(
    expectedSource.includes('.sdkwork-bc'),
    false,
    `overlay bridge source must not expose external mirror roots for ${resourceId}`,
  );
}

assert.deepEqual(
  syncModule.createComponentExecutionPlan({
    componentId: 'openclaw',
    devMode: true,
  }),
  {
    shouldBuild: false,
    shouldStage: false,
  },
  'openclaw dev sync must skip staging because prepare-openclaw-runtime owns the desktop runtime',
);

assert.deepEqual(
  syncModule.createComponentExecutionPlan({
    componentId: 'hub-installer',
    devMode: true,
  }),
  {
    shouldBuild: false,
    shouldStage: true,
  },
  'non-openclaw components should still stage in dev mode',
);

assert.equal(
  syncModule.resolveBundledComponentVersion({
    componentId: 'openclaw',
    derivedVersion: '2026.3.24+685f17460d69',
    devMode: true,
  }),
  DEFAULT_OPENCLAW_VERSION,
  'openclaw dev metadata must follow the dedicated prepared runtime version source',
);

assert.equal(
  syncModule.resolveBundledComponentVersion({
    componentId: 'openclaw',
    derivedVersion: '2026.3.24+685f17460d69',
    releaseMode: true,
  }),
  DEFAULT_OPENCLAW_VERSION,
  'openclaw release metadata must follow the dedicated prepared runtime version source',
);

assert.equal(
  syncModule.resolveBundledComponentVersion({
    componentId: 'hub-installer',
    derivedVersion: '0.1.0+327aa8239ffd',
    releaseMode: true,
  }),
  '0.1.0+327aa8239ffd',
  'components that are actually staged by sync-bundled-components must retain their derived bundled version',
);

assert.equal(
  syncModule.shouldResetBundledRoot({ devMode: true, platform: 'win32' }),
  false,
  'Windows dev sync must preserve the shared bundled mirror instead of deleting it',
);

assert.equal(
  syncModule.shouldResetBundledRoot({ devMode: false, platform: 'win32' }),
  true,
  'build sync must still reset the bundled mirror on Windows',
);

assert.deepEqual(
  syncModule.listStaleWindowsTauriBundleBridgeDirNames({
    entryNames: ['a', 'b', 'o'],
  }),
  ['a'],
  'Windows bundled sync must prune stale legacy bridge directories that are no longer part of the overlay contract',
);

{
  const env = {
    USERPROFILE: 'C:\\Users\\admin',
    Path: 'C:\\Windows\\System32',
  };
  const existingPaths = new Set([
    path.join('C:\\Users\\admin', '.cargo', 'bin'),
    path.join('C:\\Users\\admin', '.cargo', 'bin', 'cargo.exe'),
  ]);
  const commandEnv = syncModule.createCommandEnv({
    env,
    platform: 'win32',
    existsSync: (targetPath) => existingPaths.has(targetPath),
  });
  const pathEntries = commandEnv.Path.split(path.delimiter);

  assert.equal(
    pathEntries[0],
    path.join('C:\\Users\\admin', '.cargo', 'bin'),
    'Windows bundled sync must prepend the user-local Rust cargo bin before invoking cargo.exe',
  );
}

console.log('ok - sync-bundled-components emits short Windows Tauri bundle bridge roots');
