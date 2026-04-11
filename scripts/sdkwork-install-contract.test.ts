import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const removedInstallFeaturePackage = ['sdkwork', 'claw', 'install'].join('-');
const removedInstallWorkspacePath = ['packages', removedInstallFeaturePackage].join('/');
const removedInstallDependencyName = ['@sdkwork', ['claw', 'install'].join('-')].join('/');
const removedInstallImportPattern = new RegExp(
  removedInstallDependencyName.replace('/', '\\/'),
);
const removedInstallPrefetchPattern = new RegExp(
  `\\['\\/install',\\s*\\(\\)\\s*=>\\s*import\\('${removedInstallDependencyName.replace('/', '\\/')}'\\)\\]`,
);

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

runTest('removed install feature package stays deleted and shell remains free of install-route wiring', () => {
  const shellPackage = readJson<{ dependencies?: Record<string, string> }>(
    'packages/sdkwork-claw-shell/package.json',
  );
  const appRoutesSource = read('packages/sdkwork-claw-shell/src/application/router/AppRoutes.tsx');
  const routePathsSource = read(
    'packages/sdkwork-claw-shell/src/application/router/routePaths.ts',
  );
  const routePrefetchSource = read(
    'packages/sdkwork-claw-shell/src/application/router/routePrefetch.ts',
  );
  const sidebarSource = read('packages/sdkwork-claw-shell/src/components/Sidebar.tsx');
  const routeSurface = read('scripts/fixtures/claw-studio-v5-route-surface.json');

  assert.ok(!exists(`${removedInstallWorkspacePath}/package.json`));
  assert.ok(!exists(`${removedInstallWorkspacePath}/src`));
  assert.ok(!shellPackage.dependencies?.[removedInstallDependencyName]);
  assert.doesNotMatch(appRoutesSource, removedInstallImportPattern);
  assert.doesNotMatch(appRoutesSource, /path="\/install"/);
  assert.doesNotMatch(routePathsSource, /INSTALL(_DETAIL)?:\s*'\/install/);
  assert.doesNotMatch(routePrefetchSource, removedInstallPrefetchPattern);
  assert.doesNotMatch(sidebarSource, /id:\s*'install'/);
  assert.doesNotMatch(sidebarSource, /to:\s*'\/install'/);
  assert.doesNotMatch(routeSurface, /"\/install"/);
  assert.doesNotMatch(routeSurface, /"\/install\/:method"/);
});

runTest('Claw Studio routes OpenClaw setup through docs or instance onboarding instead of the removed install page', () => {
  const clawDetailSource = read('packages/sdkwork-claw-center/src/pages/ClawDetail.tsx');
  const clawUploadSource = read('packages/sdkwork-claw-center/src/pages/ClawUpload.tsx');
  const instancesSource = read('packages/sdkwork-claw-instances/src/pages/Instances.tsx');
  const warmPolicySource = read(
    'packages/sdkwork-claw-chat/src/runtime/openClawGatewayConnectionsPolicy.ts',
  );

  assert.doesNotMatch(clawDetailSource, /navigate\('\/install\?product=openclaw'\)/);
  assert.doesNotMatch(clawUploadSource, /navigate\('\/install'\)/);
  assert.doesNotMatch(instancesSource, /navigate\('\/install\?product=openclaw'\)/);
  assert.doesNotMatch(warmPolicySource, /pathname === '\/install'/);
  assert.doesNotMatch(warmPolicySource, /pathname\.startsWith\('\/install\/'\)/);
});
