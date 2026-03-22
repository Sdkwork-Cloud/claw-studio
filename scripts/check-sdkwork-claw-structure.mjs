import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const packagesDir = path.join(root, 'packages');

const requiredPackages = [
  ['packages/sdkwork-claw-web', '@sdkwork/claw-web'],
  ['packages/sdkwork-claw-desktop', '@sdkwork/claw-desktop'],
  ['packages/sdkwork-claw-shell', '@sdkwork/claw-shell'],
  ['packages/sdkwork-claw-commons', '@sdkwork/claw-commons'],
  ['packages/sdkwork-claw-ui', '@sdkwork/claw-ui'],
  ['packages/sdkwork-claw-core', '@sdkwork/claw-core'],
  ['packages/sdkwork-claw-i18n', '@sdkwork/claw-i18n'],
  ['packages/sdkwork-claw-types', '@sdkwork/claw-types'],
  ['packages/sdkwork-claw-distribution', '@sdkwork/claw-distribution'],
  ['packages/sdkwork-claw-account', '@sdkwork/claw-account'],
  ['packages/sdkwork-claw-agent', '@sdkwork/claw-agent'],
  ['packages/sdkwork-claw-apirouter', '@sdkwork/claw-apirouter'],
  ['packages/sdkwork-claw-apps', '@sdkwork/claw-apps'],
  ['packages/sdkwork-claw-auth', '@sdkwork/claw-auth'],
  ['packages/sdkwork-claw-center', '@sdkwork/claw-center'],
  ['packages/sdkwork-claw-channels', '@sdkwork/claw-channels'],
  ['packages/sdkwork-claw-chat', '@sdkwork/claw-chat'],
  ['packages/sdkwork-claw-community', '@sdkwork/claw-community'],
  ['packages/sdkwork-claw-dashboard', '@sdkwork/claw-dashboard'],
  ['packages/sdkwork-claw-devices', '@sdkwork/claw-devices'],
  ['packages/sdkwork-claw-docs', '@sdkwork/claw-docs'],
  ['packages/sdkwork-claw-extensions', '@sdkwork/claw-extensions'],
  ['packages/sdkwork-claw-github', '@sdkwork/claw-github'],
  ['packages/sdkwork-claw-huggingface', '@sdkwork/claw-huggingface'],
  ['packages/sdkwork-claw-install', '@sdkwork/claw-install'],
  ['packages/sdkwork-claw-instances', '@sdkwork/claw-instances'],
  ['packages/sdkwork-claw-market', '@sdkwork/claw-market'],
  ['packages/sdkwork-claw-model-purchase', '@sdkwork/claw-model-purchase'],
  ['packages/sdkwork-claw-points', '@sdkwork/claw-points'],
  ['packages/sdkwork-claw-settings', '@sdkwork/claw-settings'],
  ['packages/sdkwork-claw-tasks', '@sdkwork/claw-tasks'],
];

const errors = [];
const workspaceConfig = path.join(root, 'pnpm-workspace.yaml');

function assertExists(relPath, label) {
  if (!fs.existsSync(path.join(root, relPath))) {
    errors.push(`Missing ${label}: ${relPath}`);
  }
}

function assertWorkspaceTargetsSdkworkPackages() {
  if (!fs.existsSync(workspaceConfig)) {
    errors.push('Missing pnpm workspace config: pnpm-workspace.yaml');
    return;
  }

  const source = fs.readFileSync(workspaceConfig, 'utf8');
  if (!source.includes("'packages/sdkwork-claw-*'")) {
    errors.push("pnpm-workspace.yaml must include only the sdkwork-claw workspace glob.");
  }
  if (source.includes("'packages/*'")) {
    errors.push("pnpm-workspace.yaml must not include the legacy packages/* workspace glob.");
  }
  if (source.includes('claw-studio-')) {
    errors.push('pnpm-workspace.yaml must not include legacy claw-studio package globs.');
  }
}

function assertPackageName(relPath, expectedName) {
  const absPath = path.join(root, relPath);
  if (!fs.existsSync(absPath)) {
    errors.push(`Missing package.json: ${relPath}`);
    return;
  }

  const pkg = JSON.parse(fs.readFileSync(absPath, 'utf8'));
  if (pkg.name !== expectedName) {
    errors.push(`Unexpected package name in ${relPath}: expected ${expectedName}, got ${pkg.name ?? '<missing>'}`);
  }
}

function scanForLegacyBridgeReferences(absPath) {
  if (!fs.existsSync(absPath)) {
    return;
  }

  const stack = [absPath];
  while (stack.length > 0) {
    const current = stack.pop();
    const stat = fs.statSync(current);
    if (stat.isFile()) {
      const source = fs.readFileSync(current, 'utf8');
      if (/@sdkwork\/claw-studio-/.test(source) || /(?:\.\.\/)+claw-studio-/.test(source)) {
        errors.push(`Legacy claw-studio bridge reference remains in ${path.relative(root, current)}`);
      }
      continue;
    }

    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
        continue;
      }

      if (!/\.(ts|tsx|json)$/.test(entry.name)) {
        continue;
      }

      const source = fs.readFileSync(full, 'utf8');
      if (/@sdkwork\/claw-studio-/.test(source) || /(?:\.\.\/)+claw-studio-/.test(source)) {
        errors.push(`Legacy claw-studio bridge reference remains in ${path.relative(root, full)}`);
      }
    }
  }
}

function assertNoLegacyPackageDirs() {
  if (!fs.existsSync(packagesDir)) {
    return;
  }

  const legacyDirs = fs
    .readdirSync(packagesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('claw-studio-'))
    .map((entry) => entry.name)
    .sort();

  for (const dirName of legacyDirs) {
    errors.push(`Legacy package directory must be removed: packages/${dirName}`);
  }
}

function scanPackageManifestForLegacyDeps(relPath) {
  const absPath = path.join(root, relPath);
  if (!fs.existsSync(absPath)) {
    return;
  }

  const pkg = JSON.parse(fs.readFileSync(absPath, 'utf8'));
  const sections = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];

  for (const section of sections) {
    const deps = pkg[section];
    if (!deps || typeof deps !== 'object') {
      continue;
    }

    for (const dependencyName of Object.keys(deps)) {
      if (dependencyName.startsWith('@sdkwork/claw-studio-')) {
        errors.push(`Legacy dependency ${dependencyName} remains in ${relPath}`);
      }
    }
  }
}

assertWorkspaceTargetsSdkworkPackages();
assertNoLegacyPackageDirs();

for (const [dir, pkgName] of requiredPackages) {
  assertExists(dir, 'package directory');
  const packageJsonPath = path.join(dir, 'package.json');
  assertPackageName(packageJsonPath, pkgName);
  scanPackageManifestForLegacyDeps(packageJsonPath);
  scanForLegacyBridgeReferences(path.join(root, dir, 'src'));
  scanForLegacyBridgeReferences(path.join(root, dir, 'tsconfig.json'));
  scanForLegacyBridgeReferences(path.join(root, dir, 'vite.config.ts'));
}

if (errors.length > 0) {
  console.error('SDKWork Claw structure check failed:');
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log('SDKWork Claw structure check passed.');
