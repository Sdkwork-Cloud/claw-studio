import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifestPath = path.join(
  root,
  'packages',
  'sdkwork-claw-desktop',
  'src-tauri',
  'vendor',
  'sdkwork-api-router-artifacts',
  'manifest.json',
);

function readManifest() {
  return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
}

function resolveCurrentTarget() {
  if (process.platform === 'win32' && process.arch === 'x64') {
    return 'windows-x64';
  }

  if (process.platform === 'win32' && process.arch === 'arm64') {
    return 'windows-arm64';
  }

  if (process.platform === 'linux' && process.arch === 'x64') {
    return 'linux-x64';
  }

  if (process.platform === 'darwin' && process.arch === 'arm64') {
    return 'macos-aarch64';
  }

  return null;
}

function validateArchive(name, archive) {
  assert.equal(typeof archive.path, 'string', `${name} archive.path must be a string`);
  assert.ok(archive.path.trim().length > 0, `${name} archive.path must not be empty`);
  assert.equal(typeof archive.sha256, 'string', `${name} archive.sha256 must be a string`);
  assert.ok(Array.isArray(archive.binaries), `${name} archive.binaries must be an array`);
  assert.ok(archive.binaries.length > 0, `${name} archive.binaries must not be empty`);
}

function validateManifest(manifest) {
  assert.equal(typeof manifest.version, 'string', 'manifest.version must be a string');
  assert.ok(manifest.version.trim().length > 0, 'manifest.version must not be empty');
  assert.equal(typeof manifest.source, 'object', 'manifest.source must be an object');
  assert.equal(typeof manifest.source.repository, 'string', 'manifest.source.repository must be a string');
  assert.equal(typeof manifest.source.ref, 'string', 'manifest.source.ref must be a string');
  assert.equal(typeof manifest.source.commit, 'string', 'manifest.source.commit must be a string');
  assert.ok(manifest.source.commit.trim().length > 0, 'manifest.source.commit must not be empty');
  assert.notEqual(manifest.source.commit, 'UNPINNED', 'manifest.source.commit must be pinned');
  assert.equal(typeof manifest.archives, 'object', 'manifest.archives must be an object');

  const entries = Object.entries(manifest.archives);
  assert.ok(entries.length > 0, 'manifest.archives must not be empty');
  for (const [name, archive] of entries) {
    validateArchive(name, archive);
  }
}

function sha256ForFile(filePath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

function verifyCurrentTargetArchive(manifest) {
  const currentTarget = resolveCurrentTarget();
  if (!currentTarget) {
    console.log(`sdkwork-api-router artifact verification skipped for unsupported host target ${process.platform}-${process.arch}`);
    return;
  }

  const archive = manifest.archives[currentTarget];
  assert.ok(archive, `manifest must declare the current target ${currentTarget}`);
  assert.ok(archive.sha256.trim().length > 0, `manifest ${currentTarget} sha256 must be pinned`);

  const archivePath = path.join(path.dirname(manifestPath), archive.path);
  assert.ok(fs.existsSync(archivePath), `current target archive must exist: ${archive.path}`);

  const actualSha256 = sha256ForFile(archivePath);
  assert.equal(
    actualSha256,
    archive.sha256.toLowerCase(),
    `current target archive sha256 mismatch for ${archive.path}`,
  );
}

function verifyArtifacts() {
  const manifest = readManifest();
  validateManifest(manifest);
  verifyCurrentTargetArchive(manifest);
  console.log(`sdkwork-api-router artifact manifest is valid: ${manifest.version}`);
}

function prepareArtifacts() {
  const manifest = readManifest();
  validateManifest(manifest);
  console.log(
    [
      'sdkwork-api-router artifact preparation is explicit by design.',
      'Place prepared archives at the relative paths listed in the manifest, then rerun verify.',
      `Current manifest version: ${manifest.version}`,
      `Pinned upstream commit: ${manifest.source.commit}`,
      `Current host target: ${resolveCurrentTarget() ?? `${process.platform}-${process.arch}`}`,
    ].join('\n'),
  );
}

const command = process.argv[2] ?? 'verify';

if (command === 'prepare') {
  prepareArtifacts();
} else if (command === 'verify') {
  verifyArtifacts();
} else {
  console.error(`Unknown command: ${command}`);
  process.exitCode = 1;
}
