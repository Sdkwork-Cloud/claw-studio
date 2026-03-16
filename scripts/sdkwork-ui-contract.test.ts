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

runTest('sdkwork-claw-ui is implemented locally instead of re-exporting claw-studio-shared-ui', () => {
  const pkg = readJson<{ dependencies?: Record<string, string> }>('packages/sdkwork-claw-ui/package.json');
  const indexSource = read('packages/sdkwork-claw-ui/src/index.ts');

  assert.ok(exists('packages/sdkwork-claw-ui/src/components/Modal.tsx'));
  assert.ok(exists('packages/sdkwork-claw-ui/src/components/RepositoryCard.tsx'));
  assert.ok(exists('packages/sdkwork-claw-ui/src/lib/utils.ts'));

  assert.ok(!pkg.dependencies?.['@sdkwork/claw-studio-shared-ui']);
  assert.doesNotMatch(indexSource, /@sdkwork\/claw-studio-shared-ui/);
  assert.match(indexSource, /Modal/);
  assert.match(indexSource, /RepositoryCard/);
});
