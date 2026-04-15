import assert from 'node:assert/strict';
import test from 'node:test';

import {
  normalizeKernelExternalRuntimePolicy,
  readKernelExternalRuntimePolicy,
  readKernelInstallReadyLayout,
  writeKernelExternalRuntimePolicy,
  writeKernelInstallReadiness,
} from './kernel-install-readiness.mjs';

function buildHermesExternalRuntimePolicy() {
  return {
    packagingPolicy: 'external-runtime-only',
    launcherKinds: ['externalWslOrRemote'],
    platformSupport: {
      windows: 'wsl2OrRemoteOnly',
      macos: 'native',
      linux: 'native',
    },
    runtimeRequirements: ['python', 'uv'],
    optionalRuntimeRequirements: ['nodejs'],
  };
}

test('kernel install readiness preserves Hermes external-runtime policy alongside other kernel readiness entries', () => {
  const readiness = writeKernelExternalRuntimePolicy(
    writeKernelInstallReadiness(null, 'openclaw', {
      installReadyLayout: {
        mode: 'archive-extract-ready',
        installKey: '2026.4.2-windows-x64',
      },
    }),
    'hermes',
    buildHermesExternalRuntimePolicy(),
  );

  assert.deepEqual(readKernelInstallReadyLayout(readiness, 'openclaw'), {
    mode: 'archive-extract-ready',
    installKey: '2026.4.2-windows-x64',
  });
  assert.deepEqual(readKernelExternalRuntimePolicy(readiness, 'hermes'), buildHermesExternalRuntimePolicy());
});

test('kernel external-runtime policy normalization rejects incomplete policy payloads', () => {
  assert.equal(
    normalizeKernelExternalRuntimePolicy({
      launcherKinds: ['externalWslOrRemote'],
      runtimeRequirements: ['python', 'uv'],
    }),
    null,
  );
});
