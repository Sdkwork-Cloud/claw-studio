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
import { appStoreService } from './appStoreService.ts';
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

function resetInstallerCatalogCache() {
  (appStoreService as any).installCatalogCache?.clear?.();
}

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
      async installApiRouterClientSetup() {
        throw new Error('not implemented');
      },
    },
  });

  const catalog = await appStoreService.getInstallCatalog();

  assert.equal(catalog.length, 1);
  assert.equal(catalog[0]?.summary, 'Rust catalog summary from installer bridge.');
  assert.equal(catalog[0]?.variants[0]?.label, 'Rust WSL profile');
});

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
      async installApiRouterClientSetup() {
        throw new Error('not implemented');
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
      async installApiRouterClientSetup() {
        throw new Error('not implemented');
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
      async installApiRouterClientSetup() {
        throw new Error('not implemented');
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

await runTest('getList merges install metadata from the Rust catalog into seeded app content', async () => {
  resetInstallerCatalogCache();
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
      async installApiRouterClientSetup() {
        throw new Error('not implemented');
      },
    },
  });

  const result = await appStoreService.getList({ keyword: 'node', page: 1, pageSize: 10 });

  assert.equal(result.total, 2);
  assert.equal(result.items[0]?.id, 'app-nodejs');
  assert.equal(result.items[1]?.id, 'app-pnpm');
  assert.equal(result.items[0]?.installSummary, 'Rust catalog summary for Node.js.');
  assert.equal(result.items[0]?.defaultSoftwareName, 'nodejs-rust');
});

await runTest('inspectInstall delegates to the shared installer bridge with the resolved request', async () => {
  resetInstallerCatalogCache();
  const inspectCalls: HubInstallRequest[] = [];
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
      async installApiRouterClientSetup() {
        throw new Error('not implemented');
      },
    },
  });

  const result = await appStoreService.inspectInstall('app-openclaw');

  assert.equal(inspectCalls.length, 1);
  assert.equal(inspectCalls[0]?.softwareName, 'openclaw-wsl');
  assert.equal(inspectCalls[0]?.effectiveRuntimePlatform, 'wsl');
  assert.equal(result.target.softwareName, 'openclaw-wsl');
  assert.equal(result.assessment.softwareName, 'openclaw-wsl');
});

await runTest('inspectInstall preserves persistent install status from the Rust assessment bridge', async () => {
  resetInstallerCatalogCache();

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
      async installApiRouterClientSetup() {
        throw new Error('not implemented');
      },
    },
  });

  const result = await appStoreService.inspectInstall('app-openclaw');

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
      async installApiRouterClientSetup() {
        throw new Error('not implemented');
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
      async installApiRouterClientSetup() {
        throw new Error('not implemented');
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
      async installApiRouterClientSetup() {
        throw new Error('not implemented');
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
      async installApiRouterClientSetup() {
        throw new Error('not implemented');
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
      async installApiRouterClientSetup() {
        throw new Error('not implemented');
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
