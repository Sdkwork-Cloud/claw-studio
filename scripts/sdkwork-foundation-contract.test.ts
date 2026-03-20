import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(relPath: string) {
  return fs.readFileSync(path.join(root, relPath), 'utf8');
}

function exists(relPath: string) {
  return fs.existsSync(path.join(root, relPath));
}

function readJson<T>(relPath: string): T {
  return JSON.parse(read(relPath)) as T;
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

runTest('sdkwork-claw-i18n is implemented locally instead of re-exporting claw-studio infrastructure', () => {
  const pkg = readJson<{ dependencies?: Record<string, string> }>('packages/sdkwork-claw-i18n/package.json');
  const source = read('packages/sdkwork-claw-i18n/src/index.ts');

  assert.ok(exists('packages/sdkwork-claw-i18n/src/locales/en.json'));
  assert.ok(exists('packages/sdkwork-claw-i18n/src/locales/zh.json'));
  assert.ok(!pkg.dependencies?.['@sdkwork/claw-studio-infrastructure']);
  assert.doesNotMatch(source, /@sdkwork\/claw-studio-infrastructure/);
  assert.match(source, /ensureI18n/);
});

runTest('sdkwork-claw-types is implemented locally instead of re-exporting claw-studio domain', () => {
  const pkg = readJson<{ dependencies?: Record<string, string> }>('packages/sdkwork-claw-types/package.json');
  const source = read('packages/sdkwork-claw-types/src/index.ts');

  assert.ok(exists('packages/sdkwork-claw-types/src/service.ts'));
  assert.ok(!pkg.dependencies?.['@sdkwork/claw-studio-domain']);
  assert.doesNotMatch(source, /@sdkwork\/claw-studio-domain/);
  assert.match(source, /export \* from '.\/service(?:\.ts)?'/);
});

runTest('sdkwork-claw-distribution is implemented locally instead of re-exporting claw-studio distribution', () => {
  const pkg = readJson<{ dependencies?: Record<string, string> }>('packages/sdkwork-claw-distribution/package.json');
  const source = read('packages/sdkwork-claw-distribution/src/index.ts');

  assert.ok(exists('packages/sdkwork-claw-distribution/src/manifests/cn/index.ts'));
  assert.ok(exists('packages/sdkwork-claw-distribution/src/manifests/global/index.ts'));
  assert.ok(!pkg.dependencies?.['@sdkwork/claw-studio-distribution']);
  assert.doesNotMatch(source, /@sdkwork\/claw-studio-distribution/);
  assert.match(source, /getDistributionManifest/);
});
