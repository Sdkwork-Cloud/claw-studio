import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { DEFAULT_OPENCLAW_VERSION } from './prepare-openclaw-runtime.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const desktopSrcTauriPathSegments = ['packages', 'sdkwork-claw-desktop', 'src-tauri'];
const cacheRoot = path.join(rootDir, '.cache', 'bundled-components');
const upstreamRoot = path.join(cacheRoot, 'upstreams');
const buildRoot = path.join(cacheRoot, 'build');
const generatedRoot = path.join(
  rootDir,
  'packages',
  'sdkwork-claw-desktop',
  'src-tauri',
  'generated',
);
const tauriBundleOverlayConfigPath = path.join(
  rootDir,
  'packages',
  'sdkwork-claw-desktop',
  'src-tauri',
  'generated',
  'tauri.bundle.overlay.json',
);
const openClawRuntimeBundleSourceRoot = resolveBundledResourceMirrorRoot(
  rootDir,
  'openclaw-runtime',
  process.platform,
);
const sourceFoundationDir = path.join(
  rootDir,
  'packages',
  'sdkwork-claw-desktop',
  'src-tauri',
  'foundation',
  'components',
);

const args = new Set(process.argv.slice(2));
const devMode = args.has('--dev');
const noFetch = args.has('--no-fetch');
const releaseMode = args.has('--release');
const skipOpenClaw = args.has('--skip-openclaw');
const bundledRoot = resolveBundledBuildRoot(rootDir, process.platform, devMode);
const bundledLinkRoot = path.join(generatedRoot, 'bundled');
const windowsTauriBundleBridgeRoots = {
  bundled: ['generated', 'br', 'b'],
  'openclaw-runtime': ['generated', 'br', 'o'],
};

const gitCmd = process.platform === 'win32' ? 'git.exe' : 'git';
const cargoCmd = process.platform === 'win32' ? 'cargo.exe' : 'cargo';
const pnpmCmd = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const nodeExecutableName = process.platform === 'win32' ? 'node.exe' : 'node';
const commandEnv = createCommandEnv();

const componentSources = [
  {
    id: 'openclaw',
    repoUrl: 'https://github.com/openclaw/openclaw.git',
    checkoutDir: 'openclaw',
    buildAttempts: 3,
    resolveVersion(repoDir, sha) {
      const pkg = readJson(path.join(repoDir, 'package.json'));
      return `${pkg.version}+${sha}`;
    },
    build(repoDir) {
      if (skipOpenClaw) {
        return;
      }
      installPnpmWorkspace(repoDir);
      runCommand(pnpmCmd, ['build'], { cwd: repoDir });
    },
    stage(repoDir, version) {
      if (skipOpenClaw) {
        return;
      }

      const packedDir = path.join(buildRoot, 'openclaw', version, 'pack');
      const prefixDir = path.join(buildRoot, 'openclaw', version, 'prefix');
      fs.rmSync(packedDir, { recursive: true, force: true });
      fs.rmSync(prefixDir, { recursive: true, force: true });
      fs.mkdirSync(packedDir, { recursive: true });
      fs.mkdirSync(prefixDir, { recursive: true });

      const packOutput = runCommand(
        npmCmd,
        ['pack', '--ignore-scripts', '--json', '--pack-destination', packedDir],
        { cwd: repoDir, captureStdout: true },
      );
      const packResult = JSON.parse(packOutput);
      const tarballName = Array.isArray(packResult)
        ? packResult[0]?.filename
        : packResult?.filename;
      if (!tarballName) {
        throw new Error('failed to resolve openclaw npm pack output');
      }

      runCommand(
        npmCmd,
        [
          'install',
          '--global',
          '--prefix',
          prefixDir,
          '--ignore-scripts',
          path.join(packedDir, tarballName),
        ],
        { cwd: repoDir },
      );

      const installedModulesDir = resolveGlobalNodeModulesDir(prefixDir);
      const stageDir = path.join(bundledRoot, 'modules', 'openclaw', version, 'app');
      fs.mkdirSync(stageDir, { recursive: true });
      copyDirectoryContents(path.join(installedModulesDir, 'openclaw'), stageDir);
      copyDirectoryEntries(
        installedModulesDir,
        path.join(stageDir, 'node_modules'),
        new Set(['openclaw']),
      );
    },
  },
  {
    id: 'hub-installer',
    repoUrl: 'https://github.com/Sdkwork-Cloud/hub-installer.git',
    checkoutDir: 'hub-installer',
    resolveVersion(repoDir, sha) {
      return `${readCargoPackageVersion(path.join(repoDir, 'rust', 'Cargo.toml')) ?? '0.0.0'}+${sha}`;
    },
    build(repoDir) {
      const targetDir = rustTargetDir('hub-installer');
      runCommand(cargoCmd, ['build', '--manifest-path', 'rust/Cargo.toml', '--release', '--bin', 'hub-installer-rs'], {
        cwd: repoDir,
        env: { CARGO_TARGET_DIR: targetDir },
      });
    },
    stage(repoDir, version) {
      const targetDir = rustTargetDir('hub-installer');
      const versionDir = path.join(bundledRoot, 'modules', 'hub-installer', version);
      const foundationRegistryDir = path.join(
        bundledRoot,
        'foundation',
        'hub-installer',
        'registry',
      );
      fs.mkdirSync(path.join(versionDir, 'bin'), { recursive: true });
      fs.mkdirSync(path.join(versionDir, 'registry'), { recursive: true });
      fs.mkdirSync(foundationRegistryDir, { recursive: true });
      copyFile(
        path.join(targetDir, 'release', withExe('hub-installer-rs')),
        path.join(versionDir, 'bin', withExe('hub-installer-rs')),
      );
      copyDirectoryContents(path.join(repoDir, 'registry'), path.join(versionDir, 'registry'));
      copyDirectoryContents(path.join(repoDir, 'registry'), foundationRegistryDir);
    },
  },
];

function main() {
  const preserveWindowsDevMirror = devMode && process.platform === 'win32';

  fs.mkdirSync(upstreamRoot, { recursive: true });
  fs.mkdirSync(buildRoot, { recursive: true });
  fs.mkdirSync(generatedRoot, { recursive: true });
  prepareBundledRoot({ devMode, platform: process.platform });
  ensureBundledLinkRoot();
  ensureWindowsTauriBundleBridgeRoots();
  writeTauriBundleOverlayConfig();

  const bundleManifest = {
    generatedAt: new Date().toISOString(),
    mode: devMode ? 'dev' : 'build',
    components: [],
    runtimeVersions: {},
  };

  const staticRegistry = readJson(path.join(sourceFoundationDir, 'component-registry.json'));
  const serviceDefaults = readJson(path.join(sourceFoundationDir, 'service-defaults.json'));
  const upgradePolicy = readJson(path.join(sourceFoundationDir, 'upgrade-policy.json'));

  for (const component of componentSources) {
    const repoDir = ensureRepository(component, { devMode });
    const fullSha = readRepositoryCommitSha(repoDir);
    const shortSha = fullSha.slice(0, 12);
    const version = component.resolveVersion(repoDir, shortSha);
    const bundledVersion = resolveBundledComponentVersion({
      componentId: component.id,
      derivedVersion: version,
      devMode,
      releaseMode,
    });
    const executionPlan = createComponentExecutionPlan({
      componentId: component.id,
      devMode,
      releaseMode,
    });
    const executionPlanLabel = describeComponentExecutionPlan({
      componentId: component.id,
      devMode,
      releaseMode,
    });

    console.log(
      bundledVersion === version
        ? `[bundled-components] processing ${component.id} ${bundledVersion} from ${component.repoUrl}`
        : `[bundled-components] processing ${component.id} ${bundledVersion} from ${component.repoUrl} (repo ${version})`,
    );

    if (executionPlan.shouldBuild) {
      buildComponentWithRetry(component, repoDir);
    } else {
      console.log(
        `[bundled-components] skipping build for ${component.id} (${executionPlanLabel})`,
      );
    }

    if (executionPlan.shouldStage) {
      if (devMode) {
        try {
          component.stage(repoDir, version);
        } catch (error) {
          console.warn(`[bundled-components] skipped staging ${component.id} in dev mode: ${error instanceof Error ? error.message : String(error)}`);
        }
      } else {
        component.stage(repoDir, version);
      }
    } else {
      console.log(
        `[bundled-components] skipping staging for ${component.id} (${executionPlanLabel})`,
      );
    }

    bundleManifest.components.push({
      id: component.id,
      version: bundledVersion,
      commit: fullSha,
      repositoryUrl: component.repoUrl,
      checkoutDir: path.relative(rootDir, repoDir).replaceAll('\\', '/'),
    });

    const registryEntry = staticRegistry.components.find((entry) => entry.id === component.id);
    if (registryEntry) {
      registryEntry.bundledVersion = bundledVersion;
      registryEntry.commit = fullSha;
      registryEntry.sourceUrl = component.repoUrl;
    }
  }

  const nodeVersion = process.versions.node;
  const nodeRuntimeDir = path.join(bundledRoot, 'runtimes', 'node', nodeVersion);
  fs.mkdirSync(nodeRuntimeDir, { recursive: true });
  const nodeRuntimeExecutablePath = path.join(nodeRuntimeDir, nodeExecutableName);
  if (preserveWindowsDevMirror && fs.existsSync(nodeRuntimeExecutablePath)) {
    console.log('[bundled-components] preserving existing Windows dev node runtime');
  } else {
    try {
      copyFile(process.execPath, nodeRuntimeExecutablePath);
    } catch (error) {
      if (
        preserveWindowsDevMirror &&
        fs.existsSync(nodeRuntimeExecutablePath) &&
        error instanceof Error &&
        error.code === 'EPERM'
      ) {
        console.warn(
          `[bundled-components] skipped refreshing Windows dev node runtime after file lock: ${error.message}`,
        );
      } else {
        throw error;
      }
    }
  }
  bundleManifest.runtimeVersions.node = nodeVersion;

  writeJson(path.join(bundledRoot, 'foundation', 'components', 'component-registry.json'), staticRegistry);
  writeJson(path.join(bundledRoot, 'foundation', 'components', 'service-defaults.json'), serviceDefaults);
  writeJson(path.join(bundledRoot, 'foundation', 'components', 'upgrade-policy.json'), upgradePolicy);
  writeJson(path.join(bundledRoot, 'foundation', 'components', 'bundle-manifest.json'), bundleManifest);

  console.log('[bundled-components] generated bundled assets at', path.relative(rootDir, bundledLinkRoot));
}

export function shouldResetBundledRoot({
  devMode = false,
  platform = process.platform,
} = {}) {
  return !(devMode && platform === 'win32');
}

function prepareBundledRoot({
  devMode = false,
  platform = process.platform,
} = {}) {
  const resetBundledAssets = shouldResetBundledRoot({ devMode, platform });
  if (resetBundledAssets) {
    fs.rmSync(bundledRoot, { recursive: true, force: true });
  }

  fs.mkdirSync(path.join(bundledRoot, 'foundation', 'components'), { recursive: true });
  fs.mkdirSync(path.join(bundledRoot, 'modules'), { recursive: true });
  fs.mkdirSync(path.join(bundledRoot, 'runtimes'), { recursive: true });

  if (!resetBundledAssets) {
    console.log('[bundled-components] preserving Windows dev bundled mirror to avoid locked file cleanup');
  }
}

export function createComponentExecutionPlan({
  componentId,
  devMode = false,
  releaseMode = false,
} = {}) {
  if (devMode && String(componentId ?? '').trim() === 'openclaw') {
    return {
      shouldBuild: false,
      shouldStage: false,
    };
  }

  if (devMode) {
    return {
      shouldBuild: false,
      shouldStage: true,
    };
  }

  if (
    releaseMode
    && ['openclaw'].includes(String(componentId ?? '').trim())
  ) {
    return {
      shouldBuild: false,
      shouldStage: false,
    };
  }

  return {
    shouldBuild: true,
    shouldStage: true,
  };
}

export function resolveBundledComponentVersion({
  componentId,
  derivedVersion,
  devMode = false,
  releaseMode = false,
  openClawVersion = DEFAULT_OPENCLAW_VERSION,
} = {}) {
  if (
    String(componentId ?? '').trim() === 'openclaw'
    && createComponentExecutionPlan({ componentId, devMode, releaseMode }).shouldStage === false
  ) {
    return openClawVersion;
  }

  return derivedVersion;
}

function describeComponentExecutionPlan({
  componentId,
  devMode = false,
  releaseMode = false,
} = {}) {
  if (devMode && String(componentId ?? '').trim() === 'openclaw') {
    return 'dev-mode-runtime-prepared-separately';
  }

  if (devMode) {
    return 'dev-mode';
  }

  if (
    releaseMode
    && ['openclaw'].includes(String(componentId ?? '').trim())
  ) {
    return 'deferred-to-dedicated-release-phase';
  }

  return releaseMode ? 'release-sync-required' : 'standard-sync';
}

function buildComponentWithRetry(component, repoDir) {
  const maxAttempts = Math.max(1, Number(component.buildAttempts ?? 1));

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      component.build(repoDir);
      return;
    } catch (error) {
      if (attempt >= maxAttempts) {
        throw error;
      }

      const message = error instanceof Error ? error.message : String(error);
      console.warn(
        `[bundled-components] ${component.id} build attempt ${attempt}/${maxAttempts} failed; retrying after cleaning dist: ${message}`,
      );
      fs.rmSync(path.join(repoDir, 'dist'), { recursive: true, force: true });
    }
  }
}

function ensureRepository(component, { devMode = false } = {}) {
  const repoDir = path.join(upstreamRoot, component.checkoutDir);
  if (!fs.existsSync(repoDir)) {
    runCommand(gitCmd, ['clone', '--depth', '1', component.repoUrl, repoDir], { cwd: rootDir });
    return repoDir;
  }

  if (!noFetch && !devMode) {
    runCommand(gitCmd, ['-C', repoDir, 'fetch', '--depth', '1', 'origin'], { cwd: rootDir });
    runCommand(gitCmd, ['-C', repoDir, 'reset', '--hard', 'FETCH_HEAD'], { cwd: rootDir });
  }

  return repoDir;
}

function installPnpmWorkspace(cwd) {
  if (!fs.existsSync(path.join(cwd, 'node_modules'))) {
    const installEnv = buildNonInteractiveInstallEnv(commandEnv);
    try {
      runCommand(pnpmCmd, ['install', '--frozen-lockfile'], { cwd, env: installEnv });
    } catch (error) {
      console.warn(
        `[bundled-components] retrying pnpm install without frozen lockfile in ${path.relative(rootDir, cwd) || cwd}`,
      );
      runCommand(pnpmCmd, ['install', '--lockfile=false', '--force'], { cwd, env: installEnv });
    }
  }
}

function buildNonInteractiveInstallEnv(baseEnv = process.env) {
  return {
    ...baseEnv,
    CI: 'true',
    npm_config_yes: 'true',
  };
}

function runCommand(command, commandArgs, options = {}) {
  const useWindowsShell =
    process.platform === 'win32' &&
    (['.cmd', '.bat'].includes(path.extname(command).toLowerCase()) ||
      path.basename(command).toLowerCase() === 'git.exe');
  const result = spawnSync(command, commandArgs, {
    cwd: options.cwd ?? rootDir,
    encoding: 'utf8',
    env: {
      ...commandEnv,
      ...(options.env ?? {}),
    },
    maxBuffer: options.maxBuffer ?? 64 * 1024 * 1024,
    shell: useWindowsShell,
    stdio: options.captureStdout ? ['ignore', 'pipe', 'inherit'] : 'inherit',
  });

  if (result.error) {
    throw new Error(
      `${command} ${commandArgs.join(' ')} failed: ${result.error.message}`,
    );
  }

  if (result.signal) {
    throw new Error(
      `${command} ${commandArgs.join(' ')} failed with signal ${result.signal}`,
    );
  }

  if (result.status !== 0) {
    throw new Error(
      `${command} ${commandArgs.join(' ')} failed with exit code ${result.status ?? 'unknown'}`,
    );
  }

  return (result.stdout ?? '').trim();
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readRepositoryCommitSha(repoDir) {
  const gitDir = resolveRepositoryGitDir(repoDir);
  const headContent = fs.readFileSync(path.join(gitDir, 'HEAD'), 'utf8').trim();

  if (/^[0-9a-f]{40}$/i.test(headContent)) {
    return headContent;
  }

  const refMatch = headContent.match(/^ref:\s*(.+)$/i);
  if (refMatch) {
    const refName = refMatch[1].trim();
    const refPath = path.join(gitDir, ...refName.split('/'));
    if (fs.existsSync(refPath)) {
      const refSha = fs.readFileSync(refPath, 'utf8').trim();
      if (/^[0-9a-f]{40}$/i.test(refSha)) {
        return refSha;
      }
    }

    const packedRefsPath = path.join(gitDir, 'packed-refs');
    if (fs.existsSync(packedRefsPath)) {
      const packedRefs = fs.readFileSync(packedRefsPath, 'utf8');
      for (const line of packedRefs.split(/\r?\n/u)) {
        if (!line || line.startsWith('#') || line.startsWith('^')) {
          continue;
        }

        const [sha, packedRefName] = line.trim().split(/\s+/u);
        if (packedRefName === refName && /^[0-9a-f]{40}$/i.test(sha)) {
          return sha;
        }
      }
    }
  }

  throw new Error(`unable to resolve git commit sha from ${repoDir}`);
}

function resolveRepositoryGitDir(repoDir) {
  const dotGitPath = path.join(repoDir, '.git');
  const dotGitStat = fs.statSync(dotGitPath, { throwIfNoEntry: false });

  if (!dotGitStat) {
    throw new Error(`missing git metadata at ${dotGitPath}`);
  }

  if (dotGitStat.isFile()) {
    const gitdirMatch = fs.readFileSync(dotGitPath, 'utf8').match(/^gitdir:\s*(.+)$/im);
    if (!gitdirMatch) {
      throw new Error(`unable to resolve gitdir from ${dotGitPath}`);
    }

    return path.resolve(repoDir, gitdirMatch[1].trim());
  }

  return dotGitPath;
}

function readCargoPackageVersion(manifestPath) {
  const content = fs.readFileSync(manifestPath, 'utf8');
  const packageBlock = content.match(/\[package\][\s\S]*?(?=\n\[|$)/);
  if (!packageBlock) {
    return null;
  }
  const versionMatch = packageBlock[0].match(/^\s*version\s*=\s*"([^"]+)"/m);
  return versionMatch?.[1] ?? null;
}

function readWorkspaceCargoVersion(manifestPath) {
  const content = fs.readFileSync(manifestPath, 'utf8');
  const workspaceBlock = content.match(/\[workspace\.package\][\s\S]*?(?=\n\[|$)/);
  if (!workspaceBlock) {
    return null;
  }
  const versionMatch = workspaceBlock[0].match(/^\s*version\s*=\s*"([^"]+)"/m);
  return versionMatch?.[1] ?? null;
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

export function resolveGlobalNodeModulesDir(prefixDir, platform = process.platform) {
  if (platform === 'win32') {
    return path.win32.join(prefixDir, 'node_modules');
  }

  return path.posix.join(prefixDir, 'lib', 'node_modules');
}

function resolveBundledBuildRoot(workspaceRootDir, platform = process.platform, devMode = false) {
  if (platform !== 'win32' || devMode) {
    return path.join(workspaceRootDir, ...desktopSrcTauriPathSegments, 'generated', 'bundled');
  }

  return path.win32.join(
    path.win32.parse(workspaceRootDir).root,
    '.sdkwork-bc',
    path.win32.basename(workspaceRootDir),
    'bundled',
  );
}

function ensureBundledLinkRoot() {
  if (path.resolve(bundledLinkRoot) === path.resolve(bundledRoot)) {
    ensureLocalDirectoryRoot(bundledRoot);
    return;
  }

  ensureDirectoryLinkRoot(bundledLinkRoot, bundledRoot, process.platform);
}

function resolveExistingPathTarget(candidatePath) {
  try {
    return fs.realpathSync.native(candidatePath);
  } catch {
    return null;
  }
}

function writeTauriBundleOverlayConfig() {
  writeJson(
    tauriBundleOverlayConfigPath,
    createTauriBundleOverlayConfig({
      workspaceRootDir: rootDir,
      platform: process.platform,
    }),
  );
}

function resolveBundledResourceMirrorRoot(
  workspaceRootDir,
  resourceId,
  platform = process.platform,
) {
  if (platform !== 'win32') {
    return path.join(
      workspaceRootDir,
      'packages',
      'sdkwork-claw-desktop',
      'src-tauri',
      'resources',
      resourceId,
    );
  }

  return path.win32.join(
    path.win32.parse(workspaceRootDir).root,
    '.sdkwork-bc',
    path.win32.basename(workspaceRootDir),
    resourceId,
  );
}

function resolveDesktopSrcTauriDir(workspaceRootDir, platform = process.platform) {
  if (platform === 'win32') {
    return path.win32.join(workspaceRootDir, ...desktopSrcTauriPathSegments);
  }

  return path.join(workspaceRootDir, ...desktopSrcTauriPathSegments);
}

function resolveWindowsTauriBundleBridgeDir(
  workspaceRootDir,
  resourceId,
  platform = process.platform,
) {
  const relativeSegments = windowsTauriBundleBridgeRoots[resourceId];
  if (!relativeSegments) {
    throw new Error(`unsupported Windows Tauri bridge resource: ${resourceId}`);
  }

  const pathApi = platform === 'win32' ? path.win32 : path;
  return pathApi.join(resolveDesktopSrcTauriDir(workspaceRootDir, platform), ...relativeSegments);
}

function resolveWindowsTauriBundleBridgeSource(resourceId) {
  const relativeSegments = windowsTauriBundleBridgeRoots[resourceId];
  if (!relativeSegments) {
    throw new Error(`unsupported Windows Tauri bridge resource: ${resourceId}`);
  }

  return `${relativeSegments.join('/')}/`;
}

function ensureWindowsTauriBundleBridgeRoots() {
  if (process.platform !== 'win32') {
    return;
  }

  pruneWindowsTauriBundleBridgeRoots();
  ensureDirectoryLinkRoot(
    resolveWindowsTauriBundleBridgeDir(rootDir, 'bundled', process.platform),
    bundledRoot,
    process.platform,
  );
  ensureDirectoryLinkRoot(
    resolveWindowsTauriBundleBridgeDir(rootDir, 'openclaw-runtime', process.platform),
    openClawRuntimeBundleSourceRoot,
    process.platform,
  );
}

function pruneWindowsTauriBundleBridgeRoots() {
  const bridgeRoot = path.dirname(
    resolveWindowsTauriBundleBridgeDir(rootDir, 'bundled', process.platform),
  );
  if (!fs.existsSync(bridgeRoot)) {
    return;
  }

  for (const entryName of listStaleWindowsTauriBundleBridgeDirNames({
    entryNames: fs.readdirSync(bridgeRoot),
  })) {
    fs.rmSync(path.join(bridgeRoot, entryName), { recursive: true, force: true });
  }
}

export function listStaleWindowsTauriBundleBridgeDirNames({
  entryNames = [],
} = {}) {
  const supportedEntryNames = new Set(
    Object.values(windowsTauriBundleBridgeRoots)
      .map((segments) => segments.at(-1))
      .filter(Boolean),
  );

  return entryNames
    .filter((entryName) => typeof entryName === 'string' && entryName.trim().length > 0)
    .filter((entryName) => !supportedEntryNames.has(entryName))
    .sort();
}

export function createTauriBundleOverlayConfig({
  workspaceRootDir = rootDir,
  platform = process.platform,
} = {}) {
  if (platform !== 'win32') {
    return {};
  }

  return {
    bundle: {
      resources: {
        'foundation/components/': 'foundation/components/',
        // Use short in-tree bridge junctions so Windows bundling avoids both
        // lost drive prefixes and MAX_PATH expansion through repo-relative roots.
        [resolveWindowsTauriBundleBridgeSource('bundled')]: 'generated/bundled/',
        'vendor/hub-installer/registry/': 'vendor/hub-installer/registry/',
        [resolveWindowsTauriBundleBridgeSource('openclaw-runtime')]:
          'resources/openclaw-runtime/',
      },
    },
  };
}

function ensureDirectoryLinkRoot(linkRoot, targetRoot, platform = process.platform) {
  if (path.resolve(targetRoot) === path.resolve(linkRoot)) {
    ensureLocalDirectoryRoot(linkRoot);
    return;
  }

  const existingResolvedPath = resolveExistingPathTarget(linkRoot);
  if (existingResolvedPath && path.resolve(existingResolvedPath) === path.resolve(targetRoot)) {
    return;
  }

  fs.mkdirSync(path.dirname(linkRoot), { recursive: true });
  fs.rmSync(linkRoot, { recursive: true, force: true });
  fs.symlinkSync(
    targetRoot,
    linkRoot,
    platform === 'win32' ? 'junction' : 'dir',
  );
}

function ensureLocalDirectoryRoot(directoryPath) {
  const existingResolvedPath = resolveExistingPathTarget(directoryPath);
  if (
    existingResolvedPath &&
    path.resolve(existingResolvedPath) !== path.resolve(directoryPath)
  ) {
    fs.rmSync(directoryPath, { recursive: true, force: true });
  }

  fs.mkdirSync(directoryPath, { recursive: true });
}

function copyFile(sourcePath, targetPath) {
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`missing bundled artifact: ${sourcePath}`);
  }
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.copyFileSync(sourcePath, targetPath);
}

function copyDirectoryContents(sourceDir, targetDir) {
  if (!fs.existsSync(sourceDir)) {
    throw new Error(`missing bundled directory: ${sourceDir}`);
  }
  fs.mkdirSync(targetDir, { recursive: true });
  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);
    if (entry.isDirectory()) {
      copyDirectoryContents(sourcePath, targetPath);
    } else {
      copyFile(sourcePath, targetPath);
    }
  }
}

function copyDirectoryEntries(sourceDir, targetDir, excludedNames = new Set()) {
  if (!fs.existsSync(sourceDir)) {
    throw new Error(`missing bundled directory: ${sourceDir}`);
  }
  fs.mkdirSync(targetDir, { recursive: true });
  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    if (excludedNames.has(entry.name)) {
      continue;
    }
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);
    if (entry.isDirectory()) {
      copyDirectoryContents(sourcePath, targetPath);
    } else {
      copyFile(sourcePath, targetPath);
    }
  }
}

function withExe(name) {
  return process.platform === 'win32' ? `${name}.exe` : name;
}

export function createCommandEnv({
  env: inputEnv = process.env,
  platform = process.platform,
  existsSync = fs.existsSync,
} = {}) {
  const env = { ...inputEnv };
  if (platform !== 'win32') {
    return env;
  }

  const pathKey = resolvePathKey(env);
  const pathValue = env[pathKey] ?? env.PATH ?? '';
  const pathEntries = pathValue.split(path.delimiter).filter(Boolean);
  const cargoRuntimePathEntries = resolveRustCargoPathEntries(env, existsSync);
  const gitRuntimePathEntries = resolveGitRuntimePathEntries(pathEntries);
  for (const entry of [...gitRuntimePathEntries].reverse()) {
    if (!pathEntries.includes(entry)) {
      pathEntries.unshift(entry);
    }
  }
  for (const entry of [...cargoRuntimePathEntries].reverse()) {
    if (!pathEntries.includes(entry)) {
      pathEntries.unshift(entry);
    }
  }
  for (const key of Object.keys(env)) {
    if (key !== pathKey && key.toUpperCase() === 'PATH') {
      delete env[key];
    }
  }
  env[pathKey] = pathEntries.join(path.delimiter);
  return env;
}

function resolveRustCargoPathEntries(env, existsSync) {
  const homeDir = env.USERPROFILE ?? env.HOME ?? null;
  const cargoHome = env.CARGO_HOME ?? (homeDir ? path.join(homeDir, '.cargo') : null);
  const candidates = [
    cargoHome ? path.join(cargoHome, 'bin') : null,
    homeDir ? path.join(homeDir, '.cargo', 'bin') : null,
  ].filter(Boolean);

  return Array.from(new Set(candidates.filter((candidate) => {
    return existsSync(candidate) && existsSync(path.join(candidate, withExe('cargo')));
  })));
}

function resolvePathKey(env) {
  return Object.keys(env).find((key) => key.toUpperCase() === 'PATH') ?? 'Path';
}

function resolveGitRuntimePathEntries(pathEntries) {
  const candidates = [
    process.env.ProgramFiles && path.join(process.env.ProgramFiles, 'Git'),
    process.env['ProgramFiles(x86)'] &&
      path.join(process.env['ProgramFiles(x86)'], 'Git'),
    resolveGitRootFromPath(pathEntries),
  ].filter(Boolean);

  for (const candidate of candidates) {
    const runtimeEntries = [path.join(candidate, 'bin'), path.join(candidate, 'usr', 'bin')];
    if (
      runtimeEntries.every((entry) => fs.existsSync(entry)) &&
      fs.existsSync(path.join(candidate, 'bin', 'bash.exe')) &&
      fs.existsSync(path.join(candidate, 'usr', 'bin', 'cp.exe'))
    ) {
      return runtimeEntries;
    }
  }

  return [];
}

function resolveGitRootFromPath(pathEntries) {
  for (const entry of pathEntries) {
    const candidate = path.join(entry, 'git.exe');
    if (!fs.existsSync(candidate)) {
      continue;
    }
    const gitRoot = path.resolve(path.dirname(candidate), '..');
    if (
      fs.existsSync(path.join(gitRoot, 'bin', 'bash.exe')) &&
      fs.existsSync(path.join(gitRoot, 'usr', 'bin', 'cp.exe'))
    ) {
      return gitRoot;
    }
  }
  return null;
}

function rustTargetDir(componentId) {
  return path.join(cacheRoot, 'targets', componentId);
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main();
}
