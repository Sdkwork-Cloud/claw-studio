import { spawnSync } from 'node:child_process';
import { readlinkSync, symlinkSync } from 'node:fs';
import { cp, mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  BUNDLED_RESOURCE_RUNTIME_ARCHIVE_FILENAME,
  buildOpenClawManifest,
  buildOpenClawRuntimeInstallEnv,
  copyDirectoryWithWindowsFallback,
  DEFAULT_OPENCLAW_RUNTIME_SUPPLEMENTAL_PACKAGES,
  DEFAULT_OPENCLAW_VERSION,
  DEFAULT_RESOURCE_DIR,
  hydrateBundledPluginRuntimeDependency,
  inspectCachedNodeRuntimeDir,
  inspectPreparedOpenClawRuntime,
  prepareOpenClawRuntime,
  prepareOpenClawRuntimeFromStagedDirs,
  resolveDownloadedNativeRuntimeAsset,
  resolveMissingRuntimeCompanionInstallSpecs,
  resolveNapiPackageBinaryInstallSpec,
  resolveBundledPluginRuntimeHydrationTarget,
  resolveRuntimePackageCompanionInstallSpecs,
  resolveScriptCompanionPackageInstallSpec,
  resolveMissingBundledPluginRuntimeInstallSpecs,
  prepareOpenClawRuntimeFromSource,
  removeDirectoryWithRetries,
  retryOpenClawRuntimeOperation,
  refreshCachedOpenClawRuntimeArtifacts,
  resolveOpenClawRuntimeInstallSpecs,
  resolveNodeArchiveExtractionCommand,
  resolveBundledNpmCommand,
  resolveBundledResourceMirrorRoot,
  resolveDefaultOpenClawPrepareCacheDir,
  resolveOpenClawPrepareCachePaths,
  resolveOpenClawTarget,
  resolveRequestedOpenClawTarget,
  stageDownloadedNativeRuntimeAsset,
  syncBundledResourceMirror,
  shouldRetryOpenClawRuntimeOperationError,
  shouldRetryDirectoryCleanup,
  shouldSyncBundledResourceMirror,
  shouldReusePreparedOpenClawRuntime,
} from './prepare-openclaw-runtime.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const prepareScriptPath = path.join(rootDir, 'scripts', 'prepare-openclaw-runtime.mjs');
const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'prepare-openclaw-runtime-test-'));
const actualNodeVersion = process.version.replace(/^v/i, '');
const expectedOpenClawVersion = DEFAULT_OPENCLAW_VERSION;
const cachedNodeRuntimeSidecarManifestRelativePath = '.sdkwork-node-runtime.json';
const runtimeSidecarManifestRelativePath = path.join('runtime', '.sdkwork-openclaw-runtime.json');
const trackedResourcePlaceholder = 'packages/sdkwork-claw-desktop/src-tauri/resources/openclaw/.gitkeep';
const fakeNodeExecutableContent = 'not-a-real-node-runtime';

function listTrackedOpenClawResourceFiles() {
  const result = spawnSync(
    'git',
    ['ls-files', '--', 'packages/sdkwork-claw-desktop/src-tauri/resources/openclaw'],
    {
      cwd: rootDir,
      encoding: 'utf8',
      shell: false,
    },
  );

  if (result.error) {
    if (result.error.code === 'EPERM') {
      return null;
    }
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`git ls-files failed: ${result.stderr || result.stdout}`);
  }

  return result.stdout
    .split(/\r?\n/u)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .sort();
}

try {
  if (DEFAULT_OPENCLAW_VERSION !== expectedOpenClawVersion) {
    throw new Error(
      `Expected DEFAULT_OPENCLAW_VERSION=${expectedOpenClawVersion}, received ${DEFAULT_OPENCLAW_VERSION}`,
    );
  }
  if (
    !Array.isArray(DEFAULT_OPENCLAW_RUNTIME_SUPPLEMENTAL_PACKAGES)
    || DEFAULT_OPENCLAW_RUNTIME_SUPPLEMENTAL_PACKAGES.length === 0
  ) {
    throw new Error('Expected bundled OpenClaw runtime supplemental package list to be defined');
  }

  const trackedOpenClawResourceFiles = listTrackedOpenClawResourceFiles();
  if (
    trackedOpenClawResourceFiles
    && (
      trackedOpenClawResourceFiles.length !== 1
      || trackedOpenClawResourceFiles[0] !== trackedResourcePlaceholder
    )
  ) {
    throw new Error(
      `Expected only ${trackedResourcePlaceholder} to be tracked under resources/openclaw, received ${trackedOpenClawResourceFiles.join(', ') || '<none>'}`,
    );
  }

  if (!shouldSyncBundledResourceMirror({ resourceDir: DEFAULT_RESOURCE_DIR })) {
    throw new Error('Expected the default bundled resource directory to keep syncing the Windows mirror');
  }

  if (shouldSyncBundledResourceMirror({ resourceDir: path.join(tempRoot, 'isolated-resource-runtime') })) {
    throw new Error('Expected temporary bundled resource directories to avoid mutating the shared Windows mirror');
  }

  const sourceRuntimeDir = path.join(tempRoot, 'source-runtime');
  const resourceDir = path.join(tempRoot, 'resource-runtime');
  const target = resolveOpenClawTarget('win32', 'x64');
  const manifest = buildOpenClawManifest({
    openclawVersion: expectedOpenClawVersion,
    nodeVersion: '22.16.0',
    target,
  });
  const nodePath = path.join(sourceRuntimeDir, manifest.nodeRelativePath.replace(/^runtime[\\/]/, ''));
  const cliPath = path.join(sourceRuntimeDir, manifest.cliRelativePath.replace(/^runtime[\\/]/, ''));
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

  await mkdir(path.dirname(nodePath), { recursive: true });
  await mkdir(path.dirname(cliPath), { recursive: true });
  await mkdir(path.dirname(openclawPackageJsonPath), { recursive: true });
  await mkdir(path.dirname(carbonPackageJsonPath), { recursive: true });
  await mkdir(resourceDir, { recursive: true });
  await writeFile(path.join(resourceDir, '.gitkeep'), '');
  await writeFile(nodePath, fakeNodeExecutableContent);
  await writeFile(cliPath, 'console.log("openclaw");');
  await writeFile(
    openclawPackageJsonPath,
    `${JSON.stringify({ name: 'openclaw', version: expectedOpenClawVersion }, null, 2)}\n`,
  );
  await writeFile(
    carbonPackageJsonPath,
    `${JSON.stringify({ name: '@buape/carbon', version: '0.0.0-beta-20260327000044' }, null, 2)}\n`,
  );

  const result = await prepareOpenClawRuntimeFromSource({
    sourceRuntimeDir,
    resourceDir,
    openclawVersion: expectedOpenClawVersion,
    nodeVersion: '22.16.0',
    target,
  });

  await stat(path.join(resourceDir, 'runtime'));
  await stat(path.join(resourceDir, 'manifest.json'));
  await stat(path.join(resourceDir, runtimeSidecarManifestRelativePath));
  await stat(path.join(resourceDir, '.gitkeep'));

  const copiedManifest = JSON.parse(await readFile(path.join(resourceDir, 'manifest.json'), 'utf8'));
  const copiedRuntimeSidecarManifest = JSON.parse(
    await readFile(path.join(resourceDir, runtimeSidecarManifestRelativePath), 'utf8'),
  );
  if (copiedManifest.runtimeId !== 'openclaw') {
    throw new Error(`Expected runtimeId=openclaw, received ${copiedManifest.runtimeId}`);
  }

  if (copiedManifest.openclawVersion !== expectedOpenClawVersion) {
    throw new Error(`Expected openclawVersion=${expectedOpenClawVersion}, received ${copiedManifest.openclawVersion}`);
  }
  if (copiedRuntimeSidecarManifest.openclawVersion !== expectedOpenClawVersion) {
    throw new Error(
      `Expected runtime sidecar openclawVersion=${expectedOpenClawVersion}, received ${copiedRuntimeSidecarManifest.openclawVersion}`,
    );
  }
  if (copiedRuntimeSidecarManifest.nodeVersion !== '22.16.0') {
    throw new Error(
      `Expected runtime sidecar nodeVersion=22.16.0, received ${copiedRuntimeSidecarManifest.nodeVersion}`,
    );
  }

  if (result.manifest.cliRelativePath !== 'runtime/package/node_modules/openclaw/openclaw.mjs') {
    throw new Error(`Unexpected cliRelativePath ${result.manifest.cliRelativePath}`);
  }

  const mirrorWorkspaceRoot = path.join(tempRoot, 'workspace-root');
  const mirroredResourceRoot = resolveBundledResourceMirrorRoot(
    mirrorWorkspaceRoot,
    'openclaw',
    'win32',
  );
  let bundledArchiveCreateCount = 0;
  await syncBundledResourceMirror({
    resourceDir,
    resourceId: 'openclaw',
    workspaceRootDir: mirrorWorkspaceRoot,
    platform: 'win32',
    createArchiveImpl: async ({ sourceRoot, archivePath, platform }) => {
      bundledArchiveCreateCount += 1;
      if (sourceRoot !== resourceDir) {
        throw new Error(`Expected bundled resource mirror to archive ${resourceDir}, received ${sourceRoot}`);
      }
      if (platform !== 'win32') {
        throw new Error(`Expected bundled resource mirror archive platform=win32, received ${platform}`);
      }
      await writeFile(archivePath, 'zip');
    },
  });

  await stat(path.join(mirroredResourceRoot, 'manifest.json'));
  await stat(path.join(mirroredResourceRoot, BUNDLED_RESOURCE_RUNTIME_ARCHIVE_FILENAME));

  let mirroredRuntimeDirMissing = false;
  try {
    await stat(path.join(mirroredResourceRoot, 'runtime'));
  } catch (error) {
    mirroredRuntimeDirMissing = error && typeof error === 'object' && error.code === 'ENOENT';
  }

  if (!mirroredRuntimeDirMissing) {
    throw new Error('Expected the Windows bundled resource mirror to materialize an archive instead of a runtime directory tree');
  }

  await syncBundledResourceMirror({
    resourceDir,
    resourceId: 'openclaw',
    workspaceRootDir: mirrorWorkspaceRoot,
    platform: 'win32',
    createArchiveImpl: async () => {
      bundledArchiveCreateCount += 1;
      throw new Error('Expected the Windows bundled resource mirror to reuse an up-to-date archive');
    },
  });

  if (bundledArchiveCreateCount !== 1) {
    throw new Error(`Expected the Windows bundled resource mirror archive to be created once, received ${bundledArchiveCreateCount}`);
  }

  await rm(mirroredResourceRoot, { recursive: true, force: true });

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

  const installSpecs = resolveOpenClawRuntimeInstallSpecs({
    openclawPackage: 'openclaw',
    openclawVersion: expectedOpenClawVersion,
    runtimeSupplementalPackages: DEFAULT_OPENCLAW_RUNTIME_SUPPLEMENTAL_PACKAGES,
  });
  if (
    installSpecs[0] !== `openclaw@${expectedOpenClawVersion}`
    || !installSpecs.some((entry) => entry.startsWith('@buape/carbon@'))
  ) {
    throw new Error(
      `Expected install specs to include OpenClaw and @buape/carbon, received ${installSpecs.join(', ')}`,
    );
  }
  const missingBundledPluginRuntimeInstallSpecsRoot = path.join(
    tempRoot,
    'missing-bundled-plugin-runtime-install-specs-root',
  );
  const missingBundledPluginRuntimeInstallSpecsPackageRoot = path.join(
    missingBundledPluginRuntimeInstallSpecsRoot,
    'node_modules',
    'openclaw',
  );
  const missingBundledPluginRuntimeInstallSpecsPluginPackageJsonPath = path.join(
    missingBundledPluginRuntimeInstallSpecsPackageRoot,
    'dist',
    'extensions',
    'tlon',
    'package.json',
  );
  await mkdir(path.dirname(missingBundledPluginRuntimeInstallSpecsPluginPackageJsonPath), {
    recursive: true,
  });
  await writeFile(
    missingBundledPluginRuntimeInstallSpecsPluginPackageJsonPath,
    `${JSON.stringify(
      {
        name: '@openclaw/tlon',
        version: '2026.4.2-beta.1',
        dependencies: {
          '@aws-sdk/client-s3': '3.1020.0',
          '@aws-sdk/s3-request-presigner': '3.1020.0',
        },
      },
      null,
      2,
    )}\n`,
  );
  const missingBundledPluginRuntimeInstallSpecs =
    await resolveMissingBundledPluginRuntimeInstallSpecs({
      packageRoot: missingBundledPluginRuntimeInstallSpecsPackageRoot,
      packageInstallRoot: missingBundledPluginRuntimeInstallSpecsRoot,
    });
  if (
    !missingBundledPluginRuntimeInstallSpecs.includes('@aws-sdk/client-s3@3.1020.0')
    || !missingBundledPluginRuntimeInstallSpecs.includes(
      '@aws-sdk/s3-request-presigner@3.1020.0',
    )
  ) {
    throw new Error(
      `Expected missing bundled plugin runtime install specs to include tlon dependencies, received ${missingBundledPluginRuntimeInstallSpecs.join(', ')}`,
    );
  }
  const bundledPluginRuntimeHydrationTarget =
    resolveBundledPluginRuntimeHydrationTarget({
      installSpec: '@whiskeysockets/baileys@7.0.0-rc.9',
      packageJson: {
        name: '@whiskeysockets/baileys',
        version: '7.0.0-rc.9',
        dependencies: {
          '@cacheable/node-cache': '^1.4.0',
          '@hapi/boom': '^9.1.3',
          'async-mutex': '^0.5.0',
          libsignal: 'git+https://github.com/whiskeysockets/libsignal-node',
          'lru-cache': '^11.1.0',
          'music-metadata': '^11.7.0',
          'p-queue': '^9.0.0',
          pino: '^9.6',
          protobufjs: '^7.2.4',
          ws: '^8.13.0',
        },
      },
    });
  if (!bundledPluginRuntimeHydrationTarget) {
    throw new Error('Expected Baileys bundled runtime dependency hydration target to be resolved');
  }
  if (bundledPluginRuntimeHydrationTarget.packageName !== '@whiskeysockets/baileys') {
    throw new Error(
      `Expected hydration target packageName=@whiskeysockets/baileys, received ${bundledPluginRuntimeHydrationTarget.packageName}`,
    );
  }
  if (
    !bundledPluginRuntimeHydrationTarget.registryDependencyInstallSpecs.includes('protobufjs@^7.2.4')
    || bundledPluginRuntimeHydrationTarget.registryDependencyInstallSpecs.some((entry) =>
      entry.startsWith('libsignal@'),
    )
  ) {
    throw new Error(
      `Expected Baileys hydration target to keep registry deps and exclude libsignal from direct registry installs, received ${bundledPluginRuntimeHydrationTarget.registryDependencyInstallSpecs.join(', ')}`,
    );
  }
  const libsignalHydrationTarget = bundledPluginRuntimeHydrationTarget.gitDependencies.find(
    (entry) => entry.name === 'libsignal',
  );
  if (
    !libsignalHydrationTarget
    || libsignalHydrationTarget.cloneUrl !== 'https://github.com/whiskeysockets/libsignal-node.git'
    || libsignalHydrationTarget.cloneRef !== 'master'
  ) {
    throw new Error(
      `Expected Baileys hydration target to clone libsignal from GitHub master, received ${JSON.stringify(libsignalHydrationTarget)}`,
    );
  }
  const unsupportedBundledPluginRuntimeHydrationTarget =
    resolveBundledPluginRuntimeHydrationTarget({
      installSpec: '@example/custom-git-plugin@1.0.0',
      packageJson: {
        name: '@example/custom-git-plugin',
        version: '1.0.0',
        dependencies: {
          '@example/registry': '^1.0.0',
          '@example/git-runtime': 'git+https://github.com/example/git-runtime.git',
        },
      },
    });
  if (unsupportedBundledPluginRuntimeHydrationTarget !== null) {
    throw new Error('Expected unknown git-backed bundled runtime dependencies to avoid custom hydration');
  }
  const matrixNapiBinaryInstallSpec = resolveNapiPackageBinaryInstallSpec({
    packageJson: {
      name: '@matrix-org/matrix-sdk-crypto-nodejs',
      version: '0.4.0',
      napi: {
        name: 'matrix-sdk-crypto',
      },
    },
    platform: 'win32',
    arch: 'x64',
  });
  if (matrixNapiBinaryInstallSpec !== '@matrix-org/matrix-sdk-crypto-nodejs-win32-x64-msvc@0.4.0') {
    throw new Error(
      `Expected matrix napi binary install spec to target win32-x64-msvc, received ${matrixNapiBinaryInstallSpec}`,
    );
  }
  const tlonSkillScriptCompanionInstallSpec = resolveScriptCompanionPackageInstallSpec({
    packageJson: {
      name: '@tloncorp/tlon-skill',
      version: '0.3.1',
      optionalDependencies: {
        '@tloncorp/tlon-skill-darwin-arm64': '0.3.1',
        '@tloncorp/tlon-skill-darwin-x64': '0.3.1',
        '@tloncorp/tlon-skill-linux-x64': '0.3.1',
        '@tloncorp/tlon-skill-linux-arm64': '0.3.1',
      },
    },
    platform: 'linux',
    arch: 'x64',
  });
  if (tlonSkillScriptCompanionInstallSpec !== '@tloncorp/tlon-skill-linux-x64@0.3.1') {
    throw new Error(
      `Expected tlon-skill companion install spec to target linux-x64, received ${tlonSkillScriptCompanionInstallSpec}`,
    );
  }
  const unsupportedTlonSkillScriptCompanionInstallSpec = resolveScriptCompanionPackageInstallSpec({
    packageJson: {
      name: '@tloncorp/tlon-skill',
      version: '0.3.1',
      optionalDependencies: {
        '@tloncorp/tlon-skill-darwin-arm64': '0.3.1',
        '@tloncorp/tlon-skill-darwin-x64': '0.3.1',
        '@tloncorp/tlon-skill-linux-x64': '0.3.1',
        '@tloncorp/tlon-skill-linux-arm64': '0.3.1',
      },
    },
    platform: 'win32',
    arch: 'x64',
  });
  if (unsupportedTlonSkillScriptCompanionInstallSpec !== null) {
    throw new Error(
      `Expected tlon-skill companion install spec to skip unsupported win32 targets, received ${unsupportedTlonSkillScriptCompanionInstallSpec}`,
    );
  }
  const runtimeCompanionInstallSpecs = resolveRuntimePackageCompanionInstallSpecs({
    packageJson: {
      name: '@tloncorp/tlon-skill',
      version: '0.3.1',
      optionalDependencies: {
        '@tloncorp/tlon-skill-darwin-arm64': '0.3.1',
        '@tloncorp/tlon-skill-darwin-x64': '0.3.1',
        '@tloncorp/tlon-skill-linux-x64': '0.3.1',
        '@tloncorp/tlon-skill-linux-arm64': '0.3.1',
      },
    },
    platform: 'darwin',
    arch: 'arm64',
  });
  if (
    runtimeCompanionInstallSpecs.length !== 1
    || runtimeCompanionInstallSpecs[0] !== '@tloncorp/tlon-skill-darwin-arm64@0.3.1'
  ) {
    throw new Error(
      `Expected runtime companion install specs to include the tlon-skill darwin-arm64 sidecar, received ${runtimeCompanionInstallSpecs.join(', ')}`,
    );
  }
  const missingRuntimeCompanionInstallRoot = path.join(
    tempRoot,
    'missing-runtime-companion-install-root',
  );
  const missingRuntimeCompanionPackageJsonPath = path.join(
    missingRuntimeCompanionInstallRoot,
    'node_modules',
    '@tloncorp',
    'tlon-skill',
    'package.json',
  );
  await mkdir(path.dirname(missingRuntimeCompanionPackageJsonPath), { recursive: true });
  await writeFile(
    missingRuntimeCompanionPackageJsonPath,
    `${JSON.stringify(
      {
        name: '@tloncorp/tlon-skill',
        version: '0.3.1',
        optionalDependencies: {
          '@tloncorp/tlon-skill-darwin-arm64': '0.3.1',
          '@tloncorp/tlon-skill-darwin-x64': '0.3.1',
          '@tloncorp/tlon-skill-linux-x64': '0.3.1',
          '@tloncorp/tlon-skill-linux-arm64': '0.3.1',
        },
      },
      null,
      2,
    )}\n`,
  );
  const missingRuntimeCompanionInstallSpecs = await resolveMissingRuntimeCompanionInstallSpecs({
    packageInstallRoot: missingRuntimeCompanionInstallRoot,
    installSpecs: ['@tloncorp/tlon-skill@0.3.1'],
    platform: 'linux',
    arch: 'x64',
  });
  if (
    missingRuntimeCompanionInstallSpecs.length !== 1
    || missingRuntimeCompanionInstallSpecs[0] !== '@tloncorp/tlon-skill-linux-x64@0.3.1'
  ) {
    throw new Error(
      `Expected missing runtime companion install specs to include the tlon-skill linux-x64 sidecar, received ${missingRuntimeCompanionInstallSpecs.join(', ')}`,
    );
  }
  const matrixDownloadedNativeRuntimeAsset = resolveDownloadedNativeRuntimeAsset({
    packageJson: {
      name: '@matrix-org/matrix-sdk-crypto-nodejs',
      version: '0.4.0',
    },
    platform: 'win32',
    arch: 'x64',
  });
  if (!matrixDownloadedNativeRuntimeAsset) {
    throw new Error('Expected Matrix crypto package to resolve a downloaded native runtime asset');
  }
  if (
    matrixDownloadedNativeRuntimeAsset.assetFileName !== 'matrix-sdk-crypto.win32-x64-msvc.node'
    || matrixDownloadedNativeRuntimeAsset.destinationRelativePath !== 'matrix-sdk-crypto.win32-x64-msvc.node'
    || matrixDownloadedNativeRuntimeAsset.downloadUrl
      !== 'https://github.com/matrix-org/matrix-rust-sdk-crypto-nodejs/releases/download/v0.4.0/matrix-sdk-crypto.win32-x64-msvc.node'
  ) {
    throw new Error(
      `Expected Matrix downloaded native runtime asset to target the win32-x64-msvc GitHub release binary, received ${JSON.stringify(matrixDownloadedNativeRuntimeAsset)}`,
    );
  }
  const matrixDownloadedNativeRuntimePackageDir = path.join(
    tempRoot,
    'matrix-downloaded-native-runtime-package',
  );
  await mkdir(matrixDownloadedNativeRuntimePackageDir, { recursive: true });
  const matrixDownloadedNativeRuntimeResult = await stageDownloadedNativeRuntimeAsset({
    packageDir: matrixDownloadedNativeRuntimePackageDir,
    runtimeAsset: matrixDownloadedNativeRuntimeAsset,
    fetchImpl: async (url) => {
      if (url !== matrixDownloadedNativeRuntimeAsset.downloadUrl) {
        throw new Error(`Expected Matrix native runtime asset download URL ${matrixDownloadedNativeRuntimeAsset.downloadUrl}, received ${url}`);
      }
      return new Response('matrix-native-binary');
    },
  });
  if (!matrixDownloadedNativeRuntimeResult.downloaded) {
    throw new Error('Expected Matrix native runtime asset staging to download the missing binary');
  }
  const matrixDownloadedNativeRuntimeDestinationPath = path.join(
    matrixDownloadedNativeRuntimePackageDir,
    'matrix-sdk-crypto.win32-x64-msvc.node',
  );
  const matrixDownloadedNativeRuntimeValue = await readFile(
    matrixDownloadedNativeRuntimeDestinationPath,
    'utf8',
  );
  if (matrixDownloadedNativeRuntimeValue !== 'matrix-native-binary') {
    throw new Error(
      `Expected staged Matrix native runtime asset to contain the downloaded payload, received ${matrixDownloadedNativeRuntimeValue}`,
    );
  }
  const hydratedBundledPluginRuntimeInstallRoot = path.join(
    tempRoot,
    'hydrated-bundled-plugin-runtime-install-root',
  );
  const stagedBundledPluginRuntimePackageDir = path.join(
    tempRoot,
    'staged-bundled-plugin-runtime-package',
  );
  const stagedBundledPluginRuntimeGitDependencyDir = path.join(
    tempRoot,
    'staged-bundled-plugin-runtime-libsignal',
  );
  await mkdir(stagedBundledPluginRuntimePackageDir, { recursive: true });
  await mkdir(stagedBundledPluginRuntimeGitDependencyDir, { recursive: true });
  await writeFile(
    path.join(stagedBundledPluginRuntimePackageDir, 'package.json'),
    `${JSON.stringify(
      {
        name: '@whiskeysockets/baileys',
        version: '7.0.0-rc.9',
        dependencies: {
          '@cacheable/node-cache': '^1.4.0',
          libsignal: 'git+https://github.com/whiskeysockets/libsignal-node',
          protobufjs: '^7.2.4',
        },
      },
      null,
      2,
    )}\n`,
  );
  await writeFile(
    path.join(stagedBundledPluginRuntimePackageDir, 'index.js'),
    'module.exports = "baileys";\n',
  );
  await writeFile(
    path.join(stagedBundledPluginRuntimeGitDependencyDir, 'package.json'),
    `${JSON.stringify(
      {
        name: '@whiskeysockets/libsignal-node',
        version: '2.0.1',
        dependencies: {
          'curve25519-js': '^0.0.4',
          protobufjs: '6.8.8',
        },
      },
      null,
      2,
    )}\n`,
  );
  await writeFile(
    path.join(stagedBundledPluginRuntimeGitDependencyDir, 'index.js'),
    'module.exports = "libsignal";\n',
  );
  const hydratedBundledPluginRuntimeInstallCalls = [];
  await hydrateBundledPluginRuntimeDependency({
    hydrationTarget: bundledPluginRuntimeHydrationTarget,
    packageInstallRoot: hydratedBundledPluginRuntimeInstallRoot,
    cacheDir: path.join(tempRoot, 'hydrated-bundled-plugin-runtime-cache'),
    stageRegistryPackageImpl: async () => stagedBundledPluginRuntimePackageDir,
    cloneGitDependencyImpl: async () => stagedBundledPluginRuntimeGitDependencyDir,
    installPackageDependenciesImpl: async ({ packageDir, installSpecs }) => {
      hydratedBundledPluginRuntimeInstallCalls.push({
        packageDir,
        installSpecs: [...installSpecs].sort(),
      });
    },
  });
  const hydratedBundledPluginRuntimePackageJsonPath = path.join(
    hydratedBundledPluginRuntimeInstallRoot,
    'node_modules',
    '@whiskeysockets',
    'baileys',
    'package.json',
  );
  const hydratedBundledPluginRuntimeGitPackageJsonPath = path.join(
    hydratedBundledPluginRuntimeInstallRoot,
    'node_modules',
    '@whiskeysockets',
    'baileys',
    'node_modules',
    'libsignal',
    'package.json',
  );
  await stat(hydratedBundledPluginRuntimePackageJsonPath);
  await stat(hydratedBundledPluginRuntimeGitPackageJsonPath);
  const directHydrationInstallCall = hydratedBundledPluginRuntimeInstallCalls.find(
    (entry) => entry.packageDir === stagedBundledPluginRuntimePackageDir,
  );
  if (
    !directHydrationInstallCall
    || !directHydrationInstallCall.installSpecs.includes('@cacheable/node-cache@^1.4.0')
    || !directHydrationInstallCall.installSpecs.includes('protobufjs@^7.2.4')
  ) {
    throw new Error(
      `Expected bundled runtime hydration to install direct registry dependencies inside the staged package dir, received ${JSON.stringify(hydratedBundledPluginRuntimeInstallCalls)}`,
    );
  }
  const gitHydrationInstallCall = hydratedBundledPluginRuntimeInstallCalls.find(
    (entry) => entry.packageDir === stagedBundledPluginRuntimeGitDependencyDir,
  );
  if (
    !gitHydrationInstallCall
    || !gitHydrationInstallCall.installSpecs.includes('curve25519-js@^0.0.4')
    || !gitHydrationInstallCall.installSpecs.includes('protobufjs@6.8.8')
  ) {
    throw new Error(
      `Expected bundled runtime hydration to install cloned git dependency registry dependencies inside the staged git dir, received ${JSON.stringify(hydratedBundledPluginRuntimeInstallCalls)}`,
    );
  }

  const installEnv = buildOpenClawRuntimeInstallEnv({
    PATH: 'C:\\runtime\\node',
    npm_config_cache: 'D:\\workspace\\.cache\\npm-cache',
  });
  if (installEnv.PATH !== 'C:\\runtime\\node') {
    throw new Error(`Expected runtime install env to preserve PATH, received ${installEnv.PATH}`);
  }
  if (installEnv.npm_config_cache !== 'D:\\workspace\\.cache\\npm-cache') {
    throw new Error(
      `Expected runtime install env to preserve npm_config_cache, received ${installEnv.npm_config_cache}`,
    );
  }
  if (installEnv.OPENCLAW_DISABLE_BUNDLED_PLUGIN_POSTINSTALL !== '1') {
    throw new Error(
      `Expected runtime install env to disable bundled plugin postinstall, received ${installEnv.OPENCLAW_DISABLE_BUNDLED_PLUGIN_POSTINSTALL}`,
    );
  }
  const managedInstallEnv = buildOpenClawRuntimeInstallEnv(
    {
      PATH: 'C:\\runtime\\node',
      TEMP: 'C:\\Users\\admin\\AppData\\Local\\Temp',
      TMP: 'C:\\Users\\admin\\AppData\\Local\\Temp',
    },
    {
      cacheDir: 'C:\\.sdkwork-bc\\claw-studio\\openclaw-cache',
      platform: 'win32',
    },
  );
  if (managedInstallEnv.npm_config_cache?.toLowerCase() !== 'c:\\.sdkwork-bc\\claw-studio\\openclaw-cache\\npm-cache') {
    throw new Error(
      `Expected runtime install env to force a short npm cache path, received ${managedInstallEnv.npm_config_cache}`,
    );
  }
  if (managedInstallEnv.TEMP?.toLowerCase() !== 'c:\\.sdkwork-bc\\claw-studio\\openclaw-cache\\tmp') {
    throw new Error(
      `Expected runtime install env to force a short TEMP path, received ${managedInstallEnv.TEMP}`,
    );
  }
  if (managedInstallEnv.TMP?.toLowerCase() !== 'c:\\.sdkwork-bc\\claw-studio\\openclaw-cache\\tmp') {
    throw new Error(
      `Expected runtime install env to force a short TMP path, received ${managedInstallEnv.TMP}`,
    );
  }

  const prepareScriptSource = await readFile(prepareScriptPath, 'utf8');
  if (
    !/env:\s*buildOpenClawRuntimeInstallEnv\(\s*process\.env\s*,[\s\S]*?cacheDir[\s\S]*?platform:\s*target\.platformId[\s\S]*?\)/u.test(prepareScriptSource)
  ) {
    throw new Error(
      'Expected prepare-openclaw-runtime to install OpenClaw with a runtime install env that uses the active prepare cache dir and platform',
    );
  }
  if (!/['"]--ignore-scripts['"]/u.test(prepareScriptSource)) {
    throw new Error(
      'Expected prepare-openclaw-runtime to install bundled OpenClaw packages with --ignore-scripts so runtime preparation stays deterministic and sandbox-safe',
    );
  }

  const requestedWindowsTarget = resolveRequestedOpenClawTarget({
    env: {
      SDKWORK_DESKTOP_TARGET: 'x86_64-pc-windows-msvc',
      SDKWORK_DESKTOP_TARGET_PLATFORM: 'windows',
      SDKWORK_DESKTOP_TARGET_ARCH: 'x64',
    },
  });
  if (requestedWindowsTarget.platformId !== 'windows' || requestedWindowsTarget.archId !== 'x64') {
    throw new Error(
      `Expected release env target resolution to return windows-x64, received ${requestedWindowsTarget.platformId}-${requestedWindowsTarget.archId}`,
    );
  }

  const windowsCacheDir = resolveDefaultOpenClawPrepareCacheDir({
    workspaceRootDir: 'C:\\workspaces\\claw-studio',
    platform: 'win32',
    localAppData: 'C:\\Users\\admin\\AppData\\Local',
    homeDir: 'C:\\Users\\admin',
  });
  if (windowsCacheDir.toLowerCase() !== 'c:\\.sdkwork-bc\\claw-studio\\openclaw-cache') {
    throw new Error(`Expected short Windows cache dir, received ${windowsCacheDir}`);
  }

  if (typeof shouldRetryOpenClawRuntimeOperationError !== 'function') {
    throw new Error(
      'Expected shouldRetryOpenClawRuntimeOperationError to be exported for transient OpenClaw runtime install retry decisions',
    );
  }
  if (!shouldRetryOpenClawRuntimeOperationError(new Error('npm install failed: ECONNRESET network aborted'))) {
    throw new Error('Expected ECONNRESET runtime install failures to be retried');
  }
  if (shouldRetryOpenClawRuntimeOperationError(new Error('Prepared OpenClaw package.json version mismatch'))) {
    throw new Error('Expected manifest/data integrity errors to avoid retry classification');
  }

  if (typeof retryOpenClawRuntimeOperation !== 'function') {
    throw new Error('Expected retryOpenClawRuntimeOperation to be exported for runtime install retry handling');
  }
  let runtimeRetryAttempts = 0;
  const runtimeRetryResult = await retryOpenClawRuntimeOperation(
    async () => {
      runtimeRetryAttempts += 1;
      if (runtimeRetryAttempts < 3) {
        throw new Error('network aborted: ECONNRESET');
      }
      return 'ready';
    },
    {
      retries: 3,
      retryDelayMs: 0,
      logger: () => {},
    },
  );
  if (runtimeRetryResult !== 'ready') {
    throw new Error(`Expected runtime retry helper to return the successful result, received ${runtimeRetryResult}`);
  }
  if (runtimeRetryAttempts !== 3) {
    throw new Error(`Expected runtime retry helper to retry twice before success, received ${runtimeRetryAttempts} attempts`);
  }

  let nonRetryAttempts = 0;
  let nonRetryError;
  try {
    await retryOpenClawRuntimeOperation(
      async () => {
        nonRetryAttempts += 1;
        throw new Error('Prepared OpenClaw package.json version mismatch');
      },
      {
        retries: 3,
        retryDelayMs: 0,
        logger: () => {},
      },
    );
    throw new Error('Expected non-transient runtime errors to surface without retries');
  } catch (error) {
    nonRetryError = error;
  }
  if (nonRetryAttempts !== 1) {
    throw new Error(`Expected non-transient runtime errors to skip retries, received ${nonRetryAttempts} attempts`);
  }
  if (!(nonRetryError instanceof Error) || !nonRetryError.message.includes('version mismatch')) {
    throw new Error(`Expected non-transient runtime retry error to be preserved, received ${String(nonRetryError)}`);
  }

  const cachedNodeRuntimeDir = path.join(tempRoot, 'cached-node-runtime');
  const cachedNodeExecutablePath = path.join(cachedNodeRuntimeDir, 'node.exe');
  const cachedNodeNpmCliPath = path.join(
    cachedNodeRuntimeDir,
    'node_modules',
    'npm',
    'bin',
    'npm-cli.js',
  );
  const cachedNodeNpmPrefixPath = path.join(
    cachedNodeRuntimeDir,
    'node_modules',
    'npm',
    'bin',
    'npm-prefix.js',
  );
  const cachedNodeSidecarManifestPath = path.join(
    cachedNodeRuntimeDir,
    cachedNodeRuntimeSidecarManifestRelativePath,
  );

  await mkdir(path.dirname(cachedNodeExecutablePath), { recursive: true });
  await mkdir(path.dirname(cachedNodeNpmCliPath), { recursive: true });
  await mkdir(path.dirname(cachedNodeNpmPrefixPath), { recursive: true });
  await writeFile(cachedNodeExecutablePath, 'not-a-real-node-runtime');
  await writeFile(path.join(cachedNodeRuntimeDir, 'npm.cmd'), '@echo off\r\n');
  await writeFile(cachedNodeNpmCliPath, 'module.exports = {};\n');
  await writeFile(cachedNodeNpmPrefixPath, 'module.exports = {};\n');
  await writeFile(
    cachedNodeSidecarManifestPath,
    `${JSON.stringify(
      {
        schemaVersion: 1,
        nodeVersion: '22.16.0',
        platform: 'windows',
        arch: 'x64',
        nodeRelativePath: 'runtime/node/node.exe',
      },
      null,
      2,
    )}\n`,
  );

  if (typeof inspectCachedNodeRuntimeDir !== 'function') {
    throw new Error('Expected inspectCachedNodeRuntimeDir to be exported for cached node runtime verification');
  }

  const cachedNodeInspection = await inspectCachedNodeRuntimeDir({
    nodeSourceDir: cachedNodeRuntimeDir,
    target,
    nodeVersion: '22.16.0',
  });
  if (!cachedNodeInspection.reusable || cachedNodeInspection.reason !== 'ready') {
    throw new Error(
      `Expected cached node runtime sidecar metadata to allow reuse, received ${JSON.stringify(cachedNodeInspection)}`,
    );
  }

  const missingDependencySourceRuntimeDir = path.join(tempRoot, 'source-runtime-missing-carbon');
  const missingDependencyNodePath = path.join(
    missingDependencySourceRuntimeDir,
    manifest.nodeRelativePath.replace(/^runtime[\\/]/, ''),
  );
  const missingDependencyCliPath = path.join(
    missingDependencySourceRuntimeDir,
    manifest.cliRelativePath.replace(/^runtime[\\/]/, ''),
  );
  const missingDependencyOpenclawPackageJsonPath = path.join(
    missingDependencySourceRuntimeDir,
    'package',
    'node_modules',
    'openclaw',
    'package.json',
  );

  await mkdir(path.dirname(missingDependencyNodePath), { recursive: true });
  await mkdir(path.dirname(missingDependencyCliPath), { recursive: true });
  await mkdir(path.dirname(missingDependencyOpenclawPackageJsonPath), { recursive: true });
  await writeFile(missingDependencyNodePath, fakeNodeExecutableContent);
  await writeFile(missingDependencyCliPath, 'console.log("openclaw");');
  await writeFile(
    missingDependencyOpenclawPackageJsonPath,
    `${JSON.stringify({ name: 'openclaw', version: expectedOpenClawVersion }, null, 2)}\n`,
  );

  await prepareOpenClawRuntimeFromSource({
    sourceRuntimeDir: missingDependencySourceRuntimeDir,
    resourceDir: path.join(tempRoot, 'invalid-resource-runtime'),
    openclawVersion: expectedOpenClawVersion,
    nodeVersion: '22.16.0',
    runtimeSupplementalPackages: [],
    target,
  });

  let missingSupplementalDependencyRejected = false;
  try {
    await prepareOpenClawRuntimeFromSource({
      sourceRuntimeDir: missingDependencySourceRuntimeDir,
      resourceDir: path.join(tempRoot, 'invalid-resource-runtime-missing-carbon'),
      openclawVersion: expectedOpenClawVersion,
      nodeVersion: '22.16.0',
      runtimeSupplementalPackages: DEFAULT_OPENCLAW_RUNTIME_SUPPLEMENTAL_PACKAGES,
      target,
    });
  } catch (error) {
    missingSupplementalDependencyRejected =
      /@buape[\\/]+carbon/u.test(String(error));
  }
  if (!missingSupplementalDependencyRejected) {
    throw new Error('Expected prepared runtime validation to reject missing @buape/carbon supplemental dependency');
  }

  const mismatchedVersionSourceRuntimeDir = path.join(tempRoot, 'source-runtime-mismatched-openclaw-version');
  const mismatchedVersionNodePath = path.join(
    mismatchedVersionSourceRuntimeDir,
    manifest.nodeRelativePath.replace(/^runtime[\\/]/, ''),
  );
  const mismatchedVersionCliPath = path.join(
    mismatchedVersionSourceRuntimeDir,
    manifest.cliRelativePath.replace(/^runtime[\\/]/, ''),
  );
  const mismatchedVersionOpenclawPackageJsonPath = path.join(
    mismatchedVersionSourceRuntimeDir,
    'package',
    'node_modules',
    'openclaw',
    'package.json',
  );
  const mismatchedVersionCarbonPackageJsonPath = path.join(
    mismatchedVersionSourceRuntimeDir,
    'package',
    'node_modules',
    '@buape',
    'carbon',
    'package.json',
  );

  await mkdir(path.dirname(mismatchedVersionNodePath), { recursive: true });
  await mkdir(path.dirname(mismatchedVersionCliPath), { recursive: true });
  await mkdir(path.dirname(mismatchedVersionOpenclawPackageJsonPath), { recursive: true });
  await mkdir(path.dirname(mismatchedVersionCarbonPackageJsonPath), { recursive: true });
  await writeFile(mismatchedVersionNodePath, fakeNodeExecutableContent);
  await writeFile(mismatchedVersionCliPath, 'console.log("openclaw");');
  await writeFile(
    mismatchedVersionOpenclawPackageJsonPath,
    `${JSON.stringify({ name: 'openclaw', version: '2026.3.24' }, null, 2)}\n`,
  );
  await writeFile(
    mismatchedVersionCarbonPackageJsonPath,
    `${JSON.stringify({ name: '@buape/carbon', version: '0.0.0-beta-20260327000044' }, null, 2)}\n`,
  );

  let mismatchedVersionRejected = false;
  try {
    await prepareOpenClawRuntimeFromSource({
      sourceRuntimeDir: mismatchedVersionSourceRuntimeDir,
      resourceDir: path.join(tempRoot, 'invalid-resource-runtime-mismatched-openclaw-version'),
      openclawVersion: expectedOpenClawVersion,
      nodeVersion: actualNodeVersion,
      runtimeSupplementalPackages: DEFAULT_OPENCLAW_RUNTIME_SUPPLEMENTAL_PACKAGES,
      target,
    });
  } catch (error) {
    mismatchedVersionRejected =
      /openclaw-version-mismatch|Prepared OpenClaw package\.json version mismatch|2026\.3\.24/u.test(
        String(error),
      );
  }
  if (!mismatchedVersionRejected) {
    throw new Error('Expected prepared runtime validation to reject mismatched OpenClaw package versions');
  }

  const missingBundledPluginRuntimeDepSourceRuntimeDir = path.join(
    tempRoot,
    'source-runtime-missing-bundled-plugin-runtime-dep',
  );
  const missingBundledPluginRuntimeDepNodePath = path.join(
    missingBundledPluginRuntimeDepSourceRuntimeDir,
    manifest.nodeRelativePath.replace(/^runtime[\\/]/, ''),
  );
  const missingBundledPluginRuntimeDepCliPath = path.join(
    missingBundledPluginRuntimeDepSourceRuntimeDir,
    manifest.cliRelativePath.replace(/^runtime[\\/]/, ''),
  );
  const missingBundledPluginRuntimeDepOpenclawPackageJsonPath = path.join(
    missingBundledPluginRuntimeDepSourceRuntimeDir,
    'package',
    'node_modules',
    'openclaw',
    'package.json',
  );
  const missingBundledPluginRuntimeDepCarbonPackageJsonPath = path.join(
    missingBundledPluginRuntimeDepSourceRuntimeDir,
    'package',
    'node_modules',
    '@buape',
    'carbon',
    'package.json',
  );
  const missingBundledPluginRuntimeDepScriptPath = path.join(
    missingBundledPluginRuntimeDepSourceRuntimeDir,
    'package',
    'node_modules',
    'openclaw',
    'scripts',
    'postinstall-bundled-plugins.mjs',
  );
  const missingBundledPluginRuntimeDepPluginPackageJsonPath = path.join(
    missingBundledPluginRuntimeDepSourceRuntimeDir,
    'package',
    'node_modules',
    'openclaw',
    'dist',
    'extensions',
    'amazon-bedrock',
    'package.json',
  );

  await mkdir(path.dirname(missingBundledPluginRuntimeDepNodePath), { recursive: true });
  await mkdir(path.dirname(missingBundledPluginRuntimeDepCliPath), { recursive: true });
  await mkdir(path.dirname(missingBundledPluginRuntimeDepOpenclawPackageJsonPath), { recursive: true });
  await mkdir(path.dirname(missingBundledPluginRuntimeDepCarbonPackageJsonPath), { recursive: true });
  await mkdir(path.dirname(missingBundledPluginRuntimeDepScriptPath), { recursive: true });
  await mkdir(path.dirname(missingBundledPluginRuntimeDepPluginPackageJsonPath), { recursive: true });
  await writeFile(missingBundledPluginRuntimeDepNodePath, fakeNodeExecutableContent);
  await writeFile(missingBundledPluginRuntimeDepCliPath, 'console.log("openclaw");');
  await writeFile(
    missingBundledPluginRuntimeDepOpenclawPackageJsonPath,
    `${JSON.stringify({ name: 'openclaw', version: expectedOpenClawVersion }, null, 2)}\n`,
  );
  await writeFile(
    missingBundledPluginRuntimeDepCarbonPackageJsonPath,
    `${JSON.stringify({ name: '@buape/carbon', version: '0.0.0-beta-20260327000044' }, null, 2)}\n`,
  );
  await writeFile(
    missingBundledPluginRuntimeDepPluginPackageJsonPath,
    `${JSON.stringify(
      {
        name: '@openclaw/amazon-bedrock-provider',
        version: '2026.4.2-beta.1',
        dependencies: {
          '@aws-sdk/client-bedrock': '3.1020.0',
        },
      },
      null,
      2,
    )}\n`,
  );
  await writeFile(
    missingBundledPluginRuntimeDepScriptPath,
    [
      'export function discoverBundledPluginRuntimeDeps() {',
      '  return [',
      '    {',
      '      name: "@aws-sdk/client-bedrock",',
      '      version: "3.1020.0",',
      '      sentinelPath: "node_modules/@aws-sdk/client-bedrock/package.json",',
      '      pluginIds: ["amazon-bedrock"],',
      '    },',
      '  ];',
      '}',
      '',
    ].join('\n'),
  );

  let missingBundledPluginRuntimeDepRejected = false;
  try {
    await prepareOpenClawRuntimeFromSource({
      sourceRuntimeDir: missingBundledPluginRuntimeDepSourceRuntimeDir,
      resourceDir: path.join(tempRoot, 'invalid-resource-runtime-missing-bundled-plugin-runtime-dep'),
      openclawVersion: expectedOpenClawVersion,
      nodeVersion: actualNodeVersion,
      runtimeSupplementalPackages: DEFAULT_OPENCLAW_RUNTIME_SUPPLEMENTAL_PACKAGES,
      target,
    });
  } catch (error) {
    missingBundledPluginRuntimeDepRejected =
      /@aws-sdk[\\/]+client-bedrock|bundled-plugin-runtime-dependency/u.test(String(error));
  }
  if (!missingBundledPluginRuntimeDepRejected) {
    throw new Error(
      'Expected prepared runtime validation to reject missing bundled plugin runtime dependencies',
    );
  }

  const failingNativeSmokeSourceRuntimeDir = path.join(
    tempRoot,
    'source-runtime-failing-native-smoke',
  );
  const failingNativeSmokeNodePath = path.join(
    failingNativeSmokeSourceRuntimeDir,
    manifest.nodeRelativePath.replace(/^runtime[\\/]/, ''),
  );
  const failingNativeSmokeCliPath = path.join(
    failingNativeSmokeSourceRuntimeDir,
    manifest.cliRelativePath.replace(/^runtime[\\/]/, ''),
  );
  const failingNativeSmokeOpenclawPackageJsonPath = path.join(
    failingNativeSmokeSourceRuntimeDir,
    'package',
    'node_modules',
    'openclaw',
    'package.json',
  );
  const failingNativeSmokeCarbonPackageJsonPath = path.join(
    failingNativeSmokeSourceRuntimeDir,
    'package',
    'node_modules',
    '@buape',
    'carbon',
    'package.json',
  );
  const failingNativeSmokeKoffiPackageJsonPath = path.join(
    failingNativeSmokeSourceRuntimeDir,
    'package',
    'node_modules',
    'koffi',
    'package.json',
  );
  const failingNativeSmokeKoffiIndexPath = path.join(
    failingNativeSmokeSourceRuntimeDir,
    'package',
    'node_modules',
    'koffi',
    'index.js',
  );

  await mkdir(path.dirname(failingNativeSmokeNodePath), { recursive: true });
  await mkdir(path.dirname(failingNativeSmokeCliPath), { recursive: true });
  await mkdir(path.dirname(failingNativeSmokeOpenclawPackageJsonPath), { recursive: true });
  await mkdir(path.dirname(failingNativeSmokeCarbonPackageJsonPath), { recursive: true });
  await mkdir(path.dirname(failingNativeSmokeKoffiPackageJsonPath), { recursive: true });
  await writeFile(failingNativeSmokeNodePath, fakeNodeExecutableContent);
  await writeFile(failingNativeSmokeCliPath, 'console.log("openclaw");');
  await writeFile(
    failingNativeSmokeOpenclawPackageJsonPath,
    `${JSON.stringify(
      {
        name: 'openclaw',
        version: expectedOpenClawVersion,
        pnpm: {
          ignoredBuiltDependencies: ['koffi'],
        },
      },
      null,
      2,
    )}\n`,
  );
  await writeFile(
    failingNativeSmokeCarbonPackageJsonPath,
    `${JSON.stringify({ name: '@buape/carbon', version: '0.0.0-beta-20260327000044' }, null, 2)}\n`,
  );
  await writeFile(
    failingNativeSmokeKoffiPackageJsonPath,
    `${JSON.stringify({ name: 'koffi', version: '2.15.2', main: 'index.js' }, null, 2)}\n`,
  );
  await writeFile(
    failingNativeSmokeKoffiIndexPath,
    'throw new Error("koffi native load failed");\n',
  );

  let failingNativeSmokeRejected = false;
  try {
    await prepareOpenClawRuntimeFromSource({
      sourceRuntimeDir: failingNativeSmokeSourceRuntimeDir,
      resourceDir: path.join(tempRoot, 'invalid-resource-runtime-failing-native-smoke'),
      openclawVersion: expectedOpenClawVersion,
      nodeVersion: actualNodeVersion,
      runtimeSupplementalPackages: DEFAULT_OPENCLAW_RUNTIME_SUPPLEMENTAL_PACKAGES,
      target,
    });
  } catch (error) {
    failingNativeSmokeRejected =
      /koffi|native smoke|runtime smoke/u.test(String(error));
  }
  if (!failingNativeSmokeRejected) {
    throw new Error('Expected prepared runtime validation to reject failing native smoke checks');
  }

  const cliOnlyBuiltDependencySourceRuntimeDir = path.join(
    tempRoot,
    'source-runtime-cli-only-built-dependency',
  );
  const cliOnlyBuiltDependencyNodePath = path.join(
    cliOnlyBuiltDependencySourceRuntimeDir,
    manifest.nodeRelativePath.replace(/^runtime[\\/]/, ''),
  );
  const cliOnlyBuiltDependencyCliPath = path.join(
    cliOnlyBuiltDependencySourceRuntimeDir,
    manifest.cliRelativePath.replace(/^runtime[\\/]/, ''),
  );
  const cliOnlyBuiltDependencyOpenclawPackageJsonPath = path.join(
    cliOnlyBuiltDependencySourceRuntimeDir,
    'package',
    'node_modules',
    'openclaw',
    'package.json',
  );
  const cliOnlyBuiltDependencyCarbonPackageJsonPath = path.join(
    cliOnlyBuiltDependencySourceRuntimeDir,
    'package',
    'node_modules',
    '@buape',
    'carbon',
    'package.json',
  );
  const cliOnlyBuiltDependencyPackageJsonPath = path.join(
    cliOnlyBuiltDependencySourceRuntimeDir,
    'package',
    'node_modules',
    '@tloncorp',
    'tlon-skill',
    'package.json',
  );
  const cliOnlyBuiltDependencyBinPath = path.join(
    cliOnlyBuiltDependencySourceRuntimeDir,
    'package',
    'node_modules',
    '@tloncorp',
    'tlon-skill',
    'bin',
    'tlon.js',
  );

  await mkdir(path.dirname(cliOnlyBuiltDependencyNodePath), { recursive: true });
  await mkdir(path.dirname(cliOnlyBuiltDependencyCliPath), { recursive: true });
  await mkdir(path.dirname(cliOnlyBuiltDependencyOpenclawPackageJsonPath), { recursive: true });
  await mkdir(path.dirname(cliOnlyBuiltDependencyCarbonPackageJsonPath), { recursive: true });
  await mkdir(path.dirname(cliOnlyBuiltDependencyPackageJsonPath), { recursive: true });
  await mkdir(path.dirname(cliOnlyBuiltDependencyBinPath), { recursive: true });
  await writeFile(cliOnlyBuiltDependencyNodePath, fakeNodeExecutableContent);
  await writeFile(cliOnlyBuiltDependencyCliPath, 'console.log("openclaw");');
  await writeFile(
    cliOnlyBuiltDependencyOpenclawPackageJsonPath,
    `${JSON.stringify(
      {
        name: 'openclaw',
        version: expectedOpenClawVersion,
        pnpm: {
          onlyBuiltDependencies: ['@tloncorp/tlon-skill'],
        },
      },
      null,
      2,
    )}\n`,
  );
  await writeFile(
    cliOnlyBuiltDependencyCarbonPackageJsonPath,
    `${JSON.stringify({ name: '@buape/carbon', version: '0.0.0-beta-20260327000044' }, null, 2)}\n`,
  );
  await writeFile(
    cliOnlyBuiltDependencyPackageJsonPath,
    `${JSON.stringify(
      {
        name: '@tloncorp/tlon-skill',
        version: '0.3.1',
        type: 'module',
        bin: {
          tlon: './bin/tlon.js',
        },
      },
      null,
      2,
    )}\n`,
  );
  await writeFile(cliOnlyBuiltDependencyBinPath, '#!/usr/bin/env node\n');

  await prepareOpenClawRuntimeFromSource({
    sourceRuntimeDir: cliOnlyBuiltDependencySourceRuntimeDir,
    resourceDir: path.join(tempRoot, 'valid-resource-runtime-cli-only-built-dependency'),
    openclawVersion: expectedOpenClawVersion,
    nodeVersion: actualNodeVersion,
    runtimeSupplementalPackages: DEFAULT_OPENCLAW_RUNTIME_SUPPLEMENTAL_PACKAGES,
    target,
  });

  const stagedNodeDir = path.join(tempRoot, 'staged-node');
  const stagedPackageDir = path.join(tempRoot, 'staged-package');
  const stagedNodePath = path.join(stagedNodeDir, 'node.exe');
  const stagedCliPath = path.join(stagedPackageDir, 'node_modules', 'openclaw', 'openclaw.mjs');
  const stagedOpenclawPackageJsonPath = path.join(
    stagedPackageDir,
    'node_modules',
    'openclaw',
    'package.json',
  );
  const stagedCarbonPackageJsonPath = path.join(
    stagedPackageDir,
    'node_modules',
    '@buape',
    'carbon',
    'package.json',
  );
  const stagedResourceDir = path.join(tempRoot, 'staged-resource-runtime');

  await mkdir(path.dirname(stagedNodePath), { recursive: true });
  await mkdir(path.dirname(stagedCliPath), { recursive: true });
  await mkdir(path.dirname(stagedOpenclawPackageJsonPath), { recursive: true });
  await mkdir(path.dirname(stagedCarbonPackageJsonPath), { recursive: true });
  await writeFile(stagedNodePath, 'node');
  await writeFile(stagedCliPath, 'console.log(\"openclaw\");');
  await writeFile(
    stagedOpenclawPackageJsonPath,
    `${JSON.stringify({ name: 'openclaw', version: expectedOpenClawVersion }, null, 2)}\n`,
  );
  await writeFile(
    stagedCarbonPackageJsonPath,
    `${JSON.stringify({ name: '@buape/carbon', version: '0.0.0-beta-20260327000044' }, null, 2)}\n`,
  );

  await prepareOpenClawRuntimeFromStagedDirs({
    nodeSourceDir: stagedNodeDir,
    packageSourceDir: stagedPackageDir,
    resourceDir: stagedResourceDir,
    openclawVersion: expectedOpenClawVersion,
    nodeVersion: '22.16.0',
    target,
  });

  await stat(path.join(stagedResourceDir, 'runtime', 'node', 'node.exe'));
  await stat(path.join(stagedResourceDir, 'runtime', 'package', 'node_modules', 'openclaw', 'openclaw.mjs'));
  await stat(path.join(stagedResourceDir, runtimeSidecarManifestRelativePath));

  const reusableResourceDir = path.join(tempRoot, 'reusable-resource-runtime');
  await prepareOpenClawRuntimeFromSource({
    sourceRuntimeDir,
    resourceDir: reusableResourceDir,
    openclawVersion: expectedOpenClawVersion,
    nodeVersion: '22.16.0',
    target,
  });

  const inspection = await inspectPreparedOpenClawRuntime({
    resourceDir: reusableResourceDir,
    manifest,
  });
  if (!inspection.reusable) {
    throw new Error(`Expected prepared runtime inspection to be reusable, received ${inspection.reason}`);
  }

  if (shouldReusePreparedOpenClawRuntime({ inspection, forcePrepare: true })) {
    throw new Error('Expected forcePrepare=true to disable reuse of an otherwise valid prepared runtime');
  }

  const sentinelPath = path.join(reusableResourceDir, 'runtime', 'package', 'sentinel.txt');
  await writeFile(sentinelPath, 'keep');

  const reused = await prepareOpenClawRuntime({
    resourceDir: reusableResourceDir,
    openclawVersion: expectedOpenClawVersion,
    nodeVersion: '22.16.0',
    openclawPackage: 'openclaw',
    fetchImpl: async () => {
      throw new Error('prepareOpenClawRuntime should have reused the existing runtime instead of downloading Node');
    },
    target,
  });

  if (reused.strategy !== 'reused-existing') {
    throw new Error(`Expected an existing runtime reuse strategy, received ${reused.strategy}`);
  }

  const sentinelValue = await readFile(sentinelPath, 'utf8');
  if (sentinelValue !== 'keep') {
    throw new Error(`Expected runtime reuse to preserve existing files, received ${sentinelValue}`);
  }

  const repairableResourceDir = path.join(tempRoot, 'repairable-resource-runtime');
  await prepareOpenClawRuntimeFromSource({
    sourceRuntimeDir,
    resourceDir: repairableResourceDir,
    openclawVersion: expectedOpenClawVersion,
    nodeVersion: actualNodeVersion,
    target,
  });
  await rm(path.join(repairableResourceDir, 'manifest.json'));

  const repaired = await prepareOpenClawRuntime({
    resourceDir: repairableResourceDir,
    openclawVersion: expectedOpenClawVersion,
    nodeVersion: actualNodeVersion,
    openclawPackage: 'openclaw',
    fetchImpl: async () => {
      throw new Error('prepareOpenClawRuntime should have repaired the missing manifest instead of downloading Node');
    },
    target,
  });

  if (repaired.strategy !== 'repaired-existing-manifest') {
    throw new Error(`Expected a repaired-existing-manifest strategy, received ${repaired.strategy}`);
  }

  const repairedManifest = JSON.parse(
    await readFile(path.join(repairableResourceDir, 'manifest.json'), 'utf8'),
  );
  if (repairedManifest.openclawVersion !== expectedOpenClawVersion) {
    throw new Error(
      `Expected repaired manifest to restore openclawVersion=${expectedOpenClawVersion}, received ${repairedManifest.openclawVersion}`,
    );
  }

  const cacheDir = path.join(tempRoot, 'persistent-cache');
  const cachePaths = resolveOpenClawPrepareCachePaths({
    cacheDir,
    openclawVersion: expectedOpenClawVersion,
    nodeVersion: '22.16.0',
    target,
  });
  await mkdir(path.dirname(cachePaths.cachedArchivePath), { recursive: true });
  await writeFile(cachePaths.cachedArchivePath, 'cached-archive');
  await cp(path.join(sourceRuntimeDir, 'node'), cachePaths.nodeCacheDir, { recursive: true });
  await cp(path.join(sourceRuntimeDir, 'package'), cachePaths.packageCacheDir, { recursive: true });

  const cachePreparedResourceDir = path.join(tempRoot, 'cache-prepared-resource-runtime');
  const cached = await prepareOpenClawRuntime({
    resourceDir: cachePreparedResourceDir,
    cacheDir,
    openclawVersion: expectedOpenClawVersion,
    nodeVersion: '22.16.0',
    openclawPackage: 'openclaw',
    fetchImpl: async () => {
      throw new Error('prepareOpenClawRuntime should have reused cached artifacts instead of downloading Node');
    },
    target,
  });

  if (cached.strategy !== 'prepared-cache') {
    throw new Error(`Expected a prepared-cache strategy, received ${cached.strategy}`);
  }

  await stat(path.join(cachePreparedResourceDir, 'runtime', 'node', 'node.exe'));
  await stat(
    path.join(
      cachePreparedResourceDir,
      'runtime',
      'package',
      'node_modules',
      'openclaw',
      'openclaw.mjs',
    ),
  );

  const windowsExtractor = resolveNodeArchiveExtractionCommand({
    archivePath: 'C:\\temp\\node-v22.16.0-win-x64.zip',
    extractRoot: 'C:\\temp\\extract-root',
    target,
    hasTarCommand: true,
  });
  if (windowsExtractor.command.toLowerCase() !== 'tar') {
    throw new Error(`Expected Windows zip extraction to prefer tar, received ${windowsExtractor.command}`);
  }

  if (!shouldRetryDirectoryCleanup(Object.assign(new Error('directory not empty'), { code: 'ENOTEMPTY' }))) {
    throw new Error('Expected ENOTEMPTY cleanup failures to be retried');
  }

  if (shouldRetryDirectoryCleanup(Object.assign(new Error('missing'), { code: 'ENOENT' }))) {
    throw new Error('Expected ENOENT cleanup failures to skip retries');
  }

  let transientCleanupAttempts = 0;
  await removeDirectoryWithRetries(path.join(tempRoot, 'transient-cleanup'), {
    retryCount: 3,
    retryDelayMs: 0,
    logger: () => {},
    removeImpl: async () => {
      transientCleanupAttempts += 1;
      if (transientCleanupAttempts === 1) {
        throw Object.assign(new Error('directory not empty'), { code: 'ENOTEMPTY' });
      }
    },
  });

  if (transientCleanupAttempts !== 2) {
    throw new Error(`Expected transient cleanup to retry once, received ${transientCleanupAttempts} attempts`);
  }

  let fatalCleanupAttempts = 0;
  let fatalCleanupError;
  try {
    await removeDirectoryWithRetries(path.join(tempRoot, 'fatal-cleanup'), {
      retryCount: 3,
      retryDelayMs: 0,
      logger: () => {},
      removeImpl: async () => {
        fatalCleanupAttempts += 1;
        throw Object.assign(new Error('bad cleanup'), { code: 'EINVAL' });
      },
    });
    throw new Error('Expected invalid cleanup failures to surface without retries');
  } catch (error) {
    fatalCleanupError = error;
  }

  if (fatalCleanupAttempts !== 1) {
    throw new Error(`Expected fatal cleanup failures to avoid retries, received ${fatalCleanupAttempts} attempts`);
  }

  if (!(fatalCleanupError instanceof Error) || fatalCleanupError.message !== 'bad cleanup') {
    throw new Error(`Expected fatal cleanup error to be preserved, received ${String(fatalCleanupError)}`);
  }

  const aliasedNodeCacheDir = path.join(tempRoot, 'aliased-node-cache');
  const aliasedPackageSourceDir = path.join(tempRoot, 'aliased-package-source');
  const aliasedPackageCacheDir = path.join(tempRoot, 'aliased-package-cache');
  const aliasedNodeExecutable = path.join(aliasedNodeCacheDir, 'node.exe');
  const aliasedPackageJson = path.join(aliasedPackageSourceDir, 'package.json');

  await mkdir(path.dirname(aliasedNodeExecutable), { recursive: true });
  await mkdir(path.dirname(aliasedPackageJson), { recursive: true });
  await writeFile(aliasedNodeExecutable, 'node');
  await writeFile(aliasedPackageJson, '{"name":"openclaw-runtime-cache"}\n');

  await refreshCachedOpenClawRuntimeArtifacts({
    nodeSourceDir: aliasedNodeCacheDir,
    packageSourceDir: aliasedPackageSourceDir,
    cachePaths: {
      nodeCacheDir: aliasedNodeCacheDir,
      packageCacheDir: aliasedPackageCacheDir,
    },
  });

  await stat(aliasedNodeExecutable);
  await stat(path.join(aliasedPackageCacheDir, 'package.json'));

  let fallbackCopyAttempts = 0;
  await copyDirectoryWithWindowsFallback('C:\\temp\\source-package', 'C:\\temp\\target-package', {
    platform: 'win32',
    copyImpl: async () => {
      throw Object.assign(new Error('copy failed'), { code: 'ENOENT' });
    },
    robocopyImpl: async (sourceDir, targetDir) => {
      fallbackCopyAttempts += 1;
      if (sourceDir !== 'C:\\temp\\source-package' || targetDir !== 'C:\\temp\\target-package') {
        throw new Error(`Expected Windows fallback copy paths to be preserved, received ${sourceDir} -> ${targetDir}`);
      }
    },
  });

  if (fallbackCopyAttempts !== 1) {
    throw new Error(`Expected Windows fallback copy to run once, received ${fallbackCopyAttempts}`);
  }

  let nonWindowsCopyError;
  try {
    await copyDirectoryWithWindowsFallback('/tmp/source-package', '/tmp/target-package', {
      platform: 'linux',
      copyImpl: async () => {
        throw Object.assign(new Error('copy failed'), { code: 'ENOENT' });
      },
      robocopyImpl: async () => {
        throw new Error('Non-Windows copies should not invoke robocopy fallback');
      },
    });
    throw new Error('Expected non-Windows copy failures to surface without fallback');
  } catch (error) {
    nonWindowsCopyError = error;
  }

  if (!(nonWindowsCopyError instanceof Error) || nonWindowsCopyError.message !== 'copy failed') {
    throw new Error(`Expected non-Windows copy failure to be preserved, received ${String(nonWindowsCopyError)}`);
  }

  const symlinkSourceDir = path.join(tempRoot, 'symlink-source');
  const symlinkTargetDir = path.join(tempRoot, 'symlink-target');
  const symlinkShimTarget = path.join(
    symlinkSourceDir,
    'lib',
    'node_modules',
    'corepack',
    'dist',
    'corepack.js',
  );
  const symlinkShimPath = path.join(symlinkSourceDir, 'bin', 'corepack');

  await mkdir(path.dirname(symlinkShimTarget), { recursive: true });
  await mkdir(path.dirname(symlinkShimPath), { recursive: true });
  await writeFile(symlinkShimTarget, 'console.log("corepack");\n');
  symlinkSync('../lib/node_modules/corepack/dist/corepack.js', symlinkShimPath);

  await copyDirectoryWithWindowsFallback(symlinkSourceDir, symlinkTargetDir, {
    platform: 'linux',
  });

  const copiedSymlinkPath = path.join(symlinkTargetDir, 'bin', 'corepack');
  const copiedSymlinkTarget = readlinkSync(copiedSymlinkPath).replaceAll('\\', '/');
  if (copiedSymlinkTarget !== '../lib/node_modules/corepack/dist/corepack.js') {
    throw new Error(`Expected copied symlink to preserve its relative target, received ${copiedSymlinkTarget}`);
  }

  await stat(path.join(symlinkTargetDir, 'bin', copiedSymlinkTarget));

  console.log('ok - bundled OpenClaw runtime preparation copies runtime files and writes manifest');
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
