#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { parseDesktopTargetTriple } from './release/desktop-targets.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const serverPackageDir = path.join(rootDir, 'packages', 'sdkwork-claw-server');
const SERVER_BUILD_TARGET_ENV_VAR = 'SDKWORK_SERVER_TARGET';

function readOptionValue(argv, index, flag) {
  const next = argv[index + 1];
  const normalizedNext = String(next ?? '').trim();

  if (!normalizedNext || normalizedNext.startsWith('--')) {
    throw new Error(`Missing value for ${flag}.`);
  }

  return normalizedNext;
}

export function parseArgs(argv) {
  const options = {
    targetTriple: '',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === '--target') {
      options.targetTriple = readOptionValue(argv, index, '--target');
      index += 1;
    }
  }

  return options;
}

export function resolveServerBuildTarget({
  targetTriple = '',
  env = process.env,
} = {}) {
  const explicitTarget = String(targetTriple ?? '').trim();
  if (explicitTarget.length > 0) {
    return explicitTarget;
  }

  return String(env?.[SERVER_BUILD_TARGET_ENV_VAR] ?? '').trim();
}

export function createServerBuildPlan({
  targetTriple = '',
  env = process.env,
} = {}) {
  const resolvedTargetTriple = resolveServerBuildTarget({
    targetTriple,
    env,
  });
  const args = ['build', '--manifest-path', 'src-host/Cargo.toml', '--release'];
  const nextEnv = {};

  if (resolvedTargetTriple.length > 0) {
    const targetSpec = parseDesktopTargetTriple(resolvedTargetTriple);
    args.push('--target', resolvedTargetTriple);
    nextEnv.SDKWORK_SERVER_TARGET = resolvedTargetTriple;
    nextEnv.SDKWORK_SERVER_TARGET_PLATFORM = targetSpec.platform;
    nextEnv.SDKWORK_SERVER_TARGET_ARCH = targetSpec.arch;
  }

  return {
    command: 'cargo',
    args,
    cwd: serverPackageDir,
    env: nextEnv,
  };
}

export function runServerBuild(options = {}) {
  const plan = createServerBuildPlan(options);
  const result = spawnSync(plan.command, plan.args, {
    cwd: plan.cwd,
    env: {
      ...process.env,
      ...plan.env,
    },
    stdio: 'inherit',
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(
      `server build failed with exit code ${result.status ?? 'unknown'}`,
    );
  }

  return plan;
}

function main() {
  runServerBuild(parseArgs(process.argv.slice(2)));
}

if (path.resolve(process.argv[1] ?? '') === __filename) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
