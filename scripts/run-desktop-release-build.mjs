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

export function createDesktopReleaseBuildPlan({
  platform = process.platform,
  env = process.env,
  targetTriple = '',
} = {}) {
  const requestedTargetTriple = String(targetTriple ?? '').trim();
  const args = ['--filter', '@sdkwork/claw-desktop', 'run', 'tauri:build'];
  const resolvedEnv = requestedTargetTriple
    ? buildDesktopReleaseEnv({
        env,
        targetTriple: requestedTargetTriple,
      })
    : { ...env };

  if (requestedTargetTriple) {
    args.push('--', '--target', requestedTargetTriple);
  }

  return {
    command: 'pnpm',
    args,
    cwd: rootDir,
    env: withSupportedWindowsCmakeGenerator(resolvedEnv, platform),
  };
}

function parseCliArgs(argv) {
  const options = {
    targetTriple: '',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];

    if (token === '--target') {
      options.targetTriple = next ?? '';
      index += 1;
    }
  }

  return options;
}

function runCli() {
  const options = parseCliArgs(process.argv.slice(2));
  const plan = createDesktopReleaseBuildPlan({
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
