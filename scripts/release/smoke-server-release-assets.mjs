#!/usr/bin/env node

import { once } from 'node:events';
import { spawn, spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
} from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import {
  normalizeDesktopArch,
  normalizeDesktopPlatform,
  resolveDesktopReleaseTarget,
} from './desktop-targets.mjs';
import {
  writeReleaseSmokeReport,
} from './release-smoke-contract.mjs';
import {
  resolveCliPath,
} from './path-inputs.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');
const DEFAULT_RELEASE_ASSETS_DIR = path.join(rootDir, 'artifacts', 'release');
const RELEASE_ASSET_MANIFEST_FILENAME = 'release-asset-manifest.json';

function delay(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function readOptionValue(argv, index, flag) {
  const next = argv[index + 1];
  const normalizedNext = String(next ?? '').trim();

  if (!normalizedNext || normalizedNext.startsWith('--')) {
    throw new Error(`Missing value for ${flag}.`);
  }

  return normalizedNext;
}

export function resolveServerReleaseAssetManifestPath({
  releaseAssetsDir = DEFAULT_RELEASE_ASSETS_DIR,
  platform,
  arch,
} = {}) {
  return path.join(
    releaseAssetsDir,
    'server',
    normalizeDesktopPlatform(platform),
    normalizeDesktopArch(arch),
    RELEASE_ASSET_MANIFEST_FILENAME,
  );
}

export function readServerReleaseAssetManifest({
  releaseAssetsDir = DEFAULT_RELEASE_ASSETS_DIR,
  platform,
  arch,
} = {}) {
  const manifestPath = resolveServerReleaseAssetManifestPath({
    releaseAssetsDir,
    platform,
    arch,
  });

  if (!existsSync(manifestPath)) {
    throw new Error(`Missing server release asset manifest: ${manifestPath}`);
  }

  return {
    manifestPath,
    manifest: JSON.parse(readFileSync(manifestPath, 'utf8')),
  };
}

function assertServerManifestMatchesTarget({
  manifest,
  manifestPath,
  platform,
  arch,
}) {
  if (!manifest || typeof manifest !== 'object') {
    throw new Error(`Server release asset manifest must be a JSON object: ${manifestPath}`);
  }
  if (!Array.isArray(manifest.artifacts)) {
    throw new Error(`Server release asset manifest is missing artifacts[]: ${manifestPath}`);
  }
  if (String(manifest.platform ?? '').trim() !== platform) {
    throw new Error(
      `Server release asset manifest platform mismatch at ${manifestPath}: expected ${platform}, received ${manifest.platform ?? 'unknown'}`,
    );
  }
  if (String(manifest.arch ?? '').trim() !== arch) {
    throw new Error(
      `Server release asset manifest architecture mismatch at ${manifestPath}: expected ${arch}, received ${manifest.arch ?? 'unknown'}`,
    );
  }
}

function resolveServerArchiveArtifact(manifest, manifestPath) {
  const archiveArtifacts = Array.isArray(manifest?.artifacts)
    ? manifest.artifacts.filter((artifact) => {
      const relativePath = String(artifact?.relativePath ?? '').trim().toLowerCase();
      return relativePath.endsWith('.tar.gz') || relativePath.endsWith('.zip');
    })
    : [];

  if (archiveArtifacts.length === 0) {
    throw new Error(`Missing server archive artifact in ${manifestPath}`);
  }

  return archiveArtifacts[0];
}

function resolveArtifactAbsolutePath(releaseAssetsDir, artifact) {
  const relativePath = String(artifact?.relativePath ?? '').trim();
  if (!relativePath) {
    throw new Error('Server release asset manifest contains an artifact without relativePath.');
  }

  const absolutePath = path.resolve(releaseAssetsDir, relativePath);
  if (!existsSync(absolutePath)) {
    throw new Error(`Missing server release artifact at ${absolutePath}`);
  }

  return absolutePath;
}

function escapePowerShellSingleQuotedValue(value) {
  return String(value ?? '').replaceAll("'", "''");
}

function runCommand({
  command,
  args,
  cwd,
  label,
} = {}) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    const stderr = String(result.stderr ?? '').trim();
    const stdout = String(result.stdout ?? '').trim();
    throw new Error(
      `${label} failed with exit code ${result.status}.${stderr ? `\n${stderr}` : ''}${stdout ? `\n${stdout}` : ''}`,
    );
  }
}

export async function extractServerArchive({
  archivePath,
  extractDir,
} = {}) {
  mkdirSync(extractDir, { recursive: true });
  const lowerCaseArchivePath = String(archivePath ?? '').trim().toLowerCase();

  if (lowerCaseArchivePath.endsWith('.zip')) {
    if (process.platform === 'win32') {
      runCommand({
        command: 'powershell',
        args: [
          '-NoProfile',
          '-NonInteractive',
          '-Command',
          `Expand-Archive -LiteralPath '${escapePowerShellSingleQuotedValue(archivePath)}' -DestinationPath '${escapePowerShellSingleQuotedValue(extractDir)}' -Force`,
        ],
        label: 'Extracting server zip archive',
      });
    } else {
      runCommand({
        command: 'unzip',
        args: ['-q', archivePath, '-d', extractDir],
        label: 'Extracting server zip archive',
      });
    }
  } else {
    runCommand({
      command: 'tar',
      args: ['-xzf', archivePath, '-C', extractDir],
      label: 'Extracting server tar.gz archive',
    });
  }

  const bundleDirectories = readdirSync(extractDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory());
  if (bundleDirectories.length === 0) {
    throw new Error(`Unable to resolve extracted server bundle root from ${archivePath}`);
  }

  return path.join(extractDir, bundleDirectories[0].name);
}

export async function resolveAvailablePort() {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        if (!address || typeof address === 'string') {
          reject(new Error('Unable to resolve a free TCP port for server smoke.'));
          return;
        }
        resolve(address.port);
      });
    });
  });
}

async function stopChildProcess(child) {
  if (!child || child.exitCode !== null) {
    return;
  }

  child.kill();
  await Promise.race([
    once(child, 'exit').catch(() => undefined),
    delay(3000),
  ]);

  if (child.exitCode === null) {
    child.kill('SIGKILL');
    await Promise.race([
      once(child, 'exit').catch(() => undefined),
      delay(2000),
    ]);
  }
}

export async function launchServerBundle({
  bundleRoot,
  platform,
  port,
} = {}) {
  const normalizedPlatform = normalizeDesktopPlatform(platform);
  const launcherRelativePath = normalizedPlatform === 'windows'
    ? 'start-claw-server.cmd'
    : 'start-claw-server.sh';
  const launcherAbsolutePath = path.join(bundleRoot, launcherRelativePath);
  if (!existsSync(launcherAbsolutePath)) {
    throw new Error(`Missing bundled server launcher: ${launcherAbsolutePath}`);
  }

  const smokeDataDir = path.join(bundleRoot, '.smoke-data');
  mkdirSync(smokeDataDir, { recursive: true });

  const child = normalizedPlatform === 'windows'
    ? spawn('cmd.exe', ['/d', '/s', '/c', launcherAbsolutePath], {
      cwd: bundleRoot,
      env: {
        ...process.env,
        CLAW_SERVER_HOST: '127.0.0.1',
        CLAW_SERVER_PORT: String(port),
        CLAW_SERVER_DATA_DIR: smokeDataDir,
        CLAW_SERVER_WEB_DIST: path.join(bundleRoot, 'web', 'dist'),
      },
      stdio: 'ignore',
      windowsHide: true,
    })
    : spawn('sh', [launcherAbsolutePath], {
      cwd: bundleRoot,
      env: {
        ...process.env,
        CLAW_SERVER_HOST: '127.0.0.1',
        CLAW_SERVER_PORT: String(port),
        CLAW_SERVER_DATA_DIR: smokeDataDir,
        CLAW_SERVER_WEB_DIST: path.join(bundleRoot, 'web', 'dist'),
      },
      stdio: 'ignore',
    });

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    launcherRelativePath,
    async stop() {
      await stopChildProcess(child);
    },
  };
}

export async function probeEndpoint({
  baseUrl,
  path: requestPath,
  headers,
  fetchFn = fetch,
} = {}) {
  const response = await fetchFn(new URL(requestPath, baseUrl), {
    method: 'GET',
    headers,
  });

  return {
    statusCode: response.status,
    body: await response.text(),
  };
}

export async function fetchJson({
  baseUrl,
  path: requestPath,
  headers,
  fetchFn = fetch,
} = {}) {
  const response = await fetchFn(new URL(requestPath, baseUrl), {
    method: 'GET',
    headers,
  });
  const text = await response.text();

  return {
    statusCode: response.status,
    json: text.length > 0 ? JSON.parse(text) : null,
  };
}

async function waitForSuccessfulEndpoint({
  id,
  baseUrl,
  requestPath,
  probeEndpointFn,
  timeoutMs = 20000,
  intervalMs = 250,
}) {
  const startedAt = Date.now();
  let lastResponse = null;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      lastResponse = await probeEndpointFn({
        baseUrl,
        path: requestPath,
      });
      if (lastResponse?.statusCode === 200) {
        return {
          id,
          status: 'passed',
          detail: `${requestPath} returned 200`,
        };
      }
    } catch (error) {
      lastResponse = {
        statusCode: 0,
        body: error instanceof Error ? error.message : String(error),
      };
    }

    await delay(intervalMs);
  }

  throw new Error(
    `Server bundle smoke timed out waiting for ${requestPath}. Last response: ${JSON.stringify(lastResponse)}`,
  );
}

async function readHostEndpointCheck({
  baseUrl,
  fetchJsonFn,
}) {
  const response = await fetchJsonFn({
    baseUrl,
    path: '/claw/manage/v1/host-endpoints',
  });
  if (response?.statusCode !== 200) {
    throw new Error(
      `Server bundle smoke expected /claw/manage/v1/host-endpoints to return 200, received ${response?.statusCode ?? 'unknown'}.`,
    );
  }
  if (!Array.isArray(response?.json)) {
    throw new Error('Server bundle smoke expected /claw/manage/v1/host-endpoints to return a JSON array.');
  }

  return {
    id: 'host-endpoints',
    status: 'passed',
    detail: '/claw/manage/v1/host-endpoints returned canonical endpoints',
  };
}

export async function smokeServerReleaseAssets({
  releaseAssetsDir = DEFAULT_RELEASE_ASSETS_DIR,
  platform = process.platform,
  arch = process.arch,
  target = '',
  extractServerArchiveFn = extractServerArchive,
  launchServerBundleFn = launchServerBundle,
  probeEndpointFn = probeEndpoint,
  fetchJsonFn = fetchJson,
  resolveAvailablePortFn = resolveAvailablePort,
} = {}) {
  const targetSpec = resolveDesktopReleaseTarget({
    targetTriple: target,
    platform,
    arch,
  });
  const releasePlatform = normalizeDesktopPlatform(targetSpec.platform);
  const releaseArch = normalizeDesktopArch(targetSpec.arch);
  const { manifestPath, manifest } = readServerReleaseAssetManifest({
    releaseAssetsDir,
    platform: releasePlatform,
    arch: releaseArch,
  });

  assertServerManifestMatchesTarget({
    manifest,
    manifestPath,
    platform: releasePlatform,
    arch: releaseArch,
  });

  const archiveArtifact = resolveServerArchiveArtifact(manifest, manifestPath);
  const archivePath = resolveArtifactAbsolutePath(releaseAssetsDir, archiveArtifact);
  const extractDir = mkdtempSync(path.join(os.tmpdir(), 'claw-server-smoke-'));

  let runtime = null;
  try {
    const bundleRoot = await extractServerArchiveFn({
      archivePath,
      extractDir,
      platform: releasePlatform,
    });
    const port = await resolveAvailablePortFn();
    runtime = await launchServerBundleFn({
      bundleRoot,
      platform: releasePlatform,
      port,
      target: targetSpec.targetTriple,
    });

    const checks = [];
    checks.push(await waitForSuccessfulEndpoint({
      id: 'health-ready',
      baseUrl: runtime.baseUrl,
      requestPath: '/claw/health/ready',
      probeEndpointFn,
    }));
    checks.push(await readHostEndpointCheck({
      baseUrl: runtime.baseUrl,
      fetchJsonFn,
    }));
    checks.push(await waitForSuccessfulEndpoint({
      id: 'browser-shell',
      baseUrl: runtime.baseUrl,
      requestPath: '/',
      probeEndpointFn,
    }));

    const artifactRelativePaths = manifest.artifacts
      .map((artifact) => String(artifact?.relativePath ?? '').trim())
      .filter(Boolean)
      .sort((left, right) => left.localeCompare(right));
    const report = writeReleaseSmokeReport({
      releaseAssetsDir,
      family: 'server',
      platform: releasePlatform,
      arch: releaseArch,
      target: targetSpec.targetTriple,
      smokeKind: 'bundle-runtime',
      status: 'passed',
      manifestPath,
      artifactRelativePaths,
      launcherRelativePath: String(runtime?.launcherRelativePath ?? '').trim(),
      runtimeBaseUrl: String(runtime?.baseUrl ?? '').trim(),
      checks,
    });

    return {
      platform: releasePlatform,
      arch: releaseArch,
      target: targetSpec.targetTriple,
      manifestPath,
      manifest,
      archivePath,
      report,
    };
  } finally {
    if (runtime?.stop) {
      await runtime.stop();
    }
    rmSync(extractDir, { recursive: true, force: true });
  }
}

export function parseArgs(argv) {
  const options = {
    platform: process.platform,
    arch: process.arch,
    target: '',
    releaseAssetsDir: DEFAULT_RELEASE_ASSETS_DIR,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === '--platform') {
      options.platform = readOptionValue(argv, index, '--platform');
      index += 1;
      continue;
    }
    if (token === '--arch') {
      options.arch = readOptionValue(argv, index, '--arch');
      index += 1;
      continue;
    }
    if (token === '--target') {
      options.target = readOptionValue(argv, index, '--target');
      index += 1;
      continue;
    }
    if (token === '--release-assets-dir') {
      options.releaseAssetsDir = resolveCliPath(
        readOptionValue(argv, index, '--release-assets-dir'),
      );
      index += 1;
    }
  }

  return options;
}

export async function main(argv = process.argv.slice(2)) {
  const result = await smokeServerReleaseAssets(parseArgs(argv));
  console.log(
    `Smoke-verified packaged server bundle for ${result.platform}-${result.arch}.`,
  );
  return result;
}

if (path.resolve(process.argv[1] ?? '') === __filename) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
