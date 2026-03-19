import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

function readJson(relativePath) {
  return JSON.parse(readFileSync(path.join(rootDir, relativePath), 'utf8'));
}

function readText(relativePath) {
  return readFileSync(path.join(rootDir, relativePath), 'utf8');
}

function runTest(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

runTest('desktop shell hides native window chrome in favor of a custom title bar', () => {
  const tauriConfig = readJson('packages/sdkwork-claw-desktop/src-tauri/tauri.conf.json');
  const mainWindow = tauriConfig.app?.windows?.[0];

  assert.equal(mainWindow?.decorations, false);
  assert.equal(mainWindow?.visible, false);
  assert.equal(mainWindow?.fullscreen, false);
});

runTest('desktop shell keeps title-bar window controls in the platform bridge', () => {
  const bridgeSource = readText('packages/sdkwork-claw-desktop/src/desktop/tauriBridge.ts');
  const headerSource = readText('packages/sdkwork-claw-shell/src/components/AppHeader.tsx');
  const startupSource = readText(
    'packages/sdkwork-claw-desktop/src/desktop/bootstrap/DesktopStartupScreen.tsx',
  );

  assert.match(bridgeSource, /minimizeWindow/);
  assert.match(bridgeSource, /maximizeWindow/);
  assert.match(bridgeSource, /restoreWindow/);
  assert.match(bridgeSource, /isWindowMaximized/);
  assert.match(bridgeSource, /unmaximize/);
  assert.match(bridgeSource, /isMaximized/);
  assert.match(bridgeSource, /closeWindow/);
  assert.match(headerSource, /restoreWindow/);
  assert.match(headerSource, /isWindowMaximized/);
  assert.match(startupSource, /restoreWindow/);
  assert.match(startupSource, /isWindowMaximized/);
});

runTest('desktop startup keeps the initial window at the configured default size', () => {
  const bootstrapSource = readText(
    'packages/sdkwork-claw-desktop/src/desktop/bootstrap/DesktopBootstrapApp.tsx',
  );

  assert.doesNotMatch(bootstrapSource, /setFullscreen\(true\)/);
});

runTest('desktop shell grants custom title-bar window permissions through a real capability file', () => {
  const capabilityRelativePath =
    'packages/sdkwork-claw-desktop/src-tauri/capabilities/default.json';
  const capabilityPath = path.join(rootDir, capabilityRelativePath);

  assert.equal(
    existsSync(capabilityPath),
    true,
    `expected ${capabilityRelativePath} to exist`,
  );

  const capability = readJson(capabilityRelativePath);

  assert.equal(capability.identifier, 'default');
  assert.deepEqual(capability.windows, ['main']);
  assert.ok(Array.isArray(capability.permissions));
  assert.ok(capability.permissions.includes('core:default'));
  assert.ok(capability.permissions.includes('core:window:allow-start-dragging'));
  assert.ok(capability.permissions.includes('core:window:allow-internal-toggle-maximize'));
  assert.ok(capability.permissions.includes('core:window:allow-is-fullscreen'));
  assert.ok(capability.permissions.includes('core:window:allow-maximize'));
  assert.ok(capability.permissions.includes('core:window:allow-minimize'));
  assert.ok(capability.permissions.includes('core:window:allow-is-maximized'));
  assert.ok(capability.permissions.includes('core:window:allow-toggle-maximize'));
  assert.ok(capability.permissions.includes('core:window:allow-unmaximize'));
  assert.ok(capability.permissions.includes('core:window:allow-close'));
});

runTest('desktop shell keeps header interactions outside the drag region hitbox', () => {
  const headerSource = readText('packages/sdkwork-claw-shell/src/components/AppHeader.tsx');
  const switcherSource = readText('packages/sdkwork-claw-shell/src/components/InstanceSwitcher.tsx');

  assert.match(headerSource, /data-tauri-drag-region="false"/);
  assert.match(switcherSource, /data-tauri-drag-region="false"/);
  assert.doesNotMatch(headerSource, /<header[^>]*data-tauri-drag-region/);
  assert.match(headerSource, /h-12/);
});

runTest('desktop runtime uses the official Tauri detection API for window chrome actions', () => {
  const runtimeSource = readText('packages/sdkwork-claw-desktop/src/desktop/runtime.ts');

  assert.match(runtimeSource, /isTauri/);
  assert.doesNotMatch(runtimeSource, /__TAURI_INTERNALS__/);
});

runTest('desktop startup host avoids StrictMode replays for one-shot window bootstrap side effects', () => {
  const bootstrapSource = readText(
    'packages/sdkwork-claw-desktop/src/desktop/bootstrap/createDesktopApp.tsx',
  );

  assert.match(bootstrapSource, /createRoot/);
  assert.match(bootstrapSource, /<DesktopBootstrapApp/);
  assert.doesNotMatch(bootstrapSource, /StrictMode/);
});
