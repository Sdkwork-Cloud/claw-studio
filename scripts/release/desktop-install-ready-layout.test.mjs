import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildDesktopInstallReadyLayout,
  normalizeDesktopInstallReadyLayout,
} from './desktop-install-ready-layout.mjs';

test('normalizeDesktopInstallReadyLayout strips legacy bundled node entry fields', () => {
  const normalizedLayout = normalizeDesktopInstallReadyLayout({
    mode: 'archive-extract-ready',
    installKey: '2026.4.13-windows-x64',
    reuseOnFirstLaunch: true,
    requiresArchiveExtractionOnFirstLaunch: false,
    manifestRelativePath: 'manifest.json',
    runtimeSidecarRelativePath: 'runtime/.sdkwork-openclaw-runtime.json',
    cliEntryRelativePath: 'runtime/package/node_modules/openclaw/openclaw.mjs',
    nodeEntryRelativePath: 'runtime/node/node.exe',
  });

  assert.deepEqual(normalizedLayout, {
    mode: 'archive-extract-ready',
    installKey: '2026.4.13-windows-x64',
    reuseOnFirstLaunch: true,
    requiresArchiveExtractionOnFirstLaunch: false,
    manifestRelativePath: 'manifest.json',
    runtimeSidecarRelativePath: 'runtime/.sdkwork-openclaw-runtime.json',
    cliEntryRelativePath: 'runtime/package/node_modules/openclaw/openclaw.mjs',
  });
  assert.equal(Object.hasOwn(normalizedLayout, 'nodeEntryRelativePath'), false);
});

test('buildDesktopInstallReadyLayout emits only packaged OpenClaw startup paths', () => {
  const installReadyLayout = buildDesktopInstallReadyLayout({
    mode: 'archive-extract-ready',
    manifest: {
      openclawVersion: '2026.4.13',
      platform: 'windows',
      arch: 'x64',
      cliRelativePath: 'runtime/package/node_modules/openclaw/openclaw.mjs',
    },
  });

  assert.equal(Object.hasOwn(installReadyLayout, 'nodeEntryRelativePath'), false);
});
