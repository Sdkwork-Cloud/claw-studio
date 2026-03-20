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

runTest('sdkwork-claw-apps keeps the app-store surface local while routing installs through hub-installer', () => {
  const pkg = readJson<{ dependencies?: Record<string, string> }>('packages/sdkwork-claw-apps/package.json');
  const indexSource = read('packages/sdkwork-claw-apps/src/index.ts');
  const serviceSource = read('packages/sdkwork-claw-apps/src/services/appStoreService.ts');
  const detailSource = read('packages/sdkwork-claw-apps/src/pages/apps/AppDetail.tsx');
  const storeSource = read('packages/sdkwork-claw-apps/src/pages/apps/AppStore.tsx');
  const installerContractSource = read('packages/sdkwork-claw-infrastructure/src/platform/contracts/installer.ts');

  assert.ok(exists('packages/sdkwork-claw-apps/src/AppStore.tsx'));
  assert.ok(exists('packages/sdkwork-claw-apps/src/AppDetail.tsx'));
  assert.ok(exists('packages/sdkwork-claw-apps/src/services/appStoreService.ts'));

  assert.ok(!pkg.dependencies?.['@sdkwork/claw-studio-apps']);
  assert.equal(pkg.dependencies?.['@sdkwork/claw-types'], 'workspace:*');
  assert.equal(pkg.dependencies?.['@sdkwork/claw-infrastructure'], 'workspace:*');
  assert.doesNotMatch(indexSource, /@sdkwork\/claw-studio-apps/);

  assert.match(serviceSource, /studioMockService/);
  assert.match(serviceSource, /installerService/);
  assert.match(serviceSource, /listHubInstallCatalog/);
  assert.match(serviceSource, /inspectInstall\(/);
  assert.match(serviceSource, /getInstallSurfaceSummaries\(/);
  assert.match(serviceSource, /getGuidedInstallNavigation\(/);
  assert.match(serviceSource, /installDependencies\(/);
  assert.match(serviceSource, /resolveAppInstallTarget/);
  assert.doesNotMatch(serviceSource, /const appInstallCatalog\s*=/);
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
  assert.match(detailSource, /installDependencies\(/);
  assert.match(detailSource, /installApp\(/);
  assert.match(detailSource, /definition\.variants/);
  assert.match(detailSource, /assessment\.installStatus/);
  assert.match(detailSource, /dependencyIds:/);
  assert.match(detailSource, /currentProgressRequestIdRef/);
  assert.match(detailSource, /event\.requestId/);
  assert.match(detailSource, /getGuidedInstallNavigation\(/);
  assert.match(detailSource, /navigate\(guidedInstallNavigation\)/);
  assert.doesNotMatch(detailSource, /installedTargets/);
  assert.doesNotMatch(detailSource, /setInterval\(/);
  assert.doesNotMatch(detailSource, /Math\.random\(/);

  assert.match(storeSource, /navigate\(`\/apps\/\$\{featuredApp\.id\}`\)/);
  assert.match(storeSource, /getInstallSurfaceSummaries\(/);
});

runTest('the app install helper remains a thin shell over installer-provided catalog descriptors', () => {
  const catalogSource = read('packages/sdkwork-claw-apps/src/services/appInstallCatalog.ts');

  assert.doesNotMatch(catalogSource, /const appInstallCatalog\s*=/);
  assert.match(catalogSource, /resolveAppHostPlatform/);
  assert.match(catalogSource, /resolveAppInstallTarget/);
  assert.match(catalogSource, /HubInstallCatalogEntry/);
});
