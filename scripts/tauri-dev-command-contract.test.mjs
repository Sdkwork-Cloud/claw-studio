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
const staleTargetGuardCommand = 'node ../../scripts/ensure-tauri-target-clean.mjs src-tauri';
const devPortGuardCommand = 'node ../../scripts/ensure-tauri-dev-port-free.mjs 127.0.0.1 1420';
const bundledOpenClawPrepareCommand = 'node ../../scripts/prepare-openclaw-runtime.mjs';

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

if (!tauriCliDevScript.startsWith(`${staleTargetGuardCommand} && `)) {
  fail(
    `Desktop "tauri:dev" must guard against stale Tauri target artifacts via "${staleTargetGuardCommand}" before invoking the Tauri CLI.`,
  );
}

if (!tauriCliDevScript.includes(`&& ${bundledOpenClawPrepareCommand} &&`)) {
  fail(
    `Desktop "tauri:dev" must prepare the bundled OpenClaw runtime via "${bundledOpenClawPrepareCommand}" before invoking the Tauri CLI.`,
  );
}

if (!tauriCliDevScript.includes(`&& ${devPortGuardCommand} &&`)) {
  fail(
    `Desktop "tauri:dev" must verify that the fixed Tauri dev port is free via "${devPortGuardCommand}" before invoking the Tauri CLI.`,
  );
}

const tauriCliBuildScript = desktopPackage.scripts?.['tauri:build'];
if (typeof tauriCliBuildScript !== 'string' || tauriCliBuildScript.trim().length === 0) {
  fail('Desktop package must define a "tauri:build" script.');
}

if (!tauriCliBuildScript.startsWith(`${staleTargetGuardCommand} && `)) {
  fail(
    `Desktop "tauri:build" must guard against stale Tauri target artifacts via "${staleTargetGuardCommand}" before invoking the Tauri CLI.`,
  );
}

if (!tauriCliBuildScript.includes(`&& ${bundledOpenClawPrepareCommand} &&`)) {
  fail(
    `Desktop "tauri:build" must prepare the bundled OpenClaw runtime via "${bundledOpenClawPrepareCommand}" before invoking the Tauri CLI.`,
  );
}

const bundledResources = tauriConfig.bundle?.resources;
if (!Array.isArray(bundledResources) || !bundledResources.includes('resources/openclaw-runtime/**/*')) {
  fail('Desktop Tauri bundle resources must include resources/openclaw-runtime/**/*.');
}

console.log('ok - desktop Tauri commands stay aligned with devUrl and stale-target protection');
