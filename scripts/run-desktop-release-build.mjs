#!/usr/bin/env node

import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { withRustToolchainPath } from './ensure-tauri-rust-toolchain.mjs';
import { normalizeViteMode } from './run-vite-host.mjs';
import { withSupportedWindowsCmakeGenerator } from './prepare-sdkwork-api-router-runtime.mjs';
import { resolveExistingDesktopBundleRoot } from './release/package-release-assets.mjs';
import {
  buildDesktopReleaseEnv,
  normalizeDesktopArch,
  normalizeDesktopPlatform,
  parseDesktopTargetTriple,
} from './release/desktop-targets.mjs';
import {
  DEFAULT_RELEASE_PROFILE_ID,
  resolveDesktopBundleTargets,
  serializeBundleTargets,
} from './release/release-profiles.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const desktopSrcTauriDir = path.join('packages', 'sdkwork-claw-desktop', 'src-tauri');
const desktopTauriBundleOverlayConfig = path.join(
  'packages',
  'sdkwork-claw-desktop',
  'src-tauri',
  'generated',
  'tauri.bundle.overlay.json',
);
const desktopPackageName = '@sdkwork/claw-desktop';

function resolveReleasePhasePlan({
  profileId,
  phase,
  requestedTargetTriple,
  releaseMode,
  platform,
  hostArch,
  bundleTargets,
}) {
  switch (phase) {
    case 'sync':
      return {
        command: process.execPath,
        args: [
          'scripts/sync-bundled-components.mjs',
          '--no-fetch',
          ...(releaseMode ? ['--release'] : []),
        ],
      };
    case 'prepare-target':
      return {
        command: process.execPath,
        args: ['scripts/ensure-tauri-target-clean.mjs', desktopSrcTauriDir],
      };
    case 'prepare-openclaw':
      return {
        command: process.execPath,
        args: ['scripts/prepare-openclaw-runtime.mjs'],
      };
    case 'prepare-api-router':
      return {
        command: process.execPath,
        args: ['scripts/prepare-sdkwork-api-router-runtime.mjs'],
      };
    case 'bundle': {
      const resolvedBundleTargets = resolveDesktopBundleTargets({
        profileId,
        platform,
        targetTriple: requestedTargetTriple,
        arch: normalizeDesktopArch(hostArch),
        bundleTargets,
      });

      if (normalizeDesktopPlatform(platform) === 'windows') {
        return {
          command: process.execPath,
          args: [
            'scripts/run-windows-tauri-bundle.mjs',
            '--profile',
            profileId,
            '--config',
            desktopTauriBundleOverlayConfig,
            '--bundles',
            serializeBundleTargets(resolvedBundleTargets),
            ...(requestedTargetTriple
              && shouldPassExplicitTauriTarget({
                requestedTargetTriple,
                platform,
                hostArch,
              })
              ? ['--target', requestedTargetTriple]
              : []),
          ],
        };
      }

      const args = [
        '--dir',
        path.join('packages', 'sdkwork-claw-desktop'),
        'exec',
        'tauri',
        'build',
        '--config',
        path.join('src-tauri', 'generated', 'tauri.bundle.overlay.json'),
      ];
      args.push('--bundles', serializeBundleTargets(resolvedBundleTargets));
      if (
        requestedTargetTriple
        && shouldPassExplicitTauriTarget({
          requestedTargetTriple,
          platform,
          hostArch,
        })
      ) {
        args.push('--target', requestedTargetTriple);
      }
      return {
        command: 'pnpm',
        args,
        bundleTargets: resolvedBundleTargets,
      };
    }
    case 'all': {
      const args = ['--filter', desktopPackageName, 'run', 'tauri:build'];
      if (requestedTargetTriple) {
        args.push('--', '--target', requestedTargetTriple);
      }
      return {
        command: 'pnpm',
        args,
      };
    }
    default:
      throw new Error(`Unsupported desktop release phase: ${phase}`);
  }
}

export function createDesktopReleaseBuildPlan({
  profileId = DEFAULT_RELEASE_PROFILE_ID,
  platform = process.platform,
  hostArch = process.arch,
  env = process.env,
  targetTriple = '',
  phase = 'all',
  releaseMode = false,
  viteMode = 'production',
  bundleTargets = [],
} = {}) {
  const requestedTargetTriple = String(targetTriple ?? '').trim();
  const resolvedEnv = requestedTargetTriple
    ? buildDesktopReleaseEnv({
        env,
        targetTriple: requestedTargetTriple,
      })
    : { ...env };
  const rustToolchainEnv = withRustToolchainPath(resolvedEnv, { platform });
  rustToolchainEnv.SDKWORK_VITE_MODE = normalizeViteMode(
    viteMode ?? rustToolchainEnv.SDKWORK_VITE_MODE,
    'production',
  );

  const normalizedPhase = String(phase ?? 'all').trim().toLowerCase() || 'all';
  const effectiveReleaseMode = releaseMode || normalizedPhase === 'sync';
  const plan = resolveReleasePhasePlan({
    profileId,
    phase: normalizedPhase,
    requestedTargetTriple,
    releaseMode: effectiveReleaseMode,
    platform,
    hostArch,
    bundleTargets,
  });

  return {
    command: plan.command,
    args: plan.args,
    cwd: rootDir,
    env: withSupportedWindowsCmakeGenerator(rustToolchainEnv, platform),
    bundleTargets: plan.bundleTargets ?? [],
  };
}

function normalizeBundleTargets(bundleTargets) {
  return Array.isArray(bundleTargets)
    ? bundleTargets
      .map((entry) => String(entry ?? '').trim().toLowerCase())
      .filter(Boolean)
    : [];
}

function isTemporaryMacosDmgFileName(fileName) {
  const normalizedFileName = String(fileName ?? '').trim().toLowerCase();
  return normalizedFileName.endsWith('.dmg') && normalizedFileName.startsWith('rw.');
}

function isCompletedMacosDmgFileName(fileName) {
  const normalizedFileName = String(fileName ?? '').trim().toLowerCase();
  return normalizedFileName.endsWith('.dmg') && !isTemporaryMacosDmgFileName(normalizedFileName);
}

function listMacosDmgFiles(bundleRoot, bundleDirectories = ['dmg', 'macos']) {
  if (!bundleRoot || !existsSync(bundleRoot)) {
    return [];
  }

  return bundleDirectories.flatMap((bundleDirectory) => {
    const candidateDirectory = path.join(bundleRoot, bundleDirectory);
    if (!existsSync(candidateDirectory)) {
      return [];
    }

    return readdirSync(candidateDirectory, { withFileTypes: true })
      .filter((entry) => entry.isFile() && String(entry.name ?? '').toLowerCase().endsWith('.dmg'))
      .map((entry) => ({
        name: entry.name,
        absolutePath: path.join(candidateDirectory, entry.name),
        directory: bundleDirectory,
      }));
  });
}

function bundleOutputExists(bundleRoot, bundleTarget) {
  if (!bundleRoot || !existsSync(bundleRoot)) {
    return false;
  }

  if (bundleTarget === 'app') {
    const macosBundleDir = path.join(bundleRoot, 'macos');
    return existsSync(macosBundleDir)
      && readdirSync(macosBundleDir, { withFileTypes: true })
        .some((entry) => entry.isDirectory() && entry.name.endsWith('.app'));
  }

  if (bundleTarget === 'dmg') {
    return listMacosDmgFiles(bundleRoot)
      .some((entry) => isCompletedMacosDmgFileName(entry.name));
  }

  return false;
}

function resolveTemporaryMacosDmgRepairPlan(bundleRoot) {
  const temporaryDmg = listMacosDmgFiles(bundleRoot)
    .find((entry) => isTemporaryMacosDmgFileName(entry.name));
  if (!temporaryDmg) {
    return null;
  }

  const finalFileName = temporaryDmg.name.replace(/^rw\.[^.]+\./i, '');
  if (!isCompletedMacosDmgFileName(finalFileName)) {
    return null;
  }

  return {
    sourcePath: temporaryDmg.absolutePath,
    targetPath: path.join(bundleRoot, 'dmg', finalFileName),
  };
}

export function canRecoverMacosBundleFailure({
  platform = process.platform,
  bundleTargets = [],
  targetTriple = '',
  targetDir = path.join(
    rootDir,
    'packages',
    'sdkwork-claw-desktop',
    'src-tauri',
    'target',
  ),
} = {}) {
  if (normalizeDesktopPlatform(platform) !== 'macos') {
    return false;
  }

  const normalizedBundleTargets = normalizeBundleTargets(bundleTargets);
  if (normalizedBundleTargets.length === 0 || !normalizedBundleTargets.includes('dmg')) {
    return false;
  }

  const bundleRoot = resolveExistingDesktopBundleRoot({
    targetTriple,
    targetDir,
  });

  return normalizedBundleTargets.every((bundleTarget) => (
    bundleOutputExists(bundleRoot, bundleTarget)
  ));
}

export function repairMacosDmgBundleOutput({
  platform = process.platform,
  bundleTargets = [],
  targetTriple = '',
  targetDir = path.join(
    rootDir,
    'packages',
    'sdkwork-claw-desktop',
    'src-tauri',
    'target',
  ),
  spawnSyncImpl = spawnSync,
} = {}) {
  if (normalizeDesktopPlatform(platform) !== 'macos') {
    return false;
  }

  const normalizedBundleTargets = normalizeBundleTargets(bundleTargets);
  if (!normalizedBundleTargets.includes('dmg')) {
    return false;
  }

  const bundleRoot = resolveExistingDesktopBundleRoot({
    targetTriple,
    targetDir,
  });
  const repairPlan = resolveTemporaryMacosDmgRepairPlan(bundleRoot);
  if (!repairPlan) {
    return false;
  }

  mkdirSync(path.dirname(repairPlan.targetPath), { recursive: true });
  rmSync(repairPlan.targetPath, { force: true });

  const repairResult = spawnSyncImpl(
    'hdiutil',
    [
      'convert',
      repairPlan.sourcePath,
      '-format',
      'UDZO',
      '-o',
      repairPlan.targetPath,
    ],
    {
      stdio: 'inherit',
    },
  );

  if (repairResult?.error) {
    console.error(`[run-desktop-release-build] failed to repair macOS dmg output: ${repairResult.error.message}`);
    return false;
  }
  if ((repairResult?.status ?? 1) !== 0) {
    console.error(
      `[run-desktop-release-build] failed to repair macOS dmg output: hdiutil exited with code ${repairResult?.status ?? 'unknown'}`,
    );
    return false;
  }

  return bundleOutputExists(bundleRoot, 'dmg');
}

function shouldPassExplicitTauriTarget({
  requestedTargetTriple,
  platform,
  hostArch,
}) {
  if (!requestedTargetTriple) {
    return false;
  }

  const requestedTarget = parseDesktopTargetTriple(requestedTargetTriple);
  const nativePlatform = normalizeDesktopPlatform(platform);
  const nativeArch = normalizeDesktopArch(hostArch);

  return requestedTarget.platform !== nativePlatform || requestedTarget.arch !== nativeArch;
}

function parseCliArgs(argv) {
  const options = {
    profileId: DEFAULT_RELEASE_PROFILE_ID,
    targetTriple: '',
    phase: 'all',
    releaseMode: false,
    viteMode: 'production',
    bundleTargets: [],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];

    if (token === '--profile') {
      options.profileId = next ?? DEFAULT_RELEASE_PROFILE_ID;
      index += 1;
      continue;
    }

    if (token === '--target') {
      options.targetTriple = next ?? '';
      index += 1;
      continue;
    }

    if (token === '--phase') {
      options.phase = next ?? 'all';
      index += 1;
      continue;
    }

    if (token === '--release') {
      options.releaseMode = true;
      continue;
    }

    if (token === '--vite-mode') {
      options.viteMode = next ?? 'production';
      index += 1;
      continue;
    }

    if (token === '--bundles') {
      options.bundleTargets = String(next ?? '')
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean);
      index += 1;
    }
  }

  return options;
}

function runCli() {
  const options = parseCliArgs(process.argv.slice(2));
  const plan = createDesktopReleaseBuildPlan({
    profileId: options.profileId,
    phase: options.phase,
    targetTriple: options.targetTriple,
    releaseMode: options.releaseMode,
    viteMode: options.viteMode,
    bundleTargets: options.bundleTargets,
  });
  const child = spawn(plan.command, plan.args, {
    cwd: plan.cwd,
    env: plan.env,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  child.on('error', (error) => {
    console.error(`[run-desktop-release-build] ${error.message}`);
    process.exit(1);
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      console.error(`[run-desktop-release-build] build exited with signal ${signal}`);
      process.exit(1);
    }

    const repairedMacosDmg =
      (code ?? 0) !== 0
      && options.phase === 'bundle'
      && repairMacosDmgBundleOutput({
        platform: process.platform,
        targetTriple: options.targetTriple,
        bundleTargets: plan.bundleTargets,
      });

    if (
      (code ?? 0) !== 0
      && options.phase === 'bundle'
      && canRecoverMacosBundleFailure({
        platform: process.platform,
        targetTriple: options.targetTriple,
        bundleTargets: plan.bundleTargets,
      })
    ) {
      if (repairedMacosDmg) {
        console.warn(
          '[run-desktop-release-build] recovered a macOS bundle failure by converting a temporary rw dmg output into the final dmg artifact.',
        );
      } else {
        console.warn(
          '[run-desktop-release-build] treating non-zero macOS bundle exit as recoverable because the requested .app/.dmg outputs already exist.',
        );
      }
      process.exit(0);
    }

    process.exit(code ?? 0);
  });
}

if (path.resolve(process.argv[1] ?? '') === __filename) {
  runCli();
}
