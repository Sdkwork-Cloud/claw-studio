#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { parseDesktopTargetTriple } from './release/desktop-targets.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const desktopPackageDir = path.join(rootDir, 'packages', 'sdkwork-claw-desktop');
const desktopSrcTauriDir = path.join(desktopPackageDir, 'src-tauri');
const defaultBundleOverlayConfig = path.join(
  desktopPackageDir,
  'src-tauri',
  'generated',
  'tauri.bundle.overlay.json',
);
const desktopTauriConfig = JSON.parse(
  fs.readFileSync(path.join(desktopSrcTauriDir, 'tauri.conf.json'), 'utf8'),
);
const windowsNsisShortSourceSpecs = [
  ['generated', 'bundled', ['generated', 'bundled']],
  ['bridge-bundled', 'bundled', ['generated', 'br', 'b']],
  ['openclaw-runtime', 'openclaw-runtime', ['resources', 'openclaw-runtime']],
  ['bridge-openclaw-runtime', 'openclaw-runtime', ['generated', 'br', 'o']],
];
const pathDelimiter = process.platform === 'win32' ? ';' : ':';

function uniqueExistingPaths(paths, existsSync = fs.existsSync) {
  return [...new Set(paths.filter((candidatePath) =>
    typeof candidatePath === 'string' &&
    candidatePath.trim().length > 0 &&
    existsSync(candidatePath),
  ))];
}

function resolveRustCargoBinCandidates(
  env = process.env,
  existsSync = fs.existsSync,
  platform = process.platform,
) {
  const homeDir = env.USERPROFILE ?? env.HOME ?? null;
  const cargoHome = env.CARGO_HOME ?? (homeDir ? path.join(homeDir, '.cargo') : null);

  return uniqueExistingPaths([
    cargoHome ? path.join(cargoHome, 'bin') : null,
    homeDir ? path.join(homeDir, '.cargo', 'bin') : null,
  ], existsSync).filter((candidatePath) =>
    existsSync(path.join(candidatePath, platform === 'win32' ? 'cargo.exe' : 'cargo')),
  );
}

function createExecutableSearchPath(env = process.env, prependEntries = []) {
  const existingEntries = typeof env.PATH === 'string' && env.PATH.trim().length > 0
    ? env.PATH.split(pathDelimiter).filter(Boolean)
    : typeof env.Path === 'string' && env.Path.trim().length > 0
      ? env.Path.split(pathDelimiter).filter(Boolean)
      : [];

  return [...uniqueExistingPaths(prependEntries), ...existingEntries]
    .filter((value, index, items) => items.indexOf(value) === index)
    .join(pathDelimiter);
}

export function createWindowsTauriBundleEnv({
  env: inputEnv = process.env,
  platform = process.platform,
  existsSync = fs.existsSync,
} = {}) {
  if (platform !== 'win32') {
    return { ...inputEnv };
  }

  const env = { ...inputEnv };
  const cargoBinCandidates = resolveRustCargoBinCandidates(env, existsSync, platform);
  const pathKey = Object.keys(env).find((key) => key.toUpperCase() === 'PATH') ?? 'Path';
  const resolvedPath = createExecutableSearchPath(env, cargoBinCandidates);

  for (const key of Object.keys(env)) {
    if (key !== pathKey && key.toUpperCase() === 'PATH') {
      delete env[key];
    }
  }

  return {
    ...env,
    [pathKey]: resolvedPath,
    PATH: resolvedPath,
  };
}

export function buildWindowsTauriBundleCommand({
  configPath = defaultBundleOverlayConfig,
  targetTriple = '',
  platform = process.platform,
} = {}) {
  const resolvedConfigPath = path.isAbsolute(configPath)
    ? configPath
    : path.resolve(rootDir, configPath);

  return {
    command: platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
    args: [
      '--dir',
      path.relative(rootDir, desktopPackageDir).replaceAll('\\', '/'),
      'exec',
      'tauri',
      'build',
      '--config',
      path.relative(desktopPackageDir, resolvedConfigPath).replaceAll('\\', '/'),
      ...(String(targetTriple ?? '').trim().length > 0 ? ['--target', targetTriple] : []),
    ],
  };
}

export function createWindowsNsisSourceReplacements(workspaceRootDir = rootDir) {
  const workspaceName = path.win32.basename(workspaceRootDir);
  const driveRoot = path.win32.parse(workspaceRootDir).root;
  const desktopSrcTauriWinDir = path.win32.join(
    workspaceRootDir,
    'packages',
    'sdkwork-claw-desktop',
    'src-tauri',
  );

  return windowsNsisShortSourceSpecs.map(([_, mirrorDirName, relativeSourceSegments]) => ({
    from: `${path.win32.join(desktopSrcTauriWinDir, ...relativeSourceSegments)}\\`,
    to: `${path.win32.join(driveRoot, '.sdkwork-bc', workspaceName, mirrorDirName)}\\`,
  }));
}

export const createWindowsNsisBridgeReplacements = createWindowsNsisSourceReplacements;

export function rewriteNsisSourcePaths(
  installerContent,
  replacements = createWindowsNsisSourceReplacements(),
) {
  let nextContent = String(installerContent ?? '');

  for (const replacement of replacements) {
    nextContent = nextContent.split(replacement.from).join(replacement.to);
  }

  return nextContent;
}

export function prepareWindowsNsisRetryScript({
  installerContent,
  workspaceRootDir = rootDir,
  outputFilePath,
} = {}) {
  let nextContent = rewriteNsisSourcePaths(
    installerContent,
    createWindowsNsisSourceReplacements(workspaceRootDir),
  );

  if (typeof outputFilePath === 'string' && outputFilePath.trim().length > 0) {
    nextContent = nextContent.replace(
      /^!define OUTFILE ".*"$/mu,
      `!define OUTFILE "${outputFilePath.trim()}"`,
    );
  }

  return nextContent;
}

function parseCliArgs(argv) {
  const options = {
    configPath: defaultBundleOverlayConfig,
    targetTriple: String(process.env.SDKWORK_DESKTOP_TARGET ?? '').trim(),
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];

    if (token === '--config') {
      options.configPath = next ?? defaultBundleOverlayConfig;
      index += 1;
      continue;
    }

    if (token === '--target') {
      options.targetTriple = next ?? '';
      index += 1;
    }
  }

  return options;
}

function runCommand(command, args, options = {}) {
  const useWindowsShell =
    process.platform === 'win32' &&
    ['.cmd', '.bat'].includes(path.extname(command).toLowerCase());

  return spawnSync(command, args, {
    cwd: options.cwd ?? rootDir,
    env: {
      ...process.env,
      ...(options.env ?? {}),
    },
    shell: options.shell ?? useWindowsShell,
    stdio: 'inherit',
  });
}

function resolveWindowsNsisArchDir(targetTriple = '') {
  const requestedTargetTriple = String(targetTriple ?? '').trim();
  if (requestedTargetTriple.length > 0) {
    return parseDesktopTargetTriple(requestedTargetTriple).arch === 'arm64' ? 'arm64' : 'x64';
  }

  return String(process.env.SDKWORK_DESKTOP_TARGET_ARCH ?? '').trim().toLowerCase() === 'arm64'
    ? 'arm64'
    : 'x64';
}

function buildReleaseRootCandidates(targetTriple = '') {
  const requestedTargetTriple = String(targetTriple ?? '').trim();
  const releaseRoots = [];
  if (requestedTargetTriple.length > 0) {
    releaseRoots.push(path.join(desktopSrcTauriDir, 'target', requestedTargetTriple, 'release'));
  }
  releaseRoots.push(path.join(desktopSrcTauriDir, 'target', 'release'));
  return [...new Set(releaseRoots)];
}

function resolveExistingInstallerScriptPath(targetTriple = '') {
  return resolveWindowsNsisArtifacts(targetTriple).installerScriptPath;
}

function installerScriptLooksRecoverable(installerScriptPath, buildStartedAtMs) {
  if (!installerScriptPath || !fs.existsSync(installerScriptPath)) {
    return false;
  }

  const installerStat = fs.statSync(installerScriptPath);
  if (installerStat.mtimeMs < buildStartedAtMs) {
    return false;
  }

  const installerContent = fs.readFileSync(installerScriptPath, 'utf8');
  return createWindowsNsisSourceReplacements(rootDir).some((replacement) =>
    installerContent.includes(replacement.from),
  );
}

function resolveMakensisExecutable() {
  const candidates = [
    path.join(process.env.LOCALAPPDATA ?? '', 'tauri', 'NSIS', 'makensis.exe'),
    path.join(process.env.LOCALAPPDATA ?? '', 'tauri', 'NSIS', 'Bin', 'makensis.exe'),
    path.join(process.env.LOCALAPPDATA ?? '', 'electron-builder', 'Cache', 'nsis', 'nsis-3.0.4.1', 'makensis.exe'),
    path.join(process.env.LOCALAPPDATA ?? '', 'electron-builder', 'Cache', 'nsis', 'nsis-3.0.4.1', 'Bin', 'makensis.exe'),
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  const commandProbe = spawnSync('where.exe', ['makensis'], {
    cwd: rootDir,
    encoding: 'utf8',
    shell: false,
  });
  if (commandProbe.status === 0) {
    const resolved = String(commandProbe.stdout ?? '')
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .find(Boolean);
    if (resolved) {
      return resolved;
    }
  }

  throw new Error('Unable to locate makensis.exe for Windows NSIS retry.');
}

function buildWindowsNsisBundleFileName(archDir) {
  return `${desktopTauriConfig.productName}_${desktopTauriConfig.version}_${archDir}-setup.exe`;
}

function resolveWindowsNsisArtifacts(targetTriple = '') {
  const archDir = resolveWindowsNsisArchDir(targetTriple);
  const releaseRootCandidates = buildReleaseRootCandidates(targetTriple);
  const releaseRoot =
    releaseRootCandidates.find((candidate) =>
      fs.existsSync(path.join(candidate, 'nsis', archDir, 'installer.nsi')),
    ) ?? releaseRootCandidates[0];

  return {
    archDir,
    releaseRoot,
    installerScriptPath: path.join(releaseRoot, 'nsis', archDir, 'installer.nsi'),
    nsisOutputPath: path.join(releaseRoot, 'nsis', archDir, 'nsis-output.exe'),
    bundleOutputPath: path.join(
      releaseRoot,
      'bundle',
      'nsis',
      buildWindowsNsisBundleFileName(archDir),
    ),
  };
}

function retryNsisBundleWithShortSourcePaths({
  targetTriple = '',
  buildStartedAtMs,
}) {
  const artifacts = resolveWindowsNsisArtifacts(targetTriple);
  if (!installerScriptLooksRecoverable(artifacts.installerScriptPath, buildStartedAtMs)) {
    return false;
  }

  const originalInstaller = fs.readFileSync(artifacts.installerScriptPath, 'utf8');
  const rewrittenInstaller = prepareWindowsNsisRetryScript({
    installerContent: originalInstaller,
    workspaceRootDir: rootDir,
    outputFilePath: artifacts.bundleOutputPath,
  });

  if (rewrittenInstaller === originalInstaller) {
    return false;
  }

  fs.mkdirSync(path.dirname(artifacts.bundleOutputPath), { recursive: true });
  fs.rmSync(artifacts.nsisOutputPath, { force: true });
  fs.rmSync(artifacts.bundleOutputPath, { force: true });
  fs.writeFileSync(artifacts.installerScriptPath, rewrittenInstaller, 'utf8');

  console.warn(
    '[windows-tauri-bundle] retrying makensis with short absolute OpenClaw bridge source paths',
  );

  const makensisPath = resolveMakensisExecutable();
  const result = runCommand(
    makensisPath,
    [path.basename(artifacts.installerScriptPath)],
    {
      cwd: path.dirname(artifacts.installerScriptPath),
      shell: false,
    },
  );

  return (
    result.status === 0 &&
    !result.error &&
    !result.signal &&
    fs.existsSync(artifacts.bundleOutputPath)
  );
}

function main() {
  if (process.platform !== 'win32') {
    throw new Error('run-windows-tauri-bundle.mjs only supports Windows hosts');
  }

  const options = parseCliArgs(process.argv.slice(2));
  const buildPlan = buildWindowsTauriBundleCommand({
    configPath: options.configPath,
    targetTriple: options.targetTriple,
  });
  const buildStartedAtMs = Date.now();
  const buildResult = runCommand(buildPlan.command, buildPlan.args, {
    cwd: rootDir,
    env: createWindowsTauriBundleEnv(),
  });

  if (!buildResult.error && !buildResult.signal && buildResult.status === 0) {
    process.exit(0);
  }

  if (
    retryNsisBundleWithShortSourcePaths({
      targetTriple: options.targetTriple,
      buildStartedAtMs,
    })
  ) {
    process.exit(0);
  }

  if (buildResult.error) {
    throw buildResult.error;
  }

  if (buildResult.signal) {
    console.error(`[windows-tauri-bundle] tauri build exited with signal ${buildResult.signal}`);
    process.exit(1);
  }

  process.exit(buildResult.status ?? 1);
}

if (path.resolve(process.argv[1] ?? '') === __filename) {
  main();
}
