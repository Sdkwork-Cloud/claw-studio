import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(relPath: string) {
  return fs.readFileSync(path.join(root, relPath), 'utf8');
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

runTest('sdkwork-claw-shell keeps the V5 route shell surface while routing api-router to a real feature module', () => {
  const routesSource = read('packages/sdkwork-claw-shell/src/application/router/AppRoutes.tsx');

  assert.doesNotMatch(routesSource, /FeaturePlaceholder/);
  assert.match(routesSource, /@sdkwork\/claw-apirouter/);
  assert.match(routesSource, /routes\.codeboxComingSoon/);
  assert.doesNotMatch(routesSource, /routes\.apiRouterComingSoon/);
  assert.match(routesSource, /<ApiRouter \/>/);
});

runTest('sdkwork-claw-shell keeps the dual-host provider stack', () => {
  const providersSource = read('packages/sdkwork-claw-shell/src/application/providers/AppProviders.tsx');
  const languageManagerSource = read('packages/sdkwork-claw-shell/src/application/providers/LanguageManager.tsx');

  assert.match(providersSource, /QueryClientProvider/);
  assert.match(providersSource, /BrowserRouter as Router/);
  assert.match(providersSource, /Toaster/);
  assert.match(providersSource, /ThemeManager/);
  assert.match(providersSource, /LanguageManager/);
  assert.match(languageManagerSource, /i18n\.changeLanguage/);
  assert.match(languageManagerSource, /document\.documentElement\.setAttribute\('lang'/);
});

runTest('sdkwork-claw-shell owns the pre-render i18n bootstrap for both hosts', () => {
  const shellIndexSource = read('packages/sdkwork-claw-shell/src/index.ts');
  const bootstrapSource = read('packages/sdkwork-claw-shell/src/application/bootstrap/bootstrapShellRuntime.ts');
  const providersSource = read('packages/sdkwork-claw-shell/src/application/providers/AppProviders.tsx');

  assert.match(shellIndexSource, /bootstrapShellRuntime/);
  assert.match(bootstrapSource, /ensureI18n/);
  assert.doesNotMatch(providersSource, /ensureI18n/);
});

runTest('sdkwork-claw-shell keeps theme and language side effects in separate providers', () => {
  const themeManagerSource = read('packages/sdkwork-claw-shell/src/application/providers/ThemeManager.tsx');

  assert.doesNotMatch(themeManagerSource, /changeAppLanguage/);
  assert.doesNotMatch(themeManagerSource, /setAttribute\('lang'/);
});

runTest('sdkwork-claw-shell promotes a unified app header above routed content', () => {
  const layoutSource = read('packages/sdkwork-claw-shell/src/application/layouts/MainLayout.tsx');
  const routesSource = read('packages/sdkwork-claw-shell/src/application/router/AppRoutes.tsx');

  assert.match(layoutSource, /AppHeader/);
  assert.match(layoutSource, /<AppHeader\s*\/>/);
  assert.match(layoutSource, /MobileAppDownloadDialog/);
  assert.match(layoutSource, /flex-col/);
  assert.match(routesSource, /Navigate to="\/dashboard" replace/);
  assert.match(routesSource, /path="\/dashboard"/);
});

runTest('sdkwork-claw-shell splits auth flows into distinct routes and moves settings into the user control', () => {
  const layoutSource = read('packages/sdkwork-claw-shell/src/application/layouts/MainLayout.tsx');
  const routesSource = read('packages/sdkwork-claw-shell/src/application/router/AppRoutes.tsx');
  const sidebarSource = read('packages/sdkwork-claw-shell/src/components/Sidebar.tsx');

  assert.match(routesSource, /path="\/auth"/);
  assert.match(routesSource, /path="\/login"/);
  assert.match(routesSource, /path="\/register"/);
  assert.match(routesSource, /path="\/forgot-password"/);
  assert.match(layoutSource, /isAuthRoute/);
  assert.match(sidebarSource, /data-slot="sidebar-user-control"/);
  assert.doesNotMatch(sidebarSource, /to="\/settings"/);
});

runTest('sdkwork-claw-shell keeps instance selection out of the sidebar implementation', () => {
  const sidebarSource = read('packages/sdkwork-claw-shell/src/components/Sidebar.tsx');

  assert.doesNotMatch(sidebarSource, /instanceService\.getInstances/);
  assert.doesNotMatch(sidebarSource, /useInstanceStore/);
  assert.doesNotMatch(sidebarSource, /switchInstance/);
  assert.doesNotMatch(sidebarSource, /manageInstances/);
});

runTest('sdkwork-claw-shell keeps sidebar collapse controls inside the sidebar chrome instead of the app header', () => {
  const headerSource = read('packages/sdkwork-claw-shell/src/components/AppHeader.tsx');
  const sidebarSource = read('packages/sdkwork-claw-shell/src/components/Sidebar.tsx');

  assert.doesNotMatch(headerSource, /toggleSidebar/);
  assert.doesNotMatch(headerSource, /PanelLeftClose/);
  assert.doesNotMatch(headerSource, /PanelLeftOpen/);

  assert.match(sidebarSource, /toggleSidebar/);
  assert.match(sidebarSource, /PanelLeftClose/);
  assert.match(sidebarSource, /PanelLeftOpen/);
  assert.match(sidebarSource, /common\.expandSidebar/);
  assert.match(sidebarSource, /common\.collapseSidebar/);
});

runTest('sdkwork-claw-shell keeps workspace centered and search in the leading header cluster', () => {
  const headerSource = read('packages/sdkwork-claw-shell/src/components/AppHeader.tsx');

  assert.match(headerSource, /data-slot="app-header-leading"/);
  assert.match(headerSource, /data-slot="app-header-center"/);
  assert.match(headerSource, /data-slot="app-header-search"/);
  assert.match(headerSource, /data-slot="app-header-workspace"/);
  assert.match(
    headerSource,
    /data-slot="app-header-leading"[\s\S]*data-slot="app-header-search"/,
  );
  assert.match(
    headerSource,
    /data-slot="app-header-center"[\s\S]*data-slot="app-header-workspace"/,
  );
});

runTest('sdkwork-claw-shell gives the centered workspace switcher a wider header footprint and popup', () => {
  const headerSource = read('packages/sdkwork-claw-shell/src/components/AppHeader.tsx');
  const switcherSource = read('packages/sdkwork-claw-shell/src/components/InstanceSwitcher.tsx');

  assert.match(headerSource, /data-slot="app-header-center"[\s\S]*max-w-\[36rem\]/);
  assert.match(headerSource, /pointer-events-auto w-full max-w-\[24rem\]/);
  assert.match(switcherSource, /w-\[30rem\]/);
  assert.match(switcherSource, /max-w-\[calc\(100vw-2rem\)\]/);
  assert.match(switcherSource, /-translate-x-1\/2/);
});

runTest('sdkwork-claw-shell uses a flat borderless header chrome', () => {
  const headerSource = read('packages/sdkwork-claw-shell/src/components/AppHeader.tsx');
  const switcherSource = read('packages/sdkwork-claw-shell/src/components/InstanceSwitcher.tsx');

  assert.doesNotMatch(headerSource, /border/);
  assert.doesNotMatch(switcherSource, /border/);
});

runTest('sdkwork-claw-shell keeps a persistent mobile app entry in the header chrome', () => {
  const headerSource = read('packages/sdkwork-claw-shell/src/components/AppHeader.tsx');

  assert.match(headerSource, /install\.mobileGuide\.headerAction/);
  assert.match(headerSource, /openMobileAppDialog/);
});

runTest('sdkwork-claw-shell only auto-prompts the mobile app guide from the dashboard landing route', () => {
  const layoutSource = read('packages/sdkwork-claw-shell/src/application/layouts/MainLayout.tsx');

  assert.match(layoutSource, /const isPromptEligibleRoute = location\.pathname === ROUTE_PATHS\.DASHBOARD;/);
  assert.match(layoutSource, /if \(isAuthRoute \|\| isInstallRoute \|\| !isPromptEligibleRoute \|\| hasSeenMobileAppPrompt\)/);
});

runTest('sdkwork-claw-shell keeps sidebar collapse affordance on the hover edge and exposes a resize handle', () => {
  const sidebarSource = read('packages/sdkwork-claw-shell/src/components/Sidebar.tsx');

  assert.match(sidebarSource, /data-slot="sidebar-edge-control"/);
  assert.match(sidebarSource, /data-slot="sidebar-resize-handle"/);
  assert.match(sidebarSource, /onPointerDown=\{startSidebarResize\}/);
  assert.match(sidebarSource, /onMouseEnter/);
  assert.match(sidebarSource, /onMouseLeave/);
});

runTest('sdkwork-claw-shell promotes ClawHub ahead of App Store in the ecosystem navigation', () => {
  const sidebarSource = read('packages/sdkwork-claw-shell/src/components/Sidebar.tsx');

  assert.match(
    sidebarSource,
    /id: 'market'[\s\S]*badge: t\('sidebar\.hotBadge'\)[\s\S]*id: 'apps'[\s\S]*label: t\('sidebar\.appStore'\)/,
  );
  assert.doesNotMatch(
    sidebarSource,
    /id: 'apps'[\s\S]*label: t\('sidebar\.appStore'\)[\s\S]*badge: t\('sidebar\.hotBadge'\)/,
  );
});

runTest('sdkwork-claw-shell promotes dashboard as the leading workspace entry across shell navigation surfaces', () => {
  const sidebarSource = read('packages/sdkwork-claw-shell/src/components/Sidebar.tsx');
  const commandPaletteSource = read('packages/sdkwork-claw-shell/src/components/commandPaletteCommands.ts');
  const settingsSource = read('packages/sdkwork-claw-settings/src/GeneralSettings.tsx');

  assert.match(
    sidebarSource,
    /section: t\('sidebar\.workspace'\)[\s\S]*id: 'dashboard'[\s\S]*id: 'chat'/,
  );
  assert.match(commandPaletteSource, /id: 'nav-dashboard'/);
  assert.match(commandPaletteSource, /navigate\('\/dashboard'\)/);
  assert.match(settingsSource, /id: 'dashboard', label: t\('sidebar\.dashboard'\)/);
});

runTest('sdkwork-claw-shell removes codebox from the setup sidebar while keeping api-router available', () => {
  const sidebarSource = read('packages/sdkwork-claw-shell/src/components/Sidebar.tsx');

  assert.doesNotMatch(sidebarSource, /id: 'codebox'/);
  assert.match(sidebarSource, /id: 'api-router'/);
});
