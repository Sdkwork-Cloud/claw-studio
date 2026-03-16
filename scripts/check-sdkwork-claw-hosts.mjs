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

assertIncludes('packages/sdkwork-claw-web/src/App.tsx', '@sdkwork/claw-shell', 'web host shell dependency');
assertIncludes('packages/sdkwork-claw-desktop/src/desktop/bootstrap/createDesktopApp.tsx', '@sdkwork/claw-shell', 'desktop host shell dependency');
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
