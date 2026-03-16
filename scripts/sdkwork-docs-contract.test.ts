import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(relPath: string) {
  return fs.readFileSync(path.join(root, relPath), 'utf8');
}

function readJson<T>(relPath: string): T {
  return JSON.parse(read(relPath)) as T;
}

function exists(relPath: string) {
  return fs.existsSync(path.join(root, relPath));
}

function runTest(name: string, fn: () => void) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

runTest('sdkwork-claw-docs keeps the V5 docs package surface locally', () => {
  const pkg = readJson<{ dependencies?: Record<string, string> }>('packages/sdkwork-claw-docs/package.json');
  const indexSource = read('packages/sdkwork-claw-docs/src/index.ts');

  assert.ok(exists('packages/sdkwork-claw-docs/src/Docs.tsx'));
  assert.ok(exists('packages/sdkwork-claw-docs/src/content/index.ts'));

  assert.match(indexSource, /export \* from '\.\/Docs';/);
  assert.match(indexSource, /export \* from '\.\/content';/);
  assert.ok(!pkg.dependencies?.['@sdkwork/claw-studio-docs']);
  assert.doesNotMatch(indexSource, /@sdkwork\/claw-studio-docs/);
});
