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

runTest('sdkwork-claw-shell keeps dedicated routes for model-purchase and points while removing the legacy api-router route', () => {
  const routesSource = read('packages/sdkwork-claw-shell/src/application/router/AppRoutes.tsx');

  assert.doesNotMatch(routesSource, /FeaturePlaceholder/);
  assert.match(routesSource, /@sdkwork\/claw-model-purchase/);
  assert.match(routesSource, /@sdkwork\/claw-points/);
  assert.match(routesSource, /routes\.codeboxComingSoon/);
  assert.doesNotMatch(routesSource, /routes\.apiRouterComingSoon/);
  assert.doesNotMatch(routesSource, /path="\/api-router"/);
  assert.match(routesSource, /path="\/model-purchase"/);
  assert.match(routesSource, /path="\/points"/);
  assert.match(routesSource, /<ModelPurchase \/>/);
  assert.match(routesSource, /<Points \/>/);
});

runTest('sdkwork-claw-shell exposes dedicated kernel and node governance surfaces across routes, sidebar, settings, prefetch, and command palette', () => {
  const routesSource = read('packages/sdkwork-claw-shell/src/application/router/AppRoutes.tsx');
  const routePathsSource = read('packages/sdkwork-claw-shell/src/application/router/routePaths.ts');
  const routePrefetchSource = read('packages/sdkwork-claw-shell/src/application/router/routePrefetch.ts');
  const sidebarSource = read('packages/sdkwork-claw-shell/src/components/Sidebar.tsx');
  const settingsSource = read('packages/sdkwork-claw-settings/src/GeneralSettings.tsx');
  const commandPaletteSource = read('packages/sdkwork-claw-shell/src/components/commandPaletteCommands.ts');
  const settingsIndexSource = read('packages/sdkwork-claw-settings/src/index.ts');
  const instancesIndexSource = read('packages/sdkwork-claw-instances/src/index.ts');
  const enLocale = readJson<{
    sidebar: { kernelCenter: string; nodes: string };
    commandPalette: {
      commands: {
        kernel: { title: string };
        nodes: { title: string };
      };
    };
  }>('packages/sdkwork-claw-i18n/src/locales/en.json');
  const zhLocale = readJson<{
    sidebar: { kernelCenter: string; nodes: string };
    commandPalette: {
      commands: {
        kernel: { title: string; subtitle: string };
        nodes: { title: string; subtitle: string };
      };
    };
  }>('packages/sdkwork-claw-i18n/src/locales/zh.json');

  assert.match(routePathsSource, /KERNEL: '\/kernel'/);
  assert.match(routePathsSource, /NODES: '\/nodes'/);
  assert.match(settingsIndexSource, /export \* from '\.\/KernelCenter\.ts';/);
  assert.match(instancesIndexSource, /export \* from '\.\/pages\/Nodes\.tsx';/);
  assert.match(
    routesSource,
    /const KernelCenter = lazy\(\(\) =>[\s\S]*import\('@sdkwork\/claw-settings'\)[\s\S]*module\.KernelCenter/,
  );
  assert.match(
    routesSource,
    /const Nodes = lazy\(\(\) =>[\s\S]*import\('@sdkwork\/claw-instances'\)[\s\S]*module\.Nodes/,
  );
  assert.match(routesSource, /path="\/kernel"/);
  assert.match(routesSource, /path="\/nodes"/);
  assert.match(routesSource, /<KernelCenter \/>/);
  assert.match(routesSource, /<Nodes \/>/);
  assert.match(routePrefetchSource, /\['\/kernel', \(\) => import\('@sdkwork\/claw-settings'\)\]/);
  assert.match(routePrefetchSource, /\['\/nodes', \(\) => import\('@sdkwork\/claw-instances'\)\]/);
  assert.match(sidebarSource, /id: 'kernel'/);
  assert.match(sidebarSource, /to: '\/kernel'/);
  assert.match(sidebarSource, /label: t\('sidebar\.kernelCenter'\)/);
  assert.match(sidebarSource, /id: 'nodes'/);
  assert.match(sidebarSource, /to: '\/nodes'/);
  assert.match(sidebarSource, /label: t\('sidebar\.nodes'\)/);
  assert.match(settingsSource, /id: 'kernel', label: t\('sidebar\.kernelCenter'\)/);
  assert.match(settingsSource, /id: 'nodes', label: t\('sidebar\.nodes'\)/);
  assert.match(commandPaletteSource, /id: 'nav-kernel'/);
  assert.match(commandPaletteSource, /commandPalette\.commands\.kernel\.title/);
  assert.match(commandPaletteSource, /navigate\('\/kernel'\)/);
  assert.match(commandPaletteSource, /id: 'nav-nodes'/);
  assert.match(commandPaletteSource, /commandPalette\.commands\.nodes\.title/);
  assert.match(commandPaletteSource, /navigate\('\/nodes'\)/);
  assert.equal(enLocale.sidebar.kernelCenter, 'Kernel Center');
  assert.equal(enLocale.sidebar.nodes, 'Nodes');
  assert.equal(enLocale.commandPalette.commands.kernel.title, 'Go to Kernel Center');
  assert.equal(
    enLocale.commandPalette.commands.kernel.subtitle,
    'Inspect the built-in OpenClaw host, endpoint, and provenance',
  );
  assert.equal(enLocale.commandPalette.commands.nodes.title, 'Go to Nodes');
  assert.equal(
    enLocale.commandPalette.commands.nodes.subtitle,
    'Inspect local and remote kernel inventory',
  );
  assert.equal(zhLocale.sidebar.kernelCenter, '内核中心');
  assert.equal(zhLocale.sidebar.nodes, '节点');
  assert.equal(zhLocale.commandPalette.commands.kernel.title, '前往内核中心');
  assert.equal(
    zhLocale.commandPalette.commands.kernel.subtitle,
    '查看内置 OpenClaw 宿主、端点与运行来源',
  );
  assert.equal(zhLocale.commandPalette.commands.nodes.title, '前往节点');
  assert.equal(
    zhLocale.commandPalette.commands.nodes.subtitle,
    '查看本地与远程内核节点清单',
  );
});
runTest('sdkwork-claw-shell exposes the agent marketplace across route, sidebar, settings, prefetch, and command surfaces', () => {
  const shellPackage = readJson<{ dependencies?: Record<string, string> }>(
    'packages/sdkwork-claw-shell/package.json',
  );
  const routesSource = read('packages/sdkwork-claw-shell/src/application/router/AppRoutes.tsx');
  const routePathsSource = read('packages/sdkwork-claw-shell/src/application/router/routePaths.ts');
  const routePrefetchSource = read('packages/sdkwork-claw-shell/src/application/router/routePrefetch.ts');
  const sidebarSource = read('packages/sdkwork-claw-shell/src/components/Sidebar.tsx');
  const settingsSource = read('packages/sdkwork-claw-settings/src/GeneralSettings.tsx');
  const commandPaletteSource = read('packages/sdkwork-claw-shell/src/components/commandPaletteCommands.ts');
  const enLocale = readJson<{
    sidebar: { agentMarket: string };
    commandPalette: { commands: { agents: { title: string; subtitle: string } } };
    agentMarket: { hero: { title: string } };
  }>('packages/sdkwork-claw-i18n/src/locales/en.json');
  const zhLocale = readJson<{
    sidebar: { agentMarket: string };
    commandPalette: { commands: { agents: { title: string; subtitle: string } } };
    agentMarket: { hero: { title: string } };
  }>('packages/sdkwork-claw-i18n/src/locales/zh.json');

  assert.equal(shellPackage.dependencies?.['@sdkwork/claw-agent'], 'workspace:*');
  assert.match(routePathsSource, /AGENTS: '\/agents'/);
  assert.match(routesSource, /const AgentMarket = lazy\(\(\) =>[\s\S]*import\('@sdkwork\/claw-agent'\)/);
  assert.match(routesSource, /path="\/agents"/);
  assert.match(routesSource, /<AgentMarket \/>/);
  assert.match(routePrefetchSource, /\['\/agents', \(\) => import\('@sdkwork\/claw-agent'\)\]/);
  assert.match(sidebarSource, /id: 'agents'/);
  assert.match(sidebarSource, /to: '\/agents'/);
  assert.match(sidebarSource, /label: t\('sidebar\.agentMarket'\)/);
  assert.match(sidebarSource, /BriefcaseBusiness/);
  assert.doesNotMatch(sidebarSource, /icon: Bot/);
  assert.match(settingsSource, /id: 'agents', label: t\('sidebar\.agentMarket'\)/);
  assert.match(commandPaletteSource, /id: 'nav-agents'/);
  assert.match(commandPaletteSource, /commandPalette\.commands\.agents\.title/);
  assert.match(commandPaletteSource, /navigate\('\/agents'\)/);
  assert.match(commandPaletteSource, /icon: BriefcaseBusiness/);
  assert.doesNotMatch(commandPaletteSource, /icon: Bot/);
  assert.equal(enLocale.sidebar.agentMarket, 'Agent Market');
  assert.equal(enLocale.commandPalette.commands.agents.title, 'Go to Agent Market');
  assert.equal(enLocale.agentMarket.hero.title, 'OpenClaw Agent Market');
  assert.equal(zhLocale.sidebar.agentMarket, '数字员工');
  assert.equal(zhLocale.commandPalette.commands.agents.title, '前往 Agent 市场');
  assert.equal(zhLocale.agentMarket.hero.title, 'OpenClaw Agent 市场');
});

runTest('sdkwork-claw-shell exposes ClawMall across route, sidebar, settings, prefetch, and command surfaces', () => {
  const shellPackage = readJson<{ dependencies?: Record<string, string> }>(
    'packages/sdkwork-claw-shell/package.json',
  );
  const routesSource = read('packages/sdkwork-claw-shell/src/application/router/AppRoutes.tsx');
  const routePathsSource = read('packages/sdkwork-claw-shell/src/application/router/routePaths.ts');
  const routePrefetchSource = read('packages/sdkwork-claw-shell/src/application/router/routePrefetch.ts');
  const sidebarSource = read('packages/sdkwork-claw-shell/src/components/Sidebar.tsx');
  const settingsSource = read('packages/sdkwork-claw-settings/src/GeneralSettings.tsx');
  const commandPaletteSource = read('packages/sdkwork-claw-shell/src/components/commandPaletteCommands.ts');
  const enLocale = readJson<{
    sidebar: { clawMall: string };
    commandPalette: { commands: { mall: { title: string; subtitle: string } } };
  }>('packages/sdkwork-claw-i18n/src/locales/en.json');
  const zhLocale = readJson<{
    sidebar: { clawMall: string };
    commandPalette: { commands: { mall: { title: string; subtitle: string } } };
  }>('packages/sdkwork-claw-i18n/src/locales/zh.json');

  assert.equal(shellPackage.dependencies?.['@sdkwork/claw-mall'], 'workspace:*');
  assert.match(routePathsSource, /MALL: '\/mall'/);
  assert.match(routePathsSource, /PRODUCT_DETAIL: '\/mall\/:id'/);
  assert.match(routesSource, /const ClawMall = lazy\(\(\) =>[\s\S]*import\('@sdkwork\/claw-mall'\)/);
  assert.match(routesSource, /const ProductDetail = lazy\(\(\) =>[\s\S]*import\('@sdkwork\/claw-mall'\)/);
  assert.match(routesSource, /path="\/mall"/);
  assert.match(routesSource, /path="\/mall\/:id"/);
  assert.match(routesSource, /<ClawMall \/>/);
  assert.match(routesSource, /<ProductDetail \/>/);
  assert.match(routePrefetchSource, /\['\/mall', \(\) => import\('@sdkwork\/claw-mall'\)\]/);
  assert.match(sidebarSource, /id: 'mall'/);
  assert.match(sidebarSource, /to: '\/mall'/);
  assert.match(sidebarSource, /icon: Store/);
  assert.match(sidebarSource, /label: t\('sidebar\.clawMall'\)/);
  assert.match(settingsSource, /id: 'mall', label: t\('sidebar\.clawMall'\)/);
  assert.match(commandPaletteSource, /id: 'nav-mall'/);
  assert.match(commandPaletteSource, /commandPalette\.commands\.mall\.title/);
  assert.match(commandPaletteSource, /navigate\('\/mall'\)/);
  assert.match(commandPaletteSource, /icon: Store/);
  assert.equal(enLocale.sidebar.clawMall, 'Claw Mall');
  assert.equal(enLocale.commandPalette.commands.mall.title, 'Go to Claw Mall');
  assert.equal(zhLocale.sidebar.clawMall, 'Claw 商城');
  assert.equal(zhLocale.commandPalette.commands.mall.title, '前往 Claw 商城');
});

runTest('sdkwork-claw-shell keeps sidebar and navigation icons semantically grouped instead of using generic placeholders', () => {
  const sidebarSource = read('packages/sdkwork-claw-shell/src/components/Sidebar.tsx');
  const commandPaletteSource = read('packages/sdkwork-claw-shell/src/components/commandPaletteCommands.ts');

  assert.match(sidebarSource, /LayoutDashboard/);
  assert.match(sidebarSource, /CalendarClock/);
  assert.match(sidebarSource, /Blocks/);
  assert.match(sidebarSource, /PlugZap/);
  assert.match(sidebarSource, /Waypoints/);
  assert.match(sidebarSource, /Newspaper/);
  assert.match(sidebarSource, /BrainCircuit/);
  assert.match(sidebarSource, /Store/);
  assert.match(sidebarSource, /id: 'tasks', to: '\/tasks', icon: CalendarClock/);
  assert.match(sidebarSource, /id: 'dashboard', to: '\/dashboard', icon: LayoutDashboard/);
  assert.match(sidebarSource, /id: 'market',[\s\S]*icon: Blocks/);
  assert.match(sidebarSource, /id: 'mall', to: '\/mall', icon: Store/);
  assert.match(sidebarSource, /id: 'extensions', to: '\/extensions', icon: PlugZap/);
  assert.match(sidebarSource, /id: 'claw-upload', to: '\/claw-center', icon: Waypoints/);
  assert.match(sidebarSource, /id: 'community', to: '\/community', icon: Newspaper/);
  assert.match(sidebarSource, /id: 'huggingface', to: '\/huggingface', icon: BrainCircuit/);
  assert.doesNotMatch(sidebarSource, /id: 'claw-center', to: '\/claw-center', icon: Store/);
  assert.doesNotMatch(sidebarSource, /id: 'tasks', to: '\/tasks', icon: Clock/);
  assert.doesNotMatch(sidebarSource, /id: 'dashboard', to: '\/dashboard', icon: Gauge/);
  assert.doesNotMatch(sidebarSource, /id: 'community', to: '\/community', icon: Users/);
  assert.doesNotMatch(sidebarSource, /id: 'huggingface', to: '\/huggingface', icon: Box/);
  assert.doesNotMatch(sidebarSource, /id: 'claw-center', to: '\/claw-center', icon: Network/);

  assert.match(commandPaletteSource, /LayoutDashboard/);
  assert.match(commandPaletteSource, /BrainCircuit/);
  assert.match(commandPaletteSource, /Waypoints/);
  assert.match(commandPaletteSource, /Store/);
  assert.match(commandPaletteSource, /id: 'nav-dashboard',[\s\S]*icon: LayoutDashboard/);
  assert.match(commandPaletteSource, /id: 'nav-mall',[\s\S]*icon: Store/);
  assert.match(commandPaletteSource, /id: 'nav-hf',[\s\S]*icon: BrainCircuit/);
  assert.match(commandPaletteSource, /id: 'nav-upload',[\s\S]*icon: Waypoints/);
  assert.match(commandPaletteSource, /id: 'nav-mall',[\s\S]*navigate\('\/mall'\)/);
  assert.match(commandPaletteSource, /id: 'nav-upload',[\s\S]*navigate\('\/claw-center'\)/);
  assert.doesNotMatch(commandPaletteSource, /id: 'nav-dashboard',[\s\S]*icon: Gauge/);
  assert.doesNotMatch(commandPaletteSource, /id: 'nav-hf',[\s\S]*icon: Box/);
  assert.doesNotMatch(commandPaletteSource, /id: 'nav-upload',[\s\S]*icon: Globe/);
  assert.doesNotMatch(commandPaletteSource, /id: 'nav-upload',[\s\S]*navigate\('\/claw-upload'\)/);
});

runTest('sdkwork-claw-shell lazy-loads heavy route modules so the shell entry stays responsive', () => {
  const routesSource = read('packages/sdkwork-claw-shell/src/application/router/AppRoutes.tsx');

  assert.match(routesSource, /const AuthPage = lazy\(\(\) =>[\s\S]*import\('@sdkwork\/claw-auth'\)/);
  assert.match(routesSource, /const Dashboard = lazy\(\(\) =>[\s\S]*import\('@sdkwork\/claw-dashboard'\)/);
  assert.match(routesSource, /const Market = lazy\(\(\) =>[\s\S]*import\('@sdkwork\/claw-market'\)/);
  assert.match(routesSource, /const Chat = lazy\(\(\) =>[\s\S]*import\('@sdkwork\/claw-chat'\)/);
  assert.match(routesSource, /const Settings = lazy\(\(\) =>[\s\S]*import\('@sdkwork\/claw-settings'\)/);
  assert.match(routesSource, /const Points = lazy\(\(\) =>[\s\S]*import\('@sdkwork\/claw-points'\)/);
  assert.match(routesSource, /const AppStore = lazy\(\(\) =>[\s\S]*import\('@sdkwork\/claw-apps'\)/);
  assert.match(routesSource, /const ClawMall = lazy\(\(\) =>[\s\S]*import\('@sdkwork\/claw-mall'\)/);
  assert.match(
    routesSource,
    /path="\/dashboard"[\s\S]*<Suspense fallback={<RouteFallback \/>}>[\s\S]*<Dashboard \/>/,
  );
  assert.match(
    routesSource,
    /path="\/market"[\s\S]*<Suspense fallback={<RouteFallback \/>}>[\s\S]*<Market \/>/,
  );
  assert.match(
    routesSource,
    /path="\/settings"[\s\S]*<Suspense fallback={<RouteFallback \/>}>[\s\S]*<Settings \/>/,
  );
  assert.match(
    routesSource,
    /path="\/login"[\s\S]*<Suspense fallback={<RouteFallback \/>}>[\s\S]*<AuthPage \/>/,
  );
  assert.doesNotMatch(routesSource, /from '@sdkwork\/claw-dashboard';/);
  assert.doesNotMatch(routesSource, /from '@sdkwork\/claw-market';/);
  assert.doesNotMatch(routesSource, /from '@sdkwork\/claw-chat';/);
  assert.doesNotMatch(routesSource, /from '@sdkwork\/claw-settings';/);
  assert.doesNotMatch(routesSource, /from '@sdkwork\/claw-auth';/);
});

runTest('sdkwork-claw-shell defers optional header and dialog feature surfaces until they are needed', () => {
  const layoutSource = read('packages/sdkwork-claw-shell/src/application/layouts/MainLayout.tsx');
  const headerSource = read('packages/sdkwork-claw-shell/src/components/AppHeader.tsx');
  const shellIndexSource = read('packages/sdkwork-claw-shell/src/index.ts');
  const warmersPolicySource = read(
    'packages/sdkwork-claw-shell/src/application/layouts/chatRuntimeWarmersPolicy.ts',
  );

  assert.match(
    layoutSource,
    /const MobileAppDownloadDialog = lazy\(\(\) =>[\s\S]*import\('@sdkwork\/claw-install'\)/,
  );
  assert.match(
    layoutSource,
    /const ChatRuntimeWarmers = lazy\(\(\) =>[\s\S]*import\('\.\.\/\.\.\/components\/ChatRuntimeWarmers'\)/,
  );
  assert.match(
    headerSource,
    /const PointsHeaderEntry = lazy\(\(\) =>[\s\S]*import\('@sdkwork\/claw-points'\)/,
  );
  assert.match(
    headerSource,
    /const InstanceSwitcher = lazy\(\(\) =>[\s\S]*import\('\.\/InstanceSwitcher'\)/,
  );
  assert.doesNotMatch(layoutSource, /import \{ MobileAppDownloadDialog \} from '@sdkwork\/claw-install';/);
  assert.doesNotMatch(layoutSource, /import \{ OpenClawGatewayConnections \} from '@sdkwork\/claw-chat';/);
  assert.doesNotMatch(layoutSource, /import \{ ChatCronActivityNotifications \} from '\.\.\/\.\.\/components\/ChatCronActivityNotifications';/);
  assert.doesNotMatch(headerSource, /import \{ PointsHeaderEntry \} from '@sdkwork\/claw-points';/);
  assert.doesNotMatch(headerSource, /import \{ InstanceSwitcher \} from '\.\/InstanceSwitcher';/);
  assert.match(layoutSource, /shouldRenderChatRuntimeWarmersForPath/);
  assert.match(warmersPolicySource, /ROUTE_PATHS\.INSTALL/);
  assert.match(warmersPolicySource, /ROUTE_PATHS\.OAUTH_CALLBACK_PREFIX/);
  assert.match(layoutSource, /isMobileAppDialogOpen \?[\s\S]*<Suspense fallback=\{null\}>[\s\S]*<MobileAppDownloadDialog/);
  assert.match(layoutSource, /shouldRenderChatRuntimeWarmers \?[\s\S]*<Suspense fallback=\{null\}>[\s\S]*<ChatRuntimeWarmers/);
  assert.match(headerSource, /<Suspense fallback=\{null\}>[\s\S]*<PointsHeaderEntry/);
  assert.match(headerSource, /<Suspense fallback=\{<InstanceSwitcherFallback \/>}>\s*<InstanceSwitcher/);
  assert.doesNotMatch(shellIndexSource, /export \{ InstanceSwitcher \} from '\.\/components\/InstanceSwitcher';/);
});

runTest('sdkwork-claw-shell keeps the dual-host provider stack', () => {
  const providersSource = read('packages/sdkwork-claw-shell/src/application/providers/AppProviders.tsx');
  const languageManagerSource = read('packages/sdkwork-claw-shell/src/application/providers/LanguageManager.tsx');

  assert.match(providersSource, /QueryClientProvider/);
  assert.match(providersSource, /BrowserRouter as Router/);
  assert.match(providersSource, /Toaster/);
  assert.match(providersSource, /ThemeManager/);
  assert.match(providersSource, /LanguageManager/);
  assert.match(providersSource, /onLanguagePreferenceChange\?:/);
  assert.match(providersSource, /<LanguageManager onLanguagePreferenceChange=\{onLanguagePreferenceChange\} \/>/);
  assert.doesNotMatch(languageManagerSource, /@sdkwork\/claw-infrastructure/);
  assert.doesNotMatch(languageManagerSource, /getRuntimePlatform\(\)\.setAppLanguage\(languagePreference\)/);
  assert.match(languageManagerSource, /onLanguagePreferenceChange\?:/);
  assert.match(languageManagerSource, /onLanguagePreferenceChange\?\.\(languagePreference\)/);
  assert.match(languageManagerSource, /i18n\.changeLanguage/);
  assert.match(languageManagerSource, /document\.documentElement\.setAttribute\('lang'/);
});

runTest('sdkwork-claw-shell keeps i18n bootstrapped before render with a provider-level client fallback', () => {
  const shellIndexSource = read('packages/sdkwork-claw-shell/src/index.ts');
  const bootstrapSource = read('packages/sdkwork-claw-shell/src/application/bootstrap/bootstrapShellRuntime.ts');
  const providersSource = read('packages/sdkwork-claw-shell/src/application/providers/AppProviders.tsx');

  assert.match(shellIndexSource, /bootstrapShellRuntime/);
  assert.match(bootstrapSource, /ensureI18n/);
  assert.match(bootstrapSource, /runBootstrapShellRuntime/);
  assert.match(bootstrapSource, /getPlatformBridge/);
  assert.match(bootstrapSource, /bootstrapServerBrowserPlatformBridge/);
  assert.match(bootstrapSource, /if \(dependencies\.getActivePlatform\(\) !== 'desktop'\)/);
  assert.match(providersSource, /ensureI18n/);
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
  assert.doesNotMatch(layoutSource, /const isChatRoute = location\.pathname === ROUTE_PATHS\.CHAT;/);
  assert.doesNotMatch(layoutSource, /\{!isChatRoute \? <AppHeader\s*\/> : null\}/);
  assert.doesNotMatch(layoutSource, /DesktopWindowControls variant="floating"/);
  assert.match(layoutSource, /MobileAppDownloadDialog/);
  assert.match(layoutSource, /flex-col/);
  assert.match(routesSource, /Navigate to="\/chat" replace/);
  assert.match(routesSource, /path="\/chat"/);
  assert.match(routesSource, /path="\/dashboard"/);
});

runTest('sdkwork-claw-shell reuses the shared app header for auth routes while hiding workspace-only chrome', () => {
  const layoutSource = read('packages/sdkwork-claw-shell/src/application/layouts/MainLayout.tsx');
  const headerSource = read('packages/sdkwork-claw-shell/src/components/AppHeader.tsx');

  assert.match(layoutSource, /if \(isAuthRoute\)/);
  assert.match(layoutSource, /<AppHeader mode="auth" \/>/);
  assert.match(headerSource, /mode\?: 'default' \| 'auth'/);
  assert.match(headerSource, /const isAuthMode = mode === 'auth';/);
  assert.match(headerSource, /\{!isAuthMode \? \([\s\S]*data-slot="app-header-search"/);
  assert.match(headerSource, /\{!isAuthMode \? \([\s\S]*data-slot="app-header-center"/);
  assert.match(headerSource, /DesktopWindowControls variant="header" \/>/);
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

runTest('sdkwork-claw-shell routes OAuth callbacks through the dedicated auth callback page and keeps them inside the shared auth header chrome', () => {
  const layoutSource = read('packages/sdkwork-claw-shell/src/application/layouts/MainLayout.tsx');
  const routesSource = read('packages/sdkwork-claw-shell/src/application/router/AppRoutes.tsx');
  const routePathsSource = read('packages/sdkwork-claw-shell/src/application/router/routePaths.ts');

  assert.match(routePathsSource, /OAUTH_CALLBACK: '\/login\/oauth\/callback\/:provider'/);
  assert.match(routePathsSource, /OAUTH_CALLBACK_PREFIX: '\/login\/oauth\/callback'/);
  assert.match(
    routesSource,
    /const AuthOAuthCallbackPage = lazy\(\(\) =>[\s\S]*import\('@sdkwork\/claw-auth'\)[\s\S]*module\.AuthOAuthCallbackPage/,
  );
  assert.match(routesSource, /path="\/login\/oauth\/callback\/:provider"/);
  assert.match(routesSource, /<AuthOAuthCallbackPage \/>/);
  assert.match(layoutSource, /location\.pathname\.startsWith\(ROUTE_PATHS\.OAUTH_CALLBACK_PREFIX\)/);
  assert.match(layoutSource, /<AppHeader mode="auth" \/>/);
});

runTest('sdkwork-claw-settings removes the dedicated llm settings tab without reintroducing an api-router workspace', () => {
  const settingsSource = read('packages/sdkwork-claw-settings/src/Settings.tsx');

  assert.doesNotMatch(settingsSource, /import \{ LLMSettings \} from '\.\/LLMSettings';/);
  assert.doesNotMatch(settingsSource, /id: 'llm', label: t\('settings\.tabs\.llm'\)/);
  assert.doesNotMatch(settingsSource, /\{activeTab === 'llm' && <LLMSettings \/>\}/);
  assert.match(settingsSource, /activeTab = settingsTabs\.some/);
  assert.match(settingsSource, /\? requestedTab \|\| 'general' : 'general'/);
});

runTest('sdkwork-claw-settings keeps provider config center internal to settings instead of exposing a legacy api-router route', () => {
  const settingsPackage = readJson<{ dependencies?: Record<string, string> }>(
    'packages/sdkwork-claw-settings/package.json',
  );
  const shellPackage = readJson<{ dependencies?: Record<string, string> }>(
    'packages/sdkwork-claw-shell/package.json',
  );
  const settingsIndexSource = read('packages/sdkwork-claw-settings/src/index.ts');
  const providerCenterSource = read('packages/sdkwork-claw-settings/src/ProviderConfigCenter.tsx');
  const providerEditorSheetSource = read('packages/sdkwork-claw-settings/src/ProviderConfigEditorSheet.tsx');
  const routePrefetchSource = read('packages/sdkwork-claw-shell/src/application/router/routePrefetch.ts');
  const routesSource = read('packages/sdkwork-claw-shell/src/application/router/AppRoutes.tsx');

  assert.equal(settingsPackage.dependencies?.['@sdkwork/claw-infrastructure'], 'workspace:*');
  assert.match(settingsIndexSource, /export \* from '\.\/ProviderConfigCenter\.ts';/);
  assert.match(providerCenterSource, /providerConfigCenterService/);
  assert.match(providerCenterSource, /providerCenter\.page\.title/);
  assert.match(providerCenterSource, /providerCenter\.actions\.addRouteConfig/);
  assert.match(providerCenterSource, /providerCenter\.table\.provider/);
  assert.match(providerCenterSource, /providerCenter\.dialogs\.apply\.title/);
  assert.match(providerCenterSource, /ProviderConfigEditorSheet/);
  assert.match(providerEditorSheetSource, /providerCenter\.dialogs\.editor\.embeddingModel/);
  assert.match(providerCenterSource, /providerCenter\.dialogs\.apply\.agents/);
  assert.doesNotMatch(routePrefetchSource, /\['\/api-router', \(\) => import\('@sdkwork\/claw-settings'\)\]/);
  assert.doesNotMatch(routesSource, /path="\/api-router"/);
  assert.ok(!shellPackage.dependencies?.['@sdkwork/claw-apirouter']);
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

runTest('sdkwork-claw-shell warms heavy sidebar routes before click so navigation stays responsive', () => {
  const sidebarSource = read('packages/sdkwork-claw-shell/src/components/Sidebar.tsx');
  const routePrefetchSource = read('packages/sdkwork-claw-shell/src/application/router/routePrefetch.ts');

  assert.match(sidebarSource, /scheduleSidebarRoutePrefetch/);
  assert.match(sidebarSource, /prefetchSidebarRoute/);
  assert.match(sidebarSource, /cancelSidebarRoutePrefetch/);
  assert.match(sidebarSource, /onMouseEnter=\{\(\) => scheduleSidebarRoutePrefetch\(item\.to\)\}/);
  assert.match(sidebarSource, /onMouseLeave=\{\(\) => cancelSidebarRoutePrefetch\(item\.to\)\}/);
  assert.match(sidebarSource, /onFocus=\{\(\) => scheduleSidebarRoutePrefetch\(item\.to\)\}/);
  assert.match(sidebarSource, /onBlur=\{\(\) => cancelSidebarRoutePrefetch\(item\.to\)\}/);
  assert.match(sidebarSource, /onPointerDown=\{\(\) => prefetchSidebarRoute\(item\.to\)\}/);
  assert.match(routePrefetchSource, /\['\/apps', \(\) => import\('@sdkwork\/claw-apps'\)\]/);
  assert.match(routePrefetchSource, /\['\/chat', \(\) => import\('@sdkwork\/claw-chat'\)\]/);
  assert.match(routePrefetchSource, /\['\/dashboard', \(\) => import\('@sdkwork\/claw-dashboard'\)\]/);
  assert.match(routePrefetchSource, /\['\/settings', \(\) => import\('@sdkwork\/claw-settings'\)\]/);
  assert.match(routePrefetchSource, /\['\/docs', \(\) => import\('@sdkwork\/claw-docs'\)\]/);
  assert.match(routePrefetchSource, /import\('@sdkwork\/claw-apps'\)/);
  assert.match(routePrefetchSource, /\['\/market', \(\) => import\('@sdkwork\/claw-market'\)\]/);
  assert.match(routePrefetchSource, /import\('@sdkwork\/claw-market'\)/);
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

runTest('sdkwork-claw-shell defers startup update checks until after first paint instead of blocking provider setup', () => {
  const providersSource = read('packages/sdkwork-claw-shell/src/application/providers/AppProviders.tsx');

  assert.doesNotMatch(providersSource, /import \{[^}]*useUpdateStore[^}]*\} from '@sdkwork\/claw-core';/);
  assert.match(providersSource, /requestIdleCallback/);
  assert.match(providersSource, /import\('@sdkwork\/claw-core'\)/);
  assert.match(providersSource, /useUpdateStore\.getState\(\)\.runStartupCheck\(\)/);
  assert.doesNotMatch(providersSource, /apiRouterStartupService\.warmBootstrapSession\(\)/);
});

runTest('sdkwork-claw-shell uses a flat borderless header chrome', () => {
  const headerSource = read('packages/sdkwork-claw-shell/src/components/AppHeader.tsx');
  const switcherSource = read('packages/sdkwork-claw-shell/src/components/InstanceSwitcher.tsx');

  assert.doesNotMatch(headerSource, /border/);
  assert.doesNotMatch(switcherSource, /border/);
});

runTest('sdkwork-claw-shell reuses the shared core desktop window controls instead of defining header-local window chrome', () => {
  const headerSource = read('packages/sdkwork-claw-shell/src/components/AppHeader.tsx');

  assert.match(headerSource, /DesktopWindowControls/);
  assert.match(headerSource, /from '@sdkwork\/claw-core'/);
  assert.doesNotMatch(headerSource, /function DesktopWindowControls/);
  assert.doesNotMatch(headerSource, /function useDesktopWindowMaximized/);
  assert.doesNotMatch(headerSource, /function WindowSizeGlyph/);
});

runTest('sdkwork-claw-shell keeps a persistent mobile app entry in the header chrome', () => {
  const headerSource = read('packages/sdkwork-claw-shell/src/components/AppHeader.tsx');

  assert.match(headerSource, /install\.mobileGuide\.headerAction/);
  assert.match(headerSource, /openMobileAppDialog/);
  assert.match(headerSource, /PointsHeaderEntry/);
});

runTest('sdkwork-claw-shell restores the authenticated user avatar menu in the app header', () => {
  const headerSource = read('packages/sdkwork-claw-shell/src/components/AppHeader.tsx');

  assert.match(headerSource, /useAuthStore/);
  assert.match(headerSource, /sidebar\.userMenu\.profileSettings/);
  assert.match(headerSource, /sidebar\.userMenu\.logout/);
  assert.match(headerSource, /user\?\.avatarUrl/);
  assert.match(headerSource, /CircleUserRound/);
  assert.doesNotMatch(headerSource, /shadow-\[inset_0_0_0_1px/);
  assert.doesNotMatch(headerSource, /sidebar\.userMenu\.signedIn/);
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
  assert.match(sidebarSource, /right-0 top-1\/2/);
  assert.match(sidebarSource, /-translate-y-1\/2/);
  assert.doesNotMatch(sidebarSource, /right-1 top-5/);
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

runTest('sdkwork-claw-shell keeps the registry center under the Claw联网 entry while hiding app store instead of the market by default', () => {
  const sidebarSource = read('packages/sdkwork-claw-shell/src/components/Sidebar.tsx');
  const settingsSource = read('packages/sdkwork-claw-settings/src/GeneralSettings.tsx');
  const appStoreSource = read('packages/sdkwork-claw-core/src/stores/useAppStore.ts');

  assert.match(sidebarSource, /id: 'market'/);
  assert.match(sidebarSource, /id: 'mall'/);
  assert.match(sidebarSource, /id: 'apps'/);
  assert.match(sidebarSource, /id: 'extensions'/);
  assert.match(sidebarSource, /id: 'claw-upload', to: '\/claw-center'/);
  assert.doesNotMatch(sidebarSource, /id: 'claw-center'/);
  assert.match(sidebarSource, /id: 'github'/);
  assert.match(sidebarSource, /id: 'huggingface'/);
  assert.match(settingsSource, /id: 'apps', label: t\('sidebar\.appStore'\)/);
  assert.match(settingsSource, /id: 'mall', label: t\('sidebar\.clawMall'\)/);
  assert.match(settingsSource, /id: 'market', label: t\('sidebar\.market'\)/);
  assert.match(settingsSource, /id: 'extensions', label: t\('sidebar\.extensions'\)/);
  assert.match(settingsSource, /id: 'claw-upload', label: t\('sidebar\.clawUpload'\)/);
  assert.doesNotMatch(settingsSource, /id: 'claw-center', label: t\('sidebar\.clawMall'\)/);
  assert.match(settingsSource, /id: 'github', label: t\('sidebar\.githubRepos'\)/);
  assert.match(settingsSource, /id: 'huggingface', label: t\('sidebar\.huggingFace'\)/);
  assert.match(
    appStoreSource,
    /const DEFAULT_HIDDEN_SIDEBAR_ITEMS = \['apps', 'extensions', 'github', 'huggingface'\] as const;/,
  );
  assert.doesNotMatch(
    appStoreSource,
    /const DEFAULT_HIDDEN_SIDEBAR_ITEMS = \[[\s\S]*'market',/,
  );
  assert.match(appStoreSource, /const SIDEBAR_VISIBILITY_VERSION = 4;/);
  assert.match(
    appStoreSource,
    /filter\([\s\S]*\(item\) => item !== 'market' && item !== 'apps' && item !== 'claw-center'[\s\S]*\)/,
  );
  assert.match(appStoreSource, /sidebarVisibilityVersion/);
});

runTest('sdkwork-claw-shell promotes chat as the default workspace entry and moves dashboard below cron tasks across navigation surfaces', () => {
  const sidebarSource = read('packages/sdkwork-claw-shell/src/components/Sidebar.tsx');
  const commandPaletteSource = read('packages/sdkwork-claw-shell/src/components/commandPaletteCommands.ts');
  const settingsSource = read('packages/sdkwork-claw-settings/src/GeneralSettings.tsx');
  const routesSource = read('packages/sdkwork-claw-shell/src/application/router/AppRoutes.tsx');

  assert.match(
    sidebarSource,
    /section: t\('sidebar\.workspace'\)[\s\S]*id: 'chat'[\s\S]*id: 'channels'[\s\S]*id: 'tasks'[\s\S]*id: 'dashboard'/,
  );
  assert.doesNotMatch(
    sidebarSource,
    /section: t\('sidebar\.workspace'\)[\s\S]*id: 'dashboard'[\s\S]*id: 'chat'/,
  );
  assert.match(routesSource, /Navigate to="\/chat" replace/);
  assert.match(commandPaletteSource, /id: 'nav-chat'/);
  assert.match(commandPaletteSource, /navigate\('\/chat'\)/);
  assert.match(commandPaletteSource, /id: 'nav-dashboard'/);
  assert.match(commandPaletteSource, /navigate\('\/dashboard'\)/);
  assert.match(
    commandPaletteSource,
    /id: 'nav-chat'[\s\S]*id: 'nav-dashboard'/,
  );
  assert.match(
    settingsSource,
    /id: 'chat', label: t\('sidebar\.aiChat'\)[\s\S]*id: 'channels', label: t\('sidebar\.channels'\)[\s\S]*id: 'tasks', label: t\('sidebar\.cronTasks'\)[\s\S]*id: 'dashboard', label: t\('sidebar\.dashboard'\)/,
  );
});

runTest('sdkwork-claw-shell removes api-router and model purchase from shell entry surfaces while keeping devices out of the sidebar', () => {
  const sidebarSource = read('packages/sdkwork-claw-shell/src/components/Sidebar.tsx');
  const commandPaletteSource = read('packages/sdkwork-claw-shell/src/components/commandPaletteCommands.ts');
  const settingsSource = read('packages/sdkwork-claw-settings/src/GeneralSettings.tsx');

  assert.doesNotMatch(sidebarSource, /id: 'codebox'/);
  assert.doesNotMatch(sidebarSource, /id: 'api-router'/);
  assert.doesNotMatch(sidebarSource, /to: '\/api-router'/);
  assert.doesNotMatch(sidebarSource, /id: 'model-purchase'/);
  assert.doesNotMatch(sidebarSource, /to: '\/model-purchase'/);
  assert.doesNotMatch(sidebarSource, /label: t\('sidebar\.modelPurchase'\)/);
  assert.doesNotMatch(sidebarSource, /id: 'devices'/);
  assert.doesNotMatch(sidebarSource, /to: '\/devices'/);
  assert.doesNotMatch(sidebarSource, /label: t\('sidebar\.devices'\)/);
  assert.doesNotMatch(commandPaletteSource, /id: 'nav-model-purchase'/);
  assert.doesNotMatch(commandPaletteSource, /navigate\('\/model-purchase'\)/);
  assert.doesNotMatch(commandPaletteSource, /id: 'nav-api-router'/);
  assert.doesNotMatch(commandPaletteSource, /navigate\('\/api-router'\)/);
  assert.match(commandPaletteSource, /id: 'nav-devices'/);
  assert.match(commandPaletteSource, /navigate\('\/devices'\)/);
  assert.doesNotMatch(settingsSource, /id: 'codebox'/);
  assert.doesNotMatch(settingsSource, /id: 'model-purchase', label: t\('sidebar\.modelPurchase'\)/);
  assert.doesNotMatch(settingsSource, /id: 'devices', label: t\('sidebar\.devices'\)/);
  assert.doesNotMatch(settingsSource, /id: 'api-router', label: t\('sidebar\.apiRouter'\)/);
});

runTest('sdkwork-claw-shell labels the setup entry as Install Claw in both locales', () => {
  const sidebarSource = read('packages/sdkwork-claw-shell/src/components/Sidebar.tsx');
  const enLocale = readJson<{ sidebar: { install: string } }>(
    'packages/sdkwork-claw-i18n/src/locales/en.json',
  );
  const zhLocale = readJson<{ sidebar: { install: string } }>(
    'packages/sdkwork-claw-i18n/src/locales/zh.json',
  );

  assert.match(sidebarSource, /id: 'install'/);
  assert.match(sidebarSource, /label: t\('sidebar\.install'\)/);
  assert.equal(enLocale.sidebar.install, 'Install Claw');
  assert.equal(zhLocale.sidebar.install, '安装 Claw');
});
