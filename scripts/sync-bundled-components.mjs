import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
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
const bundledRoot = path.join(generatedRoot, 'bundled');
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
const skipOpenClaw = args.has('--skip-openclaw');

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

      const installedModulesDir = path.join(prefixDir, 'node_modules');
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
      const targetDir = rustTargetDir('sdkwork-api-router');
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
          '-p',
          'router-web-service',
        ],
        {
          cwd: repoDir,
          env: { CARGO_TARGET_DIR: targetDir },
        },
      );
      for (const appDir of [
        path.join(repoDir, 'apps', 'sdkwork-router-admin'),
        path.join(repoDir, 'apps', 'sdkwork-router-portal'),
      ]) {
        installPnpmWorkspace(appDir);
        runCommand(pnpmCmd, ['build'], { cwd: appDir });
      }
    },
    stage(repoDir, version) {
      const targetDir = rustTargetDir('sdkwork-api-router');
      const binDir = path.join(bundledRoot, 'modules', 'sdkwork-api-router', version, 'bin');
      const webDir = path.join(bundledRoot, 'modules', 'sdkwork-api-router', version, 'web');
      fs.mkdirSync(binDir, { recursive: true });
      fs.mkdirSync(webDir, { recursive: true });

      for (const binaryName of [
        'gateway-service',
        'admin-api-service',
        'portal-api-service',
        'router-web-service',
      ]) {
        copyFile(
          path.join(targetDir, 'release', withExe(binaryName)),
          path.join(binDir, withExe(binaryName)),
        );
      }

      copyDirectoryContents(
        path.join(repoDir, 'apps', 'sdkwork-router-admin', 'dist'),
        path.join(webDir, 'admin'),
      );
      copyDirectoryContents(
        path.join(repoDir, 'apps', 'sdkwork-router-portal', 'dist'),
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

    if (!devMode) {
      component.build(repoDir);
      component.stage(repoDir, version);
    } else {
      try {
        component.stage(repoDir, version);
      } catch (error) {
        console.warn(`[bundled-components] skipped staging ${component.id} in dev mode: ${error instanceof Error ? error.message : String(error)}`);
      }
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

  console.log('[bundled-components] generated bundled assets at', path.relative(rootDir, bundledRoot));
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
    runCommand(pnpmCmd, ['install', '--frozen-lockfile'], { cwd });
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

main();
