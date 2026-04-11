import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { normalizeDesktopPlatform } from './desktop-targets.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');

const WINDOWS_TAURI_CONFIG_PATH = 'packages/sdkwork-claw-desktop/src-tauri/tauri.windows.conf.json';
const WINDOWS_INSTALLER_HOOKS_PATH = 'packages/sdkwork-claw-desktop/src-tauri/installer-hooks.nsh';
const WINDOWS_MAIN_BINARY_NAME = 'sdkwork-claw-desktop.exe';
const LINUX_TAURI_CONFIG_PATH = 'packages/sdkwork-claw-desktop/src-tauri/tauri.linux.conf.json';
const LINUX_POSTINSTALL_PATH = 'packages/sdkwork-claw-desktop/src-tauri/linux-postinstall-openclaw.sh';
const MACOS_TAURI_CONFIG_PATH = 'packages/sdkwork-claw-desktop/src-tauri/tauri.macos.conf.json';

function readJson(workspaceRootDir, relativePath) {
  return JSON.parse(
    readFileSync(path.join(workspaceRootDir, relativePath), 'utf8'),
  );
}

function readText(workspaceRootDir, relativePath) {
  return readFileSync(path.join(workspaceRootDir, relativePath), 'utf8');
}

function assertIncludes(source, pattern, message) {
  assert.equal(source.includes(pattern), true, message);
}

function normalizeStringArray(values) {
  return Array.isArray(values)
    ? values
      .map((value) => String(value ?? '').trim())
      .filter(Boolean)
      .sort((left, right) => left.localeCompare(right))
    : undefined;
}

function normalizeDesktopOpenClawInstallerContract(contract) {
  if (!contract || typeof contract !== 'object') {
    return contract;
  }

  const normalizedContract = {
    ...contract,
  };

  if ('packageFormats' in normalizedContract) {
    normalizedContract.packageFormats = normalizeStringArray(
      normalizedContract.packageFormats,
    );
  }
  if ('installRootOverrides' in normalizedContract) {
    normalizedContract.installRootOverrides = normalizeStringArray(
      normalizedContract.installRootOverrides,
    );
  }

  return normalizedContract;
}

function readWindowsInstallerContract(workspaceRootDir) {
  const tauriConfig = readJson(workspaceRootDir, WINDOWS_TAURI_CONFIG_PATH);
  const installerHooksSource = readText(workspaceRootDir, WINDOWS_INSTALLER_HOOKS_PATH);

  assert.equal(
    tauriConfig?.bundle?.windows?.nsis?.installerHooks,
    './installer-hooks.nsh',
    'Desktop Windows Tauri config must wire installer-hooks.nsh for bundled OpenClaw postinstall prewarm.',
  );
  assertIncludes(
    installerHooksSource,
    '--prepare-bundled-openclaw-runtime',
    'Desktop Windows installer hooks must prewarm bundled OpenClaw during install.',
  );
  assertIncludes(
    installerHooksSource,
    '--prepare-bundled-openclaw-runtime --install-root "$INSTDIR"',
    'Desktop Windows installer hooks must forward $INSTDIR into the embedded OpenClaw prewarm CLI.',
  );
  assertIncludes(
    installerHooksSource,
    `"$INSTDIR\\${WINDOWS_MAIN_BINARY_NAME}" --prepare-bundled-openclaw-runtime`,
    'Desktop Windows installer hooks must invoke the actual packaged desktop binary for bundled OpenClaw prewarm.',
  );
  assertIncludes(
    installerHooksSource,
    'Abort "Embedded OpenClaw runtime prewarm failed during install',
    'Desktop Windows installer hooks must abort install when bundled OpenClaw prewarm fails.',
  );
  assertIncludes(
    installerHooksSource,
    '--register-openclaw-cli',
    'Desktop Windows installer hooks must register the bundled OpenClaw CLI during install.',
  );
  assertIncludes(
    installerHooksSource,
    '--register-openclaw-cli --install-root "$INSTDIR"',
    'Desktop Windows installer hooks must forward $INSTDIR into the embedded OpenClaw CLI registration flow.',
  );
  assertIncludes(
    installerHooksSource,
    `"$INSTDIR\\${WINDOWS_MAIN_BINARY_NAME}" --register-openclaw-cli`,
    'Desktop Windows installer hooks must invoke the actual packaged desktop binary for bundled OpenClaw CLI registration.',
  );
  assert.equal(
    installerHooksSource.indexOf('--prepare-bundled-openclaw-runtime')
      < installerHooksSource.indexOf('--register-openclaw-cli'),
    true,
    'Desktop Windows installer hooks must prewarm bundled OpenClaw before CLI registration.',
  );

  return {
    version: 1,
    platform: 'windows',
    delivery: 'archive-only-resources',
    installMode: 'postinstall-prewarm',
    bundledResourceRoot: 'resources/openclaw/',
    runtimeArchive: 'resources/openclaw/runtime.zip',
    sourceConfigPath: WINDOWS_TAURI_CONFIG_PATH,
    installerHookPath: WINDOWS_INSTALLER_HOOKS_PATH,
    prepareCommand: '--prepare-bundled-openclaw-runtime',
    prepareFailureMode: 'abort-install',
    cliRegistrationCommand: '--register-openclaw-cli',
    cliRegistrationFailureMode: 'best-effort',
  };
}

function readLinuxInstallerContract(workspaceRootDir) {
  const tauriConfig = readJson(workspaceRootDir, LINUX_TAURI_CONFIG_PATH);
  const postInstallSource = readText(workspaceRootDir, LINUX_POSTINSTALL_PATH);

  assert.equal(
    tauriConfig?.bundle?.linux?.deb?.postInstallScript,
    './linux-postinstall-openclaw.sh',
    'Desktop Linux deb packaging must wire the bundled OpenClaw postinstall hook.',
  );
  assert.equal(
    tauriConfig?.bundle?.linux?.rpm?.postInstallScript,
    './linux-postinstall-openclaw.sh',
    'Desktop Linux rpm packaging must wire the bundled OpenClaw postinstall hook.',
  );
  assertIncludes(
    postInstallSource,
    '--prepare-bundled-openclaw-runtime',
    'Desktop Linux postinstall hook must prewarm bundled OpenClaw during package install.',
  );
  assertIncludes(
    postInstallSource,
    '--prepare-bundled-openclaw-runtime --install-root "$install_root"',
    'Desktop Linux postinstall hook must forward the resolved install root into the embedded OpenClaw prewarm CLI.',
  );
  assert.equal(
    postInstallSource.includes('--prepare-bundled-openclaw-runtime || true'),
    false,
    'Desktop Linux postinstall hook must fail package install when bundled OpenClaw prewarm fails.',
  );
  assertIncludes(
    postInstallSource,
    'SDKWORK_CLAW_INSTALL_ROOT',
    'Desktop Linux postinstall hook must support explicit install-root overrides.',
  );
  assertIncludes(
    postInstallSource,
    'RPM_INSTALL_PREFIX',
    'Desktop Linux postinstall hook must honor RPM relocatable install prefixes.',
  );
  assertIncludes(
    postInstallSource,
    '--install-root',
    'Desktop Linux postinstall hook must support manual install-root overrides.',
  );

  return normalizeDesktopOpenClawInstallerContract({
    version: 1,
    platform: 'linux',
    delivery: 'archive-only-resources',
    installMode: 'postinstall-prewarm',
    bundledResourceRoot: 'resources/openclaw/',
    runtimeArchive: 'resources/openclaw/runtime.zip',
    sourceConfigPath: LINUX_TAURI_CONFIG_PATH,
    postInstallScriptPath: LINUX_POSTINSTALL_PATH,
    packageFormats: ['deb', 'rpm'],
    prepareCommand: '--prepare-bundled-openclaw-runtime',
    prepareFailureMode: 'abort-install',
    installRootOverrides: ['SDKWORK_CLAW_INSTALL_ROOT', 'RPM_INSTALL_PREFIX', '--install-root'],
  });
}

function readMacosInstallerContract(workspaceRootDir) {
  const tauriConfig = readJson(workspaceRootDir, MACOS_TAURI_CONFIG_PATH);

  assert.equal(
    tauriConfig?.bundle?.macOS?.files?.['generated/release/macos-install-root/'],
    'MacOS/',
    'Desktop macOS packaging must project the preexpanded OpenClaw managed runtime layout into Contents/MacOS/.',
  );

  return {
    version: 1,
    platform: 'macos',
    delivery: 'archive-only-resources',
    installMode: 'preexpanded-managed-layout',
    bundledResourceRoot: 'resources/openclaw/',
    runtimeArchive: 'resources/openclaw/runtime.zip',
    sourceConfigPath: MACOS_TAURI_CONFIG_PATH,
    stagedInstallRootSource: 'generated/release/macos-install-root/',
    stagedInstallRootTarget: 'MacOS/',
  };
}

export function readDesktopOpenClawInstallerContract({
  workspaceRootDir = rootDir,
  platform,
} = {}) {
  const platformId = normalizeDesktopPlatform(platform);

  if (platformId === 'windows') {
    return readWindowsInstallerContract(workspaceRootDir);
  }
  if (platformId === 'linux') {
    return readLinuxInstallerContract(workspaceRootDir);
  }
  if (platformId === 'macos') {
    return readMacosInstallerContract(workspaceRootDir);
  }

  throw new Error(`Unsupported desktop OpenClaw installer contract platform: ${platform}`);
}

export function assertDesktopOpenClawInstallerContract({
  actualContract,
  workspaceRootDir = rootDir,
  platform,
  contextLabel = 'Desktop OpenClaw installer contract',
} = {}) {
  const expectedContract = readDesktopOpenClawInstallerContract({
    workspaceRootDir,
    platform,
  });

  assert.deepEqual(
    normalizeDesktopOpenClawInstallerContract(actualContract),
    expectedContract,
    `${contextLabel} must match the current desktop OpenClaw installer contract for ${normalizeDesktopPlatform(platform)}.`,
  );

  return expectedContract;
}

export {
  normalizeDesktopOpenClawInstallerContract,
};
