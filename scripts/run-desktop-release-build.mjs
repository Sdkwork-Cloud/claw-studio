#!/usr/bin/env node

import { spawn } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { withSupportedWindowsCmakeGenerator } from './prepare-sdkwork-api-router-runtime.mjs';
import { buildDesktopReleaseEnv } from './release/desktop-targets.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const desktopSrcTauriDir = path.join('packages', 'sdkwork-claw-desktop', 'src-tauri');
const desktopPackageName = '@sdkwork/claw-desktop';

function resolveReleasePhasePlan({
  phase,
  requestedTargetTriple,
}) {
  switch (phase) {
    case 'sync':
      return {
        command: process.execPath,
        args: ['scripts/sync-bundled-components.mjs', '--no-fetch'],
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
      const args = ['--filter', desktopPackageName, 'exec', 'tauri', 'build'];
      if (requestedTargetTriple) {
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
  env = process.env,
  targetTriple = '',
  phase = 'all',
} = {}) {
  const requestedTargetTriple = String(targetTriple ?? '').trim();
  const resolvedEnv = requestedTargetTriple
    ? buildDesktopReleaseEnv({
        env,
        targetTriple: requestedTargetTriple,
      })
    : { ...env };

  const normalizedPhase = String(phase ?? 'all').trim().toLowerCase() || 'all';
  const plan = resolveReleasePhasePlan({
    phase: normalizedPhase,
    requestedTargetTriple,
  });

  return {
    command: plan.command,
    args: plan.args,
    cwd: rootDir,
    env: withSupportedWindowsCmakeGenerator(resolvedEnv, platform),
  };
}

function parseCliArgs(argv) {
  const options = {
    targetTriple: '',
    phase: 'all',
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
    }
  }

  return options;
}

function runCli() {
  const options = parseCliArgs(process.argv.slice(2));
  const plan = createDesktopReleaseBuildPlan({
    phase: options.phase,
    targetTriple: options.targetTriple,
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
