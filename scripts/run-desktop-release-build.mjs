#!/usr/bin/env node

import { spawn } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { withSupportedWindowsCmakeGenerator } from './prepare-sdkwork-api-router-runtime.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

export function createDesktopReleaseBuildPlan({
  platform = process.platform,
  env = process.env,
} = {}) {
  return {
    command: 'pnpm',
    args: ['--filter', '@sdkwork/claw-desktop', 'run', 'tauri:build'],
    cwd: rootDir,
    env: withSupportedWindowsCmakeGenerator(env, platform),
  };
}

function runCli() {
  const plan = createDesktopReleaseBuildPlan();
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
