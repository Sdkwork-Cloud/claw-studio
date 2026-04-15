import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const rootDir = path.resolve(import.meta.dirname, '..', '..');

test('kernel definitions expose standard metadata for OpenClaw and Hermes', async () => {
  const modulePath = path.join(rootDir, 'scripts', 'release', 'kernel-definitions.mjs');
  assert.equal(existsSync(modulePath), true, 'missing scripts/release/kernel-definitions.mjs');

  const definitions = await import(pathToFileURL(modulePath).href);
  assert.equal(typeof definitions.resolveKernelDefinition, 'function');
  assert.equal(typeof definitions.listKernelDefinitions, 'function');

  assert.deepEqual(
    definitions.listKernelDefinitions().map((entry) => entry.kernelId),
    ['openclaw', 'hermes'],
  );

  assert.deepEqual(definitions.resolveKernelDefinition('openclaw'), {
    kernelId: 'openclaw',
    displayName: 'OpenClaw',
    vendor: 'OpenClaw',
    launcherKinds: ['externalLocal'],
    platformSupport: {
      windows: 'native',
      macos: 'native',
      linux: 'native',
    },
    runtimeRequirements: ['nodejs'],
    optionalRuntimeRequirements: [],
    installStrategy: 'managedArchiveActivation',
    managementTransport: 'openclawGatewayWs',
    capabilityMatrix: ['chat', 'health', 'files', 'memory', 'tasks', 'tools', 'models'],
    sourceMetadata: {
      repositoryUrl: 'https://github.com/openclaw/openclaw',
      docsUrl: 'https://github.com/openclaw/openclaw/releases',
      packagingPolicy: 'external-runtime-only',
    },
  });

  assert.deepEqual(definitions.resolveKernelDefinition('hermes'), {
    kernelId: 'hermes',
    displayName: 'Hermes Agent',
    vendor: 'Nous Research',
    launcherKinds: ['externalWslOrRemote'],
    platformSupport: {
      windows: 'wsl2OrRemoteOnly',
      macos: 'native',
      linux: 'native',
    },
    runtimeRequirements: ['python', 'uv'],
    optionalRuntimeRequirements: ['nodejs'],
    installStrategy: 'externalSourceCheckout',
    managementTransport: 'customHttp',
    capabilityMatrix: ['chat', 'health', 'files', 'memory', 'tools', 'models'],
    sourceMetadata: {
      repositoryUrl: 'https://github.com/nousresearch/hermes-agent',
      docsUrl: 'https://hermes-agent.nousresearch.com/docs/getting-started/installation/',
      packagingPolicy: 'external-runtime-only',
    },
  });
});

test('kernel package profiles derive required runtimes and launcher kinds from included kernel definitions', async () => {
  const definitionsPath = path.join(rootDir, 'scripts', 'release', 'kernel-definitions.mjs');
  const profilesPath = path.join(rootDir, 'scripts', 'release', 'kernel-package-profiles.mjs');
  assert.equal(existsSync(definitionsPath), true, 'missing kernel definitions module');
  assert.equal(existsSync(profilesPath), true, 'missing kernel package profile module');

  const definitions = await import(pathToFileURL(definitionsPath).href);
  const profiles = await import(pathToFileURL(profilesPath).href);
  const profileSource = readFileSync(profilesPath, 'utf8');

  assert.match(profileSource, /from '\.\/kernel-definitions\.mjs'/);

  for (const profile of profiles.listKernelPackageProfiles()) {
    const includedDefinitions = profile.includedKernelIds.map((kernelId) =>
      definitions.resolveKernelDefinition(kernelId),
    );
    const expectedRuntimeRequirements = [
      ...new Set(includedDefinitions.flatMap((entry) => entry.runtimeRequirements)),
    ];
    const expectedLauncherKinds = [
      ...new Set(includedDefinitions.flatMap((entry) => entry.launcherKinds)),
    ];

    assert.deepEqual(profile.requiredExternalRuntimes, expectedRuntimeRequirements);
    assert.deepEqual(profile.launcherKinds, expectedLauncherKinds);
  }
});

test('kernel definition loader discovers config files from the directory and orders them by config order', async () => {
  const modulePath = path.join(rootDir, 'scripts', 'release', 'kernel-definitions.mjs');
  const definitions = await import(pathToFileURL(modulePath).href);

  assert.equal(typeof definitions.loadKernelDefinitions, 'function');

  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'claw-kernel-definitions-'));

  try {
    writeFileSync(
      path.join(tempRoot, 'zeta.json'),
      `${JSON.stringify({
        order: 20,
        kernelId: 'zeta',
        displayName: 'Zeta Kernel',
        vendor: 'Example Vendor',
        launcherKinds: ['externalRemote'],
        platformSupport: {
          windows: 'remoteOnly',
          macos: 'native',
          linux: 'native',
        },
        runtimeRequirements: ['python'],
        installStrategy: 'externalSourceCheckout',
        managementTransport: 'customHttp',
        capabilityMatrix: ['chat', 'health'],
        sourceMetadata: {
          repositoryUrl: 'https://example.com/zeta',
          docsUrl: 'https://example.com/zeta/docs',
          packagingPolicy: 'external-runtime-only',
        },
      }, null, 2)}\n`,
      'utf8',
    );
    writeFileSync(
      path.join(tempRoot, 'alpha.json'),
      `${JSON.stringify({
        order: 10,
        kernelId: 'alpha',
        displayName: 'Alpha Kernel',
        vendor: 'Example Vendor',
        launcherKinds: ['externalLocal'],
        platformSupport: {
          windows: 'native',
          macos: 'native',
          linux: 'native',
        },
        runtimeRequirements: ['nodejs'],
        installStrategy: 'managedArchiveActivation',
        managementTransport: 'gatewayWs',
        capabilityMatrix: ['chat', 'files'],
        sourceMetadata: {
          repositoryUrl: 'https://example.com/alpha',
          docsUrl: 'https://example.com/alpha/docs',
          packagingPolicy: 'external-runtime-only',
        },
      }, null, 2)}\n`,
      'utf8',
    );

    const discoveredDefinitions = definitions.loadKernelDefinitions({
      kernelConfigDir: tempRoot,
    });

    assert.deepEqual(
      discoveredDefinitions.map((entry) => entry.kernelId),
      ['alpha', 'zeta'],
    );
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});
