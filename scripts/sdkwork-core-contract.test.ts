import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(relPath: string) {
  return fs.readFileSync(path.join(root, relPath), 'utf8');
}

function exists(relPath: string) {
  return fs.existsSync(path.join(root, relPath));
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

runTest('sdkwork-claw-core exposes local stores and hooks instead of re-exporting claw-studio-business', () => {
  const pkg = readJson<{ dependencies?: Record<string, string> }>('packages/sdkwork-claw-core/package.json');
  const indexSource = read('packages/sdkwork-claw-core/src/index.ts');

  assert.ok(exists('packages/sdkwork-claw-core/src/components/CommandPalette.tsx'));
  assert.ok(exists('packages/sdkwork-claw-core/src/components/Sidebar.tsx'));
  assert.ok(exists('packages/sdkwork-claw-core/src/sdk/useAppSdkClient.ts'));
  assert.ok(exists('packages/sdkwork-claw-core/src/stores/useAppStore.ts'));
  assert.ok(exists('packages/sdkwork-claw-core/src/stores/useInstanceStore.ts'));
  assert.ok(exists('packages/sdkwork-claw-core/src/stores/useTaskStore.ts'));
  assert.ok(exists('packages/sdkwork-claw-core/src/stores/useUpdateStore.ts'));
  assert.ok(exists('packages/sdkwork-claw-core/src/store/index.ts'));
  assert.ok(exists('packages/sdkwork-claw-core/src/store/useAppStore.ts'));
  assert.ok(exists('packages/sdkwork-claw-core/src/hooks/useKeyboardShortcuts.ts'));
  assert.ok(exists('packages/sdkwork-claw-core/src/lib/llmService.ts'));
  assert.ok(exists('packages/sdkwork-claw-core/src/platform/index.ts'));
  assert.ok(exists('packages/sdkwork-claw-core/src/platform-impl/index.ts'));
  assert.ok(exists('packages/sdkwork-claw-core/src/platform-impl/web.ts'));
  assert.ok(exists('packages/sdkwork-claw-core/src/services/openClawAgentCatalogService.ts'));
  assert.ok(exists('packages/sdkwork-claw-core/src/services/updateService.ts'));
  assert.ok(exists('packages/sdkwork-claw-core/src/services/openClawConfigService.ts'));
  assert.ok(exists('packages/sdkwork-claw-core/src/services/communityService.ts'));
  assert.ok(exists('packages/sdkwork-claw-core/src/services/accountService.ts'));
  assert.ok(exists('packages/sdkwork-claw-core/src/services/settingsService.ts'));

  assert.ok(!pkg.dependencies?.['@sdkwork/claw-studio-business']);
  assert.equal(pkg.dependencies?.['@sdkwork/app-sdk'], '^1.0.34');
  assert.ok(pkg.dependencies?.json5);
  assert.doesNotMatch(indexSource, /@sdkwork\/claw-studio-business/);
  assert.match(indexSource, /\.\/platform/);
  assert.match(indexSource, /\.\/platform-impl/);
  assert.match(indexSource, /\.\/store/);
  assert.match(indexSource, /\.\/sdk\/useAppSdkClient/);
  assert.doesNotMatch(indexSource, /\.\/components\/CommandPalette\.tsx/);
  assert.doesNotMatch(indexSource, /\.\/components\/Sidebar\.tsx/);
  assert.match(indexSource, /\.\/lib\/llmService/);
  assert.match(indexSource, /openClawConfigService/);
  assert.match(indexSource, /useAppSdkClient/);
  assert.match(indexSource, /useAppStore/);
  assert.match(indexSource, /useKeyboardShortcuts/);
});

runTest('sdkwork-claw-core owns the shared community wrapper for remote feed sdk access', () => {
  const pkg = readJson<{ exports?: Record<string, string> }>('packages/sdkwork-claw-core/package.json');
  const servicesIndexSource = read('packages/sdkwork-claw-core/src/services/index.ts');
  const communityServiceSource = read('packages/sdkwork-claw-core/src/services/communityService.ts');

  assert.deepEqual(Object.keys(pkg.exports ?? {}).sort(), ['.', './sdk']);
  assert.match(servicesIndexSource, /communityService/);
  assert.match(communityServiceSource, /createCommunityService/);
  assert.match(communityServiceSource, /getAppSdkClientWithSession/);
  assert.match(communityServiceSource, /unwrapAppSdkResponse/);
  assert.match(communityServiceSource, /client\.feed\.getFeedList/);
  assert.match(communityServiceSource, /client\.feed\.getFeedDetail/);
  assert.match(communityServiceSource, /client\.feed\.create/);
  assert.match(communityServiceSource, /client\.comment\.getComments/);
  assert.match(communityServiceSource, /client\.comment\.createComment/);
  assert.match(communityServiceSource, /client\.category\.listCategories/);
});

runTest('sdkwork-claw-core owns shared account and settings wrappers for remote app sdk access', () => {
  const pkg = readJson<{ exports?: Record<string, string> }>('packages/sdkwork-claw-core/package.json');
  const servicesIndexSource = read('packages/sdkwork-claw-core/src/services/index.ts');
  const accountServiceSource = read('packages/sdkwork-claw-core/src/services/accountService.ts');
  const settingsServiceSource = read('packages/sdkwork-claw-core/src/services/settingsService.ts');

  assert.deepEqual(Object.keys(pkg.exports ?? {}).sort(), ['.', './sdk']);
  assert.match(servicesIndexSource, /accountService/);
  assert.match(servicesIndexSource, /settingsService/);
  assert.match(accountServiceSource, /getAppSdkClientWithSession/);
  assert.match(accountServiceSource, /unwrapAppSdkResponse/);
  assert.match(accountServiceSource, /client\.account\.getAccountSummary/);
  assert.match(settingsServiceSource, /getAppSdkClientWithSession/);
  assert.match(settingsServiceSource, /unwrapAppSdkResponse/);
  assert.match(settingsServiceSource, /client\.user\.getUserProfile/);
  assert.match(settingsServiceSource, /client\.notification\.getNotificationSettings/);
});

runTest('sdkwork-claw-core app store persists sidebar width for shell chrome resizing', () => {
  const storeSource = read('packages/sdkwork-claw-core/src/stores/useAppStore.ts');

  assert.match(storeSource, /sidebarWidth:\s*number/);
  assert.match(storeSource, /setSidebarWidth:\s*\(width:\s*number\)\s*=>\s*void/);
  assert.match(storeSource, /sidebarWidth:\s*252/);
  assert.match(storeSource, /setSidebarWidth:\s*\(sidebarWidth\)\s*=>\s*set\(\{\s*sidebarWidth\s*\}\)/);
});

runTest('sdkwork-claw-core app store tracks one-time mobile guide exposure separately from dialog visibility', () => {
  const storeSource = read('packages/sdkwork-claw-core/src/stores/useAppStore.ts');

  assert.match(storeSource, /isMobileAppDialogOpen:\s*boolean/);
  assert.match(storeSource, /hasSeenMobileAppPrompt:\s*boolean/);
  assert.match(storeSource, /openMobileAppDialog:\s*\(\)\s*=>\s*void/);
  assert.match(storeSource, /closeMobileAppDialog:\s*\(\)\s*=>\s*void/);
  assert.match(storeSource, /markMobileAppPromptSeen:\s*\(\)\s*=>\s*void/);
  assert.match(storeSource, /hasSeenMobileAppPrompt:\s*false/);
  assert.match(storeSource, /partialize/);
  assert.doesNotMatch(
    storeSource,
    /partialize:\s*\(state\):\s*PersistedAppState\s*=>\s*\(\{[\s\S]*isMobileAppDialogOpen:[\s\S]*\}\),\s*merge:/,
  );
});

runTest('sdkwork-claw-core sidebar removes codebox while keeping api-router available', () => {
  const sidebarSource = read('packages/sdkwork-claw-core/src/components/Sidebar.tsx');

  assert.doesNotMatch(sidebarSource, /id: 'codebox'/);
  assert.match(sidebarSource, /id: 'api-router'/);
});

runTest('sdkwork-claw-core exports shared desktop window controls for shell and auth surfaces', () => {
  const indexSource = read('packages/sdkwork-claw-core/src/index.ts');
  const controlsSource = read('packages/sdkwork-claw-core/src/components/DesktopWindowControls.tsx');

  assert.ok(exists('packages/sdkwork-claw-core/src/components/DesktopWindowControls.tsx'));
  assert.match(indexSource, /\.\/components\/DesktopWindowControls/);
  assert.match(controlsSource, /platform\.getPlatform\(\)\s*===\s*'desktop'/);
  assert.match(controlsSource, /common\.minimizeWindow/);
  assert.match(controlsSource, /common\.maximizeWindow/);
  assert.match(controlsSource, /common\.restoreWindow/);
  assert.match(controlsSource, /common\.closeWindow/);
});

runTest('claw host vite configs switch shared sdk resolution by explicit mode while keeping source mode for development', () => {
  const webViteConfig = read('packages/sdkwork-claw-web/vite.config.ts');
  const desktopViteConfig = read('packages/sdkwork-claw-desktop/vite.config.ts');

  assert.match(webViteConfig, /isSharedSdkSourceMode/);
  assert.match(webViteConfig, /resolvePnpmPackageDistEntry/);
  assert.match(webViteConfig, /@sdkwork\/app-sdk/);
  assert.match(webViteConfig, /sdkwork-app-sdk-typescript/);
  assert.match(webViteConfig, /src\/index\.ts/);

  assert.match(desktopViteConfig, /isSharedSdkSourceMode/);
  assert.match(desktopViteConfig, /@sdkwork\/app-sdk/);
  assert.match(desktopViteConfig, /sdkwork-app-sdk-typescript/);
  assert.match(desktopViteConfig, /src\/index\.ts/);
});

runTest('claw hosts resolve @sdkwork/sdk-common from shared SDK source only in source mode', () => {
  const webViteConfig = read('packages/sdkwork-claw-web/vite.config.ts');
  const desktopViteConfig = read('packages/sdkwork-claw-desktop/vite.config.ts');

  for (const source of [webViteConfig, desktopViteConfig]) {
    assert.match(source, /@sdkwork\/sdk-common/);
    assert.match(source, /sdkwork-sdk-common-typescript/);
    assert.match(source, /src\/index\.ts/);
  }
});

runTest('claw hosts restrict relative shared sdk aliases to source mode and keep git mode on installed package resolution', () => {
  const webViteConfig = read('packages/sdkwork-claw-web/vite.config.ts');
  const desktopViteConfig = read('packages/sdkwork-claw-desktop/vite.config.ts');

  for (const source of [webViteConfig, desktopViteConfig]) {
    assert.match(source, /isSharedSdkSourceMode/);
    assert.doesNotMatch(source, /sharedSdkMode === 'source' \|\| sharedSdkMode === 'git'/);
  }
});

runTest('claw workspace prefers workspace-linked shared sdk sources locally while allowing git-trunk release sourcing', () => {
  const workspacePackageJson = read('package.json');
  const webPackageJson = read('packages/sdkwork-claw-web/package.json');
  const desktopPackageJson = read('packages/sdkwork-claw-desktop/package.json');
  const workspaceManifest = read('pnpm-workspace.yaml');
  const npmrc = read('.npmrc');
  const coreCheckRunner = read('scripts/run-sdkwork-core-check.mjs');
  const prepareSharedSdkScript = read('scripts/prepare-shared-sdk-packages.mjs');
  const prepareGitSourcesScript = read('scripts/prepare-shared-sdk-git-sources.mjs');

  assert.match(npmrc, /link-workspace-packages\s*=\s*true/);
  assert.match(workspaceManifest, /spring-ai-plus-app-api/);
  assert.match(workspaceManifest, /sdkwork-sdk-common-typescript/);
  assert.match(workspacePackageJson, /"prepare:shared-sdk"\s*:\s*"node scripts\/prepare-shared-sdk-packages\.mjs"/);
  assert.match(workspacePackageJson, /"build"\s*:\s*"pnpm prepare:shared-sdk && pnpm --filter @sdkwork\/claw-web build"/);
  assert.match(webPackageJson, /"build"\s*:\s*"node \.\.\/\.\.\/scripts\/prepare-shared-sdk-packages\.mjs && vite build"/);
  assert.match(desktopPackageJson, /"build"\s*:\s*"node \.\.\/\.\.\/scripts\/prepare-shared-sdk-packages\.mjs && vite build && node \.\.\/\.\.\/scripts\/verify-desktop-build-assets\.mjs"/);
  assert.match(workspacePackageJson, /"check:sdkwork-core"\s*:\s*"pnpm prepare:shared-sdk && node scripts\/run-sdkwork-core-check\.mjs"/);
  assert.match(prepareSharedSdkScript, /SDKWORK_SHARED_SDK_MODE/);
  assert.match(prepareSharedSdkScript, /resolveSharedSdkMode/);
  assert.match(prepareSharedSdkScript, /mode === 'git'/);
  assert.match(prepareGitSourcesScript, /git clone/);
  assert.match(prepareGitSourcesScript, /git ls-remote --symref/);
  assert.match(prepareGitSourcesScript, /SDKWORK_SHARED_SDK_APP_REPO_URL/);
  assert.match(prepareGitSourcesScript, /SDKWORK_SHARED_SDK_COMMON_REPO_URL/);
  assert.match(prepareGitSourcesScript, /https:\/\/github\.com\/Sdkwork-Cloud\/sdkwork-sdk-app\.git/);
  assert.match(prepareGitSourcesScript, /https:\/\/github\.com\/Sdkwork-Cloud\/sdkwork-sdk-commons\.git/);
  assert.match(prepareGitSourcesScript, /branch', '--show-current/);
  assert.match(coreCheckRunner, /sdkwork-core-contract\.test\.ts/);
  assert.match(coreCheckRunner, /accountService\.test\.ts/);
  assert.match(coreCheckRunner, /communityService\.test\.ts/);
  assert.match(coreCheckRunner, /openClawAgentCatalogService\.test\.ts/);
  assert.match(coreCheckRunner, /settingsService\.test\.ts/);
  assert.match(workspacePackageJson, /"check:sdkwork-auth"\s*:\s*"pnpm prepare:shared-sdk && node --experimental-strip-types packages\/sdkwork-claw-core\/src\/services\/appAuthService\.test\.ts && node --experimental-strip-types packages\/sdkwork-claw-core\/src\/stores\/useAuthStore\.test\.ts && node --experimental-strip-types scripts\/sdkwork-auth-contract\.test\.ts"/);
});

runTest('claw workspace tsconfig no longer hard-pins @sdkwork/app-sdk to an external source path', () => {
  const tsconfigBase = read('tsconfig.base.json');

  assert.match(tsconfigBase, /"baseUrl"\s*:\s*"\."/);
  assert.doesNotMatch(tsconfigBase, /"@sdkwork\/app-sdk"/);
});
