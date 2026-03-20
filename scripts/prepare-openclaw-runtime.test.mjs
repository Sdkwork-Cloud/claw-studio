import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  buildOpenClawManifest,
  prepareOpenClawRuntimeFromStagedDirs,
  prepareOpenClawRuntimeFromSource,
  resolveBundledNpmCommand,
  resolveOpenClawTarget,
} from './prepare-openclaw-runtime.mjs';

const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'prepare-openclaw-runtime-test-'));

try {
  const sourceRuntimeDir = path.join(tempRoot, 'source-runtime');
  const resourceDir = path.join(tempRoot, 'resource-runtime');
  const target = resolveOpenClawTarget('win32', 'x64');
  const manifest = buildOpenClawManifest({
    openclawVersion: '2026.3.13',
    nodeVersion: '22.16.0',
    target,
  });
  const nodePath = path.join(sourceRuntimeDir, manifest.nodeRelativePath.replace(/^runtime[\\/]/, ''));
  const cliPath = path.join(sourceRuntimeDir, manifest.cliRelativePath.replace(/^runtime[\\/]/, ''));

  await mkdir(path.dirname(nodePath), { recursive: true });
  await mkdir(path.dirname(cliPath), { recursive: true });
  await writeFile(nodePath, 'node');
  await writeFile(cliPath, 'console.log("openclaw");');

  const result = await prepareOpenClawRuntimeFromSource({
    sourceRuntimeDir,
    resourceDir,
    openclawVersion: '2026.3.13',
    nodeVersion: '22.16.0',
    target,
  });

  await stat(path.join(resourceDir, 'runtime'));
  await stat(path.join(resourceDir, 'manifest.json'));

  const copiedManifest = JSON.parse(await readFile(path.join(resourceDir, 'manifest.json'), 'utf8'));
  if (copiedManifest.runtimeId !== 'openclaw') {
    throw new Error(`Expected runtimeId=openclaw, received ${copiedManifest.runtimeId}`);
  }

  if (copiedManifest.openclawVersion !== '2026.3.13') {
    throw new Error(`Expected openclawVersion=2026.3.13, received ${copiedManifest.openclawVersion}`);
  }

  if (result.manifest.cliRelativePath !== 'runtime/package/node_modules/openclaw/openclaw.mjs') {
    throw new Error(`Unexpected cliRelativePath ${result.manifest.cliRelativePath}`);
  }

  const windowsNpm = resolveBundledNpmCommand('C:\\runtime\\node', 'win32');
  if (!windowsNpm.command.toLowerCase().endsWith('cmd.exe')) {
    throw new Error(`Expected Windows command processor path, received ${windowsNpm.command}`);
  }
  if (
    windowsNpm.args.length < 4 ||
    windowsNpm.args[0] !== '/d' ||
    windowsNpm.args[1] !== '/s' ||
    windowsNpm.args[2] !== '/c' ||
    windowsNpm.args[3].toLowerCase() !== 'c:\\runtime\\node\\npm.cmd'
  ) {
    throw new Error(`Expected bundled Windows npm.cmd invocation, received ${windowsNpm.args.join(' ')}`);
  }

  const linuxNpm = resolveBundledNpmCommand('/runtime/node', 'linux');
  if (linuxNpm.command.replaceAll('\\', '/') !== '/runtime/node/bin/npm') {
    throw new Error(`Expected bundled Unix npm path, received ${linuxNpm.command}`);
  }
  if (linuxNpm.args.length !== 0) {
    throw new Error(`Expected no extra Unix npm arguments, received ${linuxNpm.args.join(' ')}`);
  }

  const stagedNodeDir = path.join(tempRoot, 'staged-node');
  const stagedPackageDir = path.join(tempRoot, 'staged-package');
  const stagedNodePath = path.join(stagedNodeDir, 'node.exe');
  const stagedCliPath = path.join(stagedPackageDir, 'node_modules', 'openclaw', 'openclaw.mjs');
  const stagedResourceDir = path.join(tempRoot, 'staged-resource-runtime');

  await mkdir(path.dirname(stagedNodePath), { recursive: true });
  await mkdir(path.dirname(stagedCliPath), { recursive: true });
  await writeFile(stagedNodePath, 'node');
  await writeFile(stagedCliPath, 'console.log(\"openclaw\");');

  await prepareOpenClawRuntimeFromStagedDirs({
    nodeSourceDir: stagedNodeDir,
    packageSourceDir: stagedPackageDir,
    resourceDir: stagedResourceDir,
    openclawVersion: '2026.3.13',
    nodeVersion: '22.16.0',
    target,
  });

  await stat(path.join(stagedResourceDir, 'runtime', 'node', 'node.exe'));
  await stat(path.join(stagedResourceDir, 'runtime', 'package', 'node_modules', 'openclaw', 'openclaw.mjs'));

  console.log('ok - bundled OpenClaw runtime preparation copies runtime files and writes manifest');
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
