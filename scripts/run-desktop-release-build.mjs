#!/usr/bin/env node

import { spawn } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { withSupportedWindowsCmakeGenerator } from './prepare-sdkwork-api-router-runtime.mjs';
import {
  buildDesktopReleaseEnv,
  normalizeDesktopArch,
  normalizeDesktopPlatform,
  parseDesktopTargetTriple,
} from './release/desktop-targets.mjs';

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
  phase,
  requestedTargetTriple,
  releaseMode,
  platform,
  hostArch,
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
      if (normalizeDesktopPlatform(platform) === 'windows') {
        return {
          command: process.execPath,
          args: [
            'scripts/run-windows-tauri-bundle.mjs',
            '--config',
            desktopTauriBundleOverlayConfig,
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
      const normalizedPlatform = normalizeDesktopPlatform(platform);
      if (normalizedPlatform === 'linux') {
        args.push('--bundles', 'deb');
      } else if (normalizedPlatform === 'macos') {
        args.push('--bundles', 'app');
      }
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
  platform = process.platform,
  hostArch = process.arch,
  env = process.env,
  targetTriple = '',
  phase = 'all',
  releaseMode = false,
} = {}) {
  const requestedTargetTriple = String(targetTriple ?? '').trim();
  const resolvedEnv = requestedTargetTriple
    ? buildDesktopReleaseEnv({
        env,
        targetTriple: requestedTargetTriple,
      })
    : { ...env };

  const normalizedPhase = String(phase ?? 'all').trim().toLowerCase() || 'all';
  const effectiveReleaseMode = releaseMode || normalizedPhase === 'sync';
  const plan = resolveReleasePhasePlan({
    phase: normalizedPhase,
    requestedTargetTriple,
    releaseMode: effectiveReleaseMode,
    platform,
    hostArch,
  });

  return {
    command: plan.command,
    args: plan.args,
    cwd: rootDir,
    env: withSupportedWindowsCmakeGenerator(resolvedEnv, platform),
  };
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
    targetTriple: '',
    phase: 'all',
    releaseMode: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];

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
    }
  }

  return options;
}

function runCli() {
  const options = parseCliArgs(process.argv.slice(2));
  const plan = createDesktopReleaseBuildPlan({
    phase: options.phase,
    targetTriple: options.targetTriple,
    releaseMode: options.releaseMode,
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

    process.exit(code ?? 0);
  });
}

if (path.resolve(process.argv[1] ?? '') === __filename) {
  runCli();
}
