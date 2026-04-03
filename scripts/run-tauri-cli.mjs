#!/usr/bin/env node

import { spawn } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { withRustToolchainPath } from './ensure-tauri-rust-toolchain.mjs';
import { normalizeViteMode } from './run-vite-host.mjs';

const __filename = fileURLToPath(import.meta.url);

function readOptionValue(argv, index, flag) {
  const next = argv[index + 1];
  const normalizedNext = String(next ?? '').trim();

  if (!normalizedNext || normalizedNext.startsWith('--')) {
    throw new Error(`Missing value for ${flag}.`);
  }

  return normalizedNext;
}

function parseArgs(argv = []) {
  const args = [];
  let viteMode;

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--vite-mode') {
      viteMode = readOptionValue(argv, index, '--vite-mode');
      index += 1;
      continue;
    }
    args.push(token);
  }

  return {
    args,
    viteMode,
  };
}

export function createTauriCliPlan({
  argv = [],
  env = process.env,
  platform = process.platform,
  cwd = process.cwd(),
} = {}) {
  const { args, viteMode } = parseArgs(Array.isArray(argv) ? argv : []);
  if (args.length === 0) {
    throw new Error('run-tauri-cli requires a tauri subcommand such as "dev" or "build".');
  }

  const resolvedMode = normalizeViteMode(viteMode ?? env.SDKWORK_VITE_MODE, 'development');
  const tauriEnv = withRustToolchainPath(env, { platform });

  return {
    command: platform === 'win32' ? 'tauri.cmd' : 'tauri',
    args,
    cwd,
    env: {
      ...tauriEnv,
      SDKWORK_VITE_MODE: resolvedMode,
    },
    shell: platform === 'win32',
  };
}

function runCli() {
  const plan = createTauriCliPlan({
    argv: process.argv.slice(2),
  });
  const child = spawn(plan.command, plan.args, {
    cwd: plan.cwd,
    env: plan.env,
    stdio: 'inherit',
    shell: plan.shell,
  });

  child.on('error', (error) => {
    console.error(`[run-tauri-cli] ${error.message}`);
    process.exit(1);
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      console.error(`[run-tauri-cli] process exited with signal ${signal}`);
      process.exit(1);
    }
    process.exit(code ?? 0);
  });
}

if (path.resolve(process.argv[1] ?? '') === __filename) {
  try {
    runCli();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
