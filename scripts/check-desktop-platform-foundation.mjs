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
    failures.push(`Invalid JSON in ${relativePath}: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

function assertPath(relativePath, label) {
  const absolutePath = path.join(rootDir, relativePath);
  if (!existsSync(absolutePath)) {
    failures.push(`Missing ${label}: ${relativePath}`);
  }
}

function assertScript(pkg, pkgPath, scriptName) {
  if (!pkg?.scripts || typeof pkg.scripts[scriptName] !== 'string' || pkg.scripts[scriptName].trim().length === 0) {
    failures.push(`Missing script \"${scriptName}\" in ${pkgPath}`);
  }
}

function assertDependency(pkg, pkgPath, dependencyName, bucket = 'dependencies') {
  if (!pkg?.[bucket] || typeof pkg[bucket][dependencyName] !== 'string') {
    failures.push(`Missing ${bucket} dependency \"${dependencyName}\" in ${pkgPath}`);
  }
}

function assertIncludes(relativePath, expectedText, label) {
  const content = readText(relativePath);
  if (!content) {
    return;
  }

  if (!content.includes(expectedText)) {
    failures.push(`Missing ${label} in ${relativePath}: expected to find \"${expectedText}\"`);
  }
}

const requiredPaths = [
  ['packages/claw-studio-shell/package.json', 'shell package'],
  ['packages/claw-studio-shell/src/index.ts', 'shell entry'],
  ['packages/claw-studio-desktop/package.json', 'desktop package'],
  ['packages/claw-studio-desktop/src/main.tsx', 'desktop entry'],
  ['packages/claw-studio-desktop/src/desktop/tauriBridge.ts', 'desktop bridge'],
  ['packages/claw-studio-desktop/src-tauri/Cargo.toml', 'desktop Cargo manifest'],
  ['packages/claw-studio-desktop/src-tauri/tauri.conf.json', 'desktop Tauri config'],
  ['packages/claw-studio-desktop/src-tauri/src/framework/mod.rs', 'desktop framework module'],
  ['packages/claw-studio-desktop/src-tauri/src/framework/error.rs', 'desktop framework error module'],
  ['packages/claw-studio-desktop/src-tauri/src/framework/context.rs', 'desktop framework context module'],
  ['packages/claw-studio-desktop/src-tauri/src/framework/paths.rs', 'desktop framework paths module'],
  ['packages/claw-studio-desktop/src-tauri/src/framework/config.rs', 'desktop framework config module'],
  ['packages/claw-studio-desktop/src-tauri/src/framework/logging.rs', 'desktop framework logging module'],
  ['packages/claw-studio-desktop/src-tauri/src/framework/events.rs', 'desktop framework events module'],
  ['packages/claw-studio-desktop/src-tauri/src/framework/filesystem.rs', 'desktop framework filesystem module'],
  ['packages/claw-studio-desktop/src-tauri/src/framework/policy.rs', 'desktop framework policy module'],
  ['packages/claw-studio-desktop/src-tauri/src/framework/runtime.rs', 'desktop framework runtime module'],
  ['packages/claw-studio-desktop/src-tauri/src/framework/services/mod.rs', 'desktop framework services module'],
  ['packages/claw-studio-desktop/src-tauri/src/framework/services/system.rs', 'desktop system service module'],
  ['packages/claw-studio-desktop/src-tauri/src/framework/services/process.rs', 'desktop process service module'],
  ['packages/claw-studio-desktop/src-tauri/src/framework/services/jobs.rs', 'desktop jobs service module'],
  ['packages/claw-studio-desktop/src-tauri/src/framework/services/browser.rs', 'desktop browser service module'],
  ['packages/claw-studio-desktop/src-tauri/src/framework/services/dialog.rs', 'desktop dialog service module'],
  ['packages/claw-studio-desktop/src-tauri/src/plugins/mod.rs', 'desktop plugin registration module'],
  ['packages/claw-studio-desktop/src-tauri/src/commands/app_info.rs', 'desktop app info command'],
  ['packages/claw-studio-desktop/src-tauri/src/commands/get_app_paths.rs', 'desktop app paths command'],
  ['packages/claw-studio-desktop/src-tauri/src/commands/get_app_config.rs', 'desktop app config command'],
  ['packages/claw-studio-desktop/src-tauri/src/commands/process_commands.rs', 'desktop process command module'],
  ['packages/claw-studio-desktop/src-tauri/src/commands/job_commands.rs', 'desktop job command module'],
  ['packages/claw-studio-desktop/src-tauri/src/commands/list_directory.rs', 'desktop list directory command'],
  ['packages/claw-studio-desktop/src-tauri/src/commands/create_directory.rs', 'desktop create directory command'],
  ['packages/claw-studio-desktop/src-tauri/src/commands/remove_path.rs', 'desktop remove path command'],
  ['packages/claw-studio-desktop/src-tauri/src/commands/copy_path.rs', 'desktop copy path command'],
  ['packages/claw-studio-desktop/src-tauri/src/commands/move_path.rs', 'desktop move path command'],
  ['packages/claw-studio-desktop/src-tauri/src/commands/path_exists.rs', 'desktop path exists command'],
  ['packages/claw-studio-desktop/src-tauri/src/commands/get_path_info.rs', 'desktop path info command'],
  ['packages/claw-studio-desktop/src-tauri/src/commands/read_binary_file.rs', 'desktop binary read command'],
  ['packages/claw-studio-desktop/src-tauri/src/commands/write_binary_file.rs', 'desktop binary write command'],
  ['packages/claw-studio-desktop/src-tauri/src/commands/open_external.rs', 'desktop open external command'],
  ['packages/claw-studio-desktop/src-tauri/src/commands/select_files.rs', 'desktop select files command'],
  ['packages/claw-studio-desktop/src-tauri/src/commands/save_blob_file.rs', 'desktop save blob file command'],
  ['packages/claw-studio-desktop/src-tauri/src/state/mod.rs', 'desktop state module'],
  ['packages/claw-studio-desktop/src-tauri/src/platform/mod.rs', 'desktop platform module'],
  ['packages/claw-studio-distribution/package.json', 'distribution package'],
  ['packages/claw-studio-distribution/src/index.ts', 'distribution entry'],
  ['packages/claw-studio-distribution/src/manifests/cn/index.ts', 'cn distribution manifest'],
  ['packages/claw-studio-distribution/src/manifests/global/index.ts', 'global distribution manifest'],
];

for (const [relativePath, label] of requiredPaths) {
  assertPath(relativePath, label);
}

const rootPackagePath = 'package.json';
const desktopPackagePath = 'packages/claw-studio-desktop/package.json';
const rootPackage = readJson(rootPackagePath);
const desktopPackage = readJson(desktopPackagePath);

for (const scriptName of ['tauri:dev', 'tauri:build', 'tauri:icon', 'tauri:info']) {
  assertScript(rootPackage, rootPackagePath, scriptName);
  assertScript(desktopPackage, desktopPackagePath, scriptName);
}

assertDependency(desktopPackage, desktopPackagePath, '@tauri-apps/cli', 'devDependencies');

assertIncludes('packages/claw-studio-desktop/src/desktop/tauriBridge.ts', 'export async function getAppInfo', 'desktop app info bridge export');
assertIncludes('packages/claw-studio-desktop/src/desktop/tauriBridge.ts', 'export async function getAppPaths', 'desktop app paths bridge export');
assertIncludes('packages/claw-studio-desktop/src/desktop/tauriBridge.ts', 'export async function getAppConfig', 'desktop app config bridge export');
assertIncludes('packages/claw-studio-desktop/src/desktop/tauriBridge.ts', 'export async function listDirectory', 'desktop list directory bridge export');
assertIncludes('packages/claw-studio-desktop/src/desktop/tauriBridge.ts', 'export async function createDirectory', 'desktop create directory bridge export');
assertIncludes('packages/claw-studio-desktop/src/desktop/tauriBridge.ts', 'export async function removePath', 'desktop remove path bridge export');
assertIncludes('packages/claw-studio-desktop/src/desktop/tauriBridge.ts', 'export async function copyPath', 'desktop copy path bridge export');
assertIncludes('packages/claw-studio-desktop/src/desktop/tauriBridge.ts', 'export async function movePath', 'desktop move path bridge export');
assertIncludes('packages/claw-studio-desktop/src/desktop/tauriBridge.ts', 'export async function pathExists', 'desktop path exists bridge export');
assertIncludes('packages/claw-studio-desktop/src/desktop/tauriBridge.ts', 'export async function getPathInfo', 'desktop path info bridge export');
assertIncludes('packages/claw-studio-desktop/src/desktop/tauriBridge.ts', 'export async function readBinaryFile', 'desktop binary read bridge export');
assertIncludes('packages/claw-studio-desktop/src/desktop/tauriBridge.ts', 'export async function writeBinaryFile', 'desktop binary write bridge export');
assertIncludes('packages/claw-studio-desktop/src/desktop/tauriBridge.ts', 'export async function subscribeJobUpdates', 'desktop job event subscription export');
assertIncludes('packages/claw-studio-desktop/src/desktop/tauriBridge.ts', 'export async function subscribeProcessOutput', 'desktop process event subscription export');
assertIncludes('packages/claw-studio-desktop/src/desktop/tauriBridge.ts', 'invoke<void>(\'open_external\'', 'desktop open external invoke wiring');
assertIncludes('packages/claw-studio-desktop/src/desktop/tauriBridge.ts', 'invoke<string[]>(\'select_files\'', 'desktop select files invoke wiring');
assertIncludes('packages/claw-studio-desktop/src/desktop/tauriBridge.ts', 'invoke(\'save_blob_file\'', 'desktop save blob file invoke wiring');
assertIncludes('packages/claw-studio-desktop/src/desktop/tauriBridge.ts', 'listen<', 'desktop event listener wiring');
assertIncludes('packages/claw-studio-desktop/src-tauri/Cargo.toml', 'tauri-plugin-single-instance', 'single-instance plugin dependency');
assertIncludes('packages/claw-studio-desktop/src-tauri/Cargo.toml', 'tauri-plugin-dialog', 'dialog plugin dependency');
assertIncludes('packages/claw-studio-desktop/src-tauri/Cargo.toml', 'tauri-plugin-opener', 'opener plugin dependency');
assertIncludes('packages/claw-studio-desktop/src-tauri/src/app/bootstrap.rs', 'plugins', 'plugin bootstrap wiring');
assertIncludes('packages/claw-studio-desktop/src-tauri/src/framework/mod.rs', 'pub mod runtime;', 'desktop runtime export');
assertIncludes('packages/claw-studio-desktop/src-tauri/src/framework/mod.rs', 'pub mod services;', 'desktop services export');
assertIncludes('packages/claw-studio-desktop/src-tauri/src/framework/context.rs', 'services', 'desktop context services wiring');
assertIncludes('packages/claw-studio-desktop/src-tauri/src/framework/events.rs', 'job://updated', 'desktop job event constant');
assertIncludes('packages/claw-studio-desktop/src-tauri/src/framework/events.rs', 'process://output', 'desktop process output event constant');
assertIncludes('packages/claw-studio-infrastructure/src/platform/contracts/runtime.ts', 'subscribeJobUpdates', 'runtime job subscription contract');
assertIncludes('packages/claw-studio-infrastructure/src/platform/contracts/runtime.ts', 'subscribeProcessOutput', 'runtime process subscription contract');
assertIncludes('packages/claw-studio-business/src/services/runtimeService.ts', 'subscribeJobUpdates', 'runtime service job subscription helper');
assertIncludes('packages/claw-studio-business/src/services/runtimeService.ts', 'subscribeProcessOutput', 'runtime service process subscription helper');
assertIncludes('.gitignore', '.venv/', 'Python virtual environment ignore rule');
assertIncludes('.gitignore', '__pycache__/', 'Python bytecode cache ignore rule');
assertIncludes('.gitignore', '*.pyc', 'Python compiled file ignore rule');
assertIncludes('.gitignore', '.pytest_cache/', 'pytest cache ignore rule');
assertIncludes('.gitignore', '.cache/', 'generic cache ignore rule');

const tauriLeakTargets = [
  'packages/claw-studio-install/src/pages/install/Install.tsx',
  'packages/claw-studio-install/src/pages/install/InstallDetail.tsx',
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
