import assert from 'node:assert/strict';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

import {
  ensureTauriDevBinaryUnlocked,
  resolveTauriDevBinaryPath,
} from './ensure-tauri-dev-binary-unlocked.mjs';

function withTempDir(callback) {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'tauri-dev-binary-unlocked-'));

  try {
    callback(tempDir);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

async function withTempDirAsync(callback) {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'tauri-dev-binary-unlocked-'));

  try {
    await callback(tempDir);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

async function waitFor(condition, timeoutMs = 5000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (condition()) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  throw new Error(`Timed out after ${timeoutMs}ms waiting for condition`);
}

if (process.platform !== 'win32') {
  console.log('ok - tauri dev binary unlock guard is only required on Windows');
  process.exit(0);
}

await (async () => {
  withTempDir((tempDir) => {
    const srcTauriDir = path.join(tempDir, 'src-tauri');
    const binaryName = 'tauri-dev-lock-test';
    const executablePath = resolveTauriDevBinaryPath(srcTauriDir, binaryName);

    mkdirSync(path.dirname(executablePath), { recursive: true });
    copyFileSync(process.execPath, executablePath);

    const result = ensureTauriDevBinaryUnlocked(srcTauriDir, binaryName);

    assert.equal(result.terminatedProcesses.length, 0, 'missing running process should not trigger termination');
    assert.equal(existsSync(executablePath), true, 'test executable should remain present');
  });

  await withTempDirAsync(async (tempDir) => {
    const srcTauriDir = path.join(tempDir, 'src-tauri');
    const binaryName = 'tauri-dev-lock-test';
    const executablePath = resolveTauriDevBinaryPath(srcTauriDir, binaryName);

    mkdirSync(path.dirname(executablePath), { recursive: true });
    copyFileSync(process.execPath, executablePath);

    const child = spawn(executablePath, ['-e', 'setInterval(() => {}, 1000);'], {
      stdio: 'ignore',
      windowsHide: true,
    });

    const cleanup = () => {
      try {
        process.kill(child.pid);
      } catch {}
    };

    try {
      await waitFor(() => {
        try {
          process.kill(child.pid, 0);
          return true;
        } catch {
          return false;
        }
      });

      const result = ensureTauriDevBinaryUnlocked(srcTauriDir, binaryName);
      assert.equal(result.terminatedProcesses.length, 1, 'running debug binary should be terminated');

      await waitFor(() => {
        try {
          process.kill(child.pid, 0);
          return false;
        } catch {
          return true;
        }
      });
    } finally {
      cleanup();
    }
  });
})();

console.log('ok - tauri dev binary unlock guard terminates only the matching debug executable');
