import { spawn } from 'node:child_process';
import { cp, mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const PREPARED_RUNTIME_MANIFEST_KEYS = [
  'schemaVersion',
  'runtimeId',
  'routerVersion',
  'platform',
  'arch',
  'gatewayRelativePath',
  'adminRelativePath',
  'portalRelativePath',
];

export const DEFAULT_API_ROUTER_VERSION = process.env.SDKWORK_API_ROUTER_VERSION ?? '0.1.0';
export const DEFAULT_RESOURCE_DIR = path.join(
  rootDir,
  'packages',
  'sdkwork-claw-desktop',
  'src-tauri',
  'resources',
  'sdkwork-api-router-runtime',
);

export function resolveApiRouterTarget(platform = process.platform, arch = process.arch) {
  const platformId =
    platform === 'win32' ? 'windows' : platform === 'darwin' ? 'macos' : platform === 'linux' ? 'linux' : platform;
  const archId = arch === 'x64' ? 'x64' : arch === 'arm64' ? 'arm64' : arch;

  if (!['windows', 'macos', 'linux'].includes(platformId)) {
    throw new Error(`Unsupported platform for bundled sdkwork-api-router runtime: ${platform}`);
  }

  if (!['x64', 'arm64'].includes(archId)) {
    throw new Error(`Unsupported architecture for bundled sdkwork-api-router runtime: ${arch}`);
  }

  const executableExt = platformId === 'windows' ? '.exe' : '';
  return {
    platformId,
    archId,
    gatewayBinaryName: `gateway-service${executableExt}`,
    adminBinaryName: `admin-api-service${executableExt}`,
    portalBinaryName: `portal-api-service${executableExt}`,
    gatewayRelativePath: `runtime/gateway-service${executableExt}`,
    adminRelativePath: `runtime/admin-api-service${executableExt}`,
    portalRelativePath: `runtime/portal-api-service${executableExt}`,
  };
}

export function buildApiRouterManifest({
  apiRouterVersion = DEFAULT_API_ROUTER_VERSION,
  target = resolveApiRouterTarget(),
  gatewayRelativePath = target.gatewayRelativePath,
  adminRelativePath = target.adminRelativePath,
  portalRelativePath = target.portalRelativePath,
} = {}) {
  return {
    schemaVersion: 1,
    runtimeId: 'sdkwork-api-router',
    routerVersion: apiRouterVersion,
    platform: target.platformId,
    arch: target.archId,
    gatewayRelativePath,
    adminRelativePath,
    portalRelativePath,
  };
}

export function preparedApiRouterManifestMatches(existingManifest, expectedManifest) {
  if (!existingManifest || typeof existingManifest !== 'object') {
    return false;
  }

  return PREPARED_RUNTIME_MANIFEST_KEYS.every(
    (key) => existingManifest[key] === expectedManifest[key],
  );
}

export async function inspectPreparedApiRouterRuntime({
  resourceDir = DEFAULT_RESOURCE_DIR,
  manifest,
} = {}) {
  const manifestPath = path.join(resourceDir, 'manifest.json');

  let existingManifest;
  try {
    existingManifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  } catch (error) {
    if (manifest) {
      const repairedInspection = await repairPreparedApiRouterRuntimeManifest({
        resourceDir,
        manifest,
      });
      if (repairedInspection.reusable) {
        return repairedInspection;
      }
    }

    return {
      reusable: false,
      reason: 'manifest-unreadable',
      manifestPath,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  if (manifest && !preparedApiRouterManifestMatches(existingManifest, manifest)) {
    return {
      reusable: false,
      reason: 'manifest-mismatch',
      manifestPath,
      existingManifest,
    };
  }

  try {
    await validatePreparedApiRouterRuntimeSource(
      path.join(resourceDir, 'runtime'),
      manifest ?? existingManifest,
    );
  } catch (error) {
    return {
      reusable: false,
      reason: 'runtime-invalid',
      manifestPath,
      existingManifest,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  return {
    reusable: true,
    reason: 'ready',
    manifestPath,
    manifest: existingManifest,
  };
}

export function shouldReusePreparedApiRouterRuntime({ inspection, forcePrepare = false }) {
  return !forcePrepare && Boolean(inspection?.reusable);
}

export async function prepareApiRouterRuntimeFromSource({
  sourceRuntimeDir,
  resourceDir = DEFAULT_RESOURCE_DIR,
  apiRouterVersion = DEFAULT_API_ROUTER_VERSION,
  target = resolveApiRouterTarget(),
} = {}) {
  if (!sourceRuntimeDir) {
    throw new Error('sourceRuntimeDir is required to prepare the bundled sdkwork-api-router runtime.');
  }

  const manifest = buildApiRouterManifest({ apiRouterVersion, target });
  await validatePreparedApiRouterRuntimeSource(sourceRuntimeDir, manifest);
  await rm(resourceDir, { recursive: true, force: true });
  await mkdir(resourceDir, { recursive: true });
  await cp(sourceRuntimeDir, path.join(resourceDir, 'runtime'), { recursive: true });
  await writeFile(
    path.join(resourceDir, 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8',
  );
  await writeGeneratedResourceMetadata(resourceDir);

  return {
    manifest,
    resourceDir,
  };
}

export async function prepareApiRouterRuntime({
  resourceDir = DEFAULT_RESOURCE_DIR,
  apiRouterVersion = DEFAULT_API_ROUTER_VERSION,
  sourceRuntimeDir = process.env.SDKWORK_API_ROUTER_BUNDLED_SOURCE_DIR,
  sourceRepoDir = process.env.SDKWORK_API_ROUTER_SOURCE_REPO_DIR ?? resolveDefaultApiRouterWorkspaceDir(),
  forcePrepare = parseBooleanFlag(process.env.SDKWORK_API_ROUTER_FORCE_PREPARE),
  profile = process.env.SDKWORK_API_ROUTER_BUILD_PROFILE ?? 'release',
  target = resolveApiRouterTarget(),
} = {}) {
  const manifest = buildApiRouterManifest({ apiRouterVersion, target });

  if (!forcePrepare) {
    const inspection = await inspectPreparedApiRouterRuntime({
      resourceDir,
      manifest,
    });

    if (shouldReusePreparedApiRouterRuntime({ inspection, forcePrepare })) {
      return {
        manifest,
        resourceDir,
        strategy: inspection.repairedManifest ? 'repaired-existing-manifest' : 'reused-existing',
      };
    }
  }

  if (sourceRuntimeDir) {
    const result = await prepareApiRouterRuntimeFromSource({
      sourceRuntimeDir,
      resourceDir,
      apiRouterVersion,
      target,
    });

    return {
      ...result,
      strategy: 'prepared-source',
    };
  }

  if (!sourceRepoDir || !existsSync(sourceRepoDir)) {
    throw new Error(
      'Unable to prepare sdkwork-api-router runtime. Set SDKWORK_API_ROUTER_BUNDLED_SOURCE_DIR to a prebuilt runtime directory or SDKWORK_API_ROUTER_SOURCE_REPO_DIR to a source checkout.',
    );
  }

  const { sourceRuntimeDir: builtRuntimeDir, cleanup } = await buildApiRouterRuntimeFromWorkspace({
    sourceRepoDir,
    profile,
    target,
  });

  try {
    const result = await prepareApiRouterRuntimeFromSource({
      sourceRuntimeDir: builtRuntimeDir,
      resourceDir,
      apiRouterVersion,
      target,
    });

    return {
      ...result,
      strategy: 'prepared-workspace',
    };
  } finally {
    await cleanup();
  }
}

export async function validatePreparedApiRouterRuntimeSource(sourceRuntimeDir, manifest) {
  const requiredRelativePaths = [manifest.gatewayRelativePath, manifest.adminRelativePath]
    .concat(typeof manifest.portalRelativePath === 'string' ? [manifest.portalRelativePath] : []);

  for (const relativePath of requiredRelativePaths) {
    const absolutePath = path.join(
      sourceRuntimeDir,
      relativePath.replace(/^runtime[\\/]/, ''),
    );
    try {
      await stat(absolutePath);
    } catch (error) {
      throw new Error(
        `Prepared sdkwork-api-router runtime is missing ${absolutePath}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

async function repairPreparedApiRouterRuntimeManifest({
  resourceDir,
  manifest,
}) {
  const manifestPath = path.join(resourceDir, 'manifest.json');
  const runtimeDir = path.join(resourceDir, 'runtime');

  try {
    await validatePreparedApiRouterRuntimeSource(runtimeDir, manifest);
  } catch (error) {
    return {
      reusable: false,
      reason: 'runtime-invalid',
      manifestPath,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  await writeFile(
    manifestPath,
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8',
  );

  return {
    reusable: true,
    repairedManifest: true,
    reason: 'repaired-manifest',
    manifestPath,
    manifest,
  };
}

async function buildApiRouterRuntimeFromWorkspace({
  sourceRepoDir,
  profile = 'release',
  target = resolveApiRouterTarget(),
}) {
  const cargoArgs = ['build'];
  if (profile === 'release') {
    cargoArgs.push('--release');
  } else if (profile !== 'debug') {
    throw new Error(`Unsupported sdkwork-api-router build profile: ${profile}`);
  }
  cargoArgs.push(
    '-p',
    'admin-api-service',
    '-p',
    'gateway-service',
    '-p',
    'portal-api-service',
  );
  await runCommand('cargo', cargoArgs, { cwd: sourceRepoDir });

  const builtArtifactsDir = path.join(
    sourceRepoDir,
    'target',
    profile === 'release' ? 'release' : 'debug',
  );
  const stagingRoot = await mkdtemp(path.join(os.tmpdir(), 'sdkwork-api-router-runtime-'));
  const runtimeDir = path.join(stagingRoot, 'runtime');
  await mkdir(runtimeDir, { recursive: true });

  for (const binaryName of [
    target.gatewayBinaryName,
    target.adminBinaryName,
    target.portalBinaryName,
  ]) {
    await cp(path.join(builtArtifactsDir, binaryName), path.join(runtimeDir, binaryName));
  }

  return {
    sourceRuntimeDir: runtimeDir,
    cleanup: async () => {
      await rm(stagingRoot, { recursive: true, force: true });
    },
  };
}

async function writeGeneratedResourceMetadata(resourceDir) {
  await writeFile(
    path.join(resourceDir, 'README.md'),
    [
      '# Bundled sdkwork-api-router Runtime',
      '',
      'This directory is generated by `scripts/prepare-sdkwork-api-router-runtime.mjs`.',
      'Commit the metadata files here, but keep the runtime binaries and manifest as generated packaging artifacts.',
      '',
      'To refresh the bundled runtime:',
      '',
      '- `node scripts/prepare-sdkwork-api-router-runtime.mjs`',
    ].join('\n') + '\n',
    'utf8',
  );
  await writeFile(
    path.join(resourceDir, '.gitignore'),
    ['runtime/', 'manifest.json'].join('\n') + '\n',
    'utf8',
  );
}

function parseBooleanFlag(value) {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value !== 'string') {
    return false;
  }

  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

function resolveDefaultApiRouterWorkspaceDir() {
  const candidates = [
    path.join(rootDir, '..', 'sdkwork-api-router'),
    path.join(rootDir, '.codex-tools', 'sdkwork-api-router-ref'),
  ];

  return candidates.find((candidate) => existsSync(candidate));
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

      reject(
        new Error(`Command failed: ${command} ${args.join(' ')} (exit ${code ?? 'unknown'})`),
      );
    });
  });
}

async function main() {
  const forcePrepare = process.argv.includes('--force');
  const result = await prepareApiRouterRuntime({ forcePrepare });
  const action = result.strategy === 'reused-existing' ? 'Reused' : 'Prepared';
  console.log(
    `${action} bundled sdkwork-api-router runtime ${result.manifest.routerVersion} for ${result.manifest.platform}-${result.manifest.arch} at ${result.resourceDir} (${result.strategy})`,
  );
}

if (path.resolve(process.argv[1] ?? '') === __filename) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
