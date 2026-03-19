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

runTest('sdkwork-claw-apps is implemented locally with the service-first app store surface', () => {
  const pkg = readJson<{ dependencies?: Record<string, string> }>('packages/sdkwork-claw-apps/package.json');
  const indexSource = read('packages/sdkwork-claw-apps/src/index.ts');
  const serviceSource = read('packages/sdkwork-claw-apps/src/services/appStoreService.ts');

  assert.ok(exists('packages/sdkwork-claw-apps/src/AppStore.tsx'));
  assert.ok(exists('packages/sdkwork-claw-apps/src/AppDetail.tsx'));
  assert.ok(exists('packages/sdkwork-claw-apps/src/services/appStoreService.ts'));

  assert.ok(!pkg.dependencies?.['@sdkwork/claw-studio-apps']);
  assert.equal(pkg.dependencies?.['@sdkwork/claw-types'], 'workspace:*');
  assert.doesNotMatch(indexSource, /@sdkwork\/claw-studio-apps/);

  assert.match(serviceSource, /import\s+\{\s*studioMockService\s*\}\s+from\s+'@sdkwork\/claw-infrastructure'/);
  assert.match(serviceSource, /getFeaturedApp\(\): Promise<AppItem>/);
  assert.match(serviceSource, /studioMockService\.getFeaturedApp\(\)/);
  assert.match(serviceSource, /studioMockService\.getTopChartApps\(\)/);
  assert.match(serviceSource, /studioMockService\.getAppCategories\(\)/);
  assert.match(serviceSource, /studioMockService\.getApp\(id\)/);
  assert.doesNotMatch(serviceSource, /fetch\('/);
  assert.doesNotMatch(serviceSource, /const FEATURED_APP/);
  assert.doesNotMatch(serviceSource, /const TOP_CHARTS/);
  assert.doesNotMatch(serviceSource, /const ALL_APPS/);
});
