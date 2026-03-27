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

runTest('sdkwork-claw-apps routes remote app-store metadata through claw-core app sdk wrappers while keeping installs on hub-installer', () => {
  const pkg = readJson<{ dependencies?: Record<string, string> }>('packages/sdkwork-claw-apps/package.json');
  const indexSource = read('packages/sdkwork-claw-apps/src/index.ts');
  const appStoreEntrySource = read('packages/sdkwork-claw-apps/src/AppStore.tsx');
  const appDetailEntrySource = read('packages/sdkwork-claw-apps/src/AppDetail.tsx');
  const serviceSource = read('packages/sdkwork-claw-apps/src/services/appStoreService.ts');
  const detailSource = read('packages/sdkwork-claw-apps/src/pages/apps/AppDetail.tsx');
  const storeSource = read('packages/sdkwork-claw-apps/src/pages/apps/AppStore.tsx');
  const installerContractSource = read('packages/sdkwork-claw-infrastructure/src/platform/contracts/installer.ts');

  assert.ok(exists('packages/sdkwork-claw-apps/src/AppStore.tsx'));
  assert.ok(exists('packages/sdkwork-claw-apps/src/AppDetail.tsx'));
  assert.ok(exists('packages/sdkwork-claw-apps/src/services/appStoreService.ts'));

  assert.ok(!pkg.dependencies?.['@sdkwork/claw-studio-apps']);
  assert.equal(pkg.dependencies?.['@sdkwork/claw-core'], 'workspace:*');
  assert.equal(pkg.dependencies?.['@sdkwork/claw-types'], 'workspace:*');
  assert.equal(pkg.dependencies?.['@sdkwork/claw-infrastructure'], 'workspace:*');
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
  assert.match(serviceSource, /installerService/);
  assert.match(serviceSource, /listHubInstallCatalog/);
  assert.match(serviceSource, /inspectInstall\(/);
  assert.match(serviceSource, /getInstallSurfaceSummaries\(/);
  assert.match(serviceSource, /getGuidedInstallNavigation\(/);
  assert.match(serviceSource, /installDependencies\(/);
  assert.match(serviceSource, /resolveAppInstallTarget/);
  assert.match(serviceSource, /catalogPresentationCache/);
  assert.match(serviceSource, /installSurfaceSummaryCache/);
  assert.doesNotMatch(serviceSource, /const appInstallCatalog\s*=/);
  assert.doesNotMatch(serviceSource, /getFeaturedApp\(/);
  assert.doesNotMatch(serviceSource, /getTopCharts\(/);
  assert.match(serviceSource, /installerService\.inspectHubInstall\(/);
  assert.match(serviceSource, /installerService[\s\S]*listHubInstallCatalog\(/);
  assert.match(serviceSource, /installerService\.runHubDependencyInstall\(/);
  assert.match(serviceSource, /installerService\.runHubInstall\(/);
  assert.match(serviceSource, /installerService\.runHubUninstall\(/);
  assert.match(installerContractSource, /requestId\?:\s*string/);
  assert.match(installerContractSource, /requestId\??:\s*string\s*\|\s*null/);
  assert.match(installerContractSource, /operationKind:\s*HubInstallProgressOperationKind/);
  assert.match(installerContractSource, /installStatus\??:\s*HubInstallRecordStatus\s*\|\s*null/);
  assert.doesNotMatch(serviceSource, /setInterval\(/);
  assert.doesNotMatch(serviceSource, /Math\.random\(/);
  assert.doesNotMatch(serviceSource, /new Promise\(.*setTimeout/s);

  assert.match(detailSource, /inspectInstall\(/);
  assert.match(detailSource, /appStoreService\.getApp\(id\)/);
  assert.match(detailSource, /installDependencies\(/);
  assert.match(detailSource, /installApp\(/);
  assert.match(detailSource, /definition\.variants/);
  assert.match(detailSource, /assessment\.installStatus/);
  assert.match(detailSource, /dependencyIds:/);
  assert.match(detailSource, /currentProgressRequestIdRef/);
  assert.match(detailSource, /event\.requestId/);
  assert.match(detailSource, /requestAnimationFrame/);
  assert.match(detailSource, /scheduleProgressFlush/);
  assert.match(detailSource, /getGuidedInstallNavigation\(/);
  assert.match(detailSource, /navigate\(guidedInstallNavigation\)/);
  assert.doesNotMatch(detailSource, /installedTargets/);
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

runTest('the app install helper remains a thin shell over installer-provided catalog descriptors', () => {
  const catalogSource = read('packages/sdkwork-claw-apps/src/services/appInstallCatalog.ts');

  assert.doesNotMatch(catalogSource, /const appInstallCatalog\s*=/);
  assert.match(catalogSource, /resolveAppHostPlatform/);
  assert.match(catalogSource, /resolveAppInstallTarget/);
  assert.match(catalogSource, /HubInstallCatalogEntry/);
});
