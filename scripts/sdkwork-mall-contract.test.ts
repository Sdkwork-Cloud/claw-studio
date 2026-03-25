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

runTest('sdkwork-claw-mall is implemented locally and routes mall reads through claw-core app sdk wrappers', () => {
  const pkg = readJson<{ dependencies?: Record<string, string> }>('packages/sdkwork-claw-mall/package.json');
  const indexSource = read('packages/sdkwork-claw-mall/src/index.ts');
  const mallEntrySource = read('packages/sdkwork-claw-mall/src/ClawMall.tsx');
  const detailEntrySource = read('packages/sdkwork-claw-mall/src/ProductDetail.tsx');
  const serviceSource = read('packages/sdkwork-claw-mall/src/services/clawMallService.ts');
  const mallPageSource = read('packages/sdkwork-claw-mall/src/pages/mall/ClawMall.tsx');
  const detailPageSource = read('packages/sdkwork-claw-mall/src/pages/mall/ProductDetail.tsx');
  const presentationSource = read('packages/sdkwork-claw-mall/src/pages/mall/mallCatalogPresentation.ts');

  assert.ok(exists('packages/sdkwork-claw-mall/src/ClawMall.tsx'));
  assert.ok(exists('packages/sdkwork-claw-mall/src/ProductDetail.tsx'));
  assert.ok(exists('packages/sdkwork-claw-mall/src/pages/mall/ClawMall.tsx'));
  assert.ok(exists('packages/sdkwork-claw-mall/src/pages/mall/ProductDetail.tsx'));
  assert.ok(exists('packages/sdkwork-claw-mall/src/pages/mall/mallCatalogPresentation.ts'));
  assert.ok(exists('packages/sdkwork-claw-mall/src/pages/mall/mallCatalogPresentation.test.ts'));
  assert.ok(exists('packages/sdkwork-claw-mall/src/services/clawMallService.ts'));
  assert.ok(exists('packages/sdkwork-claw-mall/src/services/clawMallService.test.ts'));

  assert.equal(pkg.dependencies?.['@sdkwork/claw-core'], 'workspace:*');
  assert.ok(!pkg.dependencies?.['@sdkwork/claw-studio-claw-mall']);
  assert.doesNotMatch(indexSource, /@sdkwork\/claw-studio-claw-mall/);
  assert.match(indexSource, /\.\/ClawMall/);
  assert.match(indexSource, /\.\/ProductDetail/);
  assert.match(indexSource, /\.\/services/);
  assert.match(mallEntrySource, /lazy\(\(\) =>/);
  assert.match(mallEntrySource, /\.\/pages\/mall\/ClawMall/);
  assert.match(detailEntrySource, /lazy\(\(\) =>/);
  assert.match(detailEntrySource, /\.\/pages\/mall\/ProductDetail/);

  assert.match(serviceSource, /@sdkwork\/claw-core\/services\/clawMallService/);
  assert.match(serviceSource, /listCategories\(/);
  assert.match(serviceSource, /listProducts\(/);
  assert.match(serviceSource, /listHotProducts\(/);
  assert.match(serviceSource, /listLatestProducts\(/);
  assert.match(serviceSource, /getProduct\(/);
  assert.doesNotMatch(serviceSource, /fetch\(/);
  assert.doesNotMatch(serviceSource, /axios\./);
  assert.doesNotMatch(serviceSource, /Authorization/);

  assert.match(mallPageSource, /clawMallService\.getCatalog\(/);
  assert.match(mallPageSource, /navigate\(`\/mall\/\$\{product\.id\}`\)/);
  assert.match(detailPageSource, /clawMallService\.getProduct\(/);
  assert.match(detailPageSource, /clawMallService\.getRelatedProducts\(/);
  assert.match(presentationSource, /flattenMallCategories/);
  assert.match(presentationSource, /selectRelatedProducts/);
});
