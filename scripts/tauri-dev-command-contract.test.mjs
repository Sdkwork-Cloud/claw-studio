import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

function readJson(relativePath) {
  return JSON.parse(readFileSync(path.join(rootDir, relativePath), 'utf8'));
}

function fail(message) {
  throw new Error(message);
}

function parsePort(url) {
  return new URL(url).port;
}

const desktopPackage = readJson('packages/sdkwork-claw-desktop/package.json');
const tauriConfig = readJson('packages/sdkwork-claw-desktop/src-tauri/tauri.conf.json');
const bundledSyncDevCommand = 'node ../../scripts/sync-bundled-components.mjs --dev --no-fetch';
const bundledSyncBuildCommand = 'node ../../scripts/sync-bundled-components.mjs --no-fetch';
const staleTargetGuardCommand = 'node ../../scripts/ensure-tauri-target-clean.mjs src-tauri';
const devBinaryUnlockGuardCommand =
  'node ../../scripts/ensure-tauri-dev-binary-unlocked.mjs src-tauri sdkwork-claw-desktop';
const devPortGuardCommand = 'node ../../scripts/ensure-tauri-dev-port-free.mjs 127.0.0.1 1420';
const bundledOpenClawPrepareCommand = 'node ../../scripts/prepare-openclaw-runtime.mjs';
const bundledApiRouterPrepareCommand = 'node ../../scripts/prepare-sdkwork-api-router-runtime.mjs';

function assertCommandsAppearInOrder(script, commands, label) {
  let lastIndex = -1;
  for (const command of commands) {
    const index = script.indexOf(command);
    if (index === -1) {
      fail(`${label} must include "${command}".`);
    }
    if (index < lastIndex) {
      fail(`${label} must execute "${command}" after the previous required step.`);
    }
    lastIndex = index;
  }
}

const tauriDevScript = desktopPackage.scripts?.['dev:tauri'];
if (typeof tauriDevScript !== 'string' || tauriDevScript.trim().length === 0) {
  fail('Desktop package must define a dedicated "dev:tauri" script.');
}

const expectedBeforeDevCommand = 'pnpm run dev:tauri';
if (tauriConfig.build?.beforeDevCommand !== expectedBeforeDevCommand) {
  fail(
    `Desktop Tauri beforeDevCommand must be "${expectedBeforeDevCommand}", received "${tauriConfig.build?.beforeDevCommand ?? ''}".`,
  );
}

const devUrl = tauriConfig.build?.devUrl;
if (typeof devUrl !== 'string' || devUrl.trim().length === 0) {
  fail('Desktop Tauri config must define build.devUrl.');
}

const devUrlPort = parsePort(devUrl);
if (!tauriDevScript.includes(`--port ${devUrlPort}`)) {
  fail(`Desktop "dev:tauri" must bind Vite to Tauri devUrl port ${devUrlPort}.`);
}

if (!tauriDevScript.includes('--host 127.0.0.1')) {
  fail('Desktop "dev:tauri" must bind Vite to host 127.0.0.1.');
}

const tauriCliDevScript = desktopPackage.scripts?.['tauri:dev'];
if (typeof tauriCliDevScript !== 'string' || tauriCliDevScript.trim().length === 0) {
  fail('Desktop package must define a "tauri:dev" script.');
}

const bundledOpenClawPrepareScript = desktopPackage.scripts?.['prepare:openclaw-runtime'];
if (bundledOpenClawPrepareScript !== bundledOpenClawPrepareCommand) {
  fail(
    `Desktop package must define "prepare:openclaw-runtime" as "${bundledOpenClawPrepareCommand}".`,
  );
}

const bundledApiRouterPrepareScript = desktopPackage.scripts?.['prepare:api-router-runtime'];
if (bundledApiRouterPrepareScript !== bundledApiRouterPrepareCommand) {
  fail(
    `Desktop package must define "prepare:api-router-runtime" as "${bundledApiRouterPrepareCommand}".`,
  );
}

assertCommandsAppearInOrder(
  tauriCliDevScript,
  [
    bundledSyncDevCommand,
    staleTargetGuardCommand,
    bundledOpenClawPrepareCommand,
    bundledApiRouterPrepareCommand,
    devBinaryUnlockGuardCommand,
    devPortGuardCommand,
    'tauri dev',
  ],
  'Desktop "tauri:dev"',
);

const tauriCliBuildScript = desktopPackage.scripts?.['tauri:build'];
if (typeof tauriCliBuildScript !== 'string' || tauriCliBuildScript.trim().length === 0) {
  fail('Desktop package must define a "tauri:build" script.');
}

assertCommandsAppearInOrder(
  tauriCliBuildScript,
  [
    bundledSyncBuildCommand,
    staleTargetGuardCommand,
    bundledOpenClawPrepareCommand,
    bundledApiRouterPrepareCommand,
    'tauri build',
  ],
  'Desktop "tauri:build"',
);

const bundledResources = tauriConfig.bundle?.resources;
if (!Array.isArray(bundledResources) || !bundledResources.includes('resources/openclaw-runtime/**/*')) {
  fail('Desktop Tauri bundle resources must include resources/openclaw-runtime/**/*.');
}

if (!Array.isArray(bundledResources) || !bundledResources.includes('resources/sdkwork-api-router-runtime/**/*')) {
  fail('Desktop Tauri bundle resources must include resources/sdkwork-api-router-runtime/**/*.');
}

console.log('ok - desktop Tauri commands stay aligned with devUrl and stale-target protection');
