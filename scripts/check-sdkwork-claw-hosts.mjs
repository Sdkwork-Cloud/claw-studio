import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const errors = [];

function read(relPath) {
  const absPath = path.join(root, relPath);
  if (!fs.existsSync(absPath)) {
    errors.push(`Missing required file: ${relPath}`);
    return '';
  }
  return fs.readFileSync(absPath, 'utf8');
}

function assertIncludes(relPath, pattern, label) {
  const source = read(relPath);
  if (source && !source.includes(pattern)) {
    errors.push(`Missing ${label} in ${relPath}`);
  }
}

function assertAnyIncludes(relPaths, pattern, label) {
  const sources = relPaths.map((relPath) => ({
    relPath,
    source: read(relPath),
  }));
  if (sources.some(({ source }) => source.includes(pattern))) {
    return;
  }
  errors.push(`Missing ${label} in any of: ${relPaths.join(', ')}`);
}

assertIncludes('packages/sdkwork-claw-web/src/App.tsx', '@sdkwork/claw-shell', 'web host shell dependency');
assertIncludes('packages/sdkwork-claw-desktop/package.json', '@sdkwork/claw-shell', 'desktop package shell dependency');
assertIncludes(
  'packages/sdkwork-claw-web/vite.config.ts',
  'allow:',
  'web Vite external workspace fs allow list',
);
assertIncludes(
  'packages/sdkwork-claw-web/vite.config.ts',
  '../../../../..',
  'web Vite monorepo fs allow root',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/vite.config.ts',
  'allow:',
  'desktop Vite external workspace fs allow list',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/vite.config.ts',
  '../../../../..',
  'desktop Vite monorepo fs allow root',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/vite.config.ts',
  "from './viteWorkspaceResolver.ts'",
  'desktop Vite workspace resolver helper import',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/vite.config.ts',
  'remapWorktreeWorkspaceImport',
  'desktop Vite worktree remap support',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/vite.config.ts',
  'resolveWorkspacePackageEntry',
  'desktop Vite workspace package entry resolver',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/vite.config.ts',
  'dedupe:',
  'desktop Vite module dedupe for shared React workspace hot reload',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/vite.config.ts',
  "'react'",
  'desktop Vite React dedupe entry',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/vite.config.ts',
  "'react-dom'",
  'desktop Vite React DOM dedupe entry',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/vite.config.ts',
  '@sdkwork/claw-infrastructure',
  'desktop Vite infrastructure dedupe entry',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/vite.config.ts',
  '@sdkwork/claw-i18n',
  'desktop Vite i18n dedupe entry',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/vite.config.ts',
  '@sdkwork/sdk-common',
  'desktop Vite sdk-common dedupe entry',
);
assertIncludes(
  'packages/sdkwork-claw-desktop/package.json',
  '"vite":',
  'desktop Vite dependency presence',
);
assertIncludes(
  'packages/sdkwork-claw-web/viteWorkspaceResolver.ts',
  'WORKSPACE_PACKAGE_PATTERN',
  'web Vite workspace resolver reference implementation',
);
if (!fs.existsSync(path.join(root, 'packages/sdkwork-claw-desktop/viteWorkspaceResolver.ts'))) {
  errors.push('Missing desktop Vite workspace resolver helper: packages/sdkwork-claw-desktop/viteWorkspaceResolver.ts');
}
assertAnyIncludes(
  [
    'packages/sdkwork-claw-desktop/src/desktop/bootstrap/createDesktopApp.tsx',
    'packages/sdkwork-claw-desktop/src/desktop/bootstrap/DesktopBootstrapApp.tsx',
  ],
  '@sdkwork/claw-shell',
  'desktop host shell dependency',
);
assertIncludes('packages/sdkwork-claw-shell/package.json', '@sdkwork/claw-core', 'shell core dependency');

const featurePackageDirs = fs.existsSync(path.join(root, 'packages'))
  ? fs.readdirSync(path.join(root, 'packages'), { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name.startsWith('sdkwork-claw-'))
      .map((entry) => entry.name)
      .filter((name) => !['sdkwork-claw-web', 'sdkwork-claw-desktop', 'sdkwork-claw-shell', 'sdkwork-claw-commons', 'sdkwork-claw-ui', 'sdkwork-claw-core', 'sdkwork-claw-i18n', 'sdkwork-claw-types', 'sdkwork-claw-distribution'].includes(name))
  : [];

for (const dir of featurePackageDirs) {
  const srcDir = path.join(root, 'packages', dir, 'src');
  if (!fs.existsSync(srcDir)) continue;

  const stack = [srcDir];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
        continue;
      }
      if (!/\.(ts|tsx)$/.test(entry.name)) continue;
      const source = fs.readFileSync(full, 'utf8');
      if (source.includes('@tauri-apps/api')) {
        errors.push(`Feature package must not import Tauri APIs directly: ${path.relative(root, full)}`);
      }
    }
  }
}

if (errors.length > 0) {
  console.error('SDKWork Claw host check failed:');
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log('SDKWork Claw host check passed.');
