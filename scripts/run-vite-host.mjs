#!/usr/bin/env node

import { spawn } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);

export function normalizeViteMode(value, fallback = 'development') {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'dev' || normalized === 'development') {
    return 'development';
  }
  if (normalized === 'prod' || normalized === 'production') {
    return 'production';
  }
  if (normalized === 'test') {
    return 'test';
  }
  return fallback;
}

function resolveDefaultMode(command) {
  return command === 'build' ? 'production' : 'development';
}

function stripModeArg(argv) {
  const args = [];
  let explicitMode;

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--mode') {
      explicitMode = argv[index + 1];
      index += 1;
      continue;
    }
    args.push(token);
  }

  return {
    args,
    explicitMode,
  };
}

export function createViteHostPlan({
  argv = [],
  env = process.env,
  platform = process.platform,
  cwd = process.cwd(),
} = {}) {
  const inputArgs = Array.isArray(argv) ? [...argv] : [];
  const inferredCommand =
    inputArgs.length === 0 || String(inputArgs[0]).startsWith('-')
      ? 'serve'
      : String(inputArgs.shift());
  const { args: sanitizedArgs, explicitMode } = stripModeArg(inputArgs);
  const mode = normalizeViteMode(
    explicitMode ?? env.SDKWORK_VITE_MODE,
    resolveDefaultMode(inferredCommand),
  );

  return {
    command: platform === 'win32' ? 'vite.cmd' : 'vite',
    args: [inferredCommand, '--mode', mode, ...sanitizedArgs],
    cwd,
    env: {
      ...env,
      SDKWORK_VITE_MODE: mode,
    },
    shell: platform === 'win32',
  };
}

function runCli() {
  const plan = createViteHostPlan({
    argv: process.argv.slice(2),
  });
  const child = spawn(plan.command, plan.args, {
    cwd: plan.cwd,
    env: plan.env,
    stdio: 'inherit',
    shell: plan.shell,
  });

  child.on('error', (error) => {
    console.error(`[run-vite-host] ${error.message}`);
    process.exit(1);
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      console.error(`[run-vite-host] process exited with signal ${signal}`);
      process.exit(1);
    }
    process.exit(code ?? 0);
  });
}

if (path.resolve(process.argv[1] ?? '') === __filename) {
  runCli();
}
