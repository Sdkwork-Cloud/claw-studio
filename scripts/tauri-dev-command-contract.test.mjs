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
const desktopTauriDevRunnerSource = readText('scripts/run-desktop-tauri-dev.mjs');
const desktopPortGuardSource = readText('scripts/ensure-tauri-dev-port-free.mjs');
const bundledSyncDevCommand = "['scripts/sync-bundled-components.mjs', '--dev', '--no-fetch']";
const bundledSyncBuildCommand = 'node ../../scripts/sync-bundled-components.mjs --no-fetch --release';
const devStaleTargetGuardCommand = "['scripts/ensure-tauri-target-clean.mjs', srcTauriDir]";
const buildStaleTargetGuardCommand = 'node ../../scripts/ensure-tauri-target-clean.mjs src-tauri';
const devBinaryUnlockGuardCommand =
  "['scripts/ensure-tauri-dev-binary-unlocked.mjs', srcTauriDir, 'sdkwork-claw-desktop']";
const buildBinaryUnlockGuardCommand =
  'node ../../scripts/ensure-tauri-dev-binary-unlocked.mjs src-tauri sdkwork-claw-desktop';
const devPortGuardCommand = "['scripts/ensure-tauri-dev-port-free.mjs', '127.0.0.1', '1420']";
const bundledOpenClawPrepareCommand = 'node ../../scripts/prepare-openclaw-runtime.mjs';
const desktopTauriDevRunnerCommand = 'node ../../scripts/run-desktop-tauri-dev.mjs';
const desktopBuildVerifyCommand = 'node ../../scripts/verify-desktop-build-assets.mjs';
const desktopBundleRunnerCommand = 'node ../../scripts/run-desktop-release-build.mjs --phase bundle';

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
const expectedDesktopDevScript = `vite --host 127.0.0.1 --port ${devUrlPort} --strictPort`;
if (tauriDevScript !== expectedDesktopDevScript) {
  fail(
    `Desktop "dev:tauri" must start the desktop Vite host via "${expectedDesktopDevScript}".`,
  );
}

if (tauriDevScript.includes('run-claw-web-dist-server')) {
  fail('Desktop "dev:tauri" must not serve the web host dist inside Tauri dev.');
}

const tauriCliDevScript = desktopPackage.scripts?.['tauri:dev'];
if (typeof tauriCliDevScript !== 'string' || tauriCliDevScript.trim().length === 0) {
  fail('Desktop package must define a "tauri:dev" script.');
}

if (tauriCliDevScript !== desktopTauriDevRunnerCommand) {
  fail(`Desktop "tauri:dev" must delegate through "${desktopTauriDevRunnerCommand}".`);
}

if (!desktopTauriDevRunnerSource.includes("const cargoTargetDir = path.join(desktopDir, '.tauri-target', 'dev');")) {
  fail('Desktop tauri dev runner must isolate CARGO_TARGET_DIR outside src-tauri watch roots.');
}

if (desktopTauriDevRunnerSource.includes("path.join(srcTauriDir, 'target-dev')")) {
  fail('Desktop tauri dev runner must not place CARGO_TARGET_DIR under src-tauri.');
}

if (!desktopTauriDevRunnerSource.includes('OPENCLAW_CONTROL_UI_CONFIG_PATH')) {
  fail('Desktop tauri dev runner must pass the OpenClaw control-ui config path to the dev web server.');
}

if (!desktopTauriDevRunnerSource.includes(".cargo', 'bin'")) {
  fail('Desktop tauri dev runner must look for a user-local Rust cargo bin fallback.');
}

if (!desktopTauriDevRunnerSource.includes("PATH: createExecutableSearchPath")) {
  fail('Desktop tauri dev runner must augment PATH before invoking tauri dev.');
}

if (
  !desktopTauriDevRunnerSource.includes(
    "path.join(cargoTargetDir, 'debug', 'user', 'openclaw-home', '.openclaw', 'openclaw.json')",
  )
) {
  fail(
    'Desktop tauri dev runner must point the control-ui config path at the dev runtime user openclaw.json.',
  );
}

if (
  !desktopTauriDevRunnerSource.includes(
    "const stdio = options.isolateConsole ? ['ignore', 'pipe', 'pipe'] : 'inherit';",
  )
) {
  fail(
    'Desktop tauri dev runner must isolate the Windows tauri dev child stdio instead of always inheriting the current console.',
  );
}

if (!desktopTauriDevRunnerSource.includes('detached: Boolean(options.isolateConsole),')) {
  fail(
    'Desktop tauri dev runner must allow the tauri dev child to run in an isolated process group when console isolation is requested.',
  );
}

if (
  !desktopTauriDevRunnerSource.includes("child.stdout?.on('data', (chunk) => {")
  || !desktopTauriDevRunnerSource.includes("process.stdout.write(chunk);")
  || !desktopTauriDevRunnerSource.includes("child.stderr?.on('data', (chunk) => {")
  || !desktopTauriDevRunnerSource.includes("process.stderr.write(chunk);")
) {
  fail(
    'Desktop tauri dev runner must forward isolated tauri dev output back to the current terminal streams.',
  );
}

const bundledOpenClawPrepareScript = desktopPackage.scripts?.['prepare:openclaw-runtime'];
if (bundledOpenClawPrepareScript !== bundledOpenClawPrepareCommand) {
  fail(
    `Desktop package must define "prepare:openclaw-runtime" as "${bundledOpenClawPrepareCommand}".`,
  );
}

assertCommandsAppearInOrder(
  desktopTauriDevRunnerSource,
  [
    bundledSyncDevCommand,
    devStaleTargetGuardCommand,
    "['scripts/prepare-openclaw-runtime.mjs']",
    devBinaryUnlockGuardCommand,
    devPortGuardCommand,
    "runCommand(tauriCommand, ['exec', 'tauri', 'dev']",
  ],
  'Desktop "tauri:dev"',
);

if (
  !desktopTauriDevRunnerSource.includes(
    "await runCommand(tauriCommand, ['exec', 'tauri', 'dev'], {",
  )
) {
  fail('Desktop tauri dev runner must invoke the tauri dev child through the shared runCommand helper.');
}

if (!desktopTauriDevRunnerSource.includes('SDKWORK_TAURI_ISOLATE_CONSOLE')) {
  fail('Desktop tauri dev runner must gate console isolation behind SDKWORK_TAURI_ISOLATE_CONSOLE.');
}

if (desktopTauriDevRunnerSource.includes("isolateConsole: process.platform === 'win32'")) {
  fail('Desktop tauri dev runner must not force console isolation for every Windows tauri dev session.');
}

if (!desktopPortGuardSource.includes('run-claw-web-dist-server.mjs')) {
  fail('Tauri dev port guard must recognize the legacy static web dist server so it can clear stale blockers.');
}

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
    bundledSyncBuildCommand,
    buildStaleTargetGuardCommand,
    bundledOpenClawPrepareCommand,
    buildBinaryUnlockGuardCommand,
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

console.log('ok - desktop Tauri commands stay aligned with devUrl and stale-target protection');
