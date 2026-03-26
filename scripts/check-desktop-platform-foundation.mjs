import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const failures = [];

function readText(relativePath) {
  const absolutePath = path.join(rootDir, relativePath);
  if (!existsSync(absolutePath)) {
    failures.push(`Missing required file: ${relativePath}`);
    return null;
  }

  return readFileSync(absolutePath, 'utf8');
}

function readJson(relativePath) {
  const content = readText(relativePath);
  if (!content) {
    return null;
  }

  try {
    return JSON.parse(content);
  } catch (error) {
    failures.push(
      `Invalid JSON in ${relativePath}: ${error instanceof Error ? error.message : String(error)}`,
    );
    return null;
  }
}

function assertPath(relativePath, label) {
  if (!existsSync(path.join(rootDir, relativePath))) {
    failures.push(`Missing ${label}: ${relativePath}`);
  }
}

function assertScript(pkg, pkgPath, scriptName) {
  if (!pkg?.scripts || typeof pkg.scripts[scriptName] !== 'string' || pkg.scripts[scriptName].trim().length === 0) {
    failures.push(`Missing script "${scriptName}" in ${pkgPath}`);
  }
}

function assertDependency(pkg, pkgPath, dependencyName, bucket = 'dependencies') {
  if (!pkg?.[bucket] || typeof pkg[bucket][dependencyName] !== 'string') {
    failures.push(`Missing ${bucket} dependency "${dependencyName}" in ${pkgPath}`);
  }
}

function assertIncludes(relativePath, expectedText, label) {
  const content = readText(relativePath);
  if (!content) {
    return;
  }

  if (!content.includes(expectedText)) {
    failures.push(`Missing ${label} in ${relativePath}: expected to find "${expectedText}"`);
  }
}

const requiredPaths = [
  ['packages/sdkwork-claw-shell/package.json', 'shell package'],
  ['packages/sdkwork-claw-shell/src/index.ts', 'shell entry'],
  ['packages/sdkwork-claw-desktop/package.json', 'desktop package'],
  ['packages/sdkwork-claw-desktop/.env.example', 'desktop env example'],
  ['packages/sdkwork-claw-desktop/src/main.tsx', 'desktop entry'],
  ['packages/sdkwork-claw-desktop/src/desktop/catalog.ts', 'desktop command and event catalog module'],
  ['packages/sdkwork-claw-desktop/src/desktop/runtime.ts', 'desktop runtime bridge module'],
  ['packages/sdkwork-claw-desktop/src/desktop/tauriBridge.ts', 'desktop bridge'],
  ['packages/sdkwork-claw-infrastructure/src/config/env.ts', 'desktop env config module'],
  ['packages/sdkwork-claw-infrastructure/src/updates/contracts.ts', 'desktop update contracts module'],
  ['packages/sdkwork-claw-infrastructure/src/updates/updateClient.ts', 'desktop update client module'],
  ['packages/sdkwork-claw-core/src/services/updateService.ts', 'desktop update business service'],
  ['packages/sdkwork-claw-core/src/stores/useUpdateStore.ts', 'desktop update state store'],
  ['packages/sdkwork-claw-desktop/src-tauri/Cargo.toml', 'desktop Cargo manifest'],
  ['packages/sdkwork-claw-desktop/src-tauri/tauri.conf.json', 'desktop Tauri config'],
  ['packages/sdkwork-claw-desktop/src-tauri/generated', 'desktop generated bundled resource root'],
  ['packages/sdkwork-claw-desktop/src-tauri/resources/openclaw-runtime/runtime', 'bundled openclaw runtime resource root'],
  ['packages/sdkwork-claw-desktop/src-tauri/resources/openclaw-runtime/manifest.json', 'bundled openclaw runtime manifest'],
  ['packages/sdkwork-claw-desktop/src-tauri/src/framework/mod.rs', 'desktop framework module'],
  ['packages/sdkwork-claw-desktop/src-tauri/src/framework/error.rs', 'desktop framework error module'],
  ['packages/sdkwork-claw-desktop/src-tauri/src/framework/context.rs', 'desktop framework context module'],
  ['packages/sdkwork-claw-desktop/src-tauri/src/framework/paths.rs', 'desktop framework paths module'],
  ['packages/sdkwork-claw-desktop/src-tauri/src/framework/config.rs', 'desktop framework config module'],
  ['packages/sdkwork-claw-desktop/src-tauri/src/framework/kernel.rs', 'desktop framework kernel contract module'],
  ['packages/sdkwork-claw-desktop/src-tauri/src/framework/logging.rs', 'desktop framework logging module'],
  ['packages/sdkwork-claw-desktop/src-tauri/src/framework/events.rs', 'desktop framework events module'],
  ['packages/sdkwork-claw-desktop/src-tauri/src/framework/filesystem.rs', 'desktop framework filesystem module'],
  ['packages/sdkwork-claw-desktop/src-tauri/src/framework/policy.rs', 'desktop framework policy module'],
  ['packages/sdkwork-claw-desktop/src-tauri/src/framework/runtime.rs', 'desktop framework runtime module'],
  ['packages/sdkwork-claw-desktop/src-tauri/src/framework/storage.rs', 'desktop framework storage contract module'],
  ['packages/sdkwork-claw-desktop/src-tauri/src/framework/services/mod.rs', 'desktop framework services module'],
  ['packages/sdkwork-claw-desktop/src-tauri/src/framework/services/system.rs', 'desktop system service module'],
  ['packages/sdkwork-claw-desktop/src-tauri/src/framework/services/kernel.rs', 'desktop kernel assembler service module'],
  ['packages/sdkwork-claw-desktop/src-tauri/src/framework/services/security.rs', 'desktop security service module'],
  ['packages/sdkwork-claw-desktop/src-tauri/src/framework/services/notifications.rs', 'desktop notifications service module'],
  ['packages/sdkwork-claw-desktop/src-tauri/src/framework/services/payments.rs', 'desktop payments service module'],
  ['packages/sdkwork-claw-desktop/src-tauri/src/framework/services/integrations.rs', 'desktop integrations service module'],
  ['packages/sdkwork-claw-desktop/src-tauri/src/framework/services/openclaw_runtime.rs', 'desktop bundled openclaw runtime service module'],
  ['packages/sdkwork-claw-desktop/src-tauri/src/framework/services/api_router_managed_runtime.rs', 'desktop bundled api router runtime service module'],
  ['packages/sdkwork-claw-desktop/src-tauri/src/framework/services/api_router_runtime.rs', 'desktop api router runtime service module'],
  ['packages/sdkwork-claw-desktop/src-tauri/src/framework/services/path_registration.rs', 'desktop bundled openclaw path registration service module'],
  ['packages/sdkwork-claw-desktop/src-tauri/src/framework/services/permissions.rs', 'desktop permissions service module'],
  ['packages/sdkwork-claw-desktop/src-tauri/src/framework/services/process.rs', 'desktop process service module'],
  ['packages/sdkwork-claw-desktop/src-tauri/src/framework/services/jobs.rs', 'desktop jobs service module'],
  ['packages/sdkwork-claw-desktop/src-tauri/src/framework/services/browser.rs', 'desktop browser service module'],
  ['packages/sdkwork-claw-desktop/src-tauri/src/framework/services/dialog.rs', 'desktop dialog service module'],
  ['packages/sdkwork-claw-desktop/src-tauri/src/framework/services/storage.rs', 'desktop storage service module'],
  ['packages/sdkwork-claw-desktop/src-tauri/src/plugins/mod.rs', 'desktop plugin registration module'],
  ['packages/sdkwork-claw-desktop/src-tauri/src/commands/app_info.rs', 'desktop app info command'],
  ['packages/sdkwork-claw-desktop/src-tauri/src/commands/desktop_kernel.rs', 'desktop kernel command module'],
  ['packages/sdkwork-claw-desktop/src-tauri/src/commands/get_app_paths.rs', 'desktop app paths command'],
  ['packages/sdkwork-claw-desktop/src-tauri/src/commands/get_app_config.rs', 'desktop app config command'],
  ['packages/sdkwork-claw-desktop/src-tauri/src/commands/api_router_runtime.rs', 'desktop api router runtime command'],
  ['packages/sdkwork-claw-desktop/src-tauri/src/commands/run_hub_install.rs', 'desktop hub install command'],
  ['packages/sdkwork-claw-desktop/src-tauri/src/commands/run_hub_uninstall.rs', 'desktop hub uninstall command'],
  ['packages/sdkwork-claw-desktop/src-tauri/src/commands/process_commands.rs', 'desktop process command module'],
  ['packages/sdkwork-claw-desktop/src-tauri/src/commands/job_commands.rs', 'desktop job command module'],
  ['packages/sdkwork-claw-desktop/src-tauri/src/commands/list_directory.rs', 'desktop list directory command'],
  ['packages/sdkwork-claw-desktop/src-tauri/src/commands/create_directory.rs', 'desktop create directory command'],
  ['packages/sdkwork-claw-desktop/src-tauri/src/commands/remove_path.rs', 'desktop remove path command'],
  ['packages/sdkwork-claw-desktop/src-tauri/src/commands/copy_path.rs', 'desktop copy path command'],
  ['packages/sdkwork-claw-desktop/src-tauri/src/commands/move_path.rs', 'desktop move path command'],
  ['packages/sdkwork-claw-desktop/src-tauri/src/commands/path_exists.rs', 'desktop path exists command'],
  ['packages/sdkwork-claw-desktop/src-tauri/src/commands/get_path_info.rs', 'desktop path info command'],
  ['packages/sdkwork-claw-desktop/src-tauri/src/commands/read_binary_file.rs', 'desktop binary read command'],
  ['packages/sdkwork-claw-desktop/src-tauri/src/commands/write_binary_file.rs', 'desktop binary write command'],
  ['packages/sdkwork-claw-desktop/src-tauri/src/commands/open_external.rs', 'desktop open external command'],
  ['packages/sdkwork-claw-desktop/src-tauri/src/commands/select_files.rs', 'desktop select files command'],
  ['packages/sdkwork-claw-desktop/src-tauri/src/commands/save_blob_file.rs', 'desktop save blob file command'],
  ['packages/sdkwork-claw-desktop/src-tauri/src/commands/fetch_remote_url.rs', 'desktop remote url fetch command'],
  ['packages/sdkwork-claw-desktop/src-tauri/src/commands/capture_screenshot.rs', 'desktop capture screenshot command'],
  ['packages/sdkwork-claw-desktop/src-tauri/src/state/mod.rs', 'desktop state module'],
  ['packages/sdkwork-claw-desktop/src-tauri/src/platform/mod.rs', 'desktop platform module'],
  ['scripts/prepare-openclaw-runtime.mjs', 'bundled openclaw runtime prepare script'],
  ['scripts/prepare-openclaw-runtime.test.mjs', 'bundled openclaw runtime prepare test'],
  ['scripts/prepare-sdkwork-api-router-runtime.mjs', 'bundled sdkwork-api-router runtime prepare script'],
  ['scripts/prepare-sdkwork-api-router-runtime.test.mjs', 'bundled sdkwork-api-router runtime prepare test'],
  ['scripts/verify-desktop-build-assets.mjs', 'desktop bundled asset verification script'],
  ['scripts/ensure-tauri-dev-binary-unlocked.mjs', 'tauri dev binary unlock guard script'],
  ['scripts/ensure-tauri-dev-binary-unlocked.test.mjs', 'tauri dev binary unlock guard test'],
  ['packages/sdkwork-claw-distribution/package.json', 'distribution package'],
  ['packages/sdkwork-claw-distribution/src/index.ts', 'distribution entry'],
  ['packages/sdkwork-claw-distribution/src/manifests/cn/index.ts', 'cn distribution manifest'],
  ['packages/sdkwork-claw-distribution/src/manifests/global/index.ts', 'global distribution manifest'],
];

for (const [relativePath, label] of requiredPaths) {
  assertPath(relativePath, label);
}

const rootPackagePath = 'package.json';
const desktopPackagePath = 'packages/sdkwork-claw-desktop/package.json';
const rootPackage = readJson(rootPackagePath);
const desktopPackage = readJson(desktopPackagePath);

for (const scriptName of ['tauri:dev', 'tauri:build', 'tauri:icon', 'tauri:info']) {
  assertScript(rootPackage, rootPackagePath, scriptName);
  assertScript(desktopPackage, desktopPackagePath, scriptName);
}

assertScript(desktopPackage, desktopPackagePath, 'dev:tauri');
assertScript(desktopPackage, desktopPackagePath, 'prepare:openclaw-runtime');
assertScript(desktopPackage, desktopPackagePath, 'prepare:api-router-runtime');
assertScript(rootPackage, rootPackagePath, 'sync:bundled-components');

assertDependency(desktopPackage, desktopPackagePath, '@tauri-apps/cli', 'devDependencies');
assertIncludes(
  'packages/sdkwork-claw-desktop/.env.example',
  'SDKWORK_API_ROUTER_BUNDLED_SOURCE_DIR',
  'desktop bundled sdkwork-api-router source dir env example',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/.env.example',
  'SDKWORK_API_ROUTER_SOURCE_REPO_DIR',
  'desktop bundled sdkwork-api-router source repo dir env example',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/.env.example',
  'SDKWORK_API_ROUTER_ADMIN_SITE_SOURCE_DIR',
  'desktop bundled sdkwork-api-router admin site source dir env example',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/.env.example',
  'SDKWORK_API_ROUTER_PORTAL_SITE_SOURCE_DIR',
  'desktop bundled sdkwork-api-router portal site source dir env example',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/.env.example',
  'SDKWORK_API_ROUTER_BASE_PORT',
  'desktop managed sdkwork-api-router base port env example',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/.env.example',
  'SDKWORK_API_ROUTER_GATEWAY_BIND',
  'desktop managed sdkwork-api-router gateway bind env example',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/.env.example',
  'SDKWORK_API_ROUTER_ADMIN_BIND',
  'desktop managed sdkwork-api-router admin bind env example',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/.env.example',
  'SDKWORK_API_ROUTER_PORTAL_BIND',
  'desktop managed sdkwork-api-router portal bind env example',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/src/desktop/catalog.ts',
  'export const DESKTOP_COMMANDS',
  'desktop command catalog export',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/src/desktop/catalog.ts',
  'installApiRouterClientSetup',
  'desktop api router installer command catalog entry',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/src/desktop/catalog.ts',
  'getApiRouterRuntimeStatus',
  'desktop api router runtime command catalog entry',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/src/desktop/catalog.ts',
  'captureScreenshot',
  'desktop screenshot command catalog entry',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/src/desktop/catalog.ts',
  'fetchRemoteUrl',
  'desktop remote url fetch command catalog entry',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/src/desktop/catalog.ts',
  'desktopComponentCatalog',
  'desktop component catalog command catalog entry',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/src/desktop/catalog.ts',
  'desktopComponentControl',
  'desktop component control command catalog entry',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/src/desktop/catalog.ts',
  'export const DESKTOP_EVENTS',
  'desktop event catalog export',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/src/desktop/runtime.ts',
  'export class DesktopBridgeError',
  'desktop bridge error export',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/src/desktop/runtime.ts',
  'export async function invokeDesktopCommand',
  'desktop invoke wrapper export',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/src/desktop/runtime.ts',
  'export async function listenDesktopEvent',
  'desktop event listener wrapper export',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/src/desktop/tauriBridge.ts',
  'export async function getAppInfo',
  'desktop app info bridge export',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/src/desktop/tauriBridge.ts',
  'export async function getAppPaths',
  'desktop app paths bridge export',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/src/desktop/tauriBridge.ts',
  'export async function getAppConfig',
  'desktop app config bridge export',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/src/desktop/tauriBridge.ts',
  'export async function getDesktopKernelInfo',
  'desktop kernel info bridge export',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/src/desktop/tauriBridge.ts',
  'export async function getDesktopStorageInfo',
  'desktop storage info bridge export',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/src/desktop/tauriBridge.ts',
  'export async function captureScreenshot',
  'desktop screenshot bridge export',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/src/desktop/tauriBridge.ts',
  'export async function fetchRemoteUrl',
  'desktop remote url fetch bridge export',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/src/desktop/tauriBridge.ts',
  "from './componentsBridge'",
  'desktop components bridge integration',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/src/desktop/tauriBridge.ts',
  'export function supportsNativeScreenshot',
  'desktop screenshot support bridge export',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/src/desktop/tauriBridge.ts',
  'export async function listDirectory',
  'desktop list directory bridge export',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/src/desktop/tauriBridge.ts',
  'export async function createDirectory',
  'desktop create directory bridge export',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/src/desktop/tauriBridge.ts',
  'export async function removePath',
  'desktop remove path bridge export',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/src/desktop/tauriBridge.ts',
  'export async function copyPath',
  'desktop copy path bridge export',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/src/desktop/tauriBridge.ts',
  'export async function movePath',
  'desktop move path bridge export',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/src/desktop/tauriBridge.ts',
  'export async function pathExists',
  'desktop path exists bridge export',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/src/desktop/tauriBridge.ts',
  'export async function getPathInfo',
  'desktop path info bridge export',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/src/desktop/tauriBridge.ts',
  'export async function readBinaryFile',
  'desktop binary read bridge export',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/src/desktop/tauriBridge.ts',
  'export async function writeBinaryFile',
  'desktop binary write bridge export',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/src/desktop/tauriBridge.ts',
  'export async function subscribeJobUpdates',
  'desktop job event subscription export',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/src/desktop/tauriBridge.ts',
  'export async function subscribeProcessOutput',
  'desktop process event subscription export',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/src/desktop/tauriBridge.ts',
  'DESKTOP_COMMANDS',
  'desktop command catalog usage',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/src/desktop/tauriBridge.ts',
  'DESKTOP_EVENTS',
  'desktop event catalog usage',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/src/desktop/tauriBridge.ts',
  'invokeDesktopCommand',
  'desktop invoke wrapper usage',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/src/desktop/tauriBridge.ts',
  'listenDesktopEvent',
  'desktop event wrapper usage',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/src/desktop/tauriBridge.ts',
  'export const desktopTemplateApi',
  'desktop template API facade export',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/src/desktop/tauriBridge.ts',
  'catalog:',
  'desktop template API catalog grouping',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/src/desktop/tauriBridge.ts',
  'meta:',
  'desktop template API meta grouping',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/src/desktop/tauriBridge.ts',
  'app:',
  'desktop template API app grouping',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/src/desktop/tauriBridge.ts',
  'kernel:',
  'desktop template API kernel grouping',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/src/desktop/tauriBridge.ts',
  'storage:',
  'desktop template API storage grouping',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/src/desktop/tauriBridge.ts',
  'filesystem:',
  'desktop template API filesystem grouping',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/src/desktop/tauriBridge.ts',
  'jobs:',
  'desktop template API job grouping',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/src/desktop/tauriBridge.ts',
  'shell:',
  'desktop template API shell grouping',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/src/desktop/tauriBridge.ts',
  'installer:',
  'desktop template API installer grouping',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/src/desktop/tauriBridge.ts',
  'runtime:',
  'desktop template API runtime grouping',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/src/index.ts',
  'DESKTOP_COMMANDS',
  'desktop package command catalog export',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/src/index.ts',
  'DESKTOP_EVENTS',
  'desktop package event catalog export',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/src/index.ts',
  'desktopTemplateApi',
  'desktop package template API export',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/src/index.ts',
  'captureScreenshot',
  'desktop package screenshot export',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/src/index.ts',
  'controlDesktopComponent',
  'desktop package component control export',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/src/index.ts',
  'fetchRemoteUrl',
  'desktop package remote url fetch export',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/src/index.ts',
  'DesktopBridgeError',
  'desktop package bridge error export',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/src/desktop/tauriBridge.ts',
  'DESKTOP_COMMANDS.openExternal',
  'desktop open external invoke wiring',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/src/desktop/tauriBridge.ts',
  'DESKTOP_COMMANDS.selectFiles',
  'desktop select files invoke wiring',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/src/desktop/tauriBridge.ts',
  'DESKTOP_COMMANDS.saveBlobFile',
  'desktop save blob file invoke wiring',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/src/desktop/tauriBridge.ts',
  'DESKTOP_COMMANDS.captureScreenshot',
  'desktop screenshot invoke wiring',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/src/desktop/tauriBridge.ts',
  'DESKTOP_COMMANDS.fetchRemoteUrl',
  'desktop remote url fetch invoke wiring',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/src/desktop/tauriBridge.ts',
  'DESKTOP_COMMANDS.runHubInstall',
  'desktop hub install invoke wiring',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/src/desktop/tauriBridge.ts',
  'DESKTOP_COMMANDS.runHubUninstall',
  'desktop hub uninstall invoke wiring',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/src/desktop/tauriBridge.ts',
  'DESKTOP_COMMANDS.installApiRouterClientSetup',
  'desktop api router installer invoke wiring',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/src/desktop/tauriBridge.ts',
  'export async function installApiRouterClientSetup',
  'desktop api router installer bridge export',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/src/desktop/tauriBridge.ts',
  'export async function getApiRouterRuntimeStatus',
  'desktop api router runtime bridge export',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/src/desktop/tauriBridge.ts',
  'listenDesktopEvent',
  'desktop event listener wiring',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/src-tauri/Cargo.toml',
  'tauri-plugin-single-instance',
  'single-instance plugin dependency',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/src-tauri/Cargo.toml',
  'tauri-plugin-dialog',
  'dialog plugin dependency',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/src-tauri/Cargo.toml',
  'tauri-plugin-opener',
  'opener plugin dependency',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/src-tauri/Cargo.toml',
  'xcap',
  'desktop screenshot crate dependency',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/src-tauri/Cargo.toml',
  'image',
  'desktop screenshot image dependency',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/src-tauri/src/app/bootstrap.rs',
  'plugins',
  'plugin bootstrap wiring',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/src-tauri/src/app/bootstrap.rs',
  'commands::desktop_kernel::desktop_kernel_info',
  'desktop kernel command registration',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/src-tauri/src/app/bootstrap.rs',
  'commands::desktop_kernel::desktop_storage_info',
  'desktop storage command registration',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/src-tauri/src/app/bootstrap.rs',
  'commands::run_hub_install::run_hub_install',
  'desktop hub install command registration',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/src-tauri/src/app/bootstrap.rs',
  'commands::run_hub_uninstall::run_hub_uninstall',
  'desktop hub uninstall command registration',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/src-tauri/src/app/bootstrap.rs',
  'commands::capture_screenshot::capture_screenshot',
  'desktop screenshot command registration',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/src-tauri/src/app/bootstrap.rs',
  'commands::component_commands::desktop_component_catalog',
  'desktop component catalog command registration',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/src-tauri/src/app/bootstrap.rs',
  'commands::component_commands::desktop_component_control',
  'desktop component control command registration',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/src-tauri/src/app/bootstrap.rs',
  'commands::fetch_remote_url::fetch_remote_url',
  'desktop remote url fetch command registration',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/src-tauri/src/app/bootstrap.rs',
  'activate_bundled_openclaw',
  'bundled openclaw startup activation wiring',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/src-tauri/src/app/bootstrap.rs',
  'inspect_api_router_runtime_on_startup(&app_handle, context.as_ref())?;',
  'bundled api router startup inspection wiring',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/src-tauri/src/app/bootstrap.rs',
  'activate_bundled_api_router',
  'bundled api router startup activation wiring',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/src-tauri/src/app/bootstrap.rs',
  'restart_openclaw_gateway',
  'bundled openclaw supervisor restart wiring',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/src-tauri/src/app/bootstrap.rs',
  'commands::install_api_router_client_setup::install_api_router_client_setup',
  'desktop api router installer command registration',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/src-tauri/src/app/bootstrap.rs',
  'commands::api_router_runtime::get_api_router_runtime_status',
  'desktop api router runtime command registration',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/src-tauri/src/framework/services/mod.rs',
  'pub mod openclaw_runtime;',
  'bundled openclaw runtime service export',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/src-tauri/src/framework/services/mod.rs',
  'pub mod api_router_managed_runtime;',
  'bundled api router runtime service export',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/src-tauri/src/framework/services/mod.rs',
  'pub mod api_router_runtime;',
  'desktop api router runtime service export',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/src-tauri/tauri.conf.json',
  'resources/sdkwork-api-router-runtime/**/*',
  'bundled api router runtime resource declaration',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/src-tauri/tauri.conf.json',
  'foundation/components/**/*',
  'bundled component metadata resource packaging',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/src-tauri/tauri.conf.json',
  'generated/bundled/**/*',
  'generated bundled asset resource packaging',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/src-tauri/src/framework/services/mod.rs',
  'pub mod path_registration;',
  'bundled openclaw path registration service export',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/src-tauri/src/framework/mod.rs',
  'pub mod runtime;',
  'desktop runtime export',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/src-tauri/src/framework/mod.rs',
  'pub mod services;',
  'desktop services export',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/src-tauri/src/framework/context.rs',
  'services',
  'desktop context services wiring',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/src-tauri/src/framework/events.rs',
  'job://updated',
  'desktop job event constant',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/src-tauri/src/framework/events.rs',
  'process://output',
  'desktop process output event constant',
);
assertIncludes(
  'packages/sdkwork-claw-infrastructure/src/platform/contracts/runtime.ts',
  'RuntimeApiRouterRuntimeStatus',
  'runtime api router status contract',
);
assertIncludes(
  'packages/sdkwork-claw-infrastructure/src/platform/contracts/runtime.ts',
  'subscribeJobUpdates',
  'runtime job subscription contract',
);
assertIncludes(
  'packages/sdkwork-claw-infrastructure/src/platform/contracts/runtime.ts',
  'subscribeProcessOutput',
  'runtime process subscription contract',
);
assertIncludes(
  'packages/sdkwork-claw-infrastructure/src/config/env.ts',
  'export function createAppEnvConfig',
  'typed env factory',
);
assertIncludes(
  'packages/sdkwork-claw-infrastructure/src/updates/updateClient.ts',
  'APP_UPDATE_CHECK_PATH',
  'backend update check path constant',
);
assertIncludes(
  'packages/sdkwork-claw-core/src/services/updateService.ts',
  'checkForAppUpdate',
  'business update check service',
);
assertIncludes(
  'packages/sdkwork-claw-core/src/services/updateService.ts',
  'resolvePreferredUpdateAction',
  'business update action resolver',
);
assertIncludes(
  'packages/sdkwork-claw-core/src/services/updateService.ts',
  'isStartupCheckEnabled',
  'business startup update flag helper',
);
assertIncludes(
  'packages/sdkwork-claw-core/src/stores/useUpdateStore.ts',
  'runStartupCheck',
  'startup update store action',
);
assertIncludes(
  'packages/sdkwork-claw-core/src/stores/useUpdateStore.ts',
  'openLatestUpdateTarget',
  'manual update action store helper',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/src/desktop/bootstrap/createDesktopApp.tsx',
  'configureDesktopPlatformBridge()',
  'desktop bridge bootstrap wiring',
);
assertIncludes(
  'packages/sdkwork-claw-shell/src/application/providers/AppProviders.tsx',
  'runStartupCheck',
  'shell startup update check wiring',
);
assertIncludes('.gitignore', '.venv/', 'Python virtual environment ignore rule');
assertIncludes('.gitignore', '__pycache__/', 'Python bytecode cache ignore rule');
assertIncludes('.gitignore', '*.pyc', 'Python compiled file ignore rule');
assertIncludes('.gitignore', '.pytest_cache/', 'pytest cache ignore rule');
assertIncludes('.gitignore', '.cache/', 'generic cache ignore rule');

const tauriLeakTargets = [
  'packages/sdkwork-claw-install/src/pages/install/Install.tsx',
  'packages/sdkwork-claw-install/src/pages/install/InstallDetail.tsx',
];

for (const relativePath of tauriLeakTargets) {
  const content = readText(relativePath);
  if (!content) {
    continue;
  }

  if (content.includes('@tauri-apps/api/core')) {
    failures.push(`Direct Tauri API import is not allowed in page layer: ${relativePath}`);
  }
}

if (failures.length > 0) {
  console.error('Desktop platform foundation check failed:\n');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('Desktop platform foundation check passed.');
