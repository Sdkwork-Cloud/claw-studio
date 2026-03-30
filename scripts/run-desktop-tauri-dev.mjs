import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const desktopDir = path.join(rootDir, 'packages', 'sdkwork-claw-desktop');
const srcTauriDir = path.join(desktopDir, 'src-tauri');
const cargoTargetDir = path.join(desktopDir, '.tauri-target', 'dev');
const nodeCommand = process.execPath;
const tauriCommand = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const pathDelimiter = process.platform === 'win32' ? ';' : ':';
const DEBUG_PREFIX = '[tauri-dev-debug]';

function isTruthyEnv(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value ?? '').trim().toLowerCase());
}

const verboseDebugEnabled = isTruthyEnv(process.env.SDKWORK_TAURI_DEBUG);

function logDebug(message, details) {
  const prefix = `${DEBUG_PREFIX} ${new Date().toISOString()} ${message}`;
  if (typeof details === 'undefined') {
    console.log(prefix);
    return;
  }

  console.log(prefix, details);
}

function summarizeRelevantEnv(env = process.env) {
  return {
    SDKWORK_TAURI_DEBUG: env.SDKWORK_TAURI_DEBUG ?? null,
    CARGO_TARGET_DIR: env.CARGO_TARGET_DIR ?? null,
    CARGO_HOME: env.CARGO_HOME ?? null,
    RUSTUP_HOME: env.RUSTUP_HOME ?? null,
    OPENCLAW_CONTROL_UI_CONFIG_PATH: env.OPENCLAW_CONTROL_UI_CONFIG_PATH ?? null,
    OPENCLAW_PREPARE_CACHE_DIR: env.OPENCLAW_PREPARE_CACHE_DIR ?? null,
    npm_config_cache: env.npm_config_cache ?? null,
    TAURI_ENV_DEBUG: env.TAURI_ENV_DEBUG ?? null,
    SDKWORK_TAURI_ISOLATE_CONSOLE: env.SDKWORK_TAURI_ISOLATE_CONSOLE ?? null,
  };
}

function resolveOpenClawControlUiConfigPath() {
  return path.join(cargoTargetDir, 'debug', 'user', 'openclaw-home', '.openclaw', 'openclaw.json');
}

function resolveCargoExecutableName(platform = process.platform) {
  return platform === 'win32' ? 'cargo.exe' : 'cargo';
}

function uniqueExistingPaths(candidates) {
  const seen = new Set();
  const resolved = [];

  for (const candidate of candidates) {
    if (typeof candidate !== 'string' || candidate.trim().length === 0) {
      continue;
    }

    const normalizedCandidate = path.resolve(candidate);
    if (!existsSync(normalizedCandidate) || seen.has(normalizedCandidate)) {
      continue;
    }

    seen.add(normalizedCandidate);
    resolved.push(normalizedCandidate);
  }

  return resolved;
}

function resolveRustCargoBinCandidates(env = process.env) {
  const homeDir = env.USERPROFILE ?? env.HOME ?? null;
  const cargoHome = env.CARGO_HOME ?? (homeDir ? path.join(homeDir, '.cargo') : null);

  return uniqueExistingPaths([
    cargoHome ? path.join(cargoHome, 'bin') : null,
    homeDir ? path.join(homeDir, '.cargo', 'bin') : null,
  ]).filter((candidatePath) =>
    existsSync(path.join(candidatePath, resolveCargoExecutableName())),
  );
}

function createExecutableSearchPath(env = process.env, prependEntries = []) {
  const existingEntries = typeof env.PATH === 'string' && env.PATH.trim().length > 0
    ? env.PATH.split(pathDelimiter).filter(Boolean)
    : [];

  return [...uniqueExistingPaths(prependEntries), ...existingEntries]
    .filter((value, index, items) => items.indexOf(value) === index)
    .join(pathDelimiter);
}

function createTauriCommandEnv(sharedEnv, env = process.env) {
  const cargoBinCandidates = resolveRustCargoBinCandidates(env);
  const homeDir = env.USERPROFILE ?? env.HOME ?? null;
  const resolvedCargoHome =
    env.CARGO_HOME ??
    (homeDir && existsSync(path.join(homeDir, '.cargo')) ? path.join(homeDir, '.cargo') : null);
  const resolvedRustupHome =
    env.RUSTUP_HOME ??
    (homeDir && existsSync(path.join(homeDir, '.rustup')) ? path.join(homeDir, '.rustup') : null);

  return {
    ...sharedEnv,
    ...(resolvedCargoHome ? { CARGO_HOME: resolvedCargoHome } : {}),
    ...(resolvedRustupHome ? { RUSTUP_HOME: resolvedRustupHome } : {}),
    PATH: createExecutableSearchPath(env, cargoBinCandidates),
  };
}

function stopChildProcess(child) {
  if (!child.pid) {
    return;
  }

  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
      stdio: 'ignore',
      windowsHide: true,
    });
    return;
  }

  child.kill('SIGTERM');
}

async function runCommand(command, args, options = {}) {
  const description = options.label ?? `${command} ${args.join(' ')}`;
  const startedAt = Date.now();
  logDebug(`starting ${description}`, {
    cwd: options.cwd ?? rootDir,
    isolateConsole: Boolean(options.isolateConsole),
    detached: Boolean(options.isolateConsole),
  });
  if (verboseDebugEnabled) {
    logDebug(`command details for ${description}`, {
      command,
      args,
      env: summarizeRelevantEnv({
        ...process.env,
        ...(options.env ?? {}),
      }),
    });
  }

  await new Promise((resolve, reject) => {
    const useWindowsShell =
      process.platform === 'win32' &&
      ['.cmd', '.bat'].includes(path.extname(command).toLowerCase());
    const stdio = options.isolateConsole ? ['ignore', 'pipe', 'pipe'] : 'inherit';
    const child = spawn(command, args, {
      cwd: options.cwd ?? rootDir,
      env: {
        ...process.env,
        ...(options.env ?? {}),
      },
      stdio,
      shell: useWindowsShell,
      windowsHide: true,
      detached: Boolean(options.isolateConsole),
    });

    child.on('spawn', () => {
      logDebug(`spawned ${description}`, {
        pid: child.pid ?? null,
      });
    });

    if (options.isolateConsole) {
      child.stdout?.on('data', (chunk) => {
        process.stdout.write(chunk);
      });
      child.stderr?.on('data', (chunk) => {
        process.stderr.write(chunk);
      });
    }

    let settled = false;
    const signalHandlers = new Map();

    function finalize(callback) {
      return (value) => {
        if (settled) {
          return;
        }
        settled = true;
        for (const [signal, handler] of signalHandlers) {
          process.off(signal, handler);
        }
        callback(value);
      };
    }

    const resolveOnce = finalize(resolve);
    const rejectOnce = finalize(reject);

    for (const signal of ['SIGINT', 'SIGTERM']) {
      const handler = () => {
        logDebug(`interrupting ${description}`, { signal });
        stopChildProcess(child);
        rejectOnce(new Error(`Command interrupted by ${signal}: ${command} ${args.join(' ')}`));
      };
      signalHandlers.set(signal, handler);
      process.on(signal, handler);
    }

    child.on('error', (error) => {
      logDebug(`failed to spawn ${description}`, {
        error: error instanceof Error ? error.message : String(error),
      });
      rejectOnce(error);
    });
    child.on('close', (code, signal) => {
      logDebug(`finished ${description}`, {
        code,
        signal: signal ?? null,
        durationMs: Date.now() - startedAt,
      });
      if (signal) {
        rejectOnce(
          new Error(
            `Command failed: ${command} ${args.join(' ')} (signal ${signal})`,
          ),
        );
        return;
      }

      if (code === 0) {
        resolveOnce();
        return;
      }

      rejectOnce(
        new Error(
          `Command failed: ${command} ${args.join(' ')} (exit ${code ?? 'unknown'})`,
        ),
      );
    });
  });
}

async function main() {
  const shouldIsolateTauriConsole =
    process.platform === 'win32' && isTruthyEnv(process.env.SDKWORK_TAURI_ISOLATE_CONSOLE);
  const sharedEnv = {
    CARGO_TARGET_DIR: cargoTargetDir,
    OPENCLAW_CONTROL_UI_CONFIG_PATH: resolveOpenClawControlUiConfigPath(),
  };
  const openClawDevEnv = {
    ...sharedEnv,
    OPENCLAW_PREPARE_CACHE_DIR: path.join(rootDir, '.cache', 'openclaw-runtime-dev'),
    OPENCLAW_SKIP_BUNDLED_MIRROR: '1',
    npm_config_cache: path.join(rootDir, '.cache', 'npm-cache', 'openclaw-runtime-dev'),
  };
  const tauriDevEnv = createTauriCommandEnv(sharedEnv);

  logDebug('desktop tauri dev bootstrap starting', {
    rootDir,
    desktopDir,
    srcTauriDir,
    cargoTargetDir,
    openClawControlUiConfigPath: sharedEnv.OPENCLAW_CONTROL_UI_CONFIG_PATH,
    openClawPrepareCacheDir: openClawDevEnv.OPENCLAW_PREPARE_CACHE_DIR,
    relevantEnv: summarizeRelevantEnv({
      ...process.env,
      ...sharedEnv,
      ...openClawDevEnv,
      ...tauriDevEnv,
    }),
    targetDirExists: existsSync(cargoTargetDir),
    rustCargoBinCandidates: resolveRustCargoBinCandidates(),
  });

  await runCommand(nodeCommand, ['scripts/sync-bundled-components.mjs', '--dev', '--no-fetch'], {
    label: 'sync bundled components',
  });
  await runCommand(nodeCommand, ['scripts/ensure-tauri-target-clean.mjs', srcTauriDir], {
    env: sharedEnv,
    label: 'ensure tauri target clean',
  });
  await runCommand(nodeCommand, ['scripts/prepare-openclaw-runtime.mjs'], {
    env: openClawDevEnv,
    label: 'prepare openclaw runtime',
  });
  try {
    await runCommand(
      nodeCommand,
      ['scripts/ensure-tauri-dev-binary-unlocked.mjs', srcTauriDir, 'sdkwork-claw-desktop'],
      {
        env: sharedEnv,
        label: 'ensure tauri dev binary unlocked',
      },
    );
  } catch (error) {
    console.warn(
      `[tauri:dev] skipping binary unlock guard after inspection failure: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  await runCommand(nodeCommand, ['scripts/ensure-tauri-dev-port-free.mjs', '127.0.0.1', '1420'], {
    label: 'ensure tauri dev port free',
  });
  await runCommand(tauriCommand, ['exec', 'tauri', 'dev'], {
    cwd: desktopDir,
    env: tauriDevEnv,
    isolateConsole: shouldIsolateTauriConsole,
    label: 'pnpm exec tauri dev',
  });
}

process.on('exit', (code) => {
  logDebug('desktop tauri dev bootstrap exiting', { code });
});

process.on('uncaughtException', (error) => {
  console.error(`${DEBUG_PREFIX} ${new Date().toISOString()} uncaught exception`, error);
});

process.on('unhandledRejection', (reason) => {
  console.error(`${DEBUG_PREFIX} ${new Date().toISOString()} unhandled rejection`, reason);
});

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
