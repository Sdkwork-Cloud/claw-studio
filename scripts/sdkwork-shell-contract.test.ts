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

function runTest(name: string, fn: () => void) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

runTest('sdkwork-claw-shell keeps kernel, nodes, agents, and usage surfaces wired across the retained host shell', () => {
  const shellPackage = readJson<{ dependencies?: Record<string, string> }>(
    'packages/sdkwork-claw-shell/package.json',
  );
  const routesSource = read('packages/sdkwork-claw-shell/src/application/router/AppRoutes.tsx');
  const routePathsSource = read('packages/sdkwork-claw-shell/src/application/router/routePaths.ts');
  const routePrefetchSource = read('packages/sdkwork-claw-shell/src/application/router/routePrefetch.ts');
  const sidebarSource = read('packages/sdkwork-claw-shell/src/components/Sidebar.tsx');
  const settingsSource = read('packages/sdkwork-claw-settings/src/GeneralSettings.tsx');
  const commandPaletteSource = read('packages/sdkwork-claw-shell/src/components/commandPaletteCommands.ts');

  assert.equal(shellPackage.dependencies?.['@sdkwork/claw-agent'], 'workspace:*');
  assert.match(routePathsSource, /AGENTS: '\/agents'/);
  assert.match(routePathsSource, /KERNEL: '\/kernel'/);
  assert.match(routePathsSource, /NODES: '\/nodes'/);
  assert.match(routePathsSource, /USAGE: '\/usage'/);
  assert.match(routesSource, /path="\/agents"/);
  assert.match(routesSource, /path="\/kernel"/);
  assert.match(routesSource, /path="\/nodes"/);
  assert.match(routesSource, /path="\/usage"/);
  assert.match(routePrefetchSource, /\['\/agents', \(\) => import\('@sdkwork\/claw-agent'\)\]/);
  assert.match(routePrefetchSource, /\['\/kernel', \(\) => import\('@sdkwork\/claw-settings'\)\]/);
  assert.match(routePrefetchSource, /\['\/nodes', \(\) => import\('@sdkwork\/claw-instances'\)\]/);
  assert.match(sidebarSource, /id: 'agents'/);
  assert.match(sidebarSource, /id: 'kernel'/);
  assert.match(sidebarSource, /id: 'nodes'/);
  assert.match(sidebarSource, /id: 'usage'/);
  assert.match(settingsSource, /id: 'agents', label: t\('sidebar\.agentMarket'\)/);
  assert.match(settingsSource, /id: 'kernel', label: t\('sidebar\.kernelCenter'\)/);
  assert.match(settingsSource, /id: 'nodes', label: t\('sidebar\.nodes'\)/);
  assert.match(settingsSource, /id: 'usage', label: t\('sidebar\.usage'\)/);
  assert.match(commandPaletteSource, /id: 'nav-agents'/);
  assert.match(commandPaletteSource, /id: 'nav-kernel'/);
  assert.match(commandPaletteSource, /id: 'nav-nodes'/);
  assert.match(commandPaletteSource, /id: 'nav-usage'/);
});

runTest('sdkwork-claw-shell fully removes app store, third-party catalog, and commerce surfaces from retained host entrypoints', () => {
  const routesSource = read('packages/sdkwork-claw-shell/src/application/router/AppRoutes.tsx');
  const routePathsSource = read('packages/sdkwork-claw-shell/src/application/router/routePaths.ts');
  const routePrefetchSource = read('packages/sdkwork-claw-shell/src/application/router/routePrefetch.ts');
  const sidebarSource = read('packages/sdkwork-claw-shell/src/components/Sidebar.tsx');
  const settingsSource = read('packages/sdkwork-claw-settings/src/GeneralSettings.tsx');
  const commandPaletteSource = read('packages/sdkwork-claw-shell/src/components/commandPaletteCommands.ts');
  const headerSource = read('packages/sdkwork-claw-shell/src/components/AppHeader.tsx');
  const trayBridgeSource = read('packages/sdkwork-claw-desktop/src/desktop/bootstrap/DesktopTrayRouteBridge.tsx');
  const desktopBootstrapSource = read('packages/sdkwork-claw-desktop/src-tauri/src/app/bootstrap.rs');
  const shellPackageSource = read('packages/sdkwork-claw-shell/package.json');

  for (const source of [
    routesSource,
    routePathsSource,
    routePrefetchSource,
    sidebarSource,
    settingsSource,
    commandPaletteSource,
    trayBridgeSource,
    desktopBootstrapSource,
    shellPackageSource,
  ]) {
    assert.doesNotMatch(source, /\/apps\b/);
    assert.doesNotMatch(source, /\/market\b/);
    assert.doesNotMatch(source, /\/mall\b/);
    assert.doesNotMatch(source, /\/github\b/);
    assert.doesNotMatch(source, /\/huggingface\b/);
    assert.doesNotMatch(source, /\/model-purchase\b/);
    assert.doesNotMatch(source, /\/points\b/);
    assert.doesNotMatch(source, /@sdkwork\/claw-(apps|github|huggingface|mall|market|model-purchase|points)/);
  }

  assert.doesNotMatch(headerSource, /PointsHeaderEntry/);
  assert.doesNotMatch(desktopBootstrapSource, /open_apps/);
});

runTest('sdkwork-claw-shell migrates persisted sidebar visibility away from removed ecosystem ids', () => {
  const appStoreSource = read('packages/sdkwork-claw-core/src/stores/useAppStore.ts');

  assert.match(appStoreSource, /const SIDEBAR_VISIBILITY_VERSION = 5;/);
  assert.match(appStoreSource, /const DEFAULT_HIDDEN_SIDEBAR_ITEMS = \['extensions'\] as const;/);
  assert.match(appStoreSource, /item !== 'apps'/);
  assert.match(appStoreSource, /item !== 'market'/);
  assert.match(appStoreSource, /item !== 'mall'/);
  assert.match(appStoreSource, /item !== 'github'/);
  assert.match(appStoreSource, /item !== 'huggingface'/);
  assert.match(appStoreSource, /item !== 'model-purchase'/);
  assert.match(appStoreSource, /item !== 'points'/);
});

runTest('sdkwork-claw-shell keeps header chrome focused on mobile guide, instance switching, and account controls', () => {
  const headerSource = read('packages/sdkwork-claw-shell/src/components/AppHeader.tsx');

  assert.match(headerSource, /MobileAppDownloadDialog|install\.mobileGuide\.headerAction/);
  assert.match(headerSource, /InstanceSwitcher/);
  assert.match(headerSource, /sidebar\.userMenu\.profileSettings/);
  assert.match(headerSource, /sidebar\.userMenu\.logout/);
  assert.match(headerSource, /DesktopWindowControls variant="header"/);
  assert.doesNotMatch(headerSource, /@sdkwork\/claw-points/);
});

runTest('sdkwork-claw-shell keeps auth routes isolated while workspace chrome owns retained navigation surfaces', () => {
  const layoutSource = read('packages/sdkwork-claw-shell/src/application/layouts/MainLayout.tsx');
  const routesSource = read('packages/sdkwork-claw-shell/src/application/router/AppRoutes.tsx');
  const sidebarSource = read('packages/sdkwork-claw-shell/src/components/Sidebar.tsx');

  assert.match(routesSource, /path="\/login"/);
  assert.match(routesSource, /path="\/register"/);
  assert.match(routesSource, /path="\/forgot-password"/);
  assert.match(routesSource, /path="\/login\/oauth\/callback\/:provider"/);
  assert.match(layoutSource, /isAuthRoute/);
  assert.match(sidebarSource, /data-slot="sidebar-user-control"/);
  assert.match(sidebarSource, /data-slot="sidebar-edge-control"/);
  assert.match(sidebarSource, /data-slot="sidebar-resize-handle"/);
});
