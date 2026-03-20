import { spawn } from 'node:child_process';
import {
  cp,
  mkdtemp,
  mkdir,
  readdir,
  readFile,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

export const DEFAULT_OPENCLAW_VERSION = process.env.OPENCLAW_VERSION ?? '2026.3.13';
export const DEFAULT_NODE_VERSION = process.env.OPENCLAW_NODE_VERSION ?? '22.16.0';
export const DEFAULT_OPENCLAW_PACKAGE = process.env.OPENCLAW_PACKAGE_NAME ?? 'openclaw';
export const DEFAULT_RESOURCE_DIR = path.join(
  rootDir,
  'packages',
  'sdkwork-claw-desktop',
  'src-tauri',
  'resources',
  'openclaw-runtime',
);

export function resolveOpenClawTarget(platform = process.platform, arch = process.arch) {
  const platformId =
    platform === 'win32' ? 'windows' : platform === 'darwin' ? 'macos' : 'linux';
  const archId = arch === 'x64' ? 'x64' : arch === 'arm64' ? 'arm64' : arch;

  if (!['windows', 'macos', 'linux'].includes(platformId)) {
    throw new Error(`Unsupported platform for bundled OpenClaw runtime: ${platform}`);
  }

  if (!['x64', 'arm64'].includes(archId)) {
    throw new Error(`Unsupported architecture for bundled OpenClaw runtime: ${arch}`);
  }

  if (platformId === 'windows') {
    return {
      platformId,
      archId,
      nodeArchiveExt: 'zip',
      nodeArchiveName(version) {
        return `node-v${version}-win-${archId}.zip`;
      },
      nodeDownloadName(version) {
        return `node-v${version}-win-${archId}`;
      },
      bundledNodePath: 'runtime/node/node.exe',
      bundledCliPath: 'runtime/package/node_modules/openclaw/openclaw.mjs',
    };
  }

  return {
    platformId,
    archId,
    nodeArchiveExt: 'tar.xz',
    nodeArchiveName(version) {
      const platformSlug = platformId === 'macos' ? 'darwin' : 'linux';
      return `node-v${version}-${platformSlug}-${archId}.tar.xz`;
    },
    nodeDownloadName(version) {
      const platformSlug = platformId === 'macos' ? 'darwin' : 'linux';
      return `node-v${version}-${platformSlug}-${archId}`;
    },
    bundledNodePath: 'runtime/node/bin/node',
    bundledCliPath: 'runtime/package/node_modules/openclaw/openclaw.mjs',
  };
}

export function resolveBundledNpmCommand(nodeRuntimeDir, platform = process.platform) {
  const normalizedPlatform =
    platform === 'win32' || platform === 'windows'
      ? 'windows'
      : platform === 'darwin' || platform === 'macos'
        ? 'macos'
        : 'linux';

  if (normalizedPlatform === 'windows') {
    return {
      command: process.env.ComSpec || 'cmd.exe',
      args: ['/d', '/s', '/c', path.join(nodeRuntimeDir, 'npm.cmd')],
    };
  }

  return {
    command: path.join(nodeRuntimeDir, 'bin', 'npm'),
    args: [],
  };
}

export function buildOpenClawManifest({
  openclawVersion,
  nodeVersion,
  target,
  nodeRelativePath = target.bundledNodePath,
  cliRelativePath = target.bundledCliPath,
}) {
  return {
    schemaVersion: 1,
    runtimeId: 'openclaw',
    openclawVersion,
    nodeVersion,
    platform: target.platformId,
    arch: target.archId,
    nodeRelativePath,
    cliRelativePath,
  };
}

export async function prepareOpenClawRuntimeFromSource({
  sourceRuntimeDir,
  resourceDir = DEFAULT_RESOURCE_DIR,
  openclawVersion = DEFAULT_OPENCLAW_VERSION,
  nodeVersion = DEFAULT_NODE_VERSION,
  target = resolveOpenClawTarget(),
}) {
  const manifest = buildOpenClawManifest({ openclawVersion, nodeVersion, target });
  await validatePreparedRuntimeSource(sourceRuntimeDir, manifest);
  await rm(resourceDir, { recursive: true, force: true });
  await mkdir(resourceDir, { recursive: true });
  await cp(sourceRuntimeDir, path.join(resourceDir, 'runtime'), { recursive: true });
  await writeFile(
    path.join(resourceDir, 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8',
  );

  return {
    manifest,
    resourceDir,
  };
}

export async function prepareOpenClawRuntimeFromStagedDirs({
  nodeSourceDir,
  packageSourceDir,
  resourceDir = DEFAULT_RESOURCE_DIR,
  openclawVersion = DEFAULT_OPENCLAW_VERSION,
  nodeVersion = DEFAULT_NODE_VERSION,
  target = resolveOpenClawTarget(),
}) {
  const manifest = buildOpenClawManifest({ openclawVersion, nodeVersion, target });
  await validatePreparedRuntimeArtifacts({ nodeSourceDir, packageSourceDir, manifest });
  await rm(resourceDir, { recursive: true, force: true });
  await mkdir(path.join(resourceDir, 'runtime'), { recursive: true });
  await cp(nodeSourceDir, path.join(resourceDir, 'runtime', 'node'), { recursive: true });
  await cp(packageSourceDir, path.join(resourceDir, 'runtime', 'package'), { recursive: true });
  await writeFile(
    path.join(resourceDir, 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8',
  );
  await validatePreparedRuntimeSource(path.join(resourceDir, 'runtime'), manifest);

  return {
    manifest,
    resourceDir,
  };
}

export async function prepareOpenClawRuntime({
  resourceDir = DEFAULT_RESOURCE_DIR,
  openclawVersion = DEFAULT_OPENCLAW_VERSION,
  nodeVersion = DEFAULT_NODE_VERSION,
  openclawPackage = DEFAULT_OPENCLAW_PACKAGE,
  sourceRuntimeDir = process.env.OPENCLAW_BUNDLED_SOURCE_DIR,
  packageTarball = process.env.OPENCLAW_PACKAGE_TARBALL,
  fetchImpl = globalThis.fetch,
  target = resolveOpenClawTarget(),
} = {}) {
  if (sourceRuntimeDir) {
    return prepareOpenClawRuntimeFromSource({
      sourceRuntimeDir,
      resourceDir,
      openclawVersion,
      nodeVersion,
      target,
    });
  }

  if (typeof fetchImpl !== 'function') {
    throw new Error('Global fetch is not available and no OPENCLAW_BUNDLED_SOURCE_DIR was provided.');
  }

  const stagingRoot = await mkdtemp(path.join(os.tmpdir(), 'claw-openclaw-runtime-'));
  const packageDir = path.join(stagingRoot, 'runtime-package');

  try {
    const manifest = buildOpenClawManifest({ openclawVersion, nodeVersion, target });
    const archivePath = await downloadNodeRuntime({
      stagingRoot,
      nodeVersion,
      target,
      fetchImpl,
    });
    const extractedNodeDir = await extractNodeRuntimeArchive({
      archivePath,
      stagingRoot,
      target,
    });
    await rm(resourceDir, { recursive: true, force: true });
    await mkdir(path.join(resourceDir, 'runtime'), { recursive: true });
    await cp(extractedNodeDir, path.join(resourceDir, 'runtime', 'node'), { recursive: true });

    await mkdir(packageDir, { recursive: true });
    await writeFile(
      path.join(packageDir, 'package.json'),
      `${JSON.stringify({ name: 'bundled-openclaw-runtime', private: true }, null, 2)}\n`,
      'utf8',
    );

    const installSpec = packageTarball || `${openclawPackage}@${openclawVersion}`;
    const bundledNpm = resolveBundledNpmCommand(extractedNodeDir, target.platformId);
    await runCommand(bundledNpm.command, [
      ...bundledNpm.args,
      'install',
      '--omit=dev',
      '--no-package-lock',
      installSpec,
    ], { cwd: packageDir });

    await cp(packageDir, path.join(resourceDir, 'runtime', 'package'), { recursive: true });
    await writeFile(
      path.join(resourceDir, 'manifest.json'),
      `${JSON.stringify(manifest, null, 2)}\n`,
      'utf8',
    );
    await validatePreparedRuntimeSource(path.join(resourceDir, 'runtime'), manifest);

    return {
      manifest,
      resourceDir,
    };
  } finally {
    await rm(stagingRoot, { recursive: true, force: true });
  }
}

export async function validatePreparedRuntimeSource(sourceRuntimeDir, manifest) {
  const checks = [
    path.join(sourceRuntimeDir, 'node'),
    path.join(sourceRuntimeDir, 'package'),
    path.join(sourceRuntimeDir, manifest.nodeRelativePath.replace(/^runtime[\\/]/, '')),
    path.join(sourceRuntimeDir, manifest.cliRelativePath.replace(/^runtime[\\/]/, '')),
  ];

  for (const absolutePath of checks) {
    try {
      await stat(absolutePath);
    } catch (error) {
      throw new Error(`Prepared OpenClaw runtime is missing ${absolutePath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

async function validatePreparedRuntimeArtifacts({ nodeSourceDir, packageSourceDir, manifest }) {
  const checks = [
    nodeSourceDir,
    packageSourceDir,
    path.join(nodeSourceDir, manifest.nodeRelativePath.replace(/^runtime[\\/]node[\\/]/, '')),
    path.join(packageSourceDir, manifest.cliRelativePath.replace(/^runtime[\\/]package[\\/]/, '')),
  ];

  for (const absolutePath of checks) {
    try {
      await stat(absolutePath);
    } catch (error) {
      throw new Error(`Prepared OpenClaw staged runtime is missing ${absolutePath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

async function downloadNodeRuntime({ stagingRoot, nodeVersion, target, fetchImpl }) {
  const archiveName = target.nodeArchiveName(nodeVersion);
  const url = `https://nodejs.org/dist/v${nodeVersion}/${archiveName}`;
  const archivePath = path.join(stagingRoot, archiveName);
  const response = await fetchImpl(url);

  if (!response.ok || !response.body) {
    throw new Error(`Failed to download Node runtime from ${url}: ${response.status} ${response.statusText}`);
  }

  await streamToFile(response.body, archivePath);
  return archivePath;
}

async function extractNodeRuntimeArchive({ archivePath, stagingRoot, target }) {
  const extractRoot = path.join(stagingRoot, 'node-extract');
  await mkdir(extractRoot, { recursive: true });

  if (target.nodeArchiveExt === 'zip') {
    await runCommand('powershell', [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      `Expand-Archive -LiteralPath '${archivePath.replace(/'/g, "''")}' -DestinationPath '${extractRoot.replace(/'/g, "''")}' -Force`,
    ]);
  } else {
    await runCommand('tar', ['-xJf', archivePath, '-C', extractRoot]);
  }

  const entries = await readdir(extractRoot, { withFileTypes: true });
  const firstDirectory = entries.find((entry) => entry.isDirectory());
  if (!firstDirectory) {
    throw new Error(`Unable to find extracted Node runtime directory inside ${extractRoot}`);
  }

  return path.join(extractRoot, firstDirectory.name);
}

async function streamToFile(body, destinationPath) {
  await pipeline(Readable.fromWeb(body), createWriteStream(destinationPath));
}

async function runCommand(command, args, options = {}) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? rootDir,
      stdio: 'inherit',
      env: process.env,
      shell: false,
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`Command failed: ${command} ${args.join(' ')} (exit ${code ?? 'unknown'})`));
    });
  });
}

async function main() {
  const result = await prepareOpenClawRuntime();
  console.log(
    `Prepared bundled OpenClaw runtime ${result.manifest.openclawVersion} for ${result.manifest.platform}-${result.manifest.arch} at ${result.resourceDir}`,
  );
}

if (path.resolve(process.argv[1] ?? '') === __filename) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
