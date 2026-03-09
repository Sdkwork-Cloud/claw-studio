import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const packagesDir = path.join(root, 'packages');

const allPackages = fs
  .readdirSync(packagesDir, { withFileTypes: true })
  .filter((d) => d.isDirectory() && d.name.startsWith('claw-studio-'))
  .map((d) => `@sdkwork/${d.name}`);

const WEB = '@sdkwork/claw-studio-web';
const BUSINESS = '@sdkwork/claw-studio-business';
const DOMAIN = '@sdkwork/claw-studio-domain';
const INFRA = '@sdkwork/claw-studio-infrastructure';
const SHARED_UI = '@sdkwork/claw-studio-shared-ui';
const SHELL = '@sdkwork/claw-studio-shell';
const DESKTOP = '@sdkwork/claw-studio-desktop';
const DISTRIBUTION = '@sdkwork/claw-studio-distribution';

const featurePackages = allPackages.filter(
  (p) =>
    ![WEB, BUSINESS, DOMAIN, INFRA, SHARED_UI, SHELL, DESKTOP, DISTRIBUTION].includes(p),
);
const requiredFeatureDirs = ['components', 'pages', 'services'];
const requiredShellDirs = ['application', 'components'];
const requiredDesktopDirs = ['desktop'];
const requiredDistributionDirs = ['manifests', 'providers'];
const webForbiddenSourceDirs = [
  'services',
  'store',
  'hooks',
  'platform',
  'platform-impl',
];

function listSourceFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, item.name);
    if (item.isDirectory()) {
      out.push(...listSourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(item.name)) {
      out.push(full);
    }
  }
  return out;
}

function getImports(file) {
  const text = fs.readFileSync(file, 'utf8');
  const imports = [];
  const re = /from\s+['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;
  let m;
  while ((m = re.exec(text))) {
    imports.push(m[1] || m[2]);
  }
  return imports.filter((i) => i.startsWith('@sdkwork/claw-studio-'));
}

function toPkgName(importPath) {
  const parts = importPath.split('/');
  return `${parts[0]}/${parts[1]}`;
}

function isAllowed(fromPkg, toPkg) {
  if (fromPkg === WEB) {
    return [WEB, BUSINESS, SHARED_UI, SHELL, DISTRIBUTION, ...featurePackages].includes(toPkg);
  }

  if (fromPkg === SHELL) {
    return [SHELL, BUSINESS, SHARED_UI, ...featurePackages].includes(toPkg);
  }

  if (fromPkg === DESKTOP) {
    return [DESKTOP, SHELL, DISTRIBUTION, INFRA].includes(toPkg);
  }

  if (fromPkg === DISTRIBUTION) {
    return [DISTRIBUTION].includes(toPkg);
  }

  if (fromPkg === BUSINESS) {
    return [DOMAIN, INFRA].includes(toPkg);
  }

  if (fromPkg === DOMAIN) {
    return false;
  }

  if (fromPkg === INFRA) {
    return toPkg === DOMAIN;
  }

  if (featurePackages.includes(fromPkg)) {
    return [fromPkg, BUSINESS, DOMAIN, INFRA, SHARED_UI].includes(toPkg);
  }

  return false;
}

const violations = [];
const structureViolations = [];
const webShellViolations = [];

for (const pkg of featurePackages) {
  const short = pkg.replace('@sdkwork/', '');
  const srcDir = path.join(packagesDir, short, 'src');

  for (const requiredDir of requiredFeatureDirs) {
    const full = path.join(srcDir, requiredDir);
    if (!fs.existsSync(full) || !fs.statSync(full).isDirectory()) {
      structureViolations.push({
        package: pkg,
        missingDir: path.relative(root, full),
      });
    }
  }
}

for (const [pkg, requiredDirs] of [
  [SHELL, requiredShellDirs],
  [DESKTOP, requiredDesktopDirs],
  [DISTRIBUTION, requiredDistributionDirs],
]) {
  const short = pkg.replace('@sdkwork/', '');
  const srcDir = path.join(packagesDir, short, 'src');

  for (const requiredDir of requiredDirs) {
    const full = path.join(srcDir, requiredDir);
    if (!fs.existsSync(full) || !fs.statSync(full).isDirectory()) {
      structureViolations.push({
        package: pkg,
        missingDir: path.relative(root, full),
      });
    }
  }
}

{
  const webSrcDir = path.join(packagesDir, 'claw-studio-web', 'src');
  for (const forbiddenDir of webForbiddenSourceDirs) {
    const dir = path.join(webSrcDir, forbiddenDir);
    if (!fs.existsSync(dir)) continue;

    const files = listSourceFiles(dir);
    if (files.length > 0) {
      webShellViolations.push({
        dir: path.relative(root, dir),
        files: files.map((f) => path.relative(root, f)),
      });
    }
  }
}

for (const pkg of allPackages) {
  const short = pkg.replace('@sdkwork/', '');
  const srcDir = path.join(packagesDir, short, 'src');
  const files = listSourceFiles(srcDir);

  for (const file of files) {
    const imports = getImports(file);
    for (const imp of imports) {
      const targetPkg = toPkgName(imp);
      if (!isAllowed(pkg, targetPkg)) {
        violations.push({
          file: path.relative(root, file),
          from: pkg,
          to: targetPkg,
          importPath: imp,
        });
      }
    }
  }
}

if (
  structureViolations.length > 0 ||
  webShellViolations.length > 0 ||
  violations.length > 0
) {
  if (structureViolations.length > 0) {
    console.error('Feature package structure violations found:\n');
    for (const v of structureViolations) {
      console.error(`- ${v.package}\n  missing: ${v.missingDir}\n`);
    }
  }

  if (webShellViolations.length > 0) {
    console.error('Web shell structure violations found:\n');
    for (const v of webShellViolations) {
      console.error(`- ${v.dir}`);
      for (const file of v.files) {
        console.error(`  file: ${file}`);
      }
      console.error('');
    }
  }

  if (violations.length > 0) {
    console.error('Architecture boundary violations found:\n');
    for (const v of violations) {
      console.error(
        `- ${v.file}\n  ${v.from} -> ${v.to}\n  import: ${v.importPath}\n`,
      );
    }
  }

  process.exit(1);
}

console.log('Architecture boundary check passed.');
