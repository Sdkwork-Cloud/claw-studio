#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import {
  ensureTauriRustToolchain,
  withRustToolchainPath,
} from './ensure-tauri-rust-toolchain.mjs';

const __filename = fileURLToPath(import.meta.url);

function main() {
  const cargoArgs = process.argv.slice(2);

  if (cargoArgs.length === 0) {
    console.error('Usage: node scripts/run-cargo.mjs <cargo-args...>');
    process.exit(1);
  }

  ensureTauriRustToolchain();

  const env = withRustToolchainPath(process.env);
  const result = spawnSync('cargo', cargoArgs, {
    cwd: process.cwd(),
    env,
    stdio: 'inherit',
    shell: false,
    windowsHide: true,
  });

  if (result.error) {
    throw result.error;
  }

  process.exit(result.status ?? 1);
}

if (path.resolve(process.argv[1] ?? '') === __filename) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
