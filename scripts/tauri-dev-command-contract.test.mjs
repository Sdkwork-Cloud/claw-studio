import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const bundledComponentsModulePath = path.join(rootDir, 'scripts', 'sync-bundled-components.mjs');
const bundledComponentsModule = await import(pathToFileURL(bundledComponentsModulePath).href);

function readJson(relativePath) {
  return JSON.parse(readFileSync(path.join(rootDir, relativePath), 'utf8'));
}

function readText(relativePath) {
  return readFileSync(path.join(rootDir, relativePath), 'utf8');
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
const bundledSyncBuildCommand = 'node ../../scripts/sync-bundled-components.mjs --no-fetch --release';
const staleTargetGuardCommand = 'node ../../scripts/ensure-tauri-target-clean.mjs src-tauri';
const rustToolchainGuardCommand = 'node ../../scripts/ensure-tauri-rust-toolchain.mjs';
const devBinaryUnlockGuardCommand =
  'node ../../scripts/ensure-tauri-dev-binary-unlocked.mjs src-tauri sdkwork-claw-desktop';
const devPortGuardCommand = 'node ../../scripts/ensure-tauri-dev-port-free.mjs 127.0.0.1 1420';
const bundledOpenClawPrepareCommand = 'node ../../scripts/prepare-openclaw-runtime.mjs';
const bundledApiRouterPrepareCommand = 'node ../../scripts/prepare-sdkwork-api-router-runtime.mjs';
const desktopBuildVerifyCommand = 'node ../../scripts/verify-desktop-build-assets.mjs';
const tauriDevRunnerCommand = 'node ../../scripts/run-tauri-cli.mjs dev';
const desktopBundleRunnerCommand = 'node ../../scripts/run-desktop-release-build.mjs --phase bundle --vite-mode production';

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
    rustToolchainGuardCommand,
    bundledSyncDevCommand,
    staleTargetGuardCommand,
    bundledOpenClawPrepareCommand,
    bundledApiRouterPrepareCommand,
    devBinaryUnlockGuardCommand,
    devPortGuardCommand,
    tauriDevRunnerCommand,
  ],
  'Desktop "tauri:dev"',
);

const tauriCliBuildScript = desktopPackage.scripts?.['tauri:build'];
if (typeof tauriCliBuildScript !== 'string' || tauriCliBuildScript.trim().length === 0) {
  fail('Desktop package must define a "tauri:build" script.');
}

const desktopBuildScript = desktopPackage.scripts?.build;
if (typeof desktopBuildScript !== 'string' || desktopBuildScript.trim().length === 0) {
  fail('Desktop package must define a "build" script.');
}

if (!desktopBuildScript.includes(desktopBuildVerifyCommand)) {
  fail(`Desktop "build" must verify bundled frontend assets with "${desktopBuildVerifyCommand}".`);
}

assertCommandsAppearInOrder(
  tauriCliBuildScript,
  [
    rustToolchainGuardCommand,
    bundledSyncBuildCommand,
    staleTargetGuardCommand,
    bundledOpenClawPrepareCommand,
    bundledApiRouterPrepareCommand,
    devBinaryUnlockGuardCommand,
    desktopBundleRunnerCommand,
  ],
  'Desktop "tauri:build"',
);

if (!tauriCliBuildScript.includes(desktopBundleRunnerCommand)) {
  fail(
    `Desktop "tauri:build" must delegate the final bundle step through "${desktopBundleRunnerCommand}".`,
  );
}

const bundledResources = tauriConfig.bundle?.resources;
if (!Array.isArray(bundledResources) || !bundledResources.includes('resources/openclaw-runtime/**/*')) {
  fail('Desktop Tauri bundle resources must include resources/openclaw-runtime/**/*.');
}

if (!Array.isArray(bundledResources) || !bundledResources.includes('resources/sdkwork-api-router-runtime/**/*')) {
  fail('Desktop Tauri bundle resources must include resources/sdkwork-api-router-runtime/**/*.');
}

const windowsBundleResources = bundledComponentsModule.createTauriBundleOverlayConfig({
  workspaceRootDir: 'D:\\workspace\\claw-studio',
  platform: 'win32',
}).bundle?.resources;
if (!windowsBundleResources || Array.isArray(windowsBundleResources)) {
  fail('Desktop Windows bundle overlay must declare bundle.resources as a source-to-target mapping object.');
}

const expectedWindowsBundleSources = [
  'foundation/components/',
  'generated/br/b/',
  'vendor/hub-installer/registry/',
  'generated/br/o/',
  'generated/br/a/',
];

for (const source of expectedWindowsBundleSources) {
  if (!(source in windowsBundleResources)) {
    fail(`Desktop Windows bundle overlay must map "${source}" as a bundled resource root.`);
  }
}

for (const source of Object.keys(windowsBundleResources)) {
  if (/^[a-zA-Z]:[\\/]/.test(source) || source.includes('.sdkwork-bc')) {
    fail(
      `Desktop Windows bundle overlay must not depend on external absolute mirror paths, found "${source}".`,
    );
  }
}

if (windowsBundleResources['generated/br/o/'] !== 'resources/openclaw-runtime/') {
  fail('Desktop Windows bundle overlay must map the OpenClaw bridge root into resources/openclaw-runtime/.');
}

if (windowsBundleResources['generated/br/a/'] !== 'resources/sdkwork-api-router-runtime/') {
  fail('Desktop Windows bundle overlay must map the sdkwork-api-router bridge root into resources/sdkwork-api-router-runtime/.');
}

const tauriBuildScriptSource = readText('packages/sdkwork-claw-desktop/src-tauri/build.rs');
if (!tauriBuildScriptSource.includes('../dist')) {
  fail('Desktop build.rs must keep the frontendDist path available for clean-clone cargo test runs.');
}

if (!tauriBuildScriptSource.includes('generated/bundled')) {
  fail('Desktop build.rs must tolerate clean-clone cargo test runs when generated bundled resources have not been synchronized yet.');
}

if (!tauriBuildScriptSource.includes('placeholder.txt')) {
  fail('Desktop build.rs must seed a visible generated bundled placeholder so Tauri resource glob resolution stays valid on clean clones.');
}

if (!tauriBuildScriptSource.includes('resources/sdkwork-api-router-runtime')) {
  fail('Desktop build.rs must tolerate clean-clone cargo test runs when sdkwork-api-router bundled resources have not been prepared yet.');
}

if (!tauriBuildScriptSource.includes('sdkwork-api-router-runtime/runtime/placeholder.txt')) {
  fail('Desktop build.rs must seed a visible sdkwork-api-router runtime placeholder so the Tauri resource glob stays valid on clean clones.');
}

if (!tauriBuildScriptSource.includes('ErrorKind::AlreadyExists')) {
  fail('Desktop build.rs must recover when the sdkwork-api-router runtime path already exists as a stale entry during clean-clone cargo test runs.');
}

if (!tauriBuildScriptSource.includes('symlink_metadata')) {
  fail('Desktop build.rs must inspect stale sdkwork-api-router runtime paths before recreating the bundled runtime directory.');
}

console.log('ok - desktop Tauri commands stay aligned with devUrl and stale-target protection');
