import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const WINDOWS_RELEASE_WAIT_TIMEOUT_MS = 15_000;
const WINDOWS_RELEASE_WAIT_INTERVAL_MS = 250;
const DEBUG_PREFIX = '[tauri-dev-unlock]';
const verboseDebugEnabled = ['1', 'true', 'yes', 'on'].includes(
  String(process.env.SDKWORK_TAURI_DEBUG ?? '').trim().toLowerCase(),
);

function debugLog(message, details) {
  if (!verboseDebugEnabled) {
    return;
  }

  const prefix = `${DEBUG_PREFIX} ${new Date().toISOString()} ${message}`;
  if (typeof details === 'undefined') {
    console.log(prefix);
    return;
  }

  console.log(prefix, details);
}

function escapePowerShellSingleQuoted(value) {
  return value.replace(/'/g, "''");
}

function sleepSync(delayMs) {
  if (!Number.isFinite(delayMs) || delayMs <= 0) {
    return;
  }

  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, delayMs);
}

export function resolveTauriDevBinaryPath(
  srcTauriDir = 'src-tauri',
  binaryName = 'sdkwork-claw-desktop',
  platform = process.platform,
  cargoTargetDir = process.env.CARGO_TARGET_DIR,
) {
  const targetRoot =
    typeof cargoTargetDir === 'string' && cargoTargetDir.trim().length > 0
      ? path.resolve(cargoTargetDir)
      : path.resolve(srcTauriDir, 'target');
  return path.resolve(
    targetRoot,
    'debug',
    platform === 'win32' ? `${binaryName}.exe` : binaryName,
  );
}

export function resolveTauriDevBundledRuntimeNodePath(
  srcTauriDir = 'src-tauri',
  platform = process.platform,
  cargoTargetDir = process.env.CARGO_TARGET_DIR,
) {
  const targetRoot =
    typeof cargoTargetDir === 'string' && cargoTargetDir.trim().length > 0
      ? path.resolve(cargoTargetDir)
      : path.resolve(srcTauriDir, 'target');

  return path.resolve(
    targetRoot,
    'debug',
    'resources',
    'openclaw-runtime',
    'runtime',
    'node',
    platform === 'win32' ? 'node.exe' : path.join('bin', 'node'),
  );
}

function resolveLockedExecutablePaths(
  srcTauriDir = 'src-tauri',
  binaryName = 'sdkwork-claw-desktop',
  platform = process.platform,
  cargoTargetDir = process.env.CARGO_TARGET_DIR,
) {
  return [
    resolveTauriDevBinaryPath(srcTauriDir, binaryName, platform, cargoTargetDir),
    resolveTauriDevBundledRuntimeNodePath(srcTauriDir, platform, cargoTargetDir),
  ].filter((value, index, items) => items.indexOf(value) === index);
}

function resolveLegacyTauriDevBinaryPath(
  srcTauriDir = 'src-tauri',
  binaryName = 'sdkwork-claw-desktop',
  platform = process.platform,
) {
  return path.resolve(
    srcTauriDir,
    'target-dev',
    'debug',
    platform === 'win32' ? `${binaryName}.exe` : binaryName,
  );
}

function listWindowsProcessesForBinary(executablePath) {
  const normalizedExecutablePath = path.resolve(executablePath);
  const escapedExecutablePath = escapePowerShellSingleQuoted(normalizedExecutablePath);
  const command = [
    `$target = '${escapedExecutablePath}'`,
    `$items = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object { $_.ExecutablePath -and ([System.IO.Path]::GetFullPath($_.ExecutablePath) -ieq $target) } | Select-Object @{ Name = 'Id'; Expression = { [int]$_.ProcessId } }, @{ Name = 'ProcessName'; Expression = { $_.Name } }, @{ Name = 'Path'; Expression = { $_.ExecutablePath } }`,
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
    debugLog('failed to inspect Windows processes for executable path', {
      executablePath: normalizedExecutablePath,
      status: result.status,
      stderr: result.stderr?.trim() || null,
      stdout: result.stdout?.trim() || null,
    });
    return [];
  }

  const stdout = result.stdout.trim();
  if (stdout.length === 0) {
    return [];
  }

  try {
    const parsed = JSON.parse(stdout);
    const processes = Array.isArray(parsed) ? parsed : [parsed];
    return processes.filter((item) => Number.isFinite(item?.Id) && item.Id > 0);
  } catch (error) {
    debugLog('failed to parse Windows process inspection result', {
      executablePath: normalizedExecutablePath,
      stdout,
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

function listWindowsServicesForBinary(executablePath) {
  const normalizedExecutablePath = path.resolve(executablePath);
  const escapedExecutablePath = escapePowerShellSingleQuoted(normalizedExecutablePath);
  const command = [
    `$target = '${escapedExecutablePath}'`,
    `$processMap = @{}`,
    `Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | ForEach-Object { if ($_.ExecutablePath) { try { $processMap[[int]$_.ProcessId] = [System.IO.Path]::GetFullPath($_.ExecutablePath) } catch {} } }`,
    `$items = Get-CimInstance Win32_Service -ErrorAction SilentlyContinue | Where-Object { $_.State -eq 'Running' -and $_.ProcessId -and $processMap.ContainsKey([int]$_.ProcessId) -and ($processMap[[int]$_.ProcessId] -ieq $target) } | Select-Object Name,DisplayName,State,PathName,ProcessId,AcceptStop`,
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
    debugLog('failed to inspect Windows services for executable path', {
      executablePath: normalizedExecutablePath,
      status: result.status,
      stderr: result.stderr?.trim() || null,
      stdout: result.stdout?.trim() || null,
    });
    return [];
  }

  const stdout = result.stdout.trim();
  if (stdout.length === 0) {
    return [];
  }

  try {
    const parsed = JSON.parse(stdout);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch (error) {
    debugLog('failed to parse Windows service inspection result', {
      executablePath: normalizedExecutablePath,
      stdout,
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
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

  if (!waitForWindowsProcessExit(pid)) {
    throw new Error(`Timed out waiting for locked Tauri dev process ${pid} to exit.`);
  }
}

function stopWindowsService(serviceName, serviceProcessId = null) {
  const normalizedProcessId =
    typeof serviceProcessId === 'number'
      ? serviceProcessId
      : Number.parseInt(String(serviceProcessId || ''), 10);
  const escapedServiceName = escapePowerShellSingleQuoted(serviceName);
  const command = `Stop-Service -Name '${escapedServiceName}' -ErrorAction Stop`;
  const result = spawnSync(
    'powershell',
    ['-NoProfile', '-NonInteractive', '-Command', command],
    {
      encoding: 'utf8',
      windowsHide: true,
    },
  );

  if (result.status !== 0) {
    if (Number.isFinite(normalizedProcessId) && normalizedProcessId > 0) {
      try {
        stopWindowsProcess(normalizedProcessId);
      } catch {
        // Fall through to the state check below when the service process is already gone.
      }
    }

    const state = readWindowsServiceState(serviceName);
    if (state !== 'Running') {
      return;
    }

    throw new Error(
      `Failed to stop locked Tauri dev service ${serviceName}: ${result.stderr || result.stdout}`.trim(),
    );
  }

  if (!waitForWindowsServiceStop(serviceName)) {
    if (Number.isFinite(normalizedProcessId) && normalizedProcessId > 0) {
      stopWindowsProcess(normalizedProcessId);
    }

    if (!waitForWindowsServiceStop(serviceName)) {
      const state = readWindowsServiceState(serviceName) ?? 'unknown';
      throw new Error(
        `Timed out waiting for locked Tauri dev service ${serviceName} to stop (state: ${state}).`,
      );
    }
  }

  if (Number.isFinite(normalizedProcessId) && normalizedProcessId > 0 && isWindowsProcessRunning(normalizedProcessId)) {
    stopWindowsProcess(normalizedProcessId);
  }
}

function deleteWindowsService(serviceName, serviceProcessId = null) {
  const result = spawnSync('sc.exe', ['delete', serviceName], {
    encoding: 'utf8',
    windowsHide: true,
  });

  const output = `${result.stdout || ''}${result.stderr || ''}`;
  if (result.status !== 0 && !/does not exist/i.test(output)) {
    throw new Error(
      `Failed to delete locked Tauri dev service ${serviceName}: ${output}`.trim(),
    );
  }

  const normalizedProcessId =
    typeof serviceProcessId === 'number'
      ? serviceProcessId
      : Number.parseInt(String(serviceProcessId || ''), 10);
  if (Number.isFinite(normalizedProcessId) && normalizedProcessId > 0 && isWindowsProcessRunning(normalizedProcessId)) {
    stopWindowsProcess(normalizedProcessId);
  }

  if (!waitForWindowsServiceRemoval(serviceName)) {
    throw new Error(`Timed out waiting for locked Tauri dev service ${serviceName} to be deleted.`);
  }
}

function readWindowsServiceState(serviceName) {
  const escapedServiceName = escapePowerShellSingleQuoted(serviceName);
  const command = [
    `$service = Get-Service -Name '${escapedServiceName}' -ErrorAction SilentlyContinue`,
    `if ($null -eq $service) { '' } else { $service.Status.ToString() }`,
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
    return null;
  }

  return result.stdout.trim() || null;
}

function isWindowsProcessRunning(pid) {
  const command = [
    `$process = Get-CimInstance Win32_Process -Filter "ProcessId = ${pid}" -ErrorAction SilentlyContinue`,
    `if ($null -eq $process) { 'false' } else { 'true' }`,
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
      `Failed to inspect Tauri dev process ${pid}: ${result.stderr || result.stdout}`.trim(),
    );
  }

  return result.stdout.trim().toLowerCase() === 'true';
}

function waitForWindowsProcessExit(
  pid,
  timeoutMs = WINDOWS_RELEASE_WAIT_TIMEOUT_MS,
  intervalMs = WINDOWS_RELEASE_WAIT_INTERVAL_MS,
) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() <= deadline) {
    if (!isWindowsProcessRunning(pid)) {
      return true;
    }

    sleepSync(intervalMs);
  }

  return !isWindowsProcessRunning(pid);
}

function waitForWindowsServiceStop(
  serviceName,
  timeoutMs = WINDOWS_RELEASE_WAIT_TIMEOUT_MS,
  intervalMs = WINDOWS_RELEASE_WAIT_INTERVAL_MS,
) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() <= deadline) {
    const state = readWindowsServiceState(serviceName);
    if (state === null || state === 'Stopped') {
      return true;
    }

    sleepSync(intervalMs);
  }

  const state = readWindowsServiceState(serviceName);
  return state === null || state === 'Stopped';
}

function waitForWindowsServiceRemoval(
  serviceName,
  timeoutMs = WINDOWS_RELEASE_WAIT_TIMEOUT_MS,
  intervalMs = WINDOWS_RELEASE_WAIT_INTERVAL_MS,
) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() <= deadline) {
    if (readWindowsServiceState(serviceName) === null) {
      return true;
    }

    sleepSync(intervalMs);
  }

  return readWindowsServiceState(serviceName) === null;
}

export function ensureTauriDevBinaryUnlocked(
  srcTauriDir = 'src-tauri',
  binaryName = 'sdkwork-claw-desktop',
  platform = process.platform,
  options = {},
) {
  const executablePath = resolveTauriDevBinaryPath(
    srcTauriDir,
    binaryName,
    platform,
    options.cargoTargetDir ?? process.env.CARGO_TARGET_DIR,
  );
  const lockedExecutablePaths = resolveLockedExecutablePaths(
    srcTauriDir,
    binaryName,
    platform,
    options.cargoTargetDir ?? process.env.CARGO_TARGET_DIR,
  );
  const listProcesses = options.listWindowsProcessesForBinary ?? listWindowsProcessesForBinary;
  const stopProcess = options.stopWindowsProcess ?? stopWindowsProcess;
  const isProcessRunning = options.isWindowsProcessRunning ?? isWindowsProcessRunning;
  const listServices = options.listWindowsServicesForBinary ?? listWindowsServicesForBinary;
  const stopService = options.stopWindowsService ?? stopWindowsService;
  const removeService = options.deleteWindowsService ?? deleteWindowsService;
  const legacyExecutablePath = resolveLegacyTauriDevBinaryPath(srcTauriDir, binaryName, platform);

  debugLog('starting binary unlock inspection', {
    srcTauriDir: path.resolve(srcTauriDir),
    binaryName,
    platform,
    cargoTargetDir: options.cargoTargetDir ?? process.env.CARGO_TARGET_DIR ?? null,
    executablePath,
    legacyExecutablePath,
  });

  if (platform !== 'win32') {
    return {
      executablePath,
      legacyExecutablePath,
      runningServices: [],
      terminatedServices: [],
      runningProcesses: [],
      terminatedProcesses: [],
      skipped: 'unsupported-platform',
    };
  }

  const existingExecutablePaths = lockedExecutablePaths.filter((candidatePath) => existsSync(candidatePath));
  debugLog('resolved executable candidates', {
    lockedExecutablePaths,
    existingExecutablePaths,
    legacyExecutablePath,
    legacyExecutableExists: existsSync(legacyExecutablePath),
  });

  if (existingExecutablePaths.length === 0) {
    return {
      executablePath,
      legacyExecutablePath,
      inspectedExecutablePaths: [],
      runningServices: [],
      terminatedServices: [],
      runningProcesses: [],
      terminatedProcesses: [],
      skipped: 'binary-missing',
    };
  }

  const runningServices = listServices(executablePath);
  const terminatedServices = [];
  for (const serviceInfo of runningServices) {
    stopService(serviceInfo.Name, serviceInfo.ProcessId);
    removeService(serviceInfo.Name, serviceInfo.ProcessId);
    terminatedServices.push(serviceInfo);
  }

  const runningProcesses = [];
  const terminatedProcesses = [];

  for (const candidatePath of existingExecutablePaths) {
    const matchingProcesses = listProcesses(candidatePath);
    runningProcesses.push(...matchingProcesses);

    for (const processInfo of matchingProcesses) {
      try {
        stopProcess(processInfo.Id);
      } catch (error) {
        if (isProcessRunning(processInfo.Id)) {
          throw error;
        }
      }
      terminatedProcesses.push(processInfo);
    }
  }

  return {
    executablePath,
    legacyExecutablePath,
    inspectedExecutablePaths: existingExecutablePaths,
    runningServices,
    terminatedServices,
    runningProcesses,
    terminatedProcesses,
    skipped: false,
  };
}

function runCli() {
  const srcTauriDir = process.argv[2] ?? 'src-tauri';
  const binaryName = process.argv[3] ?? 'sdkwork-claw-desktop';
  const result = ensureTauriDevBinaryUnlocked(srcTauriDir, binaryName);
  debugLog('binary unlock result', result);

  if (result.skipped === 'unsupported-platform') {
    console.log(`Skipping Tauri dev binary unlock on unsupported platform ${process.platform}.`);
    return;
  }

  if (result.skipped === 'binary-missing') {
    console.log(`No built Tauri dev binary found at ${result.executablePath}; continuing.`);
    return;
  }

  if (result.terminatedServices.length > 0 || result.terminatedProcesses.length > 0) {
    console.log(
      `Stopped ${result.terminatedServices.length} locked Tauri dev service(s) and ${result.terminatedProcesses.length} locked Tauri dev process(es) for ${result.executablePath}.`,
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
