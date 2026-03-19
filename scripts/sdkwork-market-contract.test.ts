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

runTest('sdkwork-claw-market is implemented locally instead of re-exporting claw-studio-market', () => {
  const pkg = readJson<{ dependencies?: Record<string, string> }>('packages/sdkwork-claw-market/package.json');
  const indexSource = read('packages/sdkwork-claw-market/src/index.ts');

  assert.ok(exists('packages/sdkwork-claw-market/src/Market.tsx'));
  assert.ok(exists('packages/sdkwork-claw-market/src/SkillDetail.tsx'));
  assert.ok(exists('packages/sdkwork-claw-market/src/SkillPackDetail.tsx'));
  assert.ok(exists('packages/sdkwork-claw-market/src/pages/Market.tsx'));
  assert.ok(exists('packages/sdkwork-claw-market/src/pages/SkillDetail.tsx'));
  assert.ok(exists('packages/sdkwork-claw-market/src/pages/SkillPackDetail.tsx'));
  assert.ok(exists('packages/sdkwork-claw-market/src/services/index.ts'));
  assert.ok(exists('packages/sdkwork-claw-market/src/services/marketService.ts'));
  assert.ok(exists('packages/sdkwork-claw-market/src/services/mySkillService.ts'));
  assert.ok(exists('packages/sdkwork-claw-market/src/services/instanceService.ts'));

  assert.ok(!pkg.dependencies?.['@sdkwork/claw-studio-market']);
  assert.doesNotMatch(indexSource, /@sdkwork\/claw-studio-market/);
  assert.match(indexSource, /\.\/Market/);
  assert.match(indexSource, /\.\/SkillDetail/);
  assert.match(indexSource, /\.\/SkillPackDetail/);
  assert.match(indexSource, /\.\/services\/marketService/);
});

runTest('sdkwork-claw-market preserves V5 market tab surface and multi-instance installs', () => {
  const marketSource = read('packages/sdkwork-claw-market/src/pages/Market.tsx');

  assert.match(marketSource, /'skills' \| 'packages' \| 'myskills' \| 'sdkwork'/);
  assert.match(marketSource, /selectedInstanceIds/);
  assert.match(marketSource, /selectedInstanceIds\.map/);
  assert.match(marketSource, /setActiveMarketTab\('sdkwork'\)/);
});

runTest('sdkwork-claw-market preserves V5 skill detail repository selector and multi-instance installs', () => {
  const detailSource = read('packages/sdkwork-claw-market/src/pages/SkillDetail.tsx');

  assert.match(detailSource, /useTranslation/);
  assert.match(detailSource, /selectedRepo/);
  assert.match(detailSource, /t\('market\.skillDetail\.repository\.options\.official\.title'\)/);
  assert.match(detailSource, /t\('market\.skillDetail\.repository\.options\.tencent\.title'\)/);
  assert.match(detailSource, /selectedInstanceIds/);
  assert.match(detailSource, /selectedInstanceIds\.map/);
});
