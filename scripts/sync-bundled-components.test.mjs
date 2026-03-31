import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

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
  typeof syncModule.resolvePreferredComponentRepositoryDir,
  'function',
  'sync-bundled-components must export resolvePreferredComponentRepositoryDir',
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
    syncModuleSource.indexOf('const bundledRoot = resolveBundledBuildRoot(rootDir, process.platform);'),
  'desktopSrcTauriPathSegments must be initialized before bundledRoot for non-Windows module loading',
);

for (const [resourceId, expectedSource, expectedTarget] of [
  ['bundled', 'generated/br/b/', 'generated/bundled/'],
  ['openclaw-runtime', 'generated/br/o/', 'resources/openclaw-runtime/'],
  ['sdkwork-api-router-runtime', 'generated/br/a/', 'resources/sdkwork-api-router-runtime/'],
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

const preferredHubInstallerRepoDir = syncModule.resolvePreferredComponentRepositoryDir({
  component: {
    checkoutDir: 'hub-installer',
    localWorkspaceDir: 'D:\\workspace\\spring-ai-plus\\apps\\hub-installer',
  },
  upstreamRootDir: 'D:\\workspace\\spring-ai-plus\\apps\\claw-studio\\.cache\\bundled-components\\upstreams',
  existsSyncImpl(candidatePath) {
    return candidatePath === 'D:\\workspace\\spring-ai-plus\\apps\\hub-installer\\.git';
  },
});

assert.equal(
  preferredHubInstallerRepoDir,
  'D:\\workspace\\spring-ai-plus\\apps\\hub-installer',
  'sync-bundled-components must prefer the local hub-installer workspace when it is available',
);

const cachedHubInstallerRepoDir = syncModule.resolvePreferredComponentRepositoryDir({
  component: {
    checkoutDir: 'hub-installer',
    localWorkspaceDir: 'D:\\workspace\\spring-ai-plus\\apps\\hub-installer',
  },
  upstreamRootDir: 'D:\\workspace\\spring-ai-plus\\apps\\claw-studio\\.cache\\bundled-components\\upstreams',
  existsSyncImpl() {
    return false;
  },
});

assert.equal(
  cachedHubInstallerRepoDir,
  'D:\\workspace\\spring-ai-plus\\apps\\claw-studio\\.cache\\bundled-components\\upstreams\\hub-installer',
  'sync-bundled-components must fall back to the cached upstream checkout when no local workspace is available',
);

console.log('ok - sync-bundled-components emits short Windows Tauri bundle bridge roots');
