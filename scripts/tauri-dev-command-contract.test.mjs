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
const tauriWindowsConfig = readJson('packages/sdkwork-claw-desktop/src-tauri/tauri.windows.conf.json');
const tauriLinuxConfig = readJson('packages/sdkwork-claw-desktop/src-tauri/tauri.linux.conf.json');
const tauriMacosConfig = readJson('packages/sdkwork-claw-desktop/src-tauri/tauri.macos.conf.json');
const windowsInstallerHooksPath = 'packages/sdkwork-claw-desktop/src-tauri/installer-hooks.nsh';
const linuxPostInstallHooksPath = './linux-postinstall-openclaw.sh';
const bundledSyncDevCommand = 'node ../../scripts/sync-bundled-components.mjs --dev --no-fetch';
const bundledSyncBuildCommand = 'node ../../scripts/sync-bundled-components.mjs --no-fetch --release';
const staleTargetGuardCommand = 'node ../../scripts/ensure-tauri-target-clean.mjs src-tauri';
const rustToolchainGuardCommand = 'node ../../scripts/ensure-tauri-rust-toolchain.mjs';
const devBinaryUnlockGuardCommand =
  'node ../../scripts/ensure-tauri-dev-binary-unlocked.mjs src-tauri sdkwork-claw-desktop';
const devPortGuardCommand = 'node ../../scripts/ensure-tauri-dev-port-free.mjs 127.0.0.1 1420';
const bundledOpenClawPrepareCommand = 'node ../../scripts/prepare-openclaw-runtime.mjs';
const desktopBuildVerifyCommand = 'node ../../scripts/verify-desktop-build-assets.mjs';
const tauriDevRunnerCommand = 'node ../../scripts/run-tauri-cli.mjs dev';
const tauriInfoRunnerCommand = 'node ../../scripts/run-tauri-cli.mjs info';
const tauriIconRunnerCommand = 'node ../../scripts/run-tauri-cli.mjs icon src-tauri/app-icon.svg';
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

if ('prepare:api-router-runtime' in (desktopPackage.scripts ?? {})) {
  fail('Desktop package must not keep the legacy "prepare:api-router-runtime" script after api-router runtime extraction.');
}

assertCommandsAppearInOrder(
  tauriCliDevScript,
  [
    rustToolchainGuardCommand,
    bundledOpenClawPrepareCommand,
    bundledSyncDevCommand,
    devBinaryUnlockGuardCommand,
    staleTargetGuardCommand,
    devPortGuardCommand,
    tauriDevRunnerCommand,
  ],
  'Desktop "tauri:dev"',
);

const tauriCliBuildScript = desktopPackage.scripts?.['tauri:build'];
if (typeof tauriCliBuildScript !== 'string' || tauriCliBuildScript.trim().length === 0) {
  fail('Desktop package must define a "tauri:build" script.');
}

const tauriCliIconScript = desktopPackage.scripts?.['tauri:icon'];
if (tauriCliIconScript !== tauriIconRunnerCommand) {
  fail(`Desktop "tauri:icon" must delegate through "${tauriIconRunnerCommand}".`);
}

const tauriCliInfoScript = desktopPackage.scripts?.['tauri:info'];
if (tauriCliInfoScript !== tauriInfoRunnerCommand) {
  fail(`Desktop "tauri:info" must delegate through "${tauriInfoRunnerCommand}".`);
}

const desktopBuildScript = desktopPackage.scripts?.build;
if (typeof desktopBuildScript !== 'string' || desktopBuildScript.trim().length === 0) {
  fail('Desktop package must define a "build" script.');
}

if (!desktopBuildScript.includes(desktopBuildVerifyCommand)) {
  fail(`Desktop "build" must verify bundled frontend assets with "${desktopBuildVerifyCommand}".`);
}
if (
  !/if \(path\.resolve\(process\.argv\[1\] \?\? ''\) === __filename\) \{\s*try \{\s*main\(\);\s*\} catch \(error\) \{\s*console\.error\(error instanceof Error \? error\.message : String\(error\)\);\s*process\.exit\(1\);\s*\}\s*\}/s.test(
    readText('scripts/verify-desktop-build-assets.mjs'),
  )
) {
  fail('Desktop bundled asset verification script must wrap the CLI entrypoint with a top-level error handler.');
}

assertCommandsAppearInOrder(
  tauriCliBuildScript,
  [
    rustToolchainGuardCommand,
    bundledOpenClawPrepareCommand,
    bundledSyncBuildCommand,
    devBinaryUnlockGuardCommand,
    staleTargetGuardCommand,
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
if (!Array.isArray(bundledResources) || !bundledResources.includes('resources/openclaw/')) {
  fail('Desktop Tauri bundle resources must include resources/openclaw/ as a directory resource root.');
}
if (!Array.isArray(bundledResources) || !bundledResources.includes('../dist/')) {
  fail('Desktop Tauri bundle resources must include ../dist/ as a directory resource root so the embedded host can serve the packaged browser shell.');
}
if (!Array.isArray(bundledResources) || !bundledResources.includes('generated/bundled/')) {
  fail('Desktop Tauri bundle resources must include generated/bundled/ as a directory resource root.');
}
if (!Array.isArray(bundledResources) || !bundledResources.includes('foundation/components/')) {
  fail('Desktop Tauri bundle resources must include foundation/components/ as a directory resource root.');
}
if (!Array.isArray(bundledResources) || !bundledResources.includes('vendor/hub-installer/registry/')) {
  fail('Desktop Tauri bundle resources must include vendor/hub-installer/registry/ as a directory resource root.');
}
if (Array.isArray(bundledResources) && bundledResources.some((resource) => resource.includes('/**/*'))) {
  fail('Desktop Tauri bundle resources must prefer directory resource roots over recursive glob patterns for packaged folders.');
}

if (Array.isArray(bundledResources) && bundledResources.includes('resources/sdkwork-api-router-runtime/**/*')) {
  fail('Desktop Tauri bundle resources must not include legacy sdkwork-api-router bundled runtime resources.');
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
  'generated/br/w/',
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

if (windowsBundleResources['generated/br/o/'] !== 'resources/openclaw/') {
  fail('Desktop Windows bundle overlay must map the OpenClaw bridge root into resources/openclaw/.');
}
if (windowsBundleResources['generated/br/w/'] !== 'dist/') {
  fail('Desktop Windows bundle overlay must map the browser shell bridge root into dist/.');
}

const expectedUnixBundleResources = {
  'foundation/components/': 'foundation/components/',
  'generated/bundled/': 'generated/bundled/',
  '../dist/': 'dist/',
  'vendor/hub-installer/registry/': 'vendor/hub-installer/registry/',
  'generated/release/openclaw-resource/': 'resources/openclaw/',
};

for (const [platformLabel, platformConfig] of [
  ['Linux', tauriLinuxConfig],
  ['macOS', tauriMacosConfig],
]) {
  const platformBundleResources = platformConfig.bundle?.resources;
  if (!platformBundleResources || Array.isArray(platformBundleResources)) {
    fail(`Desktop ${platformLabel} Tauri config must override bundle.resources with a source-to-target mapping object.`);
  }

  for (const [source, target] of Object.entries(expectedUnixBundleResources)) {
    if (platformBundleResources[source] !== target) {
      fail(`Desktop ${platformLabel} Tauri config must map "${source}" to "${target}".`);
    }
  }
}

const linuxDebPostInstallScript = tauriLinuxConfig.bundle?.linux?.deb?.postInstallScript;
if (linuxDebPostInstallScript !== linuxPostInstallHooksPath) {
  fail(`Desktop Linux deb bundle must use postInstallScript "${linuxPostInstallHooksPath}".`);
}

const linuxRpmPostInstallScript = tauriLinuxConfig.bundle?.linux?.rpm?.postInstallScript;
if (linuxRpmPostInstallScript !== linuxPostInstallHooksPath) {
  fail(`Desktop Linux rpm bundle must use postInstallScript "${linuxPostInstallHooksPath}".`);
}

const macosBundleFiles = tauriMacosConfig.bundle?.macOS?.files;
if (!macosBundleFiles || Array.isArray(macosBundleFiles)) {
  fail('Desktop macOS bundle must declare bundle.macOS.files as a source-to-target mapping object.');
}
if (macosBundleFiles['generated/release/macos-install-root/'] !== 'MacOS/') {
  fail('Desktop macOS bundle must project the preexpanded OpenClaw managed runtime layout into Contents/MacOS/.');
}

const windowsTauriResources = tauriWindowsConfig.bundle?.resources;
if (typeof windowsTauriResources !== 'undefined') {
  fail('Desktop Windows Tauri config must not duplicate bundle.resources when the Windows overlay already owns bundled resource mapping.');
}

const windowsNsisInstallerHooks = tauriWindowsConfig.bundle?.windows?.nsis?.installerHooks;
if (windowsNsisInstallerHooks !== './installer-hooks.nsh') {
  fail(
    `Desktop Windows Tauri config must wire NSIS installer hooks through "./installer-hooks.nsh", received "${windowsNsisInstallerHooks ?? ''}".`,
  );
}

const windowsInstallerHooksSource = readText(windowsInstallerHooksPath);
if (!windowsInstallerHooksSource.includes('!macro NSIS_HOOK_POSTINSTALL')) {
  fail('Desktop NSIS installer hooks must define NSIS_HOOK_POSTINSTALL.');
}

if (!windowsInstallerHooksSource.includes('--prepare-bundled-openclaw-runtime')) {
  fail('Desktop NSIS installer hooks must prewarm the bundled OpenClaw runtime during install.');
}
if (!windowsInstallerHooksSource.includes('--prepare-bundled-openclaw-runtime --install-root "$INSTDIR"')) {
  fail('Desktop NSIS installer hooks must forward $INSTDIR into the embedded OpenClaw prewarm CLI.');
}

if (!windowsInstallerHooksSource.includes('Abort "Embedded OpenClaw runtime prewarm failed during install')) {
  fail('Desktop NSIS installer hooks must abort the installer when bundled OpenClaw prewarm fails.');
}

if (windowsInstallerHooksSource.includes('runtime prewarm deferred to first app launch')) {
  fail('Desktop NSIS installer hooks must not silently defer bundled OpenClaw runtime prewarm to first launch.');
}

if (!windowsInstallerHooksSource.includes('--register-openclaw-cli')) {
  fail('Desktop NSIS installer hooks must invoke the embedded OpenClaw registration flow during install.');
}
if (!windowsInstallerHooksSource.includes('--register-openclaw-cli --install-root "$INSTDIR"')) {
  fail('Desktop NSIS installer hooks must forward $INSTDIR into the embedded OpenClaw CLI registration flow.');
}

if (
  windowsInstallerHooksSource.indexOf('--prepare-bundled-openclaw-runtime')
  > windowsInstallerHooksSource.indexOf('--register-openclaw-cli')
) {
  fail('Desktop NSIS installer hooks must prewarm the bundled OpenClaw runtime before CLI registration.');
}

const linuxPostInstallHooksSource = readText('packages/sdkwork-claw-desktop/src-tauri/linux-postinstall-openclaw.sh');
if (linuxPostInstallHooksSource.includes('--prepare-bundled-openclaw-runtime || true')) {
  fail('Desktop Linux postinstall hook must fail the package install when bundled OpenClaw prewarm fails.');
}
if (!linuxPostInstallHooksSource.includes('RPM_INSTALL_PREFIX')) {
  fail('Desktop Linux postinstall hook must honor RPM relocatable install prefixes during bundled OpenClaw prewarm.');
}
if (!linuxPostInstallHooksSource.includes('Unable to resolve Claw Studio install root')) {
  fail('Desktop Linux postinstall hook must surface a clear install-root failure when packaged OpenClaw resources are missing.');
}
if (!linuxPostInstallHooksSource.includes('Unable to locate the installed Claw Studio binary')) {
  fail('Desktop Linux postinstall hook must surface a clear binary discovery failure when the packaged desktop binary is missing.');
}
if (!linuxPostInstallHooksSource.includes('--prepare-bundled-openclaw-runtime --install-root "$install_root"')) {
  fail('Desktop Linux postinstall hook must forward the resolved install root into the embedded OpenClaw prewarm CLI.');
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

if (tauriBuildScriptSource.includes('sdkwork-api-router')) {
  fail('Desktop build.rs must not retain sdkwork-api-router bundled runtime handling after api-router extraction.');
}

console.log('ok - desktop Tauri commands stay aligned with devUrl and stale-target protection');
