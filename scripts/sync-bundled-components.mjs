import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  buildNonInteractiveInstallEnv,
  resolveBundledApiRouterCargoTargetDir,
  withSupportedWindowsCmakeGenerator,
} from './prepare-sdkwork-api-router-runtime.mjs';

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
const bundledLinkRoot = path.join(generatedRoot, 'bundled');
const bundledRoot = resolveBundledBuildRoot(rootDir, process.platform);
const preparedApiRouterRuntimeDir = path.join(
  rootDir,
  'packages',
  'sdkwork-claw-desktop',
  'src-tauri',
  'resources',
  'sdkwork-api-router-runtime',
  'runtime',
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
const apiRouterRuntimeBundleSourceRoot = resolveBundledResourceMirrorRoot(
  rootDir,
  'sdkwork-api-router-runtime',
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
const windowsTauriBundleBridgeRoots = {
  bundled: ['generated', 'br', 'b'],
  'openclaw-runtime': ['generated', 'br', 'o'],
  'sdkwork-api-router-runtime': ['generated', 'br', 'a'],
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
    id: 'sdkwork-api-router',
    repoUrl: 'https://github.com/Sdkwork-Cloud/sdkwork-api-router.git',
    checkoutDir: 'sdkwork-api-router',
    resolveVersion(repoDir, sha) {
      const baseVersion = readWorkspaceCargoVersion(path.join(repoDir, 'Cargo.toml')) ?? '0.0.0';
      return `${baseVersion}+${sha}`;
    },
    build(repoDir) {
      const targetDir = resolveBundledApiRouterCargoTargetDir(rootDir, process.platform);
      runCommand(
        cargoCmd,
        [
          'build',
          '--manifest-path',
          'Cargo.toml',
          '--release',
          '-p',
          'gateway-service',
          '-p',
          'admin-api-service',
          '-p',
          'portal-api-service',
        ],
        {
          cwd: repoDir,
          env: withSupportedWindowsCmakeGenerator({
            CARGO_TARGET_DIR: targetDir,
          }),
        },
      );
      if (hasPreparedApiRouterSiteBundle('admin') && hasPreparedApiRouterSiteBundle('portal')) {
        return;
      }
      for (const appDir of [
        path.join(repoDir, 'apps', 'sdkwork-router-admin'),
        path.join(repoDir, 'apps', 'sdkwork-router-portal'),
      ]) {
        installPnpmWorkspace(appDir);
        runCommand(pnpmCmd, ['build'], { cwd: appDir });
      }
    },
    stage(repoDir, version) {
      const targetDir = resolveBundledApiRouterCargoTargetDir(rootDir, process.platform);
      const adminWebSourceDir =
        resolvePreparedApiRouterSiteBundle('admin')
        ?? path.join(repoDir, 'apps', 'sdkwork-router-admin', 'dist');
      const portalWebSourceDir =
        resolvePreparedApiRouterSiteBundle('portal')
        ?? path.join(repoDir, 'apps', 'sdkwork-router-portal', 'dist');
      const binDir = path.join(bundledRoot, 'modules', 'sdkwork-api-router', version, 'bin');
      const webDir = path.join(bundledRoot, 'modules', 'sdkwork-api-router', version, 'web');
      fs.mkdirSync(binDir, { recursive: true });
      fs.mkdirSync(webDir, { recursive: true });

      // Claw Studio serves the bundled admin and portal sites through its own
      // built-in web host, so the upstream router-web-service binary is not
      // part of the packaged desktop runtime contract.
      for (const binaryName of [
        'gateway-service',
        'admin-api-service',
        'portal-api-service',
      ]) {
        copyFile(
          path.join(targetDir, 'release', withExe(binaryName)),
          path.join(binDir, withExe(binaryName)),
        );
      }

      copyDirectoryContents(
        adminWebSourceDir,
        path.join(webDir, 'admin'),
      );
      copyDirectoryContents(
        portalWebSourceDir,
        path.join(webDir, 'portal'),
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
  fs.mkdirSync(upstreamRoot, { recursive: true });
  fs.mkdirSync(buildRoot, { recursive: true });
  fs.mkdirSync(generatedRoot, { recursive: true });
  fs.rmSync(bundledRoot, { recursive: true, force: true });
  fs.mkdirSync(path.join(bundledRoot, 'foundation', 'components'), { recursive: true });
  fs.mkdirSync(path.join(bundledRoot, 'modules'), { recursive: true });
  fs.mkdirSync(path.join(bundledRoot, 'runtimes'), { recursive: true });
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
    const repoDir = ensureRepository(component);
    const fullSha = gitOutput(repoDir, ['rev-parse', 'HEAD']).trim();
    const shortSha = fullSha.slice(0, 12);
    const version = component.resolveVersion(repoDir, shortSha);
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
      `[bundled-components] processing ${component.id} ${version} from ${component.repoUrl}`,
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
      version,
      commit: fullSha,
      repositoryUrl: component.repoUrl,
      checkoutDir: path.relative(rootDir, repoDir).replaceAll('\\', '/'),
    });

    const registryEntry = staticRegistry.components.find((entry) => entry.id === component.id);
    if (registryEntry) {
      registryEntry.bundledVersion = version;
      registryEntry.commit = fullSha;
      registryEntry.sourceUrl = component.repoUrl;
    }
  }

  const nodeVersion = process.versions.node;
  const nodeRuntimeDir = path.join(bundledRoot, 'runtimes', 'node', nodeVersion);
  fs.mkdirSync(nodeRuntimeDir, { recursive: true });
  copyFile(process.execPath, path.join(nodeRuntimeDir, nodeExecutableName));
  bundleManifest.runtimeVersions.node = nodeVersion;

  writeJson(path.join(bundledRoot, 'foundation', 'components', 'component-registry.json'), staticRegistry);
  writeJson(path.join(bundledRoot, 'foundation', 'components', 'service-defaults.json'), serviceDefaults);
  writeJson(path.join(bundledRoot, 'foundation', 'components', 'upgrade-policy.json'), upgradePolicy);
  writeJson(path.join(bundledRoot, 'foundation', 'components', 'bundle-manifest.json'), bundleManifest);

  console.log('[bundled-components] generated bundled assets at', path.relative(rootDir, bundledLinkRoot));
}

export function createComponentExecutionPlan({
  componentId,
  devMode = false,
  releaseMode = false,
} = {}) {
  if (devMode) {
    return {
      shouldBuild: false,
      shouldStage: true,
    };
  }

  if (
    releaseMode
    && ['openclaw', 'sdkwork-api-router'].includes(String(componentId ?? '').trim())
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

function describeComponentExecutionPlan({
  componentId,
  devMode = false,
  releaseMode = false,
} = {}) {
  if (devMode) {
    return 'dev-mode';
  }

  if (
    releaseMode
    && ['openclaw', 'sdkwork-api-router'].includes(String(componentId ?? '').trim())
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

function ensureRepository(component) {
  const repoDir = path.join(upstreamRoot, component.checkoutDir);
  if (!fs.existsSync(repoDir)) {
    runCommand(gitCmd, ['clone', '--depth', '1', component.repoUrl, repoDir], { cwd: rootDir });
    return repoDir;
  }

  if (!noFetch) {
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

function runCommand(command, commandArgs, options = {}) {
  const useWindowsShell =
    process.platform === 'win32' &&
    ['.cmd', '.bat'].includes(path.extname(command).toLowerCase());
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

function gitOutput(cwd, commandArgs) {
  return runCommand(gitCmd, ['-C', cwd, ...commandArgs], { cwd: rootDir, captureStdout: true });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
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

function resolvePreparedApiRouterSiteBundle(siteLabel) {
  const siteDir = path.join(preparedApiRouterRuntimeDir, 'sites', siteLabel);
  if (!fs.existsSync(path.join(siteDir, 'index.html'))) {
    return null;
  }
  return siteDir;
}

export function resolveGlobalNodeModulesDir(prefixDir, platform = process.platform) {
  if (platform === 'win32') {
    return path.win32.join(prefixDir, 'node_modules');
  }

  return path.posix.join(prefixDir, 'lib', 'node_modules');
}

function hasPreparedApiRouterSiteBundle(siteLabel) {
  return resolvePreparedApiRouterSiteBundle(siteLabel) !== null;
}

function resolveBundledBuildRoot(workspaceRootDir, platform = process.platform) {
  if (platform !== 'win32') {
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
  ensureDirectoryLinkRoot(
    resolveWindowsTauriBundleBridgeDir(rootDir, 'sdkwork-api-router-runtime', process.platform),
    apiRouterRuntimeBundleSourceRoot,
    process.platform,
  );
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
        [resolveWindowsTauriBundleBridgeSource('sdkwork-api-router-runtime')]:
          'resources/sdkwork-api-router-runtime/',
      },
    },
  };
}

function ensureDirectoryLinkRoot(linkRoot, targetRoot, platform = process.platform) {
  if (path.resolve(targetRoot) === path.resolve(linkRoot)) {
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

function createCommandEnv() {
  const env = { ...process.env };
  if (process.platform !== 'win32') {
    return env;
  }

  const pathKey = resolvePathKey(env);
  const pathValue = env[pathKey] ?? env.PATH ?? '';
  const pathEntries = pathValue.split(path.delimiter).filter(Boolean);
  const gitRuntimePathEntries = resolveGitRuntimePathEntries(pathEntries);
  for (const entry of [...gitRuntimePathEntries].reverse()) {
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
