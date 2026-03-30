import { spawnSync } from 'node:child_process';
import net from 'node:net';

const [host = '127.0.0.1', portValue = '1420'] = process.argv.slice(2);
const port = Number(portValue);
const retryCount = 10;
const retryDelayMs = 1000;
const LEGACY_STATIC_WEB_DIST_SERVER_FRAGMENT = 'run-claw-web-dist-server.mjs';

if (!Number.isInteger(port) || port <= 0 || port > 65535) {
  console.error(`Invalid port "${portValue}".`);
  process.exit(1);
}

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function runWindowsPowerShell(command) {
  const result = spawnSync(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-Command', command],
    {
      encoding: 'utf8',
      windowsHide: true,
    },
  );

  if (result.error) {
    throw result.error;
  }

  if (typeof result.status === 'number' && result.status !== 0) {
    const stderr = String(result.stderr ?? '').trim();
    throw new Error(stderr || `PowerShell command failed with exit ${result.status}.`);
  }

  return String(result.stdout ?? '');
}

function listWindowsListeningProcessIds(targetPort) {
  const rawOutput = runWindowsPowerShell(
    `Get-NetTCPConnection -LocalPort ${targetPort} -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess`,
  );

  return rawOutput
    .split(/\r?\n/)
    .map((value) => Number.parseInt(value.trim(), 10))
    .filter((value, index, items) => Number.isInteger(value) && value > 0 && items.indexOf(value) === index);
}

function readWindowsProcessCommandLine(processId) {
  const escapedFilter = `ProcessId = ${processId}`;
  return runWindowsPowerShell(
    `Get-CimInstance Win32_Process -Filter "${escapedFilter}" -ErrorAction SilentlyContinue | Select-Object -ExpandProperty CommandLine`,
  ).trim();
}

function killWindowsProcessTree(processId) {
  const result = spawnSync('taskkill.exe', ['/PID', String(processId), '/T', '/F'], {
    encoding: 'utf8',
    windowsHide: true,
  });

  if (result.error) {
    throw result.error;
  }

  if (typeof result.status === 'number' && result.status !== 0) {
    const stderr = String(result.stderr ?? '').trim();
    throw new Error(stderr || `taskkill failed with exit ${result.status}.`);
  }
}

function clearLegacyStaticWebDistServerBlockers() {
  if (process.platform !== 'win32') {
    return false;
  }

  let cleared = false;

  for (const processId of listWindowsListeningProcessIds(port)) {
    const commandLine = readWindowsProcessCommandLine(processId);

    if (!commandLine.includes(LEGACY_STATIC_WEB_DIST_SERVER_FRAGMENT)) {
      continue;
    }

    console.warn(
      `Removing stale legacy Tauri dev blocker on ${host}:${port}: pid ${processId} (${commandLine})`,
    );
    killWindowsProcessTree(processId);
    cleared = true;
  }

  return cleared;
}

function tryBindPort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();

    server.once('error', (error) => {
      server.close(() => {
        if (error && typeof error === 'object' && 'code' in error && error.code === 'EADDRINUSE') {
          resolve(false);
          return;
        }

        reject(error);
      });
    });

    server.listen(port, host, () => {
      server.close((closeError) => {
        if (closeError) {
          reject(closeError);
          return;
        }

        resolve(true);
      });
    });
  });
}

async function main() {
  for (let attempt = 1; attempt <= retryCount; attempt += 1) {
    try {
      const available = await tryBindPort();
      if (available) {
        console.log(`Tauri dev port ${host}:${port} is available.`);
        return;
      }

      if (clearLegacyStaticWebDistServerBlockers()) {
        await wait(retryDelayMs);
        continue;
      }
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }

    if (attempt < retryCount) {
      await wait(retryDelayMs);
    }
  }

  console.error(`Tauri dev port ${host}:${port} is already in use. Stop the existing server and retry.`);
  process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
