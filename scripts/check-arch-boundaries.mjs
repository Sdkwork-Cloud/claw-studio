import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const packagesDir = path.join(root, 'packages');

const allPackages = fs
  .readdirSync(packagesDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && entry.name.startsWith('sdkwork-claw-'))
  .map((entry) => entry.name);

const packageNameByDir = new Map(
  allPackages.map((dirName) => [dirName, `@sdkwork/${dirName.replace(/^sdkwork-/, '')}`]),
);

const WEB = '@sdkwork/claw-web';
const DESKTOP = '@sdkwork/claw-desktop';
const SHELL = '@sdkwork/claw-shell';
const COMMONS = '@sdkwork/claw-commons';
const CORE = '@sdkwork/claw-core';
const INFRA = '@sdkwork/claw-infrastructure';
const TYPES = '@sdkwork/claw-types';
const UI = '@sdkwork/claw-ui';
const I18N = '@sdkwork/claw-i18n';
const DISTRIBUTION = '@sdkwork/claw-distribution';

const sharedPackages = new Set([
  WEB,
  DESKTOP,
  SHELL,
  COMMONS,
  CORE,
  INFRA,
  TYPES,
  UI,
  I18N,
  DISTRIBUTION,
]);

const featurePackages = [...packageNameByDir.values()].filter((pkg) => !sharedPackages.has(pkg));
const webForbiddenSourceDirs = [
  'services',
  'store',
  'stores',
  'hooks',
  'platform',
  'platform-impl',
];
const structureExpectations = [
  [SHELL, ['application', 'components']],
  [COMMONS, ['components', 'hooks', 'lib']],
  [DESKTOP, ['desktop']],
  [DISTRIBUTION, ['manifests', 'providers']],
  [CORE, ['hooks', 'services', 'stores']],
  [INFRA, ['config', 'http', 'i18n', 'platform', 'services', 'updates']],
];
const forbiddenCoreServiceExports = [
  'apiKeyService',
  'appStoreService',
  'channelService',
  'chatService',
  'clawService',
  'communityService',
  'deviceService',
  'fileDialogService',
  'i18nService',
  'installerService',
  'mySkillService',
  'settingsService',
  'taskService',
];
const allowedFeatureDependencies = new Map([
  ['@sdkwork/claw-chat', new Set(['@sdkwork/claw-market', '@sdkwork/claw-settings'])],
  ['@sdkwork/claw-market', new Set(['@sdkwork/claw-instances'])],
  ['@sdkwork/claw-settings', new Set(['@sdkwork/claw-account'])],
]);

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
  const source = fs.readFileSync(file, 'utf8');
  const imports = [];
  const pattern = /from\s+['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;
  let match;

  while ((match = pattern.exec(source))) {
    imports.push(match[1] || match[2]);
  }

  return imports;
}

function toPkgName(importPath) {
  const [scope, name] = importPath.split('/');
  return `${scope}/${name}`;
}

function isRootPackageImport(importPath) {
  return importPath === toPkgName(importPath);
}

function isAllowed(fromPkg, toPkg) {
  if (fromPkg === WEB) {
    return [WEB, SHELL].includes(toPkg);
  }

  if (fromPkg === DESKTOP) {
    return [DESKTOP, SHELL, DISTRIBUTION, INFRA].includes(toPkg);
  }

  if (fromPkg === SHELL) {
    return [SHELL, COMMONS, CORE, I18N, UI, ...featurePackages].includes(toPkg);
  }

  if (fromPkg === COMMONS) {
    return [COMMONS, CORE, UI].includes(toPkg);
  }

  if (fromPkg === DISTRIBUTION) {
    return toPkg === DISTRIBUTION;
  }

  if (fromPkg === CORE) {
    return [CORE, INFRA, TYPES].includes(toPkg);
  }

  if (fromPkg === INFRA) {
    return [INFRA, TYPES].includes(toPkg);
  }

  if (fromPkg === TYPES || fromPkg === UI || fromPkg === I18N) {
    return toPkg === fromPkg;
  }

  if (featurePackages.includes(fromPkg)) {
    return (
      [fromPkg, COMMONS, CORE, INFRA, TYPES, UI].includes(toPkg) ||
      allowedFeatureDependencies.get(fromPkg)?.has(toPkg) === true
    );
  }

  return false;
}

const structureViolations = [];
const webShellViolations = [];
const staleImportViolations = [];
const packageExportViolations = [];
const businessBarrelViolations = [];
const localServiceBarrelViolations = [];
const rootImportViolations = [];
const dependencyViolations = [];

for (const [pkgName, requiredDirs] of structureExpectations) {
  const dirName = pkgName.replace('@sdkwork/', 'sdkwork-');
  const srcDir = path.join(packagesDir, dirName, 'src');

  for (const requiredDir of requiredDirs) {
    const targetDir = path.join(srcDir, requiredDir);
    if (!fs.existsSync(targetDir) || !fs.statSync(targetDir).isDirectory()) {
      structureViolations.push({
        package: pkgName,
        missingDir: path.relative(root, targetDir),
      });
    }
  }
}

{
  const webSrcDir = path.join(packagesDir, 'sdkwork-claw-web', 'src');
  for (const forbiddenDir of webForbiddenSourceDirs) {
    const dir = path.join(webSrcDir, forbiddenDir);
    if (!fs.existsSync(dir)) continue;

    const files = listSourceFiles(dir);
    if (files.length > 0) {
      webShellViolations.push({
        dir: path.relative(root, dir),
        files: files.map((file) => path.relative(root, file)),
      });
    }
  }
}

for (const [dirName, pkgName] of packageNameByDir.entries()) {
  const packageJsonPath = path.join(packagesDir, dirName, 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const exportsField = packageJson.exports;

  if (exportsField && typeof exportsField !== 'string') {
    const exportKeys = Object.keys(exportsField);
    const nonRootExports = exportKeys.filter((key) => key !== '.');

    if (nonRootExports.length > 0) {
      packageExportViolations.push({
        package: pkgName,
        exportKeys: nonRootExports,
      });
    }
  }

  const srcDir = path.join(packagesDir, dirName, 'src');
  for (const file of listSourceFiles(srcDir)) {
    const source = fs.readFileSync(file, 'utf8');

    if (/@sdkwork\/claw-studio-/.test(source) || /(?:\.\.\/)+claw-studio-/.test(source)) {
      staleImportViolations.push(path.relative(root, file));
    }

    const imports = getImports(file);
    for (const importPath of imports) {
      if (!importPath.startsWith('@sdkwork/claw-')) {
        continue;
      }

      const targetPkg = toPkgName(importPath);
      if (pkgName !== targetPkg && !isRootPackageImport(importPath)) {
        rootImportViolations.push({
          file: path.relative(root, file),
          from: pkgName,
          to: targetPkg,
          importPath,
        });
      }

      if (!isAllowed(pkgName, targetPkg)) {
        dependencyViolations.push({
          file: path.relative(root, file),
          from: pkgName,
          to: targetPkg,
          importPath,
        });
      }
    }

    const isTestFile = /\.test\.(ts|tsx)$/.test(file);
    const isServiceSource = file.includes(`${path.sep}src${path.sep}services${path.sep}`);
    const isBarrelFile = /(?:^|[\\/])index\.(ts|tsx)$/.test(file);

    if (!isTestFile && !isServiceSource && !isBarrelFile) {
      for (const importPath of imports) {
        if (
          /^(\.\.\/|\.\/)+services\/.+/.test(importPath) &&
          !/\/services(?:\/index(?:\.ts|\.tsx)?)?$/.test(importPath)
        ) {
          localServiceBarrelViolations.push({
            file: path.relative(root, file),
            importPath,
          });
        }
      }
    }
  }
}

{
  const coreIndexPath = path.join(packagesDir, 'sdkwork-claw-core', 'src', 'index.ts');
  const coreIndexSource = fs.readFileSync(coreIndexPath, 'utf8');

  for (const serviceName of forbiddenCoreServiceExports) {
    if (coreIndexSource.includes(`/services/${serviceName}`)) {
      businessBarrelViolations.push(serviceName);
    }
  }
}

if (
  structureViolations.length > 0 ||
  webShellViolations.length > 0 ||
  staleImportViolations.length > 0 ||
  packageExportViolations.length > 0 ||
  businessBarrelViolations.length > 0 ||
  localServiceBarrelViolations.length > 0 ||
  rootImportViolations.length > 0 ||
  dependencyViolations.length > 0
) {
  if (structureViolations.length > 0) {
    console.error('Package structure violations found:\n');
    for (const violation of structureViolations) {
      console.error(`- ${violation.package}\n  missing: ${violation.missingDir}\n`);
    }
  }

  if (webShellViolations.length > 0) {
    console.error('Web host boundary violations found:\n');
    for (const violation of webShellViolations) {
      console.error(`- ${violation.dir}`);
      for (const file of violation.files) {
        console.error(`  file: ${file}`);
      }
      console.error('');
    }
  }

  if (staleImportViolations.length > 0) {
    console.error('Stale claw-studio bridge references found:\n');
    for (const file of staleImportViolations) {
      console.error(`- ${file}`);
    }
    console.error('');
  }

  if (packageExportViolations.length > 0) {
    console.error('Package root export violations found:\n');
    for (const violation of packageExportViolations) {
      console.error(`- ${violation.package}\n  exports: ${violation.exportKeys.join(', ')}\n`);
    }
  }

  if (businessBarrelViolations.length > 0) {
    console.error('Core package barrel exposes feature-local services:\n');
    for (const serviceName of businessBarrelViolations) {
      console.error(`- @sdkwork/claw-core should not export services/${serviceName}`);
    }
    console.error('');
  }

  if (localServiceBarrelViolations.length > 0) {
    console.error('Local service barrel violations found:\n');
    for (const violation of localServiceBarrelViolations) {
      console.error(`- ${violation.file}\n  import: ${violation.importPath}\n`);
    }
  }

  if (dependencyViolations.length > 0) {
    console.error('Architecture boundary violations found:\n');
    for (const violation of dependencyViolations) {
      console.error(
        `- ${violation.file}\n  ${violation.from} -> ${violation.to}\n  import: ${violation.importPath}\n`,
      );
    }
  }

  if (rootImportViolations.length > 0) {
    console.error('Cross-package root import violations found:\n');
    for (const violation of rootImportViolations) {
      console.error(
        `- ${violation.file}\n  ${violation.from} -> ${violation.to}\n  import: ${violation.importPath}\n`,
      );
    }
  }

  process.exit(1);
}

console.log('Architecture boundary check passed.');
