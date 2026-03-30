import { existsSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

function escapePowerShellSingleQuoted(value) {
  return value.replace(/'/g, "''");
}

export function resolveTauriDevBinaryPath(
  srcTauriDir = 'src-tauri',
  binaryName = 'sdkwork-claw-desktop',
  platform = process.platform,
) {
  return path.resolve(
    srcTauriDir,
    'target',
    'debug',
    platform === 'win32' ? `${binaryName}.exe` : binaryName,
  );
}

function listWindowsProcessesForBinary(executablePath) {
  const normalizedExecutablePath = path.resolve(executablePath);
  const escapedExecutablePath = escapePowerShellSingleQuoted(normalizedExecutablePath);
  const processName = escapePowerShellSingleQuoted(path.parse(normalizedExecutablePath).name);
  const command = [
    `$target = '${escapedExecutablePath}'`,
    `$items = Get-Process -Name '${processName}' -ErrorAction SilentlyContinue | Where-Object { $_.Path -and ([System.IO.Path]::GetFullPath($_.Path) -ieq $target) } | Select-Object Id,ProcessName,Path`,
    `if ($null -eq $items) { '[]' } else { $items | ConvertTo-Json -Compress }`,
  ].join('; ');
  const result = spawnSync(
    'powershell',
    ['-NoProfile', '-NonInteractive', '-Command', command],
    {
      encoding: 'utf8',
      windowsHide: true,
    },
  );

  if (result.status !== 0) {
    throw new Error(
      `Failed to inspect Tauri dev binary locks for ${normalizedExecutablePath}: ${result.stderr || result.stdout}`.trim(),
    );
  }

  const stdout = result.stdout.trim();
  if (stdout.length === 0) {
    return [];
  }

  const parsed = JSON.parse(stdout);
  return Array.isArray(parsed) ? parsed : [parsed];
}

function stopWindowsProcess(pid) {
  const result = spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], {
    encoding: 'utf8',
    windowsHide: true,
  });

  if (result.status !== 0) {
    throw new Error(
      `Failed to stop locked Tauri dev process ${pid}: ${result.stderr || result.stdout}`.trim(),
    );
  }
}

export function ensureTauriDevBinaryUnlocked(
  srcTauriDir = 'src-tauri',
  binaryName = 'sdkwork-claw-desktop',
  platform = process.platform,
) {
  const executablePath = resolveTauriDevBinaryPath(srcTauriDir, binaryName, platform);

  if (platform !== 'win32') {
    return {
      executablePath,
      runningProcesses: [],
      terminatedProcesses: [],
      skipped: 'unsupported-platform',
    };
  }

  if (!existsSync(executablePath)) {
    return {
      executablePath,
      runningProcesses: [],
      terminatedProcesses: [],
      skipped: 'binary-missing',
    };
  }

  const runningProcesses = listWindowsProcessesForBinary(executablePath);
  const terminatedProcesses = [];

  for (const processInfo of runningProcesses) {
    stopWindowsProcess(processInfo.Id);
    terminatedProcesses.push(processInfo);
  }

  return {
    executablePath,
    runningProcesses,
    terminatedProcesses,
    skipped: false,
  };
}

function runCli() {
  const srcTauriDir = process.argv[2] ?? 'src-tauri';
  const binaryName = process.argv[3] ?? 'sdkwork-claw-desktop';
  const result = ensureTauriDevBinaryUnlocked(srcTauriDir, binaryName);

  if (result.skipped === 'unsupported-platform') {
    console.log(`Skipping Tauri dev binary unlock on unsupported platform ${process.platform}.`);
    return;
  }

  if (result.skipped === 'binary-missing') {
    console.log(`No built Tauri dev binary found at ${result.executablePath}; continuing.`);
    return;
  }

  if (result.terminatedProcesses.length > 0) {
    console.log(
      `Stopped ${result.terminatedProcesses.length} locked Tauri dev process(es) for ${result.executablePath}.`,
    );
    return;
  }

  console.log(`No running Tauri dev binary lock detected for ${result.executablePath}.`);
}

const invokedScriptPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
const currentModulePath = fileURLToPath(import.meta.url);

if (invokedScriptPath && invokedScriptPath === currentModulePath) {
  runCli();
}
