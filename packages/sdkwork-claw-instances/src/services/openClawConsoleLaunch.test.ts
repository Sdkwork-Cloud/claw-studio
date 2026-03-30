import assert from 'node:assert/strict';
import type { StudioInstanceConsoleAccessRecord } from '@sdkwork/claw-types';
import { resolveOpenClawConsoleLaunchUrl } from './openClawConsoleLaunch.ts';

function runTest(name: string, fn: () => void) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

function buildConsoleAccess(
  overrides: Partial<StudioInstanceConsoleAccessRecord> = {},
): StudioInstanceConsoleAccessRecord {
  return {
    kind: 'openclawControlUi',
    available: true,
    url: 'http://127.0.0.1:18789/',
    autoLoginUrl:
      'http://127.0.0.1:18789/?gatewayUrl=ws%3A%2F%2F127.0.0.1%3A18789#token=test-token',
    gatewayUrl: 'ws://127.0.0.1:18789',
    authMode: 'token',
    authSource: 'managedConfig',
    installMethod: 'bundled',
    reason: null,
    ...overrides,
  };
}

runTest('resolveOpenClawConsoleLaunchUrl prefers the bundled control-ui entrypoint over tokenized browser URLs', () => {
  assert.equal(resolveOpenClawConsoleLaunchUrl(buildConsoleAccess()), 'http://127.0.0.1:18789/');
});

runTest('resolveOpenClawConsoleLaunchUrl falls back to the explicit auto-login URL for non-bundled installs', () => {
  assert.equal(
    resolveOpenClawConsoleLaunchUrl(
      buildConsoleAccess({
        installMethod: 'npm',
      }),
    ),
    'http://127.0.0.1:18789/?gatewayUrl=ws%3A%2F%2F127.0.0.1%3A18789#token=test-token',
  );
});

runTest('resolveOpenClawConsoleLaunchUrl returns null when no reachable console URL exists', () => {
  assert.equal(
    resolveOpenClawConsoleLaunchUrl(
      buildConsoleAccess({
        available: false,
      }),
    ),
    null,
  );
});
