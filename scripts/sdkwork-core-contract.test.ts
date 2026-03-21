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
  assert.ok(exists('packages/sdkwork-claw-core/src/services/updateService.ts'));
  assert.ok(exists('packages/sdkwork-claw-core/src/services/openClawConfigService.ts'));

  assert.ok(!pkg.dependencies?.['@sdkwork/claw-studio-business']);
  assert.ok(pkg.dependencies?.['@sdkwork/app-sdk']);
  assert.ok(pkg.dependencies?.json5);
  assert.doesNotMatch(indexSource, /@sdkwork\/claw-studio-business/);
  assert.match(indexSource, /\.\/platform/);
  assert.match(indexSource, /\.\/platform-impl/);
  assert.match(indexSource, /\.\/store/);
  assert.match(indexSource, /\.\/sdk\/useAppSdkClient/);
  assert.match(indexSource, /\.\/components\/CommandPalette/);
  assert.match(indexSource, /\.\/components\/Sidebar/);
  assert.match(indexSource, /\.\/lib\/llmService/);
  assert.match(indexSource, /openClawConfigService/);
  assert.match(indexSource, /useAppSdkClient/);
  assert.match(indexSource, /useAppStore/);
  assert.match(indexSource, /useKeyboardShortcuts/);
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

runTest('claw host vite configs resolve @sdkwork/app-sdk from shared SDK source during development', () => {
  const webViteConfig = read('packages/sdkwork-claw-web/vite.config.ts');
  const desktopViteConfig = read('packages/sdkwork-claw-desktop/vite.config.ts');

  for (const source of [webViteConfig, desktopViteConfig]) {
    assert.match(source, /@sdkwork\/app-sdk/);
    assert.match(source, /sdkwork-app-sdk-typescript/);
    assert.match(source, /src\/index\.ts/);
  }
});

runTest('claw workspace tsconfig maps @sdkwork/app-sdk to the shared SDK source entry', () => {
  const tsconfigBase = read('tsconfig.base.json');

  assert.match(tsconfigBase, /"baseUrl"\s*:\s*"\."/);
  assert.match(tsconfigBase, /"@sdkwork\/app-sdk"\s*:\s*\[\s*"\.\.\/\.\.\/spring-ai-plus-app-api\/sdkwork-sdk-app\/sdkwork-app-sdk-typescript\/src\/index\.ts"\s*\]/);
});
