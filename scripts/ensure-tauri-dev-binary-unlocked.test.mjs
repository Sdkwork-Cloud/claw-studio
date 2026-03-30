import assert from 'node:assert/strict';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
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

      const result = ensureTauriDevBinaryUnlocked(srcTauriDir, binaryName, 'win32', {
        listWindowsServicesForBinary() {
          return [];
        },
        listWindowsProcessesForBinary(targetPath) {
          assert.equal(
            targetPath,
            executablePath,
            'unlock guard must inspect the running debug executable path',
          );
          return [{ Id: child.pid, ProcessName: path.parse(executablePath).name, Path: executablePath }];
        },
      });
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

  withTempDir((tempDir) => {
    const srcTauriDir = path.join(tempDir, 'src-tauri');
    const binaryName = 'tauri-dev-lock-test';
    const executablePath = resolveTauriDevBinaryPath(srcTauriDir, binaryName);
    const operations = [];

    mkdirSync(path.dirname(executablePath), { recursive: true });
    copyFileSync(process.execPath, executablePath);

    const result = ensureTauriDevBinaryUnlocked(srcTauriDir, binaryName, 'win32', {
      listWindowsServicesForBinary() {
        operations.push('list-services');
        return [{ Name: 'ClawStudioOpenClawKernel' }];
      },
      stopWindowsService(serviceName) {
        operations.push(`stop-service:${serviceName}`);
      },
      deleteWindowsService(serviceName) {
        operations.push(`delete-service:${serviceName}`);
      },
      listWindowsProcessesForBinary() {
        operations.push('list-processes');
        return [{ Id: 4242 }];
      },
      stopWindowsProcess(pid) {
        operations.push(`stop-process:${pid}`);
      },
    });

    assert.deepEqual(
      operations,
        [
          'list-services',
          'stop-service:ClawStudioOpenClawKernel',
          'delete-service:ClawStudioOpenClawKernel',
          'list-processes',
          'stop-process:4242',
        ],
      'unlock guard must remove matching Windows services before terminating the locked executable',
    );
    assert.equal(result.terminatedServices.length, 1, 'matching Windows services should be reported');
    assert.equal(result.terminatedProcesses.length, 1, 'matching Windows processes should be reported');
  });

  withTempDir((tempDir) => {
    const srcTauriDir = path.join(tempDir, 'src-tauri');
    const binaryName = 'tauri-dev-lock-test';
    const cargoTargetDir = path.join(tempDir, 'custom-target');
    const executablePath = resolveTauriDevBinaryPath(srcTauriDir, binaryName, 'win32', cargoTargetDir);

    mkdirSync(path.dirname(executablePath), { recursive: true });
    copyFileSync(process.execPath, executablePath);

    const result = ensureTauriDevBinaryUnlocked(srcTauriDir, binaryName, 'win32', {
      cargoTargetDir,
      listWindowsServicesForBinary(targetPath) {
        assert.equal(targetPath, executablePath, 'unlock guard must inspect the overridden cargo target path');
        return [];
      },
      stopWindowsService() {
        assert.fail('no service stop should be attempted for the path override test');
      },
      listWindowsProcessesForBinary(targetPath) {
        assert.equal(targetPath, executablePath, 'unlock guard must inspect the overridden cargo target path');
        return [];
      },
      stopWindowsProcess() {
        assert.fail('no process stop should be attempted for the path override test');
      },
    });

    assert.equal(result.executablePath, executablePath, 'unlock guard must resolve the overridden cargo target path');
  });

  withTempDir((tempDir) => {
    const srcTauriDir = path.join(tempDir, 'src-tauri');
    const binaryName = 'tauri-dev-lock-test';
    const cargoTargetDir = path.join(tempDir, 'custom-target');
    const executablePath = resolveTauriDevBinaryPath(srcTauriDir, binaryName, 'win32', cargoTargetDir);
    const runtimeNodePath = path.join(
      cargoTargetDir,
      'debug',
      'resources',
      'openclaw-runtime',
      'runtime',
      'node',
      'node.exe',
    );
    const inspectedPaths = [];
    const stoppedPids = [];

    mkdirSync(path.dirname(executablePath), { recursive: true });
    mkdirSync(path.dirname(runtimeNodePath), { recursive: true });
    copyFileSync(process.execPath, executablePath);
    copyFileSync(process.execPath, runtimeNodePath);

    const result = ensureTauriDevBinaryUnlocked(srcTauriDir, binaryName, 'win32', {
      cargoTargetDir,
      listWindowsServicesForBinary() {
        return [];
      },
      listWindowsProcessesForBinary(targetPath) {
        inspectedPaths.push(targetPath);
        if (targetPath === runtimeNodePath) {
          return [{ Id: 5150, ProcessName: 'node', Path: runtimeNodePath }];
        }
        return [];
      },
      stopWindowsProcess(pid) {
        stoppedPids.push(pid);
      },
    });

    assert.deepEqual(
      inspectedPaths,
      [executablePath, runtimeNodePath],
      'unlock guard must inspect both the desktop binary and bundled OpenClaw runtime node executable',
    );
    assert.deepEqual(stoppedPids, [5150], 'unlock guard must terminate the locked bundled OpenClaw runtime process');
    assert.equal(result.terminatedProcesses.length, 1, 'locked bundled OpenClaw runtime processes should be reported');
  });

  withTempDir((tempDir) => {
    const srcTauriDir = path.join(tempDir, 'src-tauri');
    const binaryName = 'tauri-dev-lock-test';
    const cargoTargetDir = path.join(tempDir, 'custom-target');
    const executablePath = resolveTauriDevBinaryPath(srcTauriDir, binaryName, 'win32', cargoTargetDir);

    mkdirSync(path.dirname(executablePath), { recursive: true });
    copyFileSync(process.execPath, executablePath);

    const result = ensureTauriDevBinaryUnlocked(srcTauriDir, binaryName, 'win32', {
      cargoTargetDir,
      listWindowsServicesForBinary() {
        return [];
      },
      listWindowsProcessesForBinary(targetPath) {
        if (targetPath === executablePath) {
          return [{ Id: 6262, ProcessName: path.parse(executablePath).name, Path: executablePath }];
        }
        return [];
      },
      stopWindowsProcess() {
        throw new Error('process already exited');
      },
      isWindowsProcessRunning() {
        return false;
      },
    });

    assert.equal(
      result.terminatedProcesses.length,
      1,
      'unlock guard should tolerate races where the locked process exits before taskkill runs',
    );
  });

  const unlockScriptSource = readFileSync(
    new URL('./ensure-tauri-dev-binary-unlocked.mjs', import.meta.url),
    'utf8',
  );
  assert.equal(
    unlockScriptSource.includes("spawnSync('tasklist'"),
    false,
    'unlock guard must not fall back to image-name-only tasklist matching, which can terminate unrelated node.exe processes',
  );
  assert.equal(
    unlockScriptSource.includes('Get-CimInstance Win32_Process'),
    true,
    'unlock guard must inspect Windows processes by exact ExecutablePath instead of image name',
  );
})();

console.log('ok - tauri dev binary unlock guard terminates only the matching debug executable');
