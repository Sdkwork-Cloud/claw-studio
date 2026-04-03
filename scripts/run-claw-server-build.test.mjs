import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const rootDir = path.resolve(import.meta.dirname, '..');

test('server build helper creates a default release cargo plan', async () => {
  const modulePath = path.join(rootDir, 'scripts', 'run-claw-server-build.mjs');
  const helper = await import(pathToFileURL(modulePath).href);

  assert.equal(typeof helper.createServerBuildPlan, 'function');

  const plan = helper.createServerBuildPlan({
    env: {},
  });

  assert.deepEqual(plan, {
    command: 'cargo',
    args: ['build', '--manifest-path', 'src-host/Cargo.toml', '--release'],
    cwd: path.join(rootDir, 'packages', 'sdkwork-claw-server'),
    env: {},
  });
});

test('server build helper forwards an explicit rust target triple', async () => {
  const modulePath = path.join(rootDir, 'scripts', 'run-claw-server-build.mjs');
  const helper = await import(pathToFileURL(modulePath).href);

  assert.equal(typeof helper.createServerBuildPlan, 'function');

  const plan = helper.createServerBuildPlan({
    targetTriple: 'aarch64-unknown-linux-gnu',
    env: {},
  });

  assert.deepEqual(plan, {
    command: 'cargo',
    args: [
      'build',
      '--manifest-path',
      'src-host/Cargo.toml',
      '--release',
      '--target',
      'aarch64-unknown-linux-gnu',
    ],
    cwd: path.join(rootDir, 'packages', 'sdkwork-claw-server'),
    env: {
      SDKWORK_SERVER_TARGET: 'aarch64-unknown-linux-gnu',
      SDKWORK_SERVER_TARGET_PLATFORM: 'linux',
      SDKWORK_SERVER_TARGET_ARCH: 'arm64',
    },
  });
});

test('server build helper rejects a missing --target value instead of silently falling back', async () => {
  const modulePath = path.join(rootDir, 'scripts', 'run-claw-server-build.mjs');
  const helper = await import(pathToFileURL(modulePath).href);

  assert.equal(typeof helper.parseArgs, 'function');
  assert.throws(
    () => helper.parseArgs(['--target']),
    /Missing value for --target/,
  );
});
