import assert from 'node:assert/strict';

import {
  buildMissingRustToolchainMessage,
  ensureTauriRustToolchain,
} from './ensure-tauri-rust-toolchain.mjs';

const successfulChecks = [];
const successResult = ensureTauriRustToolchain({
  inspectCommand(command, args) {
    successfulChecks.push({ command, args });
    return {
      available: true,
      command,
      stdout: `${command} 1.90.0`,
    };
  },
});

assert.deepEqual(
  successfulChecks,
  [
    { command: 'cargo', args: ['--version'] },
    { command: 'rustc', args: ['--version'] },
  ],
  'Rust toolchain guard should verify both cargo and rustc with --version',
);
assert.equal(successResult.length, 2, 'Rust toolchain guard should return successful inspections');

let missingToolError;
try {
  ensureTauriRustToolchain({
    inspectCommand(command) {
      if (command === 'cargo') {
        return {
          available: false,
          command,
          reason: 'not-found',
          error: 'spawnSync cargo ENOENT',
        };
      }

      return {
        available: true,
        command,
        stdout: 'rustc 1.90.0',
      };
    },
  });
} catch (error) {
  missingToolError = error;
}

assert.ok(missingToolError instanceof Error, 'Missing cargo should fail the Rust toolchain guard');
assert.match(
  missingToolError.message,
  /Rust\/Cargo toolchain is required for Claw Studio desktop development and builds\./,
);
assert.match(missingToolError.message, /Missing command\(s\): cargo/);
assert.match(missingToolError.message, /Install Rust via rustup: https:\/\/rustup\.rs\//);
assert.match(missingToolError.message, /cargo --version/);
assert.match(missingToolError.message, /rustc --version/);

const friendlyMessage = buildMissingRustToolchainMessage([
  {
    available: false,
    command: 'cargo',
    reason: 'not-found',
    error: 'spawnSync cargo ENOENT',
  },
  {
    available: false,
    command: 'rustc',
    reason: 'not-found',
    error: 'spawnSync rustc ENOENT',
  },
]);

assert.match(friendlyMessage, /Missing command\(s\): cargo, rustc/);
assert.match(friendlyMessage, /Restart the terminal after installation/);

console.log('ok - tauri rust toolchain guard reports actionable errors and passes when cargo and rustc exist');
