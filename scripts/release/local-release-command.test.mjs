import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const rootDir = path.resolve(import.meta.dirname, '..', '..');

test('local release helper resolves usable defaults for root release commands', async () => {
  const helperPath = path.join(rootDir, 'scripts', 'release', 'local-release-command.mjs');
  const helper = await import(pathToFileURL(helperPath).href);

  assert.equal(typeof helper.resolveLocalReleaseContext, 'function');
  assert.equal(typeof helper.parseArgs, 'function');

  const planContext = helper.resolveLocalReleaseContext({
    mode: 'plan',
    env: {},
    platform: 'win32',
    arch: 'x64',
  });

  assert.equal(planContext.releaseTag, 'release-local');
  assert.equal(planContext.profileId, 'claw-studio');

  const serverContext = helper.resolveLocalReleaseContext({
    mode: 'package:server',
    env: {},
    platform: 'win32',
    arch: 'x64',
  });

  assert.equal(serverContext.platform, 'windows');
  assert.equal(serverContext.arch, 'x64');
  assert.equal(serverContext.target, 'x86_64-pc-windows-msvc');
  assert.equal(serverContext.outputDir.replaceAll('\\', '/'), path.join(rootDir, 'artifacts', 'release').replaceAll('\\', '/'));

  const deploymentContext = helper.resolveLocalReleaseContext({
    mode: 'package:container',
    env: {},
    platform: 'win32',
    arch: 'x64',
  });

  assert.equal(deploymentContext.platform, 'linux');
  assert.equal(deploymentContext.arch, 'x64');
  assert.equal(deploymentContext.target, 'x86_64-unknown-linux-gnu');
  assert.equal(deploymentContext.accelerator, 'cpu');
  assert.equal(deploymentContext.imageTag, 'release-local');

  const parsedContainerOptions = helper.parseArgs(['package', 'container']);
  const parsedContainerContext = helper.resolveLocalReleaseContext({
    mode: parsedContainerOptions.mode,
    env: {},
    platform: parsedContainerOptions.platform,
    arch: parsedContainerOptions.arch,
    cliOverrides: parsedContainerOptions,
  });

  assert.equal(parsedContainerContext.arch, 'x64');
  assert.equal(parsedContainerContext.target, 'x86_64-unknown-linux-gnu');
});

test('local release helper auto-builds missing server prerequisites for local server and container packaging', async () => {
  const helperPath = path.join(rootDir, 'scripts', 'release', 'local-release-command.mjs');
  const helper = await import(pathToFileURL(helperPath).href);

  assert.equal(typeof helper.ensureLocalServerBuildPrerequisite, 'function');

  const buildCalls = [];
  const serverResult = helper.ensureLocalServerBuildPrerequisite({
    context: {
      mode: 'package:server',
      target: 'x86_64-pc-windows-msvc',
      platform: 'windows',
    },
    fileExists() {
      return false;
    },
    resolveBinaryPath() {
      return 'D:/synthetic/sdkwork-claw-server.exe';
    },
    runServerBuildFn(options) {
      buildCalls.push(options);
    },
  });

  const containerResult = helper.ensureLocalServerBuildPrerequisite({
    context: {
      mode: 'package:container',
      target: 'x86_64-unknown-linux-gnu',
      platform: 'linux',
    },
    fileExists() {
      return false;
    },
    resolveBinaryPath() {
      return 'D:/synthetic/sdkwork-claw-server';
    },
    runServerBuildFn(options) {
      buildCalls.push(options);
    },
  });

  assert.deepEqual(buildCalls, [
    { targetTriple: 'x86_64-pc-windows-msvc' },
    { targetTriple: 'x86_64-unknown-linux-gnu' },
  ]);
  assert.deepEqual(serverResult, {
    binaryPath: 'D:/synthetic/sdkwork-claw-server.exe',
    built: true,
  });
  assert.deepEqual(containerResult, {
    binaryPath: 'D:/synthetic/sdkwork-claw-server',
    built: true,
  });
});
