import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const rootDir = path.resolve(import.meta.dirname, '..', '..');

test('kernel package profiles expose explicit multi-kernel packaging presets', async () => {
  const modulePath = path.join(rootDir, 'scripts', 'release', 'kernel-package-profiles.mjs');
  assert.equal(existsSync(modulePath), true, 'missing scripts/release/kernel-package-profiles.mjs');

  const profiles = await import(pathToFileURL(modulePath).href);
  assert.equal(typeof profiles.resolveKernelPackageProfile, 'function');
  assert.equal(typeof profiles.listKernelPackageProfiles, 'function');

  const profileIds = profiles.listKernelPackageProfiles().map((entry) => entry.profileId);
  assert.deepEqual(profileIds, ['openclaw-only', 'hermes-only', 'dual-kernel']);

  assert.deepEqual(
    profiles.resolveKernelPackageProfile('openclaw-only'),
    {
      profileId: 'openclaw-only',
      displayName: 'OpenClaw Only',
      includedKernelIds: ['openclaw'],
      defaultEnabledKernelIds: ['openclaw'],
      requiredExternalRuntimes: ['nodejs'],
      optionalExternalRuntimes: [],
      launcherKinds: ['externalLocal'],
      kernelPlatformSupport: {
        openclaw: {
          windows: 'native',
          macos: 'native',
          linux: 'native',
        },
      },
    },
  );

  assert.deepEqual(
    profiles.resolveKernelPackageProfile('hermes-only'),
    {
      profileId: 'hermes-only',
      displayName: 'Hermes Only',
      includedKernelIds: ['hermes'],
      defaultEnabledKernelIds: ['hermes'],
      requiredExternalRuntimes: ['python', 'uv'],
      optionalExternalRuntimes: ['nodejs'],
      launcherKinds: ['externalWslOrRemote'],
      kernelPlatformSupport: {
        hermes: {
          windows: 'wsl2OrRemoteOnly',
          macos: 'native',
          linux: 'native',
        },
      },
    },
  );

  assert.deepEqual(
    profiles.resolveKernelPackageProfile('dual-kernel'),
    {
      profileId: 'dual-kernel',
      displayName: 'Dual Kernel',
      includedKernelIds: ['openclaw', 'hermes'],
      defaultEnabledKernelIds: ['openclaw', 'hermes'],
      requiredExternalRuntimes: ['nodejs', 'python', 'uv'],
      optionalExternalRuntimes: [],
      launcherKinds: ['externalLocal', 'externalWslOrRemote'],
      kernelPlatformSupport: {
        openclaw: {
          windows: 'native',
          macos: 'native',
          linux: 'native',
        },
        hermes: {
          windows: 'wsl2OrRemoteOnly',
          macos: 'native',
          linux: 'native',
        },
      },
    },
  );

  assert.throws(
    () => profiles.resolveKernelPackageProfile('unknown-profile'),
    /Unsupported kernel package profile/,
  );
});

test('kernel package profile loader discovers config files from the directory and orders them by config order', async () => {
  const modulePath = path.join(rootDir, 'scripts', 'release', 'kernel-package-profiles.mjs');
  const profiles = await import(pathToFileURL(modulePath).href);

  assert.equal(typeof profiles.loadKernelPackageProfiles, 'function');

  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'claw-kernel-package-profiles-'));

  try {
    writeFileSync(
      path.join(tempRoot, 'beta.json'),
      `${JSON.stringify({
        order: 20,
        profileId: 'beta-dual',
        displayName: 'Beta Dual',
        includedKernelIds: ['alpha', 'zeta'],
        defaultEnabledKernelIds: ['alpha'],
      }, null, 2)}\n`,
      'utf8',
    );
    writeFileSync(
      path.join(tempRoot, 'alpha.json'),
      `${JSON.stringify({
        order: 10,
        profileId: 'alpha-only',
        displayName: 'Alpha Only',
        includedKernelIds: ['alpha'],
        defaultEnabledKernelIds: ['alpha'],
      }, null, 2)}\n`,
      'utf8',
    );

    const discoveredProfiles = profiles.loadKernelPackageProfiles({
      profileConfigDir: tempRoot,
      resolveKernelDefinition(kernelId) {
        if (kernelId === 'alpha') {
          return {
            kernelId: 'alpha',
            runtimeRequirements: ['nodejs'],
            optionalRuntimeRequirements: [],
            launcherKinds: ['externalLocal'],
            platformSupport: {
              windows: 'native',
              macos: 'native',
              linux: 'native',
            },
          };
        }
        if (kernelId === 'zeta') {
          return {
            kernelId: 'zeta',
            runtimeRequirements: ['python', 'uv'],
            optionalRuntimeRequirements: [],
            launcherKinds: ['externalRemote'],
            platformSupport: {
              windows: 'remoteOnly',
              macos: 'native',
              linux: 'native',
            },
          };
        }

        throw new Error(`Unexpected kernelId in test: ${kernelId}`);
      },
    });

    assert.deepEqual(
      discoveredProfiles.map((entry) => entry.profileId),
      ['alpha-only', 'beta-dual'],
    );
    assert.deepEqual(
      discoveredProfiles[1].requiredExternalRuntimes,
      ['nodejs', 'python', 'uv'],
    );
    assert.deepEqual(
      discoveredProfiles[1].launcherKinds,
      ['externalLocal', 'externalRemote'],
    );
    assert.deepEqual(
      discoveredProfiles[1].optionalExternalRuntimes,
      [],
    );
    assert.deepEqual(
      discoveredProfiles[1].kernelPlatformSupport,
      {
        alpha: {
          windows: 'native',
          macos: 'native',
          linux: 'native',
        },
        zeta: {
          windows: 'remoteOnly',
          macos: 'native',
          linux: 'native',
        },
      },
    );
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});
