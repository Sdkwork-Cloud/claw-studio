#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);

function normalizeOutput(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function formatCommandDisplay(command, args = []) {
  return [command, ...args].join(' ').trim();
}

function formatInspectionFailure(inspection) {
  if (inspection.reason === 'not-found') {
    return `command was not found in PATH${inspection.error ? ` (${inspection.error})` : ''}`;
  }

  if (inspection.reason === 'non-zero-exit') {
    return inspection.error || `${formatCommandDisplay(inspection.command, inspection.args)} exited with a non-zero status`;
  }

  if (inspection.error) {
    return inspection.error;
  }

  return 'command inspection failed for an unknown reason';
}

export function inspectCommandAvailability(command, args = ['--version'], options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? process.cwd(),
    env: options.env ?? process.env,
    encoding: 'utf8',
    shell: false,
    windowsHide: true,
  });

  if (result.error) {
    return {
      available: false,
      command,
      args,
      reason: result.error.code === 'ENOENT' ? 'not-found' : 'spawn-error',
      error: result.error.message,
    };
  }

  const stdout = normalizeOutput(result.stdout);
  const stderr = normalizeOutput(result.stderr);
  if (result.status !== 0) {
    return {
      available: false,
      command,
      args,
      reason: 'non-zero-exit',
      error: stderr || stdout || `${formatCommandDisplay(command, args)} exited with status ${result.status ?? 'unknown'}`,
    };
  }

  return {
    available: true,
    command,
    args,
    stdout,
    stderr,
  };
}

export function buildMissingRustToolchainMessage(inspections) {
  const failedInspections = Array.isArray(inspections)
    ? inspections.filter((inspection) => inspection && inspection.available === false)
    : [];

  const missingCommands = failedInspections.map((inspection) => inspection.command).join(', ') || 'cargo, rustc';
  const detailLines = failedInspections.map((inspection) => {
    return `- ${inspection.command}: ${formatInspectionFailure(inspection)}`;
  });

  return [
    'Rust/Cargo toolchain is required for Claw Studio desktop development and builds.',
    `Missing command(s): ${missingCommands}`,
    ...(detailLines.length > 0 ? ['', 'Detected issue(s):', ...detailLines] : []),
    '',
    'Install Rust via rustup: https://rustup.rs/',
    'Restart the terminal after installation, then verify:',
    '- cargo --version',
    '- rustc --version',
    'If you only need the browser host right now, run: pnpm dev',
  ].join('\n');
}

export function ensureTauriRustToolchain({
  inspectCommand = inspectCommandAvailability,
  requiredCommands = ['cargo', 'rustc'],
} = {}) {
  const inspections = requiredCommands.map((command) => {
    return inspectCommand(command, ['--version']);
  });
  const failedInspections = inspections.filter((inspection) => inspection?.available === false);

  if (failedInspections.length > 0) {
    throw new Error(buildMissingRustToolchainMessage(failedInspections));
  }

  return inspections;
}

function main() {
  ensureTauriRustToolchain();
  console.log('ok - tauri rust toolchain available');
}

if (path.resolve(process.argv[1] ?? '') === __filename) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
