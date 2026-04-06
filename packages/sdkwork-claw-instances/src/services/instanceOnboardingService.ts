import {
  installerService,
  runtime,
  studio,
  type HubInstallAssessmentResult,
  type HubInstallCatalogEntry,
  type HubInstallCatalogQuery,
  type HubInstallRequest,
  type RuntimeInfo,
  type StudioCreateInstanceInput,
  type StudioInstanceRecord,
  type StudioUpdateInstanceInput,
} from '@sdkwork/claw-infrastructure';
import { openClawConfigService, type OpenClawConfigPathInput } from '@sdkwork/claw-core';

export interface OpenClawAssociationSnapshot {
  root: Record<string, unknown>;
  defaultWorkspacePath?: string | null;
}

export interface DiscoveredInstalledOpenClawInstall {
  id: string;
  label: string;
  summary: string;
  methodId: string | null;
  methodLabel: string;
  runtimePlatform: 'host' | 'wsl';
  installControlLevel: HubInstallAssessmentResult['installControlLevel'];
  installStatus: NonNullable<HubInstallAssessmentResult['installStatus']>;
  configPath: string | null;
  installRoot: string | null;
  workRoot: string | null;
  dataRoot: string | null;
  workspacePath: string | null;
  baseUrl: string | null;
  websocketUrl: string | null;
  associatedInstanceId: string | null;
  associationStatus: 'associated' | 'readyToAssociate' | 'configMissing';
}

export interface AssociateInstalledOpenClawInstallInput {
  request: HubInstallRequest;
}

export interface AssociateOpenClawConfigPathInput {
  configPath: string;
  installationMethodId?: string | null;
  installationMethodLabel?: string | null;
  installRoot?: string | null;
  workRoot?: string | null;
  dataRoot?: string | null;
}

export interface OpenClawAssociationResult {
  mode: 'created' | 'updated';
  instance: StudioInstanceRecord;
  configPath: string;
}

export interface CreateRemoteOpenClawInstanceInput {
  name: string;
  host: string;
  port: number;
  secure?: boolean;
  authToken?: string | null;
  description?: string;
}

interface InstanceOnboardingDependencies {
  runtimeApi: {
    getRuntimeInfo(): Promise<RuntimeInfo>;
  };
  installerApi: {
    listHubInstallCatalog(query?: HubInstallCatalogQuery): Promise<HubInstallCatalogEntry[]>;
    inspectHubInstall(request: HubInstallRequest): Promise<HubInstallAssessmentResult>;
  };
  studioApi: {
    listInstances(): Promise<StudioInstanceRecord[]>;
    createInstance(input: StudioCreateInstanceInput): Promise<StudioInstanceRecord>;
    updateInstance(id: string, input: StudioUpdateInstanceInput): Promise<StudioInstanceRecord>;
  };
  openClawConfigApi: {
    resolveInstallConfigPath(input: OpenClawConfigPathInput): Promise<string | null>;
    readAssociationSnapshot(configPath: string): Promise<OpenClawAssociationSnapshot>;
  };
}

export interface InstanceOnboardingDependencyOverrides {
  runtimeApi?: Partial<InstanceOnboardingDependencies['runtimeApi']>;
  installerApi?: Partial<InstanceOnboardingDependencies['installerApi']>;
  studioApi?: Partial<InstanceOnboardingDependencies['studioApi']>;
  openClawConfigApi?: Partial<InstanceOnboardingDependencies['openClawConfigApi']>;
}

function createDefaultDependencies(): InstanceOnboardingDependencies {
  return {
    runtimeApi: {
      getRuntimeInfo: () => runtime.getRuntimeInfo(),
    },
    installerApi: {
      listHubInstallCatalog: (query) => installerService.listHubInstallCatalog(query),
      inspectHubInstall: (request) => installerService.inspectHubInstall(request),
    },
    studioApi: {
      listInstances: () => studio.listInstances(),
      createInstance: (input) => studio.createInstance(input),
      updateInstance: (id, input) => studio.updateInstance(id, input),
    },
    openClawConfigApi: {
      resolveInstallConfigPath: (input) => openClawConfigService.resolveInstallConfigPath(input),
      readAssociationSnapshot: async (configPath) => {
        const snapshot = await openClawConfigService.readConfigSnapshot(configPath);
        const defaultAgent =
          snapshot.agentSnapshots.find((agent) => agent.isDefault) ||
          snapshot.agentSnapshots[0] ||
          null;

        return {
          root: snapshot.root as Record<string, unknown>,
          defaultWorkspacePath: defaultAgent?.workspace || null,
        };
      },
    },
  };
}

function normalizePath(path?: string | null) {
  return path?.replace(/\\/g, '/').trim() || null;
}

function normalizeNullableString(value?: string | null) {
  const normalized = value?.trim() || '';
  return normalized || null;
}

function readObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function readString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function parsePort(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return 28789;
}

function normalizeControlUiBasePath(value: unknown) {
  const trimmed = readString(value);
  if (!trimmed || trimmed === '/') {
    return '/';
  }

  return `/${trimmed.replace(/^\/+|\/+$/g, '')}/`;
}

function toGatewayWebsocketPath(basePath: string) {
  return basePath === '/' ? '' : basePath.replace(/\/$/, '');
}

function buildGatewayUrls(root: Record<string, unknown>) {
  const gateway = readObject(root.gateway);
  const port = parsePort(gateway?.port);
  const controlUi = readObject(gateway?.controlUi);
  const websocketPath = toGatewayWebsocketPath(
    normalizeControlUiBasePath(controlUi?.basePath),
  );

  return {
    host: '127.0.0.1',
    port,
    baseUrl: `http://127.0.0.1:${port}`,
    websocketUrl: `ws://127.0.0.1:${port}${websocketPath}`,
  };
}

function resolveSyncedOpenClawAuthToken(input: {
  root: Record<string, unknown>;
  existingAuthToken?: string | null;
}) {
  const gateway = readObject(input.root.gateway);
  const auth = readObject(gateway?.auth);
  const configuredToken = readString(auth?.token);

  if (configuredToken) {
    return configuredToken;
  }

  return normalizeNullableString(input.existingAuthToken);
}

function resolveStateRootFromConfigPath(configPath: string) {
  const normalized = normalizePath(configPath) || configPath;
  if (normalized.endsWith('/.openclaw/openclaw.json')) {
    return normalized.slice(0, -'/openclaw.json'.length);
  }
  if (normalized.endsWith('/config/openclaw.json')) {
    return normalized.slice(0, -'/config/openclaw.json'.length);
  }

  const lastSlashIndex = normalized.lastIndexOf('/');
  return lastSlashIndex >= 0 ? normalized.slice(0, lastSlashIndex) : normalized;
}

function resolveWorkspacePath(input: {
  snapshot: OpenClawAssociationSnapshot;
  workRoot?: string | null;
  dataRoot?: string | null;
  installRoot?: string | null;
  configPath: string;
}) {
  return (
    normalizePath(input.snapshot.defaultWorkspacePath) ||
    normalizePath(input.workRoot) ||
    normalizePath(input.dataRoot) ||
    normalizePath(input.installRoot) ||
    normalizePath(resolveStateRootFromConfigPath(input.configPath))
  );
}

function findMatchingLocalExternalInstance(
  instances: StudioInstanceRecord[],
  input: {
    workspacePath?: string | null;
    baseUrl?: string | null;
    websocketUrl?: string | null;
  },
) {
  const workspacePath = normalizePath(input.workspacePath);
  const baseUrl = normalizePath(input.baseUrl);
  const websocketUrl = normalizePath(input.websocketUrl);

  return (
    instances.find(
      (instance) =>
        instance.runtimeKind === 'openclaw' &&
        instance.deploymentMode === 'local-external' &&
        ((workspacePath && normalizePath(instance.config.workspacePath) === workspacePath) ||
          (baseUrl && normalizePath(instance.baseUrl) === baseUrl) ||
          (websocketUrl && normalizePath(instance.websocketUrl) === websocketUrl)),
    ) || null
  );
}

function getHostOs(runtimeInfo: RuntimeInfo) {
  const os = runtimeInfo.system?.os?.toLowerCase() ?? '';
  if (os.includes('win')) {
    return 'windows' as const;
  }
  if (os.includes('mac') || os.includes('darwin')) {
    return 'macos' as const;
  }
  if (os.includes('linux') || os.includes('ubuntu')) {
    return 'linux' as const;
  }
  return 'unknown' as const;
}

function toCatalogQuery(runtimeInfo: RuntimeInfo): HubInstallCatalogQuery | undefined {
  const hostOs = getHostOs(runtimeInfo);
  if (hostOs === 'windows' || hostOs === 'macos') {
    return { hostPlatform: hostOs };
  }
  if (hostOs === 'linux') {
    return { hostPlatform: 'ubuntu' };
  }

  return undefined;
}

function selectOpenClawCatalogEntry(entries: HubInstallCatalogEntry[]) {
  return (
    entries.find((entry) => entry.appId === 'app-openclaw') ||
    entries.find((entry) => entry.defaultSoftwareName === 'openclaw') ||
    null
  );
}

function resolveHomeRoots(runtimeInfo: RuntimeInfo, assessment: HubInstallAssessmentResult) {
  const homeRoots = new Set<string>();
  const runtimeHome = normalizePath(assessment.runtime.runtimeHomeDir);
  const userRoot = normalizePath(runtimeInfo.paths?.userRoot);
  const userDir = normalizePath(runtimeInfo.paths?.userDir);

  if (runtimeHome) {
    homeRoots.add(runtimeHome);
  }
  if (userRoot) {
    homeRoots.add(userRoot);
  }
  if (userDir) {
    homeRoots.add(userDir);
  }

  return [...homeRoots];
}

function buildLocalExternalInstanceCreateInput(input: {
  workspacePath: string | null;
  baseUrl: string;
  websocketUrl: string;
  port: number;
  authToken: string | null;
}) {
  return {
    name: 'OpenClaw Host',
    description: 'Attached OpenClaw runtime synchronized from an existing installation.',
    runtimeKind: 'openclaw' as const,
    deploymentMode: 'local-external' as const,
    transportKind: 'openclawGatewayWs' as const,
    iconType: 'server' as const,
    version: 'host-managed',
    typeLabel: 'Associated OpenClaw',
    host: '127.0.0.1',
    port: input.port,
    baseUrl: input.baseUrl,
    websocketUrl: input.websocketUrl,
    storage: {
      provider: 'localFile' as const,
      namespace: 'openclaw-local-external',
    },
    config: {
      port: String(input.port),
      sandbox: true,
      autoUpdate: false,
      logLevel: 'info',
      corsOrigins: '*',
      workspacePath: input.workspacePath,
      baseUrl: input.baseUrl,
      websocketUrl: input.websocketUrl,
      authToken: input.authToken,
    },
  } satisfies StudioCreateInstanceInput;
}

function buildLocalExternalInstanceUpdateInput(input: {
  workspacePath: string | null;
  baseUrl: string;
  websocketUrl: string;
  port: number;
  authToken: string | null;
}) {
  return {
    name: 'OpenClaw Host',
    description: 'Attached OpenClaw runtime synchronized from an existing installation.',
    iconType: 'server' as const,
    version: 'host-managed',
    typeLabel: 'Associated OpenClaw',
    host: '127.0.0.1',
    port: input.port,
    baseUrl: input.baseUrl,
    websocketUrl: input.websocketUrl,
    config: {
      port: String(input.port),
      sandbox: true,
      autoUpdate: false,
      logLevel: 'info',
      corsOrigins: '*',
      workspacePath: input.workspacePath,
      baseUrl: input.baseUrl,
      websocketUrl: input.websocketUrl,
      authToken: input.authToken,
    },
  } satisfies StudioUpdateInstanceInput;
}

class InstanceOnboardingService {
  private readonly dependencies: InstanceOnboardingDependencies;

  constructor(dependencies: InstanceOnboardingDependencies) {
    this.dependencies = dependencies;
  }

  async discoverInstalledOpenClawInstalls(): Promise<DiscoveredInstalledOpenClawInstall[]> {
    const runtimeInfo = await this.dependencies.runtimeApi.getRuntimeInfo();
    const entry = selectOpenClawCatalogEntry(
      await this.dependencies.installerApi.listHubInstallCatalog(toCatalogQuery(runtimeInfo)),
    );

    if (!entry) {
      return [];
    }

    const instances = await this.dependencies.studioApi.listInstances();
    const discovered = await Promise.all(
      entry.variants.map(async (variant): Promise<DiscoveredInstalledOpenClawInstall | null> => {
        let assessment: HubInstallAssessmentResult;
        try {
          assessment = await this.dependencies.installerApi.inspectHubInstall(variant.request);
        } catch {
          return null;
        }

        if (assessment.installStatus !== 'installed') {
          return null;
        }

        const configPath = await this.dependencies.openClawConfigApi.resolveInstallConfigPath({
          installRoot: assessment.resolvedInstallRoot,
          workRoot: assessment.resolvedWorkRoot,
          dataRoot: assessment.resolvedDataRoot,
          homeRoots: resolveHomeRoots(runtimeInfo, assessment),
        });

        if (!configPath) {
          return {
            id: variant.id,
            label: variant.label,
            summary: variant.summary,
            methodId: assessment.installation?.method.id ?? null,
            methodLabel: assessment.installation?.method.label || variant.label,
            runtimePlatform: variant.runtimePlatform,
            installControlLevel: assessment.installControlLevel,
            installStatus: 'installed' as const,
            configPath: null,
            installRoot: normalizePath(assessment.resolvedInstallRoot),
            workRoot: normalizePath(assessment.resolvedWorkRoot),
            dataRoot: normalizePath(assessment.resolvedDataRoot),
            workspacePath: null,
            baseUrl: null,
            websocketUrl: null,
            associatedInstanceId: null,
            associationStatus: 'configMissing' as const,
          };
        }

        const snapshot = await this.dependencies.openClawConfigApi.readAssociationSnapshot(configPath);
        const gateway = buildGatewayUrls(snapshot.root);
        const workspacePath = resolveWorkspacePath({
          snapshot,
          workRoot: assessment.resolvedWorkRoot,
          dataRoot: assessment.resolvedDataRoot,
          installRoot: assessment.resolvedInstallRoot,
          configPath,
        });
        const existing = findMatchingLocalExternalInstance(instances, {
          workspacePath,
          baseUrl: gateway.baseUrl,
          websocketUrl: gateway.websocketUrl,
        });

        return {
          id: variant.id,
          label: variant.label,
          summary: variant.summary,
          methodId: assessment.installation?.method.id ?? null,
          methodLabel: assessment.installation?.method.label || variant.label,
          runtimePlatform: variant.runtimePlatform,
          installControlLevel: assessment.installControlLevel,
          installStatus: 'installed' as const,
          configPath: normalizePath(configPath),
          installRoot: normalizePath(assessment.resolvedInstallRoot),
          workRoot: normalizePath(assessment.resolvedWorkRoot),
          dataRoot: normalizePath(assessment.resolvedDataRoot),
          workspacePath,
          baseUrl: gateway.baseUrl,
          websocketUrl: gateway.websocketUrl,
          associatedInstanceId: existing?.id ?? null,
          associationStatus: existing ? ('associated' as const) : ('readyToAssociate' as const),
        };
      }),
    );

    return discovered.filter((item): item is DiscoveredInstalledOpenClawInstall => Boolean(item));
  }

  async associateInstalledOpenClawInstall(
    input: AssociateInstalledOpenClawInstallInput,
  ): Promise<OpenClawAssociationResult> {
    const runtimeInfo = await this.dependencies.runtimeApi.getRuntimeInfo();
    const assessment = await this.dependencies.installerApi.inspectHubInstall(input.request);
    const configPath = await this.dependencies.openClawConfigApi.resolveInstallConfigPath({
      installRoot: assessment.resolvedInstallRoot,
      workRoot: assessment.resolvedWorkRoot,
      dataRoot: assessment.resolvedDataRoot,
      homeRoots: resolveHomeRoots(runtimeInfo, assessment),
    });

    if (!configPath) {
      throw new Error('Unable to locate the installed OpenClaw config file.');
    }

    return this.associateOpenClawConfigPath({
      configPath,
      installationMethodId: assessment.installation?.method.id ?? null,
      installationMethodLabel: assessment.installation?.method.label ?? null,
      installRoot: assessment.resolvedInstallRoot,
      workRoot: assessment.resolvedWorkRoot,
      dataRoot: assessment.resolvedDataRoot,
    });
  }

  async associateOpenClawConfigPath(
    input: AssociateOpenClawConfigPathInput,
  ): Promise<OpenClawAssociationResult> {
    const configPath = normalizePath(input.configPath);
    if (!configPath) {
      throw new Error('OpenClaw config path is required.');
    }

    const snapshot = await this.dependencies.openClawConfigApi.readAssociationSnapshot(configPath);
    const gateway = buildGatewayUrls(snapshot.root);
    const workspacePath = resolveWorkspacePath({
      snapshot,
      workRoot: input.workRoot,
      dataRoot: input.dataRoot,
      installRoot: input.installRoot,
      configPath,
    });
    const instances = await this.dependencies.studioApi.listInstances();
    const existing = findMatchingLocalExternalInstance(instances, {
      workspacePath,
      baseUrl: gateway.baseUrl,
      websocketUrl: gateway.websocketUrl,
    });
    const authToken = resolveSyncedOpenClawAuthToken({
      root: snapshot.root,
      existingAuthToken: existing?.config.authToken ?? null,
    });

    if (existing) {
      const updated = await this.dependencies.studioApi.updateInstance(
        existing.id,
        buildLocalExternalInstanceUpdateInput({
          workspacePath,
          baseUrl: gateway.baseUrl,
          websocketUrl: gateway.websocketUrl,
          port: gateway.port,
          authToken,
        }),
      );

      return {
        mode: 'updated',
        instance: updated,
        configPath,
      };
    }

    const created = await this.dependencies.studioApi.createInstance(
      buildLocalExternalInstanceCreateInput({
        workspacePath,
        baseUrl: gateway.baseUrl,
        websocketUrl: gateway.websocketUrl,
        port: gateway.port,
        authToken,
      }),
    );

    return {
      mode: 'created',
      instance: created,
      configPath,
    };
  }

  async createRemoteOpenClawInstance(input: CreateRemoteOpenClawInstanceInput) {
    const normalizedName = input.name.trim();
    const normalizedHost = input.host.trim();

    if (!normalizedName) {
      throw new Error('Instance name is required.');
    }
    if (!normalizedHost) {
      throw new Error('Remote host is required.');
    }
    if (!Number.isFinite(input.port) || input.port <= 0) {
      throw new Error('A valid remote port is required.');
    }

    const scheme = input.secure ? 'https' : 'http';
    const websocketScheme = input.secure ? 'wss' : 'ws';
    const baseUrl = `${scheme}://${normalizedHost}:${input.port}`;
    const websocketUrl = `${websocketScheme}://${normalizedHost}:${input.port}`;

    return this.dependencies.studioApi.createInstance({
      name: normalizedName,
      description: input.description?.trim() || undefined,
      runtimeKind: 'openclaw',
      deploymentMode: 'remote',
      transportKind: 'openclawGatewayWs',
      iconType: 'server',
      version: 'remote',
      typeLabel: 'Remote OpenClaw Gateway',
      host: normalizedHost,
      port: input.port,
      baseUrl,
      websocketUrl,
      storage: {
        provider: 'localFile',
        namespace: 'openclaw-remote',
      },
      config: {
        port: String(input.port),
        sandbox: true,
        autoUpdate: false,
        logLevel: 'info',
        corsOrigins: '*',
        workspacePath: null,
        baseUrl,
        websocketUrl,
        authToken: normalizeNullableString(input.authToken),
      },
    });
  }
}

export function createInstanceOnboardingService(
  overrides: InstanceOnboardingDependencyOverrides = {},
) {
  const defaults = createDefaultDependencies();

  return new InstanceOnboardingService({
    runtimeApi: {
      ...defaults.runtimeApi,
      ...(overrides.runtimeApi || {}),
    },
    installerApi: {
      ...defaults.installerApi,
      ...(overrides.installerApi || {}),
    },
    studioApi: {
      ...defaults.studioApi,
      ...(overrides.studioApi || {}),
    },
    openClawConfigApi: {
      ...defaults.openClawConfigApi,
      ...(overrides.openClawConfigApi || {}),
    },
  });
}

export const instanceOnboardingService = createInstanceOnboardingService();
