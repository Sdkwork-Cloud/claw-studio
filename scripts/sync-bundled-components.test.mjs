import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const rootDir = path.resolve(import.meta.dirname, '..');
const syncModulePath = path.join(rootDir, 'scripts', 'sync-bundled-components.mjs');
const syncModule = await import(pathToFileURL(syncModulePath).href);
assert.equal(
  typeof syncModule.createTauriBundleOverlayConfig,
  'function',
  'sync-bundled-components must export createTauriBundleOverlayConfig',
);

const overlay = syncModule.createTauriBundleOverlayConfig({
  workspaceRootDir: 'D:\\workspace\\claw-studio',
  platform: 'win32',
});

assert.equal(typeof overlay, 'object');
assert.equal(typeof overlay.bundle, 'object');
assert.equal(typeof overlay.bundle.resources, 'object');

const resources = overlay.bundle.resources;

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

console.log('ok - sync-bundled-components emits short Windows Tauri bundle bridge roots');
