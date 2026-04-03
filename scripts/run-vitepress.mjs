import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

function findExistingPath(candidates) {
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? null;
}

export function resolveVitepressPackageDir(rootDir = process.cwd()) {
  const directPackageDir = path.join(rootDir, 'node_modules', 'vitepress');
  if (fs.existsSync(path.join(directPackageDir, 'package.json'))) {
    return directPackageDir;
  }

  const pnpmStoreDir = path.join(rootDir, 'node_modules', '.pnpm');
  if (!fs.existsSync(pnpmStoreDir)) {
    throw new Error('Unable to resolve VitePress CLI: node_modules/.pnpm is missing.');
  }

  const vitepressEntries = fs
    .readdirSync(pnpmStoreDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('vitepress@'))
    .map((entry) =>
      path.join(pnpmStoreDir, entry.name, 'node_modules', 'vitepress'),
    );

  const resolvedPackageDir = findExistingPath(vitepressEntries);
  if (!resolvedPackageDir) {
    throw new Error('Unable to resolve VitePress package from pnpm store entries.');
  }

  return resolvedPackageDir;
}

export function resolveVitepressCli(rootDir = process.cwd()) {
  return path.join(resolveVitepressPackageDir(rootDir), 'bin', 'vitepress.js');
}

export function ensureVitepressPackageLink(rootDir = process.cwd()) {
  const packageDir = resolveVitepressPackageDir(rootDir);
  const packageLinkPath = path.join(rootDir, 'node_modules', 'vitepress');

  if (fs.existsSync(path.join(packageLinkPath, 'package.json'))) {
    return packageLinkPath;
  }

  fs.mkdirSync(path.dirname(packageLinkPath), { recursive: true });

  if (fs.existsSync(packageLinkPath)) {
    fs.rmSync(packageLinkPath, { recursive: true, force: true });
  }

  fs.symlinkSync(
    packageDir,
    packageLinkPath,
    process.platform === 'win32' ? 'junction' : 'dir',
  );

  return packageLinkPath;
}

export function maybeCleanVitepressDist(rootDir = process.cwd(), cliArgs = process.argv.slice(2)) {
  const [command, siteDir] = cliArgs;
  if (command !== 'build' || !siteDir) {
    return null;
  }

  const distDir = path.join(rootDir, siteDir, '.vitepress', 'dist');
  if (fs.existsSync(distDir)) {
    fs.rmSync(distDir, { recursive: true, force: true });
  }

  return distDir;
}

function main() {
  ensureVitepressPackageLink(process.cwd());
  maybeCleanVitepressDist(process.cwd(), process.argv.slice(2));
  const vitepressCli = resolveVitepressCli(process.cwd());
  const child = spawn(process.execPath, [vitepressCli, ...process.argv.slice(2)], {
    cwd: process.cwd(),
    stdio: 'inherit',
  });

  child.on('error', (error) => {
    console.error(`[run-vitepress] ${error.message}`);
    process.exit(1);
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code ?? 0);
  });
}

const entryUrl = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : null;

if (entryUrl === import.meta.url) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
