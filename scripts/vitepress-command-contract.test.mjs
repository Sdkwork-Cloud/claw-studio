import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

async function main() {
  const modulePath = path.join(root, 'scripts/run-vitepress.mjs');
  const moduleUrl = new URL(`file://${modulePath}`);
  const { ensureVitepressPackageLink, resolveVitepressCli } = await import(moduleUrl.href);
  const vitepressCli = resolveVitepressCli(root);
  const vitepressPackageLink = ensureVitepressPackageLink(root);

  assert.ok(vitepressCli, 'expected to resolve a VitePress CLI path');
  assert.ok(fs.existsSync(vitepressCli), `expected CLI to exist: ${vitepressCli}`);
  assert.ok(vitepressPackageLink, 'expected to ensure a VitePress package link');
  assert.ok(
    fs.existsSync(path.join(vitepressPackageLink, 'package.json')),
    `expected package link to expose package.json: ${vitepressPackageLink}`,
  );
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
