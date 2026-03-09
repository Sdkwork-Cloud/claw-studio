import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const requiredPaths = [
  'packages/claw-studio-shell/package.json',
  'packages/claw-studio-shell/src/index.ts',
  'packages/claw-studio-desktop/package.json',
  'packages/claw-studio-desktop/src/main.tsx',
  'packages/claw-studio-desktop/src-tauri/Cargo.toml',
  'packages/claw-studio-desktop/src-tauri/tauri.conf.json',
  'packages/claw-studio-distribution/package.json',
  'packages/claw-studio-distribution/src/index.ts',
  'packages/claw-studio-distribution/src/manifests/cn/index.ts',
  'packages/claw-studio-distribution/src/manifests/global/index.ts',
];

const tauriLeakTargets = [
  'packages/claw-studio-install/src/pages/install/Install.tsx',
  'packages/claw-studio-install/src/pages/install/InstallDetail.tsx',
];

const failures = [];

for (const relativePath of requiredPaths) {
  const absolutePath = path.join(rootDir, relativePath);
  if (!existsSync(absolutePath)) {
    failures.push(`Missing required desktop foundation file: ${relativePath}`);
  }
}

for (const relativePath of tauriLeakTargets) {
  const absolutePath = path.join(rootDir, relativePath);
  if (!existsSync(absolutePath)) {
    failures.push(`Missing Tauri leak check target: ${relativePath}`);
    continue;
  }

  const content = readFileSync(absolutePath, 'utf8');
  if (content.includes("@tauri-apps/api/core")) {
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
