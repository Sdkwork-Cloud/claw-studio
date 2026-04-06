import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = process.cwd();

async function main() {
  const modulePath = path.join(root, 'scripts/run-vitepress.mjs');
  const moduleUrl = new URL(`file://${modulePath}`);
  const {
    ensureVitepressPackageLink,
    maybeCleanVitepressDist,
    resolveVitepressCli,
  } = await import(moduleUrl.href);
  const vitepressCli = resolveVitepressCli(root);
  const vitepressPackageLink = ensureVitepressPackageLink(root);

  assert.ok(vitepressCli, 'expected to resolve a VitePress CLI path');
  assert.ok(fs.existsSync(vitepressCli), `expected CLI to exist: ${vitepressCli}`);
  assert.ok(vitepressPackageLink, 'expected to ensure a VitePress package link');
  assert.ok(
    fs.existsSync(path.join(vitepressPackageLink, 'package.json')),
    `expected package link to expose package.json: ${vitepressPackageLink}`,
  );
  const source = fs.readFileSync(modulePath, 'utf8');
  assert.match(
    source,
    /child\.on\('error', \(error\) => \{\s*console\.error\(`\[run-vitepress\] \$\{error\.message\}`\);\s*process\.exit\(1\);\s*\}\);/s,
    'expected run-vitepress to handle child process startup failures explicitly',
  );
  assert.match(
    source,
    /if \(entryUrl === import\.meta\.url\) \{\s*try \{\s*main\(\);\s*\} catch \(error\) \{\s*console\.error\(error instanceof Error \? error\.message : String\(error\)\);\s*process\.exit\(1\);\s*\}\s*\}/s,
    'expected run-vitepress to wrap the CLI entrypoint with a top-level error handler',
  );

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'claw-vitepress-'));
  const distDir = path.join(tempRoot, 'docs', '.vitepress', 'dist');
  const staleFile = path.join(distDir, 'stale.html');
  fs.mkdirSync(distDir, { recursive: true });
  fs.writeFileSync(staleFile, 'stale');

  maybeCleanVitepressDist(tempRoot, ['build', 'docs']);
  assert.equal(fs.existsSync(staleFile), false, 'expected build mode to remove stale docs dist output');

  fs.mkdirSync(distDir, { recursive: true });
  fs.writeFileSync(staleFile, 'stale');

  maybeCleanVitepressDist(tempRoot, ['dev', 'docs']);
  assert.equal(fs.existsSync(staleFile), true, 'expected non-build mode to preserve docs dist output');

  fs.rmSync(tempRoot, { recursive: true, force: true });
}

main().then(
  () => {
    console.log('ok - vitepress CLI path resolves for workspace docs commands');
  },
  (error) => {
    console.error('not ok - vitepress CLI path resolves for workspace docs commands');
    throw error;
  },
);
