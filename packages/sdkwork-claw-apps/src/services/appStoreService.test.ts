import assert from 'node:assert/strict';
import {
  configurePlatformBridge,
  type HubInstallCatalogEntry,
  type HubInstallAssessmentResult,
  type HubInstallDependencyResult,
  type HubInstallRequest,
  type HubInstallResult,
  type HubUninstallResult,
  type RuntimeInfo,
} from '@sdkwork/claw-infrastructure';
import { appStoreService, createAppStoreService } from './appStoreService.ts';
import { resolveAppHostPlatform } from './appInstallCatalog.ts';

async function runTest(name: string, callback: () => Promise<void> | void) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

function createAssessment(
  request: HubInstallRequest,
  overrides: Partial<HubInstallAssessmentResult> = {},
): HubInstallAssessmentResult {
  return {
    registryName: 'Hub Installer Official Registry',
    registrySource: 'registry/software-registry.yaml',
    softwareName: request.softwareName,
    manifestSource: `registry/manifests/${request.softwareName}.hub.yaml`,
    manifestName: request.softwareName,
    manifestDescription: `${request.softwareName} manifest`,
    manifestHomepage: `https://example.com/${request.softwareName}`,
    ready: true,
    requiresElevatedSetup: false,
    platform: request.effectiveRuntimePlatform ?? 'windows',
    effectiveRuntimePlatform: request.effectiveRuntimePlatform ?? 'windows',
    resolvedInstallScope: request.installScope ?? 'user',
    resolvedInstallRoot: 'C:/Users/admin/.sdkwork/install',
    resolvedWorkRoot: 'C:/Users/admin/.sdkwork/work',
    resolvedBinDir: 'C:/Users/admin/.sdkwork/bin',
    resolvedDataRoot: 'C:/Users/admin/.sdkwork/data',
    installControlLevel: 'managed',
    installStatus: null,
    dependencies: [],
    issues: [],
    recommendations: [],
    installation: null,
    dataItems: [],
    migrationStrategies: [],
    runtime: {
      hostPlatform: 'windows',
      requestedRuntimePlatform: request.effectiveRuntimePlatform ?? 'windows',
      effectiveRuntimePlatform: request.effectiveRuntimePlatform ?? 'windows',
      containerRuntimePreference: request.containerRuntimePreference ?? null,
      resolvedContainerRuntime: 'host',
      wslDistribution: request.wslDistribution ?? null,
      availableWslDistributions: ['Ubuntu-24.04'],
      wslAvailable: true,
      hostDockerAvailable: true,
      wslDockerAvailable: true,
      runtimeHomeDir: 'C:/Users/admin',
      commandAvailability: {},
    },
    ...overrides,
  };
}

function createCatalogEntry(
  overrides: Partial<HubInstallCatalogEntry> = {},
): HubInstallCatalogEntry {
  return {
    appId: 'app-openclaw',
    title: 'OpenClaw',
    developer: 'OpenClaw',
    category: 'AI Agents',
    summary: 'Rust-backed OpenClaw catalog summary.',
    description: 'Rust-backed OpenClaw descriptor from hub-installer.',
    homepage: 'https://docs.openclaw.ai/install',
    tags: ['ai', 'gateway'],
    defaultVariantId: 'windows-wsl',
    defaultSoftwareName: 'openclaw-wsl',
    supportedHostPlatforms: ['windows', 'macos', 'ubuntu'],
    variants: [
      {
        id: 'windows-wsl',
        label: 'Rust WSL profile',
        summary: 'Install through the Rust WSL profile.',
        softwareName: 'openclaw-wsl',
        hostPlatforms: ['windows'],
        runtimePlatform: 'wsl',
        manifestName: 'OpenClaw Install (WSL)',
        manifestDescription: 'Install OpenClaw inside WSL from a Windows host.',
        manifestHomepage: 'https://docs.openclaw.ai/install',
        installationMethod: {
          id: 'wsl',
          label: 'Windows WSL install',
          type: 'wsl',
          summary: 'Install OpenClaw inside a WSL distribution.',
          supported: true,
          documentationUrl: 'https://docs.openclaw.ai/install',
          notes: [],
        },
        request: {
          softwareName: 'openclaw-wsl',
          effectiveRuntimePlatform: 'wsl',
        },
      },
      {
        id: 'unix-host',
        label: 'Rust host profile',
        summary: 'Install through the Rust host profile.',
        softwareName: 'openclaw-npm',
        hostPlatforms: ['macos', 'ubuntu'],
        runtimePlatform: 'host',
        manifestName: 'OpenClaw npm Install',
        manifestDescription: 'Install OpenClaw directly on Unix hosts.',
        manifestHomepage: 'https://docs.openclaw.ai/install',
        installationMethod: {
          id: 'npm-global',
          label: 'npm global install',
          type: 'package',
          summary: 'Install OpenClaw globally with npm.',
          supported: true,
          documentationUrl: 'https://docs.openclaw.ai/install',
          notes: [],
        },
        request: {
          softwareName: 'openclaw-npm',
        },
      },
    ],
    ...overrides,
  };
}

function createRuntimeInfo(overrides: Partial<RuntimeInfo> = {}): RuntimeInfo {
  return {
    platform: 'desktop',
    system: {
      os: 'Windows 11 Pro',
      arch: 'x86_64',
      family: 'windows',
      target: 'x86_64-pc-windows-msvc',
    },
    ...overrides,
  };
}

function resetInstallerCatalogCache() {
  (appStoreService as any).installCatalogCache?.clear?.();
  (appStoreService as any).catalogPresentationCache?.clear?.();
  (appStoreService as any).installSurfaceSummaryCache?.clear?.();
  (appStoreService as any).installSurfaceSummaryPending?.clear?.();
  (appStoreService as any).runtimeInfoPromise = null;
}

function createNoopCleanup() {
  return () => {};
}

await runTest(
  'getList, getCategories, and getApp delegate remote metadata reads to the shared app store catalog sdk wrapper',
  async () => {
    resetInstallerCatalogCache();
    const listQueries: Array<Record<string, unknown> | undefined> = [];
    const getAppCalls: string[] = [];
    const service = createAppStoreService({
      appStoreCatalogService: {
        listApps: async (params) => {
          listQueries.push(params as Record<string, unknown> | undefined);
          return {
            items: [
              {
                id: 'app-openclaw',
                name: 'OpenClaw Desktop',
                developer: 'SDKWork',
                category: 'SDK',
                description: 'Desktop automation app.',
                iconUrl: 'https://cdn.sdkwork.com/openclaw/icon.png',
              },
            ],
            total: 1,
            page: 1,
            pageSize: 20,
            hasMore: false,
          };
        },
        listCategories: async () => [
          {
            code: 'sdk',
            name: 'SDK',
            count: 1,
          },
        ],
        getApp: async (id) => {
          getAppCalls.push(id);
          return {
            id,
            name: 'OpenClaw Desktop',
            developer: 'SDKWork',
            category: 'SDK',
            description: 'Desktop automation app.',
            iconUrl: 'https://cdn.sdkwork.com/openclaw/icon.png',
          };
        },
      } as any,
    });

    configurePlatformBridge({
      installer: {
        async listHubInstallCatalog() {
          return [
            createCatalogEntry({
              appId: 'app-openclaw',
              title: 'OpenClaw Installer',
              developer: 'SDKWork',
              category: 'AI Agents',
              summary: 'Rust catalog summary for OpenClaw.',
              description: 'Rust-backed OpenClaw installer descriptor.',
              homepage: 'https://docs.openclaw.ai/install',
              tags: ['ai', 'desktop'],
            }),
          ];
        },
        async inspectHubInstall(request) {
          return createAssessment(request);
        },
        async runHubDependencyInstall() {
          throw new Error('not implemented');
        },
        async runHubInstall() {
          throw new Error('not implemented');
        },
        async runHubUninstall() {
          throw new Error('not implemented');
        },
        async subscribeHubInstallProgress() {
          return () => {};
        },
      },
    });

    const page = await service.getList({ page: 1, pageSize: 20, keyword: 'claw' });
    const categories = await service.getCategories();
    const app = await service.getApp('app-openclaw');

    assert.equal(listQueries[0]?.keyword, 'claw');
    assert.equal(listQueries[0]?.page, 1);
    assert.equal(listQueries[0]?.pageSize, 20);
    assert.ok(
      listQueries.some(
        (query) =>
          query?.page === 1 &&
          query?.pageSize === 100 &&
          query?.keyword === undefined,
      ),
    );
    assert.deepEqual(getAppCalls, ['app-openclaw']);
    assert.equal(page.items[0]?.installSummary, 'Rust catalog summary for OpenClaw.');
    assert.equal(categories[0]?.title, 'SDK');
    assert.equal(categories[0]?.apps[0]?.id, 'app-openclaw');
    assert.equal(app.id, 'app-openclaw');
    assert.equal(app.developer, 'SDKWork');
    assert.equal(app.installHomepage, 'https://docs.openclaw.ai/install');
  },
);

await runTest('resolveAppHostPlatform normalizes host operating systems', () => {
  assert.equal(resolveAppHostPlatform('Windows 11 Pro'), 'windows');
  assert.equal(resolveAppHostPlatform('macOS 14.4'), 'macos');
  assert.equal(resolveAppHostPlatform('Ubuntu 24.04 LTS'), 'ubuntu');
  assert.equal(resolveAppHostPlatform('Linux'), 'ubuntu');
});

await runTest('getInstallCatalog delegates to the Rust installer catalog bridge', async () => {
  resetInstallerCatalogCache();
  configurePlatformBridge({
    installer: {
      async listHubInstallCatalog() {
        return [
          createCatalogEntry({
            summary: 'Rust catalog summary from installer bridge.',
          }),
        ];
      },
      async inspectHubInstall(request) {
        return createAssessment(request);
      },
      async runHubDependencyInstall() {
        throw new Error('not implemented');
      },
      async runHubInstall() {
        throw new Error('not implemented');
      },
      async runHubUninstall() {
        throw new Error('not implemented');
      },
      async subscribeHubInstallProgress() {
        return () => {};
      },
    },
  });

  const catalog = await appStoreService.getInstallCatalog();

  assert.equal(catalog.length, 1);
  assert.equal(catalog[0]?.summary, 'Rust catalog summary from installer bridge.');
  assert.equal(catalog[0]?.variants[0]?.label, 'Rust WSL profile');
});

await runTest(
  'catalog-driven app lookups reuse runtime detection across list, categories, and detail access',
  async () => {
    resetInstallerCatalogCache();
    let runtimeInfoCalls = 0;
    const restoreCleanup = createNoopCleanup();
    const service = createAppStoreService({
      appStoreCatalogService: {
        listApps: async () => ({
          items: [
            {
              id: 'app-openclaw',
              name: 'OpenClaw Desktop',
              developer: 'SDKWork',
              category: 'SDK',
              description: 'Desktop automation app.',
            },
            {
              id: 'app-codex',
              name: 'Codex',
              developer: 'OpenAI',
              category: 'SDK',
              description: 'Code automation app.',
            },
          ],
          total: 2,
          page: 1,
          pageSize: 100,
          hasMore: false,
        }),
        listCategories: async () => [
          {
            code: 'sdk',
            name: 'SDK',
            count: 2,
          },
        ],
        getApp: async (id) => ({
          id,
          name: id === 'app-codex' ? 'Codex' : 'OpenClaw Desktop',
          developer: id === 'app-codex' ? 'OpenAI' : 'SDKWork',
          category: 'SDK',
          description: 'Code automation app.',
        }),
      } as any,
    });

    try {
      configurePlatformBridge({
        runtime: {
          async getRuntimeInfo() {
            runtimeInfoCalls += 1;
            return createRuntimeInfo();
          },
          async setAppLanguage() {},
          async submitProcessJob() {
            return 'job-1';
          },
          async getJob() {
            throw new Error('not implemented');
          },
          async listJobs() {
            return [];
          },
          async cancelJob() {
            throw new Error('not implemented');
          },
          async subscribeJobUpdates() {
            return () => {};
          },
          async subscribeProcessOutput() {
            return () => {};
          },
        },
        installer: {
          async listHubInstallCatalog() {
            return [
              createCatalogEntry(),
              createCatalogEntry({
                appId: 'app-codex',
                title: 'Codex',
                developer: 'OpenAI',
                category: 'AI Agents',
                summary: 'Rust-backed Codex catalog summary.',
                description: 'Rust-backed Codex descriptor from hub-installer.',
                homepage: 'https://openai.com/codex',
                tags: ['ai', 'cli'],
                defaultVariantId: 'windows-host',
                defaultSoftwareName: 'codex',
                variants: [
                  {
                    id: 'windows-host',
                    label: 'Windows host profile',
                    summary: 'Install Codex directly on Windows.',
                    softwareName: 'codex',
                    hostPlatforms: ['windows'],
                    runtimePlatform: 'host',
                    manifestName: 'Codex Install',
                    manifestDescription: 'Install Codex on Windows.',
                    manifestHomepage: 'https://openai.com/codex',
                    installationMethod: null,
                    request: {
                      softwareName: 'codex',
                    },
                  },
                ],
              }),
            ];
          },
          async inspectHubInstall(request) {
            return createAssessment(request);
          },
          async runHubDependencyInstall() {
            throw new Error('not implemented');
          },
          async runHubInstall() {
            throw new Error('not implemented');
          },
          async runHubUninstall() {
            throw new Error('not implemented');
          },
          async subscribeHubInstallProgress() {
            return () => {};
          },
        },
      });

      await Promise.all([
        service.getList({ page: 1, pageSize: 20 }),
        service.getCategories(),
        service.getApp('app-codex'),
      ]);

      assert.equal(runtimeInfoCalls, 1);
    } finally {
      restoreCleanup();
    }
  },
);

await runTest('resolveInstallTarget prefers the Rust-selected variant data for Windows hosts', async () => {
  resetInstallerCatalogCache();
  configurePlatformBridge({
    installer: {
      async listHubInstallCatalog() {
        return [
          createCatalogEntry({
            variants: [
              {
                id: 'windows-wsl',
                label: 'Rust selected WSL profile',
                summary: 'Use the Rust-selected WSL flow.',
                softwareName: 'openclaw-rust-wsl',
                hostPlatforms: ['windows'],
                runtimePlatform: 'wsl',
                manifestName: 'OpenClaw Install (WSL)',
                manifestDescription: 'Install OpenClaw inside WSL from a Windows host.',
                manifestHomepage: 'https://docs.openclaw.ai/install',
                installationMethod: null,
                request: {
                  softwareName: 'openclaw-rust-wsl',
                  effectiveRuntimePlatform: 'wsl',
                },
              },
            ],
            defaultVariantId: 'windows-wsl',
            defaultSoftwareName: 'openclaw-rust-wsl',
            supportedHostPlatforms: ['windows'],
          }),
        ];
      },
      async inspectHubInstall(request) {
        return createAssessment(request);
      },
      async runHubDependencyInstall() {
        throw new Error('not implemented');
      },
      async runHubInstall() {
        throw new Error('not implemented');
      },
      async runHubUninstall() {
        throw new Error('not implemented');
      },
      async subscribeHubInstallProgress() {
        return () => {};
      },
    },
  });

  const target = await appStoreService.resolveInstallTarget('app-openclaw', {
    hostPlatform: 'windows',
  });

  assert.equal(target.softwareName, 'openclaw-rust-wsl');
  assert.equal(target.hostPlatform, 'windows');
  assert.equal(target.runtimePlatform, 'wsl');
  assert.equal(target.request.effectiveRuntimePlatform, 'wsl');
});

await runTest('resolveInstallTarget honors an explicit Rust catalog profile selection', async () => {
  resetInstallerCatalogCache();
  configurePlatformBridge({
    installer: {
      async listHubInstallCatalog() {
        return [
          createCatalogEntry({
            variants: [
              {
                id: 'windows-wsl',
                label: 'Rust selected WSL profile',
                summary: 'Use the Rust-selected WSL flow.',
                softwareName: 'openclaw-wsl',
                hostPlatforms: ['windows'],
                runtimePlatform: 'wsl',
                manifestName: 'OpenClaw Install (WSL)',
                manifestDescription: 'Install OpenClaw inside WSL from a Windows host.',
                manifestHomepage: 'https://docs.openclaw.ai/install',
                installationMethod: null,
                request: {
                  softwareName: 'openclaw-wsl',
                  effectiveRuntimePlatform: 'wsl',
                },
              },
              {
                id: 'windows-docker-wsl',
                label: 'Rust selected Docker via WSL profile',
                summary: 'Run the OpenClaw Docker flow inside WSL.',
                softwareName: 'openclaw-docker',
                hostPlatforms: ['windows'],
                runtimePlatform: 'wsl',
                manifestName: 'OpenClaw Install (Docker)',
                manifestDescription: 'Install OpenClaw with the Docker workflow.',
                manifestHomepage: 'https://docs.openclaw.ai/install/docker',
                installationMethod: {
                  id: 'docker',
                  label: 'Docker workflow',
                  type: 'container',
                  summary: 'Run the documented Docker workflow.',
                  supported: true,
                  documentationUrl: 'https://docs.openclaw.ai/install/docker',
                  notes: [],
                },
                request: {
                  softwareName: 'openclaw-docker',
                  effectiveRuntimePlatform: 'wsl',
                  containerRuntimePreference: 'wsl',
                },
              },
            ],
            defaultVariantId: 'windows-wsl',
            defaultSoftwareName: 'openclaw-wsl',
            supportedHostPlatforms: ['windows'],
          }),
        ];
      },
      async inspectHubInstall(request) {
        return createAssessment(request);
      },
      async runHubDependencyInstall() {
        throw new Error('not implemented');
      },
      async runHubInstall() {
        throw new Error('not implemented');
      },
      async runHubUninstall() {
        throw new Error('not implemented');
      },
      async subscribeHubInstallProgress() {
        return () => {};
      },
    },
  });

  const target = await appStoreService.resolveInstallTarget('app-openclaw', {
    hostPlatform: 'windows',
    variantId: 'windows-docker-wsl',
  });

  assert.equal(target.variant.id, 'windows-docker-wsl');
  assert.equal(target.softwareName, 'openclaw-docker');
  assert.equal(target.runtimePlatform, 'wsl');
  assert.equal(target.request.effectiveRuntimePlatform, 'wsl');
  assert.equal(target.request.containerRuntimePreference, 'wsl');
});

await runTest('getGuidedInstallNavigation routes claw runtimes into the step-based Install Claw flow', async () => {
  resetInstallerCatalogCache();
  configurePlatformBridge({
    installer: {
      async listHubInstallCatalog() {
        return [
          createCatalogEntry(),
          createCatalogEntry({
            appId: 'app-zeroclaw',
            title: 'ZeroClaw',
            developer: 'ZeroClaw Labs',
            category: 'AI Agents',
            summary: 'Rust catalog summary for ZeroClaw.',
            description: 'Rust-backed ZeroClaw descriptor.',
            homepage: 'https://github.com/zeroclaw-labs/zeroclaw',
            tags: ['rust'],
            defaultVariantId: 'source-host',
            defaultSoftwareName: 'zeroclaw-source',
            supportedHostPlatforms: ['windows', 'macos', 'ubuntu'],
            variants: [
              {
                id: 'source-host',
                label: 'Rust source profile',
                summary: 'Install ZeroClaw from source.',
                softwareName: 'zeroclaw-source',
                hostPlatforms: ['windows', 'macos', 'ubuntu'],
                runtimePlatform: 'host',
                manifestName: 'ZeroClaw Install',
                manifestDescription: 'Install ZeroClaw from source.',
                manifestHomepage: 'https://github.com/zeroclaw-labs/zeroclaw',
                installationMethod: null,
                request: {
                  softwareName: 'zeroclaw-source',
                },
              },
            ],
          }),
        ];
      },
      async inspectHubInstall(request) {
        return createAssessment(request);
      },
      async runHubDependencyInstall() {
        throw new Error('not implemented');
      },
      async runHubInstall() {
        throw new Error('not implemented');
      },
      async runHubUninstall() {
        throw new Error('not implemented');
      },
      async subscribeHubInstallProgress() {
        return () => {};
      },
    },
  });

  const openClawNavigation = await appStoreService.getGuidedInstallNavigation('app-openclaw', {
    hostPlatform: 'windows',
    variantId: 'windows-docker-wsl',
  });
  const zeroClawNavigation = await appStoreService.getGuidedInstallNavigation('app-zeroclaw', {
    hostPlatform: 'ubuntu',
  });

  assert.equal(
    openClawNavigation,
    '/install?product=openclaw&method=docker&guided=1',
  );
  assert.equal(
    zeroClawNavigation,
    '/install?product=zeroclaw&method=source&guided=1',
  );
});

await runTest('getList merges app sdk store metadata with the Rust installer catalog without seeded mock content', async () => {
  resetInstallerCatalogCache();
  const restoreCleanup = createNoopCleanup();
  const service = createAppStoreService({
    appStoreCatalogService: {
      listApps: async () => ({
        items: [
          {
            id: 'app-nodejs',
            name: 'Node.js',
            developer: 'Node.js Foundation',
            category: 'Runtimes',
            description: 'Node.js runtime.',
          },
          {
            id: 'app-pnpm',
            name: 'pnpm',
            developer: 'pnpm',
            category: 'Package Managers',
            description: 'pnpm package manager.',
          },
        ],
        total: 2,
        page: 1,
        pageSize: 10,
        hasMore: false,
      }),
      listCategories: async () => [
        { code: 'package-managers', name: 'Package Managers', count: 1 },
        { code: 'runtimes', name: 'Runtimes', count: 1 },
      ],
      getApp: async (id) => ({
        id,
        name: id === 'app-pnpm' ? 'pnpm' : 'Node.js',
        developer: id === 'app-pnpm' ? 'pnpm' : 'Node.js Foundation',
        category: id === 'app-pnpm' ? 'Package Managers' : 'Runtimes',
        description: id === 'app-pnpm' ? 'pnpm package manager.' : 'Node.js runtime.',
      }),
    } as any,
  });

  try {
    configurePlatformBridge({
      installer: {
        async listHubInstallCatalog() {
          return [
            createCatalogEntry({
              appId: 'app-nodejs',
              title: 'Node.js',
              developer: 'Node.js Foundation',
              category: 'Runtimes',
              summary: 'Rust catalog summary for Node.js.',
              description: 'Rust-backed Node.js descriptor.',
              homepage: 'https://nodejs.org/',
              tags: ['runtime'],
              defaultVariantId: 'shared-host',
              defaultSoftwareName: 'nodejs-rust',
              supportedHostPlatforms: ['windows', 'macos', 'ubuntu'],
              variants: [
                {
                  id: 'shared-host',
                  label: 'Rust host profile',
                  summary: 'Install Node.js on the current host.',
                  softwareName: 'nodejs-rust',
                  hostPlatforms: ['windows', 'macos', 'ubuntu'],
                  runtimePlatform: 'host',
                  manifestName: 'Node.js Install',
                  manifestDescription: 'Install Node.js on the current host.',
                  manifestHomepage: 'https://nodejs.org/',
                  installationMethod: null,
                  request: {
                    softwareName: 'nodejs-rust',
                  },
                },
              ],
            }),
            createCatalogEntry({
              appId: 'app-pnpm',
              title: 'pnpm',
              developer: 'pnpm',
              category: 'Package Managers',
              summary: 'Rust catalog summary for pnpm.',
              description: 'Rust-backed pnpm descriptor.',
              homepage: 'https://pnpm.io/',
              tags: ['package-manager'],
              defaultVariantId: 'shared-host',
              defaultSoftwareName: 'pnpm-rust',
              supportedHostPlatforms: ['windows', 'macos', 'ubuntu'],
              variants: [
                {
                  id: 'shared-host',
                  label: 'Rust host profile',
                  summary: 'Install pnpm on the current host.',
                  softwareName: 'pnpm-rust',
                  hostPlatforms: ['windows', 'macos', 'ubuntu'],
                  runtimePlatform: 'host',
                  manifestName: 'pnpm Install',
                  manifestDescription: 'Install pnpm on the current host.',
                  manifestHomepage: 'https://pnpm.io/',
                  installationMethod: null,
                  request: {
                    softwareName: 'pnpm-rust',
                  },
                },
              ],
            }),
          ];
        },
        async inspectHubInstall(request) {
          return createAssessment(request);
        },
        async runHubDependencyInstall() {
          throw new Error('not implemented');
        },
        async runHubInstall() {
          throw new Error('not implemented');
        },
        async runHubUninstall() {
          throw new Error('not implemented');
        },
        async subscribeHubInstallProgress() {
          return () => {};
        },
      },
      });

    const result = await service.getList({ page: 1, pageSize: 10 });

    assert.equal(result.total, 2);
    assert.deepEqual(
      result.items.map((item) => item.id),
      ['app-pnpm', 'app-nodejs'],
    );
    assert.equal(result.items[1]?.installSummary, 'Rust catalog summary for Node.js.');
    assert.equal(result.items[1]?.defaultSoftwareName, 'nodejs-rust');
    assert.match(result.items[0]?.icon || '', /^data:image\/svg\+xml/);
  } finally {
    restoreCleanup();
  }
});

await runTest('getCategories groups app sdk store entries with merged installer metadata', async () => {
  resetInstallerCatalogCache();
  const restoreCleanup = createNoopCleanup();
  const service = createAppStoreService({
    appStoreCatalogService: {
      listApps: async () => ({
        items: [
          {
            id: 'app-pnpm',
            name: 'pnpm',
            developer: 'pnpm',
            category: 'Package Managers',
            description: 'pnpm package manager.',
          },
          {
            id: 'app-nodejs',
            name: 'Node.js',
            developer: 'Node.js Foundation',
            category: 'Runtimes',
            description: 'Node.js runtime.',
          },
        ],
        total: 2,
        page: 1,
        pageSize: 100,
        hasMore: false,
      }),
      listCategories: async () => [
        { code: 'package-managers', name: 'Package Managers', count: 1 },
        { code: 'runtimes', name: 'Runtimes', count: 1 },
      ],
      getApp: async (id) => ({
        id,
        name: id === 'app-pnpm' ? 'pnpm' : 'Node.js',
        developer: id === 'app-pnpm' ? 'pnpm' : 'Node.js Foundation',
        category: id === 'app-pnpm' ? 'Package Managers' : 'Runtimes',
        description: id === 'app-pnpm' ? 'pnpm package manager.' : 'Node.js runtime.',
      }),
    } as any,
  });

  try {
    configurePlatformBridge({
      installer: {
        async listHubInstallCatalog() {
          return [
            createCatalogEntry({
              appId: 'app-pnpm',
              title: 'pnpm',
              developer: 'pnpm',
              category: 'Package Managers',
              summary: 'Rust catalog summary for pnpm.',
              description: 'Rust-backed pnpm descriptor.',
              homepage: 'https://pnpm.io/',
              tags: ['package-manager'],
              defaultVariantId: 'shared-host',
              defaultSoftwareName: 'pnpm-rust',
              supportedHostPlatforms: ['windows', 'macos', 'ubuntu'],
              variants: [
                {
                  id: 'shared-host',
                  label: 'Rust host profile',
                  summary: 'Install pnpm on the current host.',
                  softwareName: 'pnpm-rust',
                  hostPlatforms: ['windows', 'macos', 'ubuntu'],
                  runtimePlatform: 'host',
                  manifestName: 'pnpm Install',
                  manifestDescription: 'Install pnpm on the current host.',
                  manifestHomepage: 'https://pnpm.io/',
                  installationMethod: null,
                  request: {
                    softwareName: 'pnpm-rust',
                  },
                },
              ],
            }),
            createCatalogEntry({
              appId: 'app-nodejs',
              title: 'Node.js',
              developer: 'Node.js Foundation',
              category: 'Runtimes',
              summary: 'Rust catalog summary for Node.js.',
              description: 'Rust-backed Node.js descriptor.',
              homepage: 'https://nodejs.org/',
              tags: ['runtime'],
              defaultVariantId: 'shared-host',
              defaultSoftwareName: 'nodejs-rust',
              supportedHostPlatforms: ['windows', 'macos', 'ubuntu'],
              variants: [
                {
                  id: 'shared-host',
                  label: 'Rust host profile',
                  summary: 'Install Node.js on the current host.',
                  softwareName: 'nodejs-rust',
                  hostPlatforms: ['windows', 'macos', 'ubuntu'],
                  runtimePlatform: 'host',
                  manifestName: 'Node.js Install',
                  manifestDescription: 'Install Node.js on the current host.',
                  manifestHomepage: 'https://nodejs.org/',
                  installationMethod: null,
                  request: {
                    softwareName: 'nodejs-rust',
                  },
                },
              ],
            }),
          ];
        },
        async inspectHubInstall(request) {
          return createAssessment(request);
        },
        async runHubDependencyInstall() {
          throw new Error('not implemented');
        },
        async runHubInstall() {
          throw new Error('not implemented');
        },
        async runHubUninstall() {
          throw new Error('not implemented');
        },
        async subscribeHubInstallProgress() {
          return () => {};
        },
      },
      });

    const categories = await service.getCategories();

    assert.equal(categories.length, 2);
    assert.deepEqual(
      categories.map((category) => category.title),
      ['Package Managers', 'Runtimes'],
    );
    assert.deepEqual(
      categories.map((category) => category.apps[0]?.id),
      ['app-pnpm', 'app-nodejs'],
    );
  } finally {
    restoreCleanup();
  }
});

await runTest('getApp resolves detail from app sdk store metadata and merges installer hints', async () => {
  resetInstallerCatalogCache();
  const restoreCleanup = createNoopCleanup();
  const service = createAppStoreService({
    appStoreCatalogService: {
      listApps: async () => ({
        items: [
          {
            id: 'app-codex',
            name: 'Codex',
            developer: 'OpenAI',
            category: 'SDK',
            description: 'Code automation app.',
          },
        ],
        total: 1,
        page: 1,
        pageSize: 100,
        hasMore: false,
      }),
      listCategories: async () => [{ code: 'sdk', name: 'SDK', count: 1 }],
      getApp: async (id) => ({
        id,
        name: 'Codex',
        developer: 'OpenAI',
        category: 'SDK',
        description: 'Code automation app.',
        iconUrl: 'https://cdn.sdkwork.com/codex/icon.png',
      }),
    } as any,
  });

  try {
    configurePlatformBridge({
      installer: {
        async listHubInstallCatalog() {
          return [
            createCatalogEntry({
              appId: 'app-codex',
              title: 'Codex',
              developer: 'OpenAI',
              category: 'AI Agents',
              summary: 'Rust-backed Codex catalog summary.',
              description: 'Rust-backed Codex descriptor from hub-installer.',
              homepage: 'https://openai.com/codex',
              tags: ['ai', 'cli'],
              defaultVariantId: 'windows-host',
              defaultSoftwareName: 'codex',
              supportedHostPlatforms: ['windows', 'macos', 'ubuntu'],
              variants: [
                {
                  id: 'windows-host',
                  label: 'Windows host profile',
                  summary: 'Install Codex directly on Windows.',
                  softwareName: 'codex',
                  hostPlatforms: ['windows', 'macos', 'ubuntu'],
                  runtimePlatform: 'host',
                  manifestName: 'Codex Install',
                  manifestDescription: 'Install Codex on Windows.',
                  manifestHomepage: 'https://openai.com/codex',
                  installationMethod: null,
                  request: {
                    softwareName: 'codex',
                  },
                },
              ],
            }),
          ];
        },
        async inspectHubInstall(request) {
          return createAssessment(request);
        },
        async runHubDependencyInstall() {
          throw new Error('not implemented');
        },
        async runHubInstall() {
          throw new Error('not implemented');
        },
        async runHubUninstall() {
          throw new Error('not implemented');
        },
        async subscribeHubInstallProgress() {
          return () => {};
        },
      },
      });

    const app = await service.getApp('app-codex');

    assert.equal(app.id, 'app-codex');
    assert.equal(app.name, 'Codex');
    assert.equal(app.installHomepage, 'https://openai.com/codex');
    assert.equal(app.icon, 'https://cdn.sdkwork.com/codex/icon.png');
  } finally {
    restoreCleanup();
  }
});

await runTest('inspectInstall delegates to the shared installer bridge with the resolved request', async () => {
  resetInstallerCatalogCache();
  const inspectCalls: HubInstallRequest[] = [];
  const service = createAppStoreService({
    appStoreCatalogService: {
      listApps: async () => ({
        items: [],
        total: 0,
        page: 1,
        pageSize: 100,
        hasMore: false,
      }),
      listCategories: async () => [],
      getApp: async (id) => ({
        id,
        name: 'OpenClaw',
        developer: 'SDKWork',
        category: 'SDK',
        description: 'Desktop automation app.',
      }),
    } as any,
  });
  const runtimeInfo: RuntimeInfo = {
    platform: 'desktop',
    system: {
      os: 'Windows 11 Pro',
      arch: 'x86_64',
      family: 'windows',
      target: 'x86_64-pc-windows-msvc',
    },
  };

  configurePlatformBridge({
    runtime: {
      async getRuntimeInfo() {
        return runtimeInfo;
      },
      async setAppLanguage() {},
      async submitProcessJob() {
        return 'job-1';
      },
      async getJob() {
        throw new Error('not implemented');
      },
      async listJobs() {
        return [];
      },
      async cancelJob() {
        throw new Error('not implemented');
      },
      async subscribeJobUpdates() {
        return () => {};
      },
      async subscribeProcessOutput() {
        return () => {};
      },
    },
    installer: {
      async listHubInstallCatalog() {
        return [createCatalogEntry()];
      },
      async inspectHubInstall(request) {
        inspectCalls.push(request);
        return createAssessment(request);
      },
      async runHubDependencyInstall() {
        throw new Error('not implemented');
      },
      async runHubInstall() {
        throw new Error('not implemented');
      },
      async runHubUninstall() {
        throw new Error('not implemented');
      },
      async subscribeHubInstallProgress() {
        return () => {};
      },
    },
  });

  const result = await service.inspectInstall('app-openclaw');

  assert.equal(inspectCalls.length, 1);
  assert.equal(inspectCalls[0]?.softwareName, 'openclaw-wsl');
  assert.equal(inspectCalls[0]?.effectiveRuntimePlatform, 'wsl');
  assert.equal(result.target.softwareName, 'openclaw-wsl');
  assert.equal(result.assessment.softwareName, 'openclaw-wsl');
});

await runTest('inspectInstall preserves persistent install status from the Rust assessment bridge', async () => {
  resetInstallerCatalogCache();
  const service = createAppStoreService({
    appStoreCatalogService: {
      listApps: async () => ({
        items: [],
        total: 0,
        page: 1,
        pageSize: 100,
        hasMore: false,
      }),
      listCategories: async () => [],
      getApp: async (id) => ({
        id,
        name: 'OpenClaw',
        developer: 'SDKWork',
        category: 'SDK',
        description: 'Desktop automation app.',
      }),
    } as any,
  });

  configurePlatformBridge({
    runtime: {
      async getRuntimeInfo() {
        return {
          platform: 'desktop',
          system: {
            os: 'Windows 11 Pro',
            arch: 'x86_64',
            family: 'windows',
            target: 'x86_64-pc-windows-msvc',
          },
        };
      },
      async setAppLanguage() {},
      async submitProcessJob() {
        return 'job-1';
      },
      async getJob() {
        throw new Error('not implemented');
      },
      async listJobs() {
        return [];
      },
      async cancelJob() {
        throw new Error('not implemented');
      },
      async subscribeJobUpdates() {
        return () => {};
      },
      async subscribeProcessOutput() {
        return () => {};
      },
    },
    installer: {
      async listHubInstallCatalog() {
        return [createCatalogEntry()];
      },
      async inspectHubInstall(request) {
        return createAssessment(request, {
          installStatus: 'installed',
        });
      },
      async runHubDependencyInstall() {
        throw new Error('not implemented');
      },
      async runHubInstall() {
        throw new Error('not implemented');
      },
      async runHubUninstall() {
        throw new Error('not implemented');
      },
      async subscribeHubInstallProgress() {
        return () => {};
      },
    },
  });

  const result = await service.inspectInstall('app-openclaw');

  assert.equal(result.assessment.installStatus, 'installed');
});

await runTest('getInstallSurfaceSummaries derives installed, ready, and attention states from Rust inspections', async () => {
  resetInstallerCatalogCache();
  const inspectCalls: HubInstallRequest[] = [];

  configurePlatformBridge({
    runtime: {
      async getRuntimeInfo() {
        return {
          platform: 'desktop',
          system: {
            os: 'Ubuntu 24.04',
            arch: 'x86_64',
            family: 'unix',
            target: 'x86_64-unknown-linux-gnu',
          },
        };
      },
      async setAppLanguage() {},
      async submitProcessJob() {
        return 'job-1';
      },
      async getJob() {
        throw new Error('not implemented');
      },
      async listJobs() {
        return [];
      },
      async cancelJob() {
        throw new Error('not implemented');
      },
      async subscribeJobUpdates() {
        return () => {};
      },
      async subscribeProcessOutput() {
        return () => {};
      },
    },
    installer: {
      async listHubInstallCatalog() {
        return [
          createCatalogEntry({
            appId: 'app-openclaw',
            defaultSoftwareName: 'openclaw-host',
            supportedHostPlatforms: ['ubuntu'],
            defaultVariantId: 'ubuntu-host',
            variants: [
              {
                id: 'ubuntu-host',
                label: 'Rust host profile',
                summary: 'Install OpenClaw on the current Ubuntu host.',
                softwareName: 'openclaw-host',
                hostPlatforms: ['ubuntu'],
                runtimePlatform: 'host',
                manifestName: 'OpenClaw Install',
                manifestDescription: 'Install OpenClaw directly on Ubuntu.',
                manifestHomepage: 'https://docs.openclaw.ai/install',
                installationMethod: null,
                request: {
                  softwareName: 'openclaw-host',
                },
              },
            ],
          }),
          createCatalogEntry({
            appId: 'app-homebrew',
            title: 'Homebrew',
            developer: 'Homebrew',
            category: 'Package Managers',
            summary: 'Rust catalog summary for Homebrew.',
            description: 'Rust-backed Homebrew descriptor.',
            homepage: 'https://brew.sh/',
            tags: ['package-manager'],
            defaultVariantId: 'ubuntu-host',
            defaultSoftwareName: 'brew',
            supportedHostPlatforms: ['ubuntu'],
            variants: [
              {
                id: 'ubuntu-host',
                label: 'Rust host profile',
                summary: 'Install Homebrew on the current Ubuntu host.',
                softwareName: 'brew',
                hostPlatforms: ['ubuntu'],
                runtimePlatform: 'host',
                manifestName: 'Homebrew Install',
                manifestDescription: 'Install Homebrew on the current Ubuntu host.',
                manifestHomepage: 'https://brew.sh/',
                installationMethod: null,
                request: {
                  softwareName: 'brew',
                },
              },
            ],
          }),
          createCatalogEntry({
            appId: 'app-pnpm',
            title: 'pnpm',
            developer: 'pnpm',
            category: 'Package Managers',
            summary: 'Rust catalog summary for pnpm.',
            description: 'Rust-backed pnpm descriptor.',
            homepage: 'https://pnpm.io/',
            tags: ['package-manager'],
            defaultVariantId: 'ubuntu-host',
            defaultSoftwareName: 'pnpm',
            supportedHostPlatforms: ['ubuntu'],
            variants: [
              {
                id: 'ubuntu-host',
                label: 'Rust host profile',
                summary: 'Install pnpm on the current Ubuntu host.',
                softwareName: 'pnpm',
                hostPlatforms: ['ubuntu'],
                runtimePlatform: 'host',
                manifestName: 'pnpm Install',
                manifestDescription: 'Install pnpm on the current Ubuntu host.',
                manifestHomepage: 'https://pnpm.io/',
                installationMethod: null,
                request: {
                  softwareName: 'pnpm',
                },
              },
            ],
          }),
        ];
      },
      async inspectHubInstall(request) {
        inspectCalls.push(request);
        if (request.softwareName === 'openclaw-host') {
          return createAssessment(request, {
            installStatus: 'installed',
          });
        }

        if (request.softwareName === 'brew') {
          return createAssessment(request, {
            ready: true,
          });
        }

        if (request.softwareName === 'pnpm') {
          return createAssessment(request, {
            ready: false,
            dependencies: [
              {
                id: 'nodejs',
                description: 'Node.js runtime',
                required: true,
                checkType: 'command',
                target: 'node',
                status: 'missing',
                supportsAutoRemediation: true,
                remediationCommands: [],
              },
            ],
            issues: [
              {
                severity: 'error',
                code: 'node_missing',
                message: 'Node.js must be installed first.',
                dependencyId: 'nodejs',
              },
            ],
          });
        }

        throw new Error(`unexpected software name: ${request.softwareName}`);
      },
      async runHubDependencyInstall() {
        throw new Error('not implemented');
      },
      async runHubInstall() {
        throw new Error('not implemented');
      },
      async runHubUninstall() {
        throw new Error('not implemented');
      },
      async subscribeHubInstallProgress() {
        return () => {};
      },
    },
  });

  const summaries = await appStoreService.getInstallSurfaceSummaries([
    'app-openclaw',
    'app-homebrew',
    'app-pnpm',
    'app-unknown',
  ]);

  assert.equal(inspectCalls.length, 3);
  assert.equal(summaries.size, 3);
  assert.equal(summaries.get('app-openclaw')?.state, 'installed');
  assert.equal(summaries.get('app-openclaw')?.installStatus, 'installed');
  assert.equal(summaries.get('app-homebrew')?.state, 'ready');
  assert.equal(summaries.get('app-homebrew')?.ready, true);
  assert.equal(summaries.get('app-pnpm')?.state, 'attention');
  assert.equal(summaries.get('app-pnpm')?.blockingIssueCount, 1);
  assert.equal(summaries.get('app-pnpm')?.dependencyAttentionCount, 1);
  assert.equal(summaries.get('app-pnpm')?.autoRemediableDependencyCount, 1);
  assert.equal(summaries.has('app-unknown'), false);
});

await runTest(
  'getInstallSurfaceSummaries reuses cached inspections for repeated App Store summary lookups',
  async () => {
    resetInstallerCatalogCache();
    let runtimeInfoCalls = 0;
    const inspectCalls: HubInstallRequest[] = [];

    configurePlatformBridge({
      runtime: {
        async getRuntimeInfo() {
          runtimeInfoCalls += 1;
          return createRuntimeInfo();
        },
        async setAppLanguage() {},
        async submitProcessJob() {
          return 'job-1';
        },
        async getJob() {
          throw new Error('not implemented');
        },
        async listJobs() {
          return [];
        },
        async cancelJob() {
          throw new Error('not implemented');
        },
        async subscribeJobUpdates() {
          return () => {};
        },
        async subscribeProcessOutput() {
          return () => {};
        },
      },
      installer: {
        async listHubInstallCatalog() {
          return [
            createCatalogEntry(),
            createCatalogEntry({
              appId: 'app-pnpm',
              title: 'pnpm',
              developer: 'pnpm',
              category: 'Package Managers',
              summary: 'Rust-backed pnpm catalog summary.',
              description: 'Rust-backed pnpm descriptor from hub-installer.',
              homepage: 'https://pnpm.io/',
              tags: ['package-manager'],
              defaultVariantId: 'windows-host',
              defaultSoftwareName: 'pnpm',
              variants: [
                {
                  id: 'windows-host',
                  label: 'Windows host profile',
                  summary: 'Install pnpm directly on Windows.',
                  softwareName: 'pnpm',
                  hostPlatforms: ['windows'],
                  runtimePlatform: 'host',
                  manifestName: 'pnpm Install',
                  manifestDescription: 'Install pnpm on Windows.',
                  manifestHomepage: 'https://pnpm.io/',
                  installationMethod: null,
                  request: {
                    softwareName: 'pnpm',
                  },
                },
              ],
            }),
          ];
        },
        async inspectHubInstall(request) {
          inspectCalls.push(request);
          if (request.softwareName === 'openclaw-wsl') {
            return createAssessment(request, {
              installStatus: 'installed',
            });
          }
          if (request.softwareName === 'pnpm') {
            return createAssessment(request, {
              ready: false,
              issues: [
                {
                  id: 'pnpm-not-ready',
                  severity: 'error',
                  summary: 'pnpm needs repair',
                  detail: 'pnpm is missing from PATH.',
                },
              ],
            });
          }

          throw new Error(`unexpected software name: ${request.softwareName}`);
        },
        async runHubDependencyInstall() {
          throw new Error('not implemented');
        },
        async runHubInstall() {
          throw new Error('not implemented');
        },
        async runHubUninstall() {
          throw new Error('not implemented');
        },
        async subscribeHubInstallProgress() {
          return () => {};
        },
      },
    });

    const firstPass = await appStoreService.getInstallSurfaceSummaries([
      'app-openclaw',
      'app-pnpm',
    ]);
    const secondPass = await appStoreService.getInstallSurfaceSummaries([
      'app-pnpm',
      'app-openclaw',
      'app-openclaw',
    ]);

    assert.equal(firstPass.size, 2);
    assert.equal(secondPass.size, 2);
    assert.equal(secondPass.get('app-openclaw')?.state, 'installed');
    assert.equal(secondPass.get('app-pnpm')?.state, 'attention');
    assert.equal(inspectCalls.length, 2);
    assert.equal(runtimeInfoCalls, 1);
  },
);

await runTest('installDependencies delegates to the shared dependency installer with selected dependency ids', async () => {
  resetInstallerCatalogCache();
  const dependencyCalls: Array<HubInstallRequest & { dependencyIds?: string[] }> = [];

  configurePlatformBridge({
    runtime: {
      async getRuntimeInfo() {
        return {
          platform: 'desktop',
          system: {
            os: 'Ubuntu 24.04',
            arch: 'x86_64',
            family: 'unix',
            target: 'x86_64-unknown-linux-gnu',
          },
        };
      },
      async setAppLanguage() {},
      async submitProcessJob() {
        return 'job-1';
      },
      async getJob() {
        throw new Error('not implemented');
      },
      async listJobs() {
        return [];
      },
      async cancelJob() {
        throw new Error('not implemented');
      },
      async subscribeJobUpdates() {
        return () => {};
      },
      async subscribeProcessOutput() {
        return () => {};
      },
    },
    installer: {
      async listHubInstallCatalog() {
        return [
          createCatalogEntry({
            appId: 'app-pnpm',
            title: 'pnpm',
            developer: 'pnpm',
            category: 'Package Managers',
            summary: 'Rust catalog summary for pnpm.',
            description: 'Rust-backed pnpm descriptor.',
            homepage: 'https://pnpm.io/',
            tags: ['package-manager'],
            defaultVariantId: 'shared-host',
            defaultSoftwareName: 'pnpm',
            supportedHostPlatforms: ['windows', 'macos', 'ubuntu'],
            variants: [
              {
                id: 'shared-host',
                label: 'Rust host profile',
                summary: 'Install pnpm on the current host.',
                softwareName: 'pnpm',
                hostPlatforms: ['windows', 'macos', 'ubuntu'],
                runtimePlatform: 'host',
                manifestName: 'pnpm Install',
                manifestDescription: 'Install pnpm on the current host.',
                manifestHomepage: 'https://pnpm.io/',
                installationMethod: null,
                request: {
                  softwareName: 'pnpm',
                },
              },
            ],
          }),
        ];
      },
      async inspectHubInstall(request) {
        return createAssessment(request);
      },
      async runHubDependencyInstall(request) {
        dependencyCalls.push(request);
        const result: HubInstallDependencyResult = {
          manifestName: request.softwareName,
          manifestSource: `registry/manifests/${request.softwareName}.hub.yaml`,
          manifestSourceInput: `registry/manifests/${request.softwareName}.hub.yaml`,
          manifestSourceKind: 'registry-entry',
          registryName: 'Hub Installer Official Registry',
          registrySource: 'registry/software-registry.yaml',
          softwareName: request.softwareName,
          success: true,
          durationMs: 12,
          platform: request.effectiveRuntimePlatform ?? 'ubuntu',
          effectiveRuntimePlatform: request.effectiveRuntimePlatform ?? 'ubuntu',
          resolvedInstallScope: request.installScope ?? 'user',
          resolvedInstallRoot: '/home/admin/.sdkwork/install',
          resolvedWorkRoot: '/home/admin/.sdkwork/work',
          resolvedBinDir: '/home/admin/.sdkwork/bin',
          resolvedDataRoot: '/home/admin/.sdkwork/data',
          installControlLevel: 'managed',
          dependencyReports: [],
        };
        return result;
      },
      async runHubInstall() {
        throw new Error('not implemented');
      },
      async runHubUninstall() {
        throw new Error('not implemented');
      },
      async subscribeHubInstallProgress() {
        return () => {};
      },
    },
  });

  await appStoreService.installDependencies('app-pnpm', {
    hostPlatform: 'ubuntu',
    dependencyIds: ['nodejs'],
  });

  assert.equal(dependencyCalls.length, 1);
  assert.equal(dependencyCalls[0]?.softwareName, 'pnpm');
  assert.deepEqual(dependencyCalls[0]?.dependencyIds, ['nodejs']);
});

await runTest('installApp delegates to the shared installer bridge for the selected target', async () => {
  resetInstallerCatalogCache();
  const installCalls: HubInstallRequest[] = [];

  configurePlatformBridge({
    runtime: {
      async getRuntimeInfo() {
        return {
          platform: 'desktop',
          system: {
            os: 'macOS 14.4',
            arch: 'arm64',
            family: 'unix',
            target: 'aarch64-apple-darwin',
          },
        };
      },
      async setAppLanguage() {},
      async submitProcessJob() {
        return 'job-1';
      },
      async getJob() {
        throw new Error('not implemented');
      },
      async listJobs() {
        return [];
      },
      async cancelJob() {
        throw new Error('not implemented');
      },
      async subscribeJobUpdates() {
        return () => {};
      },
      async subscribeProcessOutput() {
        return () => {};
      },
    },
    installer: {
      async listHubInstallCatalog() {
        return [
          createCatalogEntry({
            appId: 'app-homebrew',
            title: 'Homebrew',
            developer: 'Homebrew',
            category: 'Package Managers',
            summary: 'Rust catalog summary for Homebrew.',
            description: 'Rust-backed Homebrew descriptor.',
            homepage: 'https://brew.sh/',
            tags: ['package-manager'],
            defaultVariantId: 'macos-host',
            defaultSoftwareName: 'brew',
            supportedHostPlatforms: ['windows', 'macos', 'ubuntu'],
            variants: [
              {
                id: 'windows-wsl',
                label: 'Rust WSL profile',
                summary: 'Install Homebrew inside WSL.',
                softwareName: 'brew',
                hostPlatforms: ['windows'],
                runtimePlatform: 'wsl',
                manifestName: 'Homebrew Install',
                manifestDescription: 'Install Homebrew inside WSL.',
                manifestHomepage: 'https://brew.sh/',
                installationMethod: null,
                request: {
                  softwareName: 'brew',
                  effectiveRuntimePlatform: 'wsl',
                },
              },
              {
                id: 'macos-host',
                label: 'Rust macOS profile',
                summary: 'Install Homebrew directly on macOS.',
                softwareName: 'brew',
                hostPlatforms: ['macos'],
                runtimePlatform: 'host',
                manifestName: 'Homebrew Install',
                manifestDescription: 'Install Homebrew directly on macOS.',
                manifestHomepage: 'https://brew.sh/',
                installationMethod: null,
                request: {
                  softwareName: 'brew',
                },
              },
            ],
          }),
        ];
      },
      async inspectHubInstall(request) {
        return createAssessment(request);
      },
      async runHubDependencyInstall() {
        throw new Error('not implemented');
      },
      async runHubInstall(request) {
        installCalls.push(request);
        const result: HubInstallResult = {
          registryName: 'Hub Installer Official Registry',
          registrySource: 'registry/software-registry.yaml',
          softwareName: request.softwareName,
          manifestSource: `registry/manifests/${request.softwareName}.hub.yaml`,
          manifestName: request.softwareName,
          success: true,
          durationMs: 24,
          platform: request.effectiveRuntimePlatform ?? 'macos',
          effectiveRuntimePlatform: request.effectiveRuntimePlatform ?? 'macos',
          resolvedInstallScope: request.installScope ?? 'user',
          resolvedInstallRoot: '/Users/admin/.sdkwork/install',
          resolvedWorkRoot: '/Users/admin/.sdkwork/work',
          resolvedBinDir: '/Users/admin/.sdkwork/bin',
          resolvedDataRoot: '/Users/admin/.sdkwork/data',
          installControlLevel: 'managed',
          stageReports: [],
          artifactReports: [],
        };
        return result;
      },
      async runHubUninstall() {
        throw new Error('not implemented');
      },
      async subscribeHubInstallProgress() {
        return () => {};
      },
    },
  });

  const result = await appStoreService.installApp('app-homebrew', { hostPlatform: 'macos' });

  assert.equal(installCalls.length, 1);
  assert.equal(installCalls[0]?.softwareName, 'brew');
  assert.equal(result.softwareName, 'brew');
});

await runTest('uninstallApp delegates to the shared installer bridge', async () => {
  resetInstallerCatalogCache();
  const uninstallCalls: HubInstallRequest[] = [];

  configurePlatformBridge({
    runtime: {
      async getRuntimeInfo() {
        return {
          platform: 'desktop',
          system: {
            os: 'Ubuntu 24.04',
            arch: 'x86_64',
            family: 'unix',
            target: 'x86_64-unknown-linux-gnu',
          },
        };
      },
      async setAppLanguage() {},
      async submitProcessJob() {
        return 'job-1';
      },
      async getJob() {
        throw new Error('not implemented');
      },
      async listJobs() {
        return [];
      },
      async cancelJob() {
        throw new Error('not implemented');
      },
      async subscribeJobUpdates() {
        return () => {};
      },
      async subscribeProcessOutput() {
        return () => {};
      },
    },
    installer: {
      async listHubInstallCatalog() {
        return [
          createCatalogEntry({
            appId: 'app-pnpm',
            title: 'pnpm',
            developer: 'pnpm',
            category: 'Package Managers',
            summary: 'Rust catalog summary for pnpm.',
            description: 'Rust-backed pnpm descriptor.',
            homepage: 'https://pnpm.io/',
            tags: ['package-manager'],
            defaultVariantId: 'shared-host',
            defaultSoftwareName: 'pnpm',
            supportedHostPlatforms: ['windows', 'macos', 'ubuntu'],
            variants: [
              {
                id: 'shared-host',
                label: 'Rust host profile',
                summary: 'Install pnpm on the current host.',
                softwareName: 'pnpm',
                hostPlatforms: ['windows', 'macos', 'ubuntu'],
                runtimePlatform: 'host',
                manifestName: 'pnpm Install',
                manifestDescription: 'Install pnpm on the current host.',
                manifestHomepage: 'https://pnpm.io/',
                installationMethod: null,
                request: {
                  softwareName: 'pnpm',
                },
              },
            ],
          }),
        ];
      },
      async inspectHubInstall(request) {
        return createAssessment(request);
      },
      async runHubDependencyInstall() {
        throw new Error('not implemented');
      },
      async runHubInstall() {
        throw new Error('not implemented');
      },
      async runHubUninstall(request) {
        uninstallCalls.push(request);
        const result: HubUninstallResult = {
          registryName: 'Hub Installer Official Registry',
          registrySource: 'registry/software-registry.yaml',
          softwareName: request.softwareName,
          manifestSource: `registry/manifests/${request.softwareName}.hub.yaml`,
          manifestName: request.softwareName,
          success: true,
          durationMs: 11,
          platform: request.effectiveRuntimePlatform ?? 'ubuntu',
          effectiveRuntimePlatform: request.effectiveRuntimePlatform ?? 'ubuntu',
          resolvedInstallScope: request.installScope ?? 'user',
          resolvedInstallRoot: '/home/admin/.sdkwork/install',
          resolvedWorkRoot: '/home/admin/.sdkwork/work',
          resolvedBinDir: '/home/admin/.sdkwork/bin',
          resolvedDataRoot: '/home/admin/.sdkwork/data',
          installControlLevel: 'managed',
          purgeData: Boolean(request.purgeData),
          stageReports: [],
          targetReports: [],
        };
        return result;
      },
      async subscribeHubInstallProgress() {
        return () => {};
      },
    },
  });

  const result = await appStoreService.uninstallApp('app-pnpm', { hostPlatform: 'ubuntu' });

  assert.equal(uninstallCalls.length, 1);
  assert.equal(uninstallCalls[0]?.softwareName, 'pnpm');
  assert.equal(result.softwareName, 'pnpm');
});

await runTest('install lifecycle requests preserve caller-supplied request ids for progress correlation', async () => {
  resetInstallerCatalogCache();
  const dependencyCalls: HubInstallRequest[] = [];
  const installCalls: HubInstallRequest[] = [];
  const uninstallCalls: HubInstallRequest[] = [];

  configurePlatformBridge({
    runtime: {
      async getRuntimeInfo() {
        return {
          platform: 'desktop',
          system: {
            os: 'Ubuntu 24.04',
            arch: 'x86_64',
            family: 'unix',
            target: 'x86_64-unknown-linux-gnu',
          },
        };
      },
      async setAppLanguage() {},
      async submitProcessJob() {
        return 'job-1';
      },
      async getJob() {
        throw new Error('not implemented');
      },
      async listJobs() {
        return [];
      },
      async cancelJob() {
        throw new Error('not implemented');
      },
      async subscribeJobUpdates() {
        return () => {};
      },
      async subscribeProcessOutput() {
        return () => {};
      },
    },
    installer: {
      async listHubInstallCatalog() {
        return [
          createCatalogEntry({
            appId: 'app-pnpm',
            title: 'pnpm',
            developer: 'pnpm',
            category: 'Package Managers',
            summary: 'Rust catalog summary for pnpm.',
            description: 'Rust-backed pnpm descriptor.',
            homepage: 'https://pnpm.io/',
            tags: ['package-manager'],
            defaultVariantId: 'shared-host',
            defaultSoftwareName: 'pnpm',
            supportedHostPlatforms: ['windows', 'macos', 'ubuntu'],
            variants: [
              {
                id: 'shared-host',
                label: 'Rust host profile',
                summary: 'Install pnpm on the current host.',
                softwareName: 'pnpm',
                hostPlatforms: ['windows', 'macos', 'ubuntu'],
                runtimePlatform: 'host',
                manifestName: 'pnpm Install',
                manifestDescription: 'Install pnpm on the current host.',
                manifestHomepage: 'https://pnpm.io/',
                installationMethod: null,
                request: {
                  softwareName: 'pnpm',
                },
              },
            ],
          }),
        ];
      },
      async inspectHubInstall(request) {
        return createAssessment(request);
      },
      async runHubDependencyInstall(request) {
        dependencyCalls.push(request);
        return {
          manifestName: request.softwareName,
          manifestSource: `registry/manifests/${request.softwareName}.hub.yaml`,
          manifestSourceInput: `registry/manifests/${request.softwareName}.hub.yaml`,
          manifestSourceKind: 'registry-entry',
          registryName: 'Hub Installer Official Registry',
          registrySource: 'registry/software-registry.yaml',
          softwareName: request.softwareName,
          success: true,
          durationMs: 12,
          platform: request.effectiveRuntimePlatform ?? 'ubuntu',
          effectiveRuntimePlatform: request.effectiveRuntimePlatform ?? 'ubuntu',
          resolvedInstallScope: request.installScope ?? 'user',
          resolvedInstallRoot: '/home/admin/.sdkwork/install',
          resolvedWorkRoot: '/home/admin/.sdkwork/work',
          resolvedBinDir: '/home/admin/.sdkwork/bin',
          resolvedDataRoot: '/home/admin/.sdkwork/data',
          installControlLevel: 'managed',
          dependencyReports: [],
        };
      },
      async runHubInstall(request) {
        installCalls.push(request);
        return {
          registryName: 'Hub Installer Official Registry',
          registrySource: 'registry/software-registry.yaml',
          softwareName: request.softwareName,
          manifestSource: `registry/manifests/${request.softwareName}.hub.yaml`,
          manifestName: request.softwareName,
          success: true,
          durationMs: 24,
          platform: request.effectiveRuntimePlatform ?? 'ubuntu',
          effectiveRuntimePlatform: request.effectiveRuntimePlatform ?? 'ubuntu',
          resolvedInstallScope: request.installScope ?? 'user',
          resolvedInstallRoot: '/home/admin/.sdkwork/install',
          resolvedWorkRoot: '/home/admin/.sdkwork/work',
          resolvedBinDir: '/home/admin/.sdkwork/bin',
          resolvedDataRoot: '/home/admin/.sdkwork/data',
          installControlLevel: 'managed',
          stageReports: [],
          artifactReports: [],
        };
      },
      async runHubUninstall(request) {
        uninstallCalls.push(request);
        return {
          registryName: 'Hub Installer Official Registry',
          registrySource: 'registry/software-registry.yaml',
          softwareName: request.softwareName,
          manifestSource: `registry/manifests/${request.softwareName}.hub.yaml`,
          manifestName: request.softwareName,
          success: true,
          durationMs: 11,
          platform: request.effectiveRuntimePlatform ?? 'ubuntu',
          effectiveRuntimePlatform: request.effectiveRuntimePlatform ?? 'ubuntu',
          resolvedInstallScope: request.installScope ?? 'user',
          resolvedInstallRoot: '/home/admin/.sdkwork/install',
          resolvedWorkRoot: '/home/admin/.sdkwork/work',
          resolvedBinDir: '/home/admin/.sdkwork/bin',
          resolvedDataRoot: '/home/admin/.sdkwork/data',
          installControlLevel: 'managed',
          purgeData: Boolean(request.purgeData),
          stageReports: [],
          targetReports: [],
        };
      },
      async subscribeHubInstallProgress() {
        return () => {};
      },
    },
  });

  await appStoreService.installDependencies('app-pnpm', {
    hostPlatform: 'ubuntu',
    requestId: 'dependency-request-1',
  });
  await appStoreService.installApp('app-pnpm', {
    hostPlatform: 'ubuntu',
    requestId: 'install-request-1',
  });
  await appStoreService.uninstallApp('app-pnpm', {
    hostPlatform: 'ubuntu',
    requestId: 'uninstall-request-1',
  });

  assert.equal(dependencyCalls[0]?.requestId, 'dependency-request-1');
  assert.equal(installCalls[0]?.requestId, 'install-request-1');
  assert.equal(uninstallCalls[0]?.requestId, 'uninstall-request-1');
});
