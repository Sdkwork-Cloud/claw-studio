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
  ['packages/claw-studio-desktop/src-tauri/src/commands/app_info.rs', 'desktop app info command'],
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
