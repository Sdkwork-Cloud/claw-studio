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

runTest('sdkwork-claw-instances is implemented locally instead of re-exporting claw-studio-instances', () => {
  const pkg = readJson<{ dependencies?: Record<string, string> }>(
    'packages/sdkwork-claw-instances/package.json',
  );
  const indexSource = read('packages/sdkwork-claw-instances/src/index.ts');

  assert.ok(exists('packages/sdkwork-claw-instances/src/pages/Instances.tsx'));
  assert.ok(exists('packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx'));
  assert.ok(exists('packages/sdkwork-claw-instances/src/services/instanceService.ts'));
  assert.ok(exists('packages/sdkwork-claw-instances/src/store/useInstanceStore.ts'));
  assert.ok(exists('packages/sdkwork-claw-instances/src/types/index.ts'));

  assert.ok(!pkg.dependencies?.['@sdkwork/claw-studio-instances']);
  assert.doesNotMatch(indexSource, /@sdkwork\/claw-studio-instances/);
  assert.match(indexSource, /Instances/);
  assert.match(indexSource, /InstanceDetail/);
  assert.match(indexSource, /instanceService/);
  assert.match(indexSource, /useInstanceStore/);
});

runTest('sdkwork-claw-instances keeps the V5 instance detail token display behavior', () => {
  const detailSource = read('packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx');

  assert.match(detailSource, /value=\{token \|\| ''\}/);
  assert.doesNotMatch(detailSource, /sk-local-123456789/);
});
