import assert from 'node:assert/strict';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

import {
  buildOpenClawManifest,
  prepareOpenClawRuntimeFromSource,
  resolveOpenClawTarget,
  syncPackagedOpenClawReleaseArtifacts,
} from './prepare-openclaw-runtime.mjs';

const rootDir = path.resolve(import.meta.dirname, '..');
const expectedOpenClawVersion = '2026.4.9';
const expectedNodeVersion = '22.16.0';

function createJson(filePath, value) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function createPreparedReleaseFixture({
  platform = 'windows',
  arch = 'x64',
} = {}) {
  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'cleanup-legacy-openclaw-source-runtime-'));
  const sourceRuntimeDir = path.join(tempRoot, 'source-runtime');
  const resourceDir = path.join(tempRoot, 'resource-runtime');
  const workspaceRootDir = path.join(tempRoot, 'workspace-root');
  const target = resolveOpenClawTarget(platform, arch);
  const manifest = buildOpenClawManifest({
    openclawVersion: expectedOpenClawVersion,
    nodeVersion: expectedNodeVersion,
    target,
  });
  const cliPath = path.join(
    sourceRuntimeDir,
    manifest.cliRelativePath.replace(/^runtime[\\/]/, ''),
  );
  const openclawPackageJsonPath = path.join(
    sourceRuntimeDir,
    'package',
    'node_modules',
    'openclaw',
    'package.json',
  );
  const carbonPackageJsonPath = path.join(
    sourceRuntimeDir,
    'package',
    'node_modules',
    '@buape',
    'carbon',
    'package.json',
  );

  mkdirSync(path.dirname(cliPath), { recursive: true });
  mkdirSync(path.dirname(openclawPackageJsonPath), { recursive: true });
  mkdirSync(path.dirname(carbonPackageJsonPath), { recursive: true });
  mkdirSync(resourceDir, { recursive: true });
  writeFileSync(cliPath, 'console.log("openclaw");\n', 'utf8');
  writeFileSync(
    openclawPackageJsonPath,
    `${JSON.stringify({ name: 'openclaw', version: expectedOpenClawVersion }, null, 2)}\n`,
    'utf8',
  );
  writeFileSync(
    carbonPackageJsonPath,
    `${JSON.stringify({ name: '@buape/carbon', version: '0.14.0' }, null, 2)}\n`,
    'utf8',
  );

  return prepareOpenClawRuntimeFromSource({
    sourceRuntimeDir,
    resourceDir,
    openclawVersion: expectedOpenClawVersion,
    nodeVersion: expectedNodeVersion,
    target,
  }).then((result) => ({
    tempRoot,
    workspaceRootDir,
    resourceDir,
    target,
    manifest: result.manifest,
  }));
}

function createLegacyResidue(workspaceRootDir, version = '2026.3.28') {
  const legacyRuntimeRoot = path.join(
    workspaceRootDir,
    'packages',
    'sdkwork-claw-desktop',
    'src-tauri',
    'resources',
    'openclaw-runtime',
  );
  createJson(path.join(legacyRuntimeRoot, 'manifest.json'), {
    schemaVersion: 1,
    runtimeId: 'openclaw',
    openclawVersion: version,
    nodeVersion: expectedNodeVersion,
    platform: 'windows',
    arch: 'x64',
  });
  createJson(
    path.join(
      legacyRuntimeRoot,
      'runtime',
      'package',
      'node_modules',
      'openclaw',
      'package.json',
    ),
    {
      name: 'openclaw',
      version,
    },
  );

  return legacyRuntimeRoot;
}

function createPreparedBundledNodeResidue(workspaceRootDir) {
  const preparedBundledNodeRuntimeDir = path.join(
    workspaceRootDir,
    'packages',
    'sdkwork-claw-desktop',
    'src-tauri',
    'resources',
    'openclaw',
    'runtime',
    'node',
  );
  mkdirSync(preparedBundledNodeRuntimeDir, { recursive: true });
  writeFileSync(
    path.join(preparedBundledNodeRuntimeDir, 'node.exe'),
    'synthetic-node-runtime',
    'utf8',
  );
  return preparedBundledNodeRuntimeDir;
}

test('cleanupLegacyOpenClawSourceRuntimeResidue removes legacy source runtime residue and reports version', async () => {
  const modulePath = path.join(rootDir, 'scripts', 'cleanup-legacy-openclaw-source-runtime.mjs');
  const cleanup = await import(pathToFileURL(modulePath).href);

  assert.equal(typeof cleanup.cleanupLegacyOpenClawSourceRuntimeResidue, 'function');
  assert.equal(typeof cleanup.detectLegacyOpenClawSourceRuntimeResidue, 'function');

  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'cleanup-legacy-openclaw-direct-'));
  try {
    const legacyRuntimeRoot = createLegacyResidue(tempRoot);

    const detectedBefore = await cleanup.detectLegacyOpenClawSourceRuntimeResidue({
      workspaceRootDir: tempRoot,
    });
    assert.equal(detectedBefore.legacySourceRuntimeDirPresent, true);
    assert.equal(detectedBefore.legacySourceRuntimeVersion, '2026.3.28');

    const result = await cleanup.cleanupLegacyOpenClawSourceRuntimeResidue({
      workspaceRootDir: tempRoot,
    });

    assert.equal(result.removed, true);
    assert.equal(result.legacySourceRuntimeVersion, '2026.3.28');
    assert.equal(existsSync(legacyRuntimeRoot), false);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('cleanupLegacyOpenClawSourceRuntimeResidue removes prepared bundled Node residue from the current openclaw resource root', async () => {
  const modulePath = path.join(rootDir, 'scripts', 'cleanup-legacy-openclaw-source-runtime.mjs');
  const cleanup = await import(pathToFileURL(modulePath).href);

  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'cleanup-openclaw-bundled-node-'));
  try {
    const preparedBundledNodeRuntimeDir = createPreparedBundledNodeResidue(tempRoot);

    const detectedBefore = await cleanup.detectLegacyOpenClawSourceRuntimeResidue({
      workspaceRootDir: tempRoot,
    });
    assert.equal(detectedBefore.preparedBundledNodeRuntimeDirPresent, true);

    const result = await cleanup.cleanupLegacyOpenClawSourceRuntimeResidue({
      workspaceRootDir: tempRoot,
    });

    assert.equal(result.removed, true);
    assert.equal(result.removedPreparedBundledNodeRuntimeDir, true);
    assert.equal(existsSync(preparedBundledNodeRuntimeDir), false);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('syncPackagedOpenClawReleaseArtifacts removes legacy source runtime residue before mirroring packaged assets', async () => {
  const fixture = await createPreparedReleaseFixture({
    platform: 'linux',
    arch: 'x64',
  });

  try {
    const legacyRuntimeRoot = createLegacyResidue(fixture.workspaceRootDir);
    assert.equal(existsSync(legacyRuntimeRoot), true);

    const result = await syncPackagedOpenClawReleaseArtifacts({
      resourceDir: fixture.resourceDir,
      workspaceRootDir: fixture.workspaceRootDir,
      target: fixture.target,
      manifest: fixture.manifest,
    });

    assert.equal(existsSync(legacyRuntimeRoot), false);
    assert.equal(
      existsSync(path.join(result.packagedResourceDir, 'manifest.json')),
      true,
    );
  } finally {
    rmSync(fixture.tempRoot, { recursive: true, force: true });
  }
});

test('syncPackagedOpenClawReleaseArtifacts removes prepared bundled Node residue under the workspace resource root before mirroring packaged assets', async () => {
  const fixture = await createPreparedReleaseFixture({
    platform: 'linux',
    arch: 'x64',
  });

  try {
    const preparedBundledNodeRuntimeDir = createPreparedBundledNodeResidue(
      fixture.workspaceRootDir,
    );
    assert.equal(existsSync(preparedBundledNodeRuntimeDir), true);

    const result = await syncPackagedOpenClawReleaseArtifacts({
      resourceDir: fixture.resourceDir,
      workspaceRootDir: fixture.workspaceRootDir,
      target: fixture.target,
      manifest: fixture.manifest,
    });

    assert.equal(existsSync(preparedBundledNodeRuntimeDir), false);
    assert.equal(
      existsSync(path.join(result.packagedResourceDir, 'manifest.json')),
      true,
    );
  } finally {
    rmSync(fixture.tempRoot, { recursive: true, force: true });
  }
});

test('desktop openclaw runtime check repairs legacy source runtime residue before probing the current workspace', () => {
  const packageJson = JSON.parse(readFileSync(path.join(rootDir, 'package.json'), 'utf8'));

  assert.match(
    packageJson.scripts['check:desktop-openclaw-runtime'],
    /node scripts\/cleanup-legacy-openclaw-source-runtime\.test\.mjs/,
    'check:desktop-openclaw-runtime must execute the cleanup contract test',
  );
  assert.match(
    packageJson.scripts['check:desktop-openclaw-runtime'],
    /node scripts\/cleanup-legacy-openclaw-source-runtime\.mjs/,
    'check:desktop-openclaw-runtime must repair legacy source runtime residue before probing the current workspace',
  );
});
