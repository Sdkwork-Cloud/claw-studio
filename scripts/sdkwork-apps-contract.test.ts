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

runTest('sdkwork-claw-apps keeps App Store metadata on claw-core wrappers while removing embedded install orchestration', () => {
  const workspacePackage = readJson<{ scripts?: Record<string, string> }>('package.json');
  const pkg = readJson<{ dependencies?: Record<string, string> }>('packages/sdkwork-claw-apps/package.json');
  const indexSource = read('packages/sdkwork-claw-apps/src/index.ts');
  const appStoreEntrySource = read('packages/sdkwork-claw-apps/src/AppStore.tsx');
  const appDetailEntrySource = read('packages/sdkwork-claw-apps/src/AppDetail.tsx');
  const serviceSource = read('packages/sdkwork-claw-apps/src/services/appStoreService.ts');
  const detailSource = read('packages/sdkwork-claw-apps/src/pages/apps/AppDetail.tsx');
  const storeSource = read('packages/sdkwork-claw-apps/src/pages/apps/AppStore.tsx');
  const appsCheckRunnerSource = read('scripts/run-sdkwork-apps-check.mjs');

  assert.ok(exists('packages/sdkwork-claw-apps/src/AppStore.tsx'));
  assert.ok(exists('packages/sdkwork-claw-apps/src/AppDetail.tsx'));
  assert.ok(exists('packages/sdkwork-claw-apps/src/services/appStoreService.ts'));
  assert.ok(exists('scripts/run-sdkwork-apps-check.mjs'));

  assert.ok(!pkg.dependencies?.['@sdkwork/claw-studio-apps']);
  assert.equal(pkg.dependencies?.['@sdkwork/claw-core'], 'workspace:*');
  assert.equal(pkg.dependencies?.['@sdkwork/claw-types'], 'workspace:*');
  assert.equal(pkg.dependencies?.['@sdkwork/claw-infrastructure'], 'workspace:*');
  assert.match(
    workspacePackage.scripts?.['check:sdkwork-apps'] ?? '',
    /node scripts\/run-sdkwork-apps-check\.mjs && node --experimental-strip-types scripts\/sdkwork-apps-contract\.test\.ts/,
  );
  assert.match(appsCheckRunnerSource, /packages\/sdkwork-claw-apps\/src\/services\/appStoreService\.test\.ts/);
  assert.match(appsCheckRunnerSource, /packages\/sdkwork-claw-apps\/src\/pages\/apps\/appCatalogPresentation\.test\.ts/);
  assert.doesNotMatch(indexSource, /@sdkwork\/claw-studio-apps/);
  assert.match(appStoreEntrySource, /lazy\(\(\) =>/);
  assert.match(appStoreEntrySource, /\.\/pages\/apps\/AppStore/);
  assert.match(appDetailEntrySource, /lazy\(\(\) =>/);
  assert.match(appDetailEntrySource, /\.\/pages\/apps\/AppDetail/);

  assert.doesNotMatch(serviceSource, /studioMockService/);
  assert.match(serviceSource, /from '@sdkwork\/claw-core'/);
  assert.doesNotMatch(serviceSource, /@sdkwork\/claw-core\/services\//);
  assert.match(serviceSource, /appStoreCatalogService/);
  assert.match(serviceSource, /listApps\(/);
  assert.match(serviceSource, /listCategories\(/);
  assert.match(serviceSource, /getApp\(/);
  assert.match(serviceSource, /getInstallSurfaceSummaries\(/);
  assert.match(serviceSource, /getGuidedInstallNavigation\(/);
  assert.match(serviceSource, /catalogPresentationCache/);
  assert.match(serviceSource, /installSurfaceSummaryCache/);
  assert.match(serviceSource, /Promise\.resolve\(\[\] as AppInstallDefinition\[\]\)/);
  assert.match(serviceSource, /Embedded install integration was removed/);
  assert.match(serviceSource, /return app\?\.installHomepage \|\| app\?\.downloadUrl \|\| app\?\.storeUrl \|\| '\/docs#script'/);
  assert.doesNotMatch(serviceSource, /installerService/);
  assert.doesNotMatch(serviceSource, /listInstallCatalog/);
  assert.doesNotMatch(serviceSource, /inspectInstall/);
  assert.doesNotMatch(serviceSource, /runInstallDependencies/);
  assert.doesNotMatch(serviceSource, /runInstall/);
  assert.doesNotMatch(serviceSource, /runUninstall/);
  assert.doesNotMatch(serviceSource, /\/install\?/);
  assert.doesNotMatch(serviceSource, /setInterval\(/);
  assert.doesNotMatch(serviceSource, /Math\.random\(/);
  assert.doesNotMatch(serviceSource, /new Promise\(.*setTimeout/s);

  assert.match(detailSource, /await appStoreService\.getApp\(id\)/);
  assert.match(detailSource, /if \(!nextApp\.installable\)/);
  assert.match(detailSource, /showExternalAccessOnly/);
  assert.match(detailSource, /apps\.detail\.externalAccessDescription/);
  assert.match(detailSource, /apps\.detail\.actions\.download/);
  assert.match(detailSource, /apps\.detail\.actions\.openStore/);
  assert.doesNotMatch(detailSource, /navigate\(guidedInstallNavigation\)/);
  assert.doesNotMatch(detailSource, /navigate\('\/install/);
  assert.doesNotMatch(detailSource, /setInterval\(/);
  assert.doesNotMatch(detailSource, /Math\.random\(/);

  assert.match(storeSource, /useDeferredValue/);
  assert.match(storeSource, /createStoreOverview/);
  assert.match(storeSource, /collectPriorityInstallableAppIds/);
  assert.match(storeSource, /getCategories\(/);
  assert.match(storeSource, /getInstallSurfaceSummaries\(/);
  assert.match(storeSource, /IntersectionObserver/);
  assert.match(storeSource, /contentVisibility:\s*'auto'/);
  assert.doesNotMatch(storeSource, /featuredApp/);
  assert.doesNotMatch(storeSource, /topCharts?/i);
});

runTest('the app install helper remains a thin shell over install descriptor types without a local embedded catalog', () => {
  const catalogSource = read('packages/sdkwork-claw-apps/src/services/appInstallCatalog.ts');

  assert.doesNotMatch(catalogSource, /const appInstallCatalog\s*=/);
  assert.match(catalogSource, /resolveAppHostPlatform/);
  assert.match(catalogSource, /resolveAppInstallTarget/);
  assert.match(catalogSource, /InstallCatalogEntry/);
});
