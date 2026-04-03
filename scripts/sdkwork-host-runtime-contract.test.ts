import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();

function read(relPath: string) {
  return fs.readFileSync(path.join(root, relPath), 'utf8');
}

function readJson<T>(relPath: string): T {
  return JSON.parse(read(relPath)) as T;
}

function extractDesktopLockImporter() {
  const lockSource = read('pnpm-lock.yaml').replace(/\r\n/g, '\n');
  const match = lockSource.match(
    /packages\/sdkwork-claw-desktop:\r?\n([\s\S]*?)(?:\r?\n  packages\/|\r?\npackages:|\r?\nimporters:|$)/,
  );

  if (!match) {
    throw new Error('Unable to locate the packages/sdkwork-claw-desktop importer in pnpm-lock.yaml');
  }

  return match[1];
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

async function runAsyncTest(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

runTest('sdkwork-claw-web stays a Vite-only host without a business runtime server', () => {
  const pkg = readJson<{
    scripts?: Record<string, string>;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  }>(
    'packages/sdkwork-claw-web/package.json',
  );

  assert.equal(
    pkg.scripts?.dev,
    'node ../../scripts/run-vite-host.mjs serve --host 0.0.0.0 --port 3001 --mode development',
  );
  assert.equal(pkg.dependencies?.express, undefined);
  assert.equal(pkg.dependencies?.['sql.js'], undefined);
  assert.equal(pkg.devDependencies?.tsx, undefined);
  assert.equal(exists('packages/sdkwork-claw-web/server.ts'), false);
});

runTest('sdkwork-claw-web bootstraps shell runtime before mounting the React tree', () => {
  const mainSource = read('packages/sdkwork-claw-web/src/main.tsx');

  assert.match(mainSource, /bootstrapShellRuntime/);
  assert.doesNotMatch(mainSource, /@sdkwork\/claw-i18n/);
  assert.match(
    mainSource,
    /await bootstrapShellRuntime\([\s\S]*?\);[\s\S]*createRoot\(document\.getElementById\('root'\)!\)\.render/,
  );
});

runTest('built-in OpenClaw hosts derive a real version label instead of the bundled placeholder', () => {
  const webStudioSource = read('packages/sdkwork-claw-infrastructure/src/platform/webStudio.ts');
  const desktopStudioSource = read(
    'packages/sdkwork-claw-desktop/src-tauri/src/framework/services/studio.rs',
  );

  assert.doesNotMatch(webStudioSource, /version:\s*'bundled'/);
  assert.match(webStudioSource, /version:\s*DEFAULT_BUNDLED_OPENCLAW_VERSION/);
  assert.doesNotMatch(
    desktopStudioSource,
    /\.unwrap_or_else\(\|\| "bundled"\.to_string\(\)\)/,
  );
  assert.match(desktopStudioSource, /resolve_built_in_openclaw_display_version/);
});

runTest('sdkwork-claw-desktop contains the Tauri runtime package surface', () => {
  const pkg = readJson<{
    scripts?: Record<string, string>;
    dependencies?: Record<string, string>;
  }>(
    'packages/sdkwork-claw-desktop/package.json',
  );
  const desktopLockImporter = extractDesktopLockImporter();

  assert.ok(exists('packages/sdkwork-claw-desktop/.env.example'));
  assert.ok(exists('packages/sdkwork-claw-desktop/src-tauri/Cargo.toml'));
  assert.ok(exists('packages/sdkwork-claw-desktop/src-tauri/tauri.conf.json'));
  assert.equal(
    pkg.scripts?.['dev:tauri'],
    'node ../../scripts/run-vite-host.mjs serve --host 127.0.0.1 --port 1420 --strictPort',
  );
  assert.equal(pkg.dependencies?.['@sdkwork/claw-core'], undefined);
  assert.doesNotMatch(desktopLockImporter, /'@sdkwork\/claw-core':/);
});

runTest('sdkwork-claw-server and sdkwork-claw-host-core expose the shared server host foundation', () => {
  const serverPackage = readJson<{
    dependencies?: Record<string, string>;
  }>('packages/sdkwork-claw-server/package.json');
  const hostCorePackage = readJson<{
    name?: string;
  }>('packages/sdkwork-claw-host-core/package.json');

  assert.ok(exists('packages/sdkwork-claw-server/src-host/Cargo.toml'));
  assert.ok(exists('packages/sdkwork-claw-host-core/src-host/Cargo.toml'));
  assert.equal(serverPackage.dependencies?.['@sdkwork/claw-host-core'], 'workspace:*');
  assert.equal(hostCorePackage.name, '@sdkwork/claw-host-core');
});

runTest('sdkwork-claw-desktop bootstraps shell runtime before mounting the React tree', () => {
  const createDesktopAppSource = read(
    'packages/sdkwork-claw-desktop/src/desktop/bootstrap/createDesktopApp.tsx',
  );
  const desktopBootstrapAppSource = read(
    'packages/sdkwork-claw-desktop/src/desktop/bootstrap/DesktopBootstrapApp.tsx',
  );
  const connectDesktopRuntimeBody = desktopBootstrapAppSource.match(
    /const connectDesktopRuntime = useEffectEvent\(async \(\) => \{([\s\S]*?)\n  }\);/,
  )?.[1];

  assert.match(createDesktopAppSource, /<DesktopBootstrapApp/);
  assert.match(desktopBootstrapAppSource, /bootstrapShellRuntime/);
  assert.match(desktopBootstrapAppSource, /prefetchSidebarRoute/);
  assert.match(desktopBootstrapAppSource, /prefetchSidebarRoutes/);
  assert.match(desktopBootstrapAppSource, /resolveSidebarStartupRoute/);
  assert.match(desktopBootstrapAppSource, /listSidebarRoutePrefetchPaths/);
  assert.match(desktopBootstrapAppSource, /getAppInfo/);
  assert.doesNotMatch(desktopBootstrapAppSource, /@sdkwork\/claw-i18n/);
  assert.ok(connectDesktopRuntimeBody);
  assert.match(connectDesktopRuntimeBody, /getAppInfo\(/);
  assert.doesNotMatch(
    connectDesktopRuntimeBody,
    /getDesktopKernelInfo\(/,
  );
  assert.match(
    desktopBootstrapAppSource,
    /await revealStartupWindow\(\);[\s\S]*await connectDesktopRuntime\(\);[\s\S]*const startupRoute = resolveSidebarStartupRoute\(window\.location\.pathname\);[\s\S]*prefetchSidebarRoute\(startupRoute\);[\s\S]*await bootstrapShellRuntime\(\);[\s\S]*setShouldRenderShell\(true\)/,
  );
  assert.match(
    desktopBootstrapAppSource,
    /const warmSidebarRoutesHandle = window\.setTimeout\(\(\) => \{[\s\S]*prefetchSidebarRoutes\([\s\S]*listSidebarRoutePrefetchPaths\(\)\.filter\(\(path\) => path !== startupRoute\)/,
  );
  assert.match(
    desktopBootstrapAppSource,
    /shouldRenderShell \? \([\s\S]*<DesktopProviders>[\s\S]*<AppProviders onLanguagePreferenceChange=\{handleLanguagePreferenceChange\}>[\s\S]*<DesktopTrayRouteBridge \/>[\s\S]*<MainLayout \/>/,
  );
});

runTest('sdkwork hosts persist app language through a host callback while the shared runtime bridge exposes the desktop command', () => {
  const shellProvidersSource = read(
    'packages/sdkwork-claw-shell/src/application/providers/AppProviders.tsx',
  );
  const shellLanguageManagerSource = read(
    'packages/sdkwork-claw-shell/src/application/providers/LanguageManager.tsx',
  );
  const desktopBootstrapAppSource = read(
    'packages/sdkwork-claw-desktop/src/desktop/bootstrap/DesktopBootstrapApp.tsx',
  );
  const desktopBridgeSource = read(
    'packages/sdkwork-claw-desktop/src/desktop/tauriBridge.ts',
  );
  const webRuntimeSource = read(
    'packages/sdkwork-claw-infrastructure/src/platform/webRuntime.ts',
  );
  const runtimeContractSource = read(
    'packages/sdkwork-claw-infrastructure/src/platform/contracts/runtime.ts',
  );

  assert.match(runtimeContractSource, /setAppLanguage\(language: RuntimeLanguagePreference\)/);
  assert.match(shellProvidersSource, /onLanguagePreferenceChange\?:/);
  assert.match(shellLanguageManagerSource, /onLanguagePreferenceChange\?:/);
  assert.match(shellLanguageManagerSource, /onLanguagePreferenceChange\?\.\(languagePreference\)/);
  assert.doesNotMatch(shellLanguageManagerSource, /getRuntimePlatform\(\)\.setAppLanguage\(languagePreference\)/);
  assert.match(desktopBootstrapAppSource, /import \{ getAppInfo, setAppLanguage \} from '\.\.\/tauriBridge';/);
  assert.match(desktopBootstrapAppSource, /const handleLanguagePreferenceChange = useEffectEvent\(/);
  assert.match(desktopBootstrapAppSource, /void setAppLanguage\(languagePreference\);/);
  assert.match(desktopBridgeSource, /export async function setAppLanguage/);
  assert.match(desktopBridgeSource, /DESKTOP_COMMANDS\.setAppLanguage/);
  assert.match(webRuntimeSource, /async setAppLanguage\(_language: RuntimeLanguagePreference\): Promise<void> \{\}/);
});

runTest('sdkwork-claw-desktop wires hub-installer execution through a real Tauri command and progress event', () => {
  const bridgeSource = read('packages/sdkwork-claw-desktop/src/desktop/tauriBridge.ts');
  const catalogSource = read('packages/sdkwork-claw-desktop/src/desktop/catalog.ts');
  const commandsMod = read('packages/sdkwork-claw-desktop/src-tauri/src/commands/mod.rs');
  const bootstrap = read('packages/sdkwork-claw-desktop/src-tauri/src/app/bootstrap.rs');
  const tauriConfig = read('packages/sdkwork-claw-desktop/src-tauri/tauri.conf.json');

  assert.ok(exists('packages/sdkwork-claw-desktop/src-tauri/src/commands/run_hub_install.rs'));
  assert.ok(
    exists(
      'packages/sdkwork-claw-desktop/src-tauri/vendor/hub-installer/registry/software-registry.yaml',
    ),
  );
  assert.doesNotMatch(
    bridgeSource,
    /Desktop installer runtime is not enabled in the base Tauri foundation\./,
  );
  assert.match(catalogSource, /runHubInstall:\s*'run_hub_install'/);
  assert.match(catalogSource, /hubInstallProgress:\s*'hub-installer:progress'/);
  assert.match(
    bridgeSource,
    /invokeDesktopCommand<HubInstallResult>\(\s*DESKTOP_COMMANDS\.runHubInstall,\s*\{\s*request\s*\}/,
  );
  assert.match(bridgeSource, /subscribeHubInstallProgress/);
  assert.match(commandsMod, /pub mod run_hub_install;/);
  assert.match(
    bootstrap,
    /commands::run_hub_install::run_hub_install/,
  );
  assert.match(tauriConfig, /vendor\/hub-installer\/registry/);
});

runTest('sdkwork-claw-desktop keeps browser mocks out of desktop business bridges', () => {
  const bridgeSource = read('packages/sdkwork-claw-desktop/src/desktop/tauriBridge.ts');
  const componentsBridgeSource = read(
    'packages/sdkwork-claw-desktop/src/desktop/componentsBridge.ts',
  );

  assert.doesNotMatch(bridgeSource, /WebKernelPlatform/);
  assert.doesNotMatch(bridgeSource, /WebStoragePlatform/);
  assert.doesNotMatch(bridgeSource, /WebStudioPlatform/);
  assert.doesNotMatch(
    bridgeSource,
    /studioListInstances[\s\S]*webStudioPlatform\.listInstances/,
  );
  assert.doesNotMatch(
    bridgeSource,
    /storageGetText[\s\S]*webStoragePlatform\.getText/,
  );
  assert.doesNotMatch(
    bridgeSource,
    /ensureDesktopKernelRunning[\s\S]*webKernelPlatform\.ensureRunning/,
  );
  assert.doesNotMatch(
    componentsBridgeSource,
    /webComponentPlatform\.(listComponents|controlComponent)/,
  );
});

runTest('sdkwork-claw-desktop seeds a real bundled OpenClaw version in runtime defaults', () => {
  const componentDefaultsSource = read(
    'packages/sdkwork-claw-desktop/src-tauri/src/framework/components.rs',
  );
  const componentResourcesSource = read(
    'packages/sdkwork-claw-desktop/src-tauri/src/framework/services/components.rs',
  );

  assert.match(
    componentDefaultsSource,
    /PackagedComponentDefinition\s*\{\s*id:\s*"openclaw"\.to_string\(\),[\s\S]*?bundled_version:\s*bundled_openclaw_version\(\)\.to_string\(\)/,
  );
  assert.doesNotMatch(componentResourcesSource, /source_component_resource_dir\(\)/);
});

await runAsyncTest('sdkwork-claw-desktop recognizes Tauri v2 runtimes even when withGlobalTauri is disabled', async () => {
  const previousWindow = (globalThis as { window?: unknown }).window;
  const previousIsTauri = (globalThis as { isTauri?: unknown }).isTauri;
  const runtimeModule = await import('../packages/sdkwork-claw-desktop/src/desktop/runtime.ts');

  try {
    (globalThis as { window?: unknown }).window = {
      __TAURI_INTERNALS__: {
        invoke() {},
        transformCallback() {
          return 1;
        },
        unregisterCallback() {},
        convertFileSrc() {
          return '';
        },
      },
    };
    delete (globalThis as { isTauri?: unknown }).isTauri;

    assert.equal(
      runtimeModule.isTauriRuntime(),
      true,
      'expected the desktop runtime probe to recognize __TAURI_INTERNALS__',
    );

    (globalThis as { window?: unknown }).window = {};

    assert.equal(
      runtimeModule.isTauriRuntime(),
      false,
      'expected plain web previews without Tauri globals to stay on the web fallback',
    );
  } finally {
    if (typeof previousWindow === 'undefined') {
      delete (globalThis as { window?: unknown }).window;
    } else {
      (globalThis as { window?: unknown }).window = previousWindow;
    }

    if (typeof previousIsTauri === 'undefined') {
      delete (globalThis as { isTauri?: unknown }).isTauri;
    } else {
      (globalThis as { isTauri?: unknown }).isTauri = previousIsTauri;
    }
  }
});

await runAsyncTest('sdkwork-claw-desktop waits for a late Tauri runtime before invoking the desktop bridge', async () => {
  const previousWindow = (globalThis as { window?: unknown }).window;
  const previousIsTauri = (globalThis as { isTauri?: unknown }).isTauri;
  const runtimeModule = await import('../packages/sdkwork-claw-desktop/src/desktop/runtime.ts');
  let installHandle: ReturnType<typeof setTimeout> | null = null;

  try {
    let desktopCalls = 0;
    (globalThis as { window?: unknown }).window = {};
    delete (globalThis as { isTauri?: unknown }).isTauri;

    installHandle = setTimeout(() => {
      const runtimeWindow = ((globalThis as { window?: Record<string, unknown> }).window ??
        {}) as Record<string, unknown>;
      runtimeWindow.__TAURI_INTERNALS__ = {
        invoke(command: string) {
          desktopCalls += 1;
          assert.equal(command, 'studio_list_instances');
          return Promise.resolve([
            {
              id: 'local-built-in',
              name: 'Local Built-In',
              description: 'Bundled local OpenClaw runtime managed by Claw Studio.',
              runtimeKind: 'openclaw',
              deploymentMode: 'local-managed',
              transportKind: 'openclawGatewayWs',
              status: 'online',
              isBuiltIn: true,
              isDefault: true,
              iconType: 'server',
              version: 'bundled',
              typeLabel: 'Built-In OpenClaw',
              host: '127.0.0.1',
              port: 18796,
              baseUrl: 'http://127.0.0.1:18796',
              websocketUrl: 'ws://127.0.0.1:18796',
              cpu: 0,
              memory: 0,
              totalMemory: 'Unknown',
              uptime: '-',
              capabilities: ['chat', 'health'],
              storage: {
                profileId: 'default-local',
                provider: 'localFile',
                namespace: 'claw-studio',
                database: null,
                connectionHint: null,
                endpoint: null,
              },
              config: {
                port: '18796',
                sandbox: true,
                autoUpdate: true,
                logLevel: 'info',
                corsOrigins: '*',
                workspacePath: null,
                baseUrl: 'http://127.0.0.1:18796',
                websocketUrl: 'ws://127.0.0.1:18796',
                authToken: 'studio-token',
              },
              createdAt: 1,
              updatedAt: 1,
              lastSeenAt: 1,
            },
          ]);
        },
      };
      (globalThis as { window?: unknown }).window = runtimeWindow;
    }, 15);

    const instances = await runtimeModule.invokeDesktopCommand<any[]>(
      'studio_list_instances',
      undefined,
      { operation: 'studio.listInstances' },
    );

    assert.equal(desktopCalls, 1);
    assert.equal(instances[0]?.port, 18796);
    assert.equal(instances[0]?.websocketUrl, 'ws://127.0.0.1:18796');
    assert.equal(instances[0]?.config.authToken, 'studio-token');
  } finally {
    if (installHandle) {
      clearTimeout(installHandle);
    }

    if (typeof previousWindow === 'undefined') {
      delete (globalThis as { window?: unknown }).window;
    } else {
      (globalThis as { window?: unknown }).window = previousWindow;
    }

    if (typeof previousIsTauri === 'undefined') {
      delete (globalThis as { isTauri?: unknown }).isTauri;
    } else {
      (globalThis as { isTauri?: unknown }).isTauri = previousIsTauri;
    }
  }
});

await runAsyncTest('sdkwork-claw-desktop strict desktop bridge rejects when Tauri runtime is unavailable', async () => {
  const previousWindow = (globalThis as { window?: unknown }).window;
  const previousIsTauri = (globalThis as { isTauri?: unknown }).isTauri;
  const runtimeModule = await import('../packages/sdkwork-claw-desktop/src/desktop/runtime.ts');

  try {
    (globalThis as { window?: unknown }).window = {};
    delete (globalThis as { isTauri?: unknown }).isTauri;

    await assert.rejects(
      runtimeModule.runDesktopOnly('studio.listInstances', async () => []),
      (error: unknown) => {
        assert.equal(error instanceof runtimeModule.DesktopBridgeError, true);
        assert.equal(
          (error as InstanceType<typeof runtimeModule.DesktopBridgeError>).operation,
          'studio.listInstances',
        );
        assert.equal(
          (error as InstanceType<typeof runtimeModule.DesktopBridgeError>).runtime,
          'web',
        );
        assert.match(
          (error as InstanceType<typeof runtimeModule.DesktopBridgeError>).message,
          /Tauri runtime is unavailable/,
        );
        return true;
      },
    );

    await assert.rejects(
      runtimeModule.runDesktopOnly('storage.getText', async () => ({
        profileId: 'default-local',
        namespace: 'claw-studio',
        key: 'openclaw-version',
        value: null,
      })),
      (error: unknown) => {
        assert.equal(error instanceof runtimeModule.DesktopBridgeError, true);
        assert.equal(
          (error as InstanceType<typeof runtimeModule.DesktopBridgeError>).operation,
          'storage.getText',
        );
        return true;
      },
    );

    await assert.rejects(
      runtimeModule.runDesktopOnly('components.list', async () => ({
        defaultStartupComponentIds: [],
        components: [],
      })),
      (error: unknown) => {
        assert.equal(error instanceof runtimeModule.DesktopBridgeError, true);
        assert.equal(
          (error as InstanceType<typeof runtimeModule.DesktopBridgeError>).operation,
          'components.list',
        );
        return true;
      },
    );
  } finally {
    if (typeof previousWindow === 'undefined') {
      delete (globalThis as { window?: unknown }).window;
    } else {
      (globalThis as { window?: unknown }).window = previousWindow;
    }

    if (typeof previousIsTauri === 'undefined') {
      delete (globalThis as { isTauri?: unknown }).isTauri;
    } else {
      (globalThis as { isTauri?: unknown }).isTauri = previousIsTauri;
    }
  }
});

await runAsyncTest('sdkwork-claw-infrastructure shares the configured platform bridge across duplicate module instances', async () => {
  const registryUrl = pathToFileURL(
    path.join(root, 'packages/sdkwork-claw-infrastructure/src/platform/registry.ts'),
  ).href;
  const registryCopyA = await import(`${registryUrl}?bridge-copy=a`);
  const registryCopyB = await import(`${registryUrl}?bridge-copy=b`);
  const originalBridge = registryCopyA.getPlatformBridge();
  const sharedInstaller = {
    async listHubInstallCatalog() {
      return [];
    },
    async inspectHubInstall() {
      return {
        ready: true,
        installStatus: 'not-installed',
        issues: [],
        dependencies: [],
        installations: [],
      };
    },
    async runHubDependencyInstall() {
      return { success: true, dependencyReports: [] };
    },
    async runHubInstall() {
      return { success: true, summary: '', stageReports: [], artifactReports: [] };
    },
    async runHubUninstall() {
      return { success: true, targetReports: [] };
    },
    async subscribeHubInstallProgress() {
      return () => {};
    },
  };

  try {
    registryCopyA.configurePlatformBridge({
      installer: sharedInstaller,
    });

    assert.equal(
      registryCopyB.getInstallerPlatform(),
      sharedInstaller,
      'expected duplicate infrastructure module instances to observe the same installer bridge',
    );
  } finally {
    registryCopyA.configurePlatformBridge(originalBridge);
  }
});
