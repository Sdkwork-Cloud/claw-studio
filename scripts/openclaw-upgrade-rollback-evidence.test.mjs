import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const rootDir = path.resolve(import.meta.dirname, '..');

function createReadJsonFileStub() {
  return async (filePath) => {
    const normalizedPath = String(filePath).replaceAll('\\', '/');

    if (normalizedPath.endsWith('/config/kernel-releases/openclaw.json')) {
      return {
        kernelId: 'openclaw',
        stableVersion: '2026.4.2',
        supportedChannels: ['stable'],
        defaultChannel: 'stable',
        nodeVersion: '22.16.0',
        packageName: 'openclaw',
        runtimeRequirements: {
          requiredExternalRuntimes: ['nodejs'],
          requiredExternalRuntimeVersions: {
            nodejs: '22.16.0',
          },
        },
      };
    }

    if (normalizedPath.endsWith('/packages/sdkwork-claw-desktop/src-tauri/resources/openclaw/manifest.json')) {
      return {
        schemaVersion: 1,
        runtimeId: 'openclaw',
        openclawVersion: '2026.4.2',
        nodeVersion: '22.16.0',
        platform: 'windows',
        arch: 'x64',
      };
    }

    if (normalizedPath.endsWith('/packages/sdkwork-claw-desktop/src-tauri/generated/release/openclaw-resource/manifest.json')) {
      return {
        schemaVersion: 1,
        runtimeId: 'openclaw',
        openclawVersion: '2026.4.2',
        nodeVersion: '22.16.0',
        platform: 'windows',
        arch: 'x64',
      };
    }

    throw new Error(`Unexpected JSON read: ${filePath}`);
  };
}

test('desktop openclaw runtime check includes upgrade rollback evidence contract', () => {
  const packageJson = JSON.parse(readFileSync(path.join(rootDir, 'package.json'), 'utf8'));

  assert.match(
    packageJson.scripts['check:desktop-openclaw-runtime'],
    /node scripts\/openclaw-upgrade-rollback-evidence\.test\.mjs/,
    'check:desktop-openclaw-runtime must execute the upgrade rollback evidence test',
  );
});

test('upgrade rollback evidence summarizes explicit upgrade and rollback readiness', async () => {
  const modulePath = path.join(rootDir, 'scripts', 'openclaw-upgrade-rollback-evidence.mjs');
  const evidence = await import(pathToFileURL(modulePath).href);

  assert.equal(typeof evidence.buildOpenClawUpgradeRollbackEvidence, 'function');

  const result = await evidence.buildOpenClawUpgradeRollbackEvidence({
    workspaceRootDir: 'D:/synthetic/workspace',
    targetVersion: '2026.4.5',
    rollbackVersion: '2026.4.2',
    target: {
      platformId: 'windows',
      archId: 'x64',
    },
    readJsonFileFn: createReadJsonFileStub(),
    assessOpenClawUpgradeReadinessFn: async () => ({
      targetVersion: '2026.4.5',
      readyToUpgrade: true,
      blockers: [],
    }),
    inspectPreparedOpenClawRuntimeFn: async () => ({
      reusable: true,
      reason: 'ready',
      manifestPath: 'D:/synthetic/workspace/packages/sdkwork-claw-desktop/src-tauri/resources/openclaw/manifest.json',
    }),
    verifyDesktopOpenClawReleaseAssetsFn: async () => ({
      manifest: {
        openclawVersion: '2026.4.2',
      },
      packagedResourceDir: 'D:/synthetic/workspace/packages/sdkwork-claw-desktop/src-tauri/generated/release/openclaw-resource',
    }),
  });

  assert.equal(result.baselineVersion, '2026.4.2');
  assert.equal(result.targetVersion, '2026.4.5');
  assert.equal(result.upgradeReady, true);
  assert.equal(result.rollbackReady, true);
  assert.match(
    result.sources.releaseConfigPath.replaceAll('\\', '/'),
    /config\/kernel-releases\/openclaw\.json$/,
    'upgrade rollback evidence must resolve OpenClaw baseline version from the kernel release registry',
  );
  assert.deepEqual(result.blockers, {
    upgrade: [],
    rollback: [],
  });
  assert.deepEqual(
    result.phases.map((entry) => ({ id: entry.id, status: entry.status })),
    [
      { id: 'baseline-alignment', status: 'passed' },
      { id: 'prepared-runtime', status: 'passed' },
      { id: 'packaged-release-verify', status: 'passed' },
      { id: 'upgrade-readiness', status: 'passed' },
      { id: 'rollback-readiness', status: 'passed' },
    ],
  );
});

test('upgrade rollback evidence turns packaged release verification failures into rollback blockers', async () => {
  const modulePath = path.join(rootDir, 'scripts', 'openclaw-upgrade-rollback-evidence.mjs');
  const evidence = await import(pathToFileURL(modulePath).href);

  const result = await evidence.buildOpenClawUpgradeRollbackEvidence({
    workspaceRootDir: 'D:/synthetic/workspace',
    rollbackVersion: '2026.4.2',
    target: {
      platformId: 'windows',
      archId: 'x64',
    },
    readJsonFileFn: createReadJsonFileStub(),
    inspectPreparedOpenClawRuntimeFn: async () => ({
      reusable: true,
      reason: 'ready',
      manifestPath: 'D:/synthetic/workspace/packages/sdkwork-claw-desktop/src-tauri/resources/openclaw/manifest.json',
    }),
    verifyDesktopOpenClawReleaseAssetsFn: async () => {
      throw new Error('Missing packaged OpenClaw release manifest.');
    },
  });

  assert.equal(result.targetVersion, null);
  assert.equal(result.upgradeReady, null);
  assert.equal(result.rollbackReady, false);
  assert.match(
    result.blockers.rollback.join('\n'),
    /Missing packaged OpenClaw release manifest\./,
  );
  assert.deepEqual(
    result.phases.map((entry) => ({ id: entry.id, status: entry.status })),
    [
      { id: 'baseline-alignment', status: 'passed' },
      { id: 'prepared-runtime', status: 'passed' },
      { id: 'packaged-release-verify', status: 'failed' },
      { id: 'rollback-readiness', status: 'failed' },
    ],
  );
});
