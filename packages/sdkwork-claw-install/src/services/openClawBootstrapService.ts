import {
  openClawGatewayClient,
  runtime,
  studio,
  type HubInstallAssessmentResult,
  type HubInstallResult,
  type OpenClawGatewayValidationStatus,
  type OpenClawSkillsStatusResult,
  type RuntimeDesktopKernelInfo,
} from '@sdkwork/claw-infrastructure';
import {
  createOpenClawLocalProxyProjection,
  kernelPlatformService,
  OPENCLAW_LOCAL_PROXY_DEFAULT_API_KEY,
  openClawConfigService,
  providerRoutingCatalogService,
  resolveOpenClawLocalProxyBaseUrl,
  type ProviderRoutingRecord,
  type OpenClawChannelSnapshot,
} from '@sdkwork/claw-core';
import type { ProxyProvider, Skill, SkillPack } from '@sdkwork/claw-types';
import {
  buildOpenClawModelSelection,
  filterOpenClawCompatibleProviders,
  type OpenClawModelSelection,
} from './openClawInstallWizardService.ts';
import { resolveSyncedOpenClawAuthToken } from './openClawGatewayAuth.ts';

export interface OpenClawBootstrapData {
  configPath: string;
  syncedInstanceId: string;
  providers: ProxyProvider[];
  channels: OpenClawChannelSnapshot[];
  packs: SkillPack[];
  skills: Skill[];
  installRoot?: string;
  workRoot?: string;
  dataRoot?: string;
  baseUrl?: string;
  websocketUrl?: string;
}

export interface OpenClawChannelConfigurationInput {
  channelId: string;
  values: Record<string, string>;
}

export interface ApplyOpenClawConfigurationInput {
  configPath: string;
  syncedInstanceId: string;
  providerId: string;
  modelSelection: OpenClawModelSelection;
  channels: OpenClawChannelConfigurationInput[];
  disabledChannelIds?: string[];
  installResult?: HubInstallResult | null;
  assessment?: HubInstallAssessmentResult | null;
}

export interface ApplyOpenClawConfigurationResult {
  configPath: string;
  providerId: string;
  syncedInstanceId: string;
  configuredChannelIds: string[];
}

export interface InitializeOpenClawInstanceInput {
  instanceId: string;
  packIds: string[];
  skillIds: string[];
}

export interface InitializeOpenClawInstanceResult {
  instanceId: string;
  installedPackIds: string[];
  installedSkillIds: string[];
}

export interface OpenClawVerificationSnapshot {
  instanceId: string;
  installSucceeded: boolean;
  gatewayReachable: boolean;
  gatewayStatus: OpenClawGatewayValidationStatus;
  hasReadyProvider: boolean;
  selectedChannelCount: number;
  configuredChannelCount: number;
  selectedSkillCount: number;
  initializedSkillCount: number;
}

function normalizePath(path?: string | null) {
  return path?.replace(/\\/g, '/');
}

function buildBootstrapProviderStatus(route: ProviderRoutingRecord): ProxyProvider['status'] {
  if (!route.enabled) {
    return 'disabled';
  }

  return route.apiKey || route.managedBy === 'system-default' ? 'active' : 'warning';
}

function projectProviderRouteForOpenClawBootstrap(
  route: ProviderRoutingRecord,
  kernelInfo: RuntimeDesktopKernelInfo | null,
): ProxyProvider {
  const proxyBaseUrl = resolveOpenClawLocalProxyBaseUrl(kernelInfo, route.clientProtocol);

  return {
    id: route.id,
    channelId: route.providerId,
    name: route.name,
    apiKey: proxyBaseUrl ? OPENCLAW_LOCAL_PROXY_DEFAULT_API_KEY : route.apiKey,
    groupId: 'provider-config-center',
    usage: {
      requestCount: 0,
      tokenCount: 0,
      spendUsd: 0,
      period: '30d',
    },
    expiresAt: null,
    status: buildBootstrapProviderStatus(route),
    createdAt:
      typeof route.createdAt === 'number' ? new Date(route.createdAt).toISOString() : null,
    baseUrl: proxyBaseUrl || route.upstreamBaseUrl,
    models: route.models.map((model) => ({
      id: model.id,
      name: model.name,
    })),
    notes: proxyBaseUrl
      ? `Managed local proxy projection for route "${route.name}".`
      : route.notes,
    credentialReference: proxyBaseUrl ? 'local-ai-proxy' : 'provider-config-center',
    canCopyApiKey: false,
    clientProtocol: route.clientProtocol,
    upstreamProtocol: route.upstreamProtocol,
    managedBy: route.managedBy,
    enabled: route.enabled,
    isDefault: route.isDefault,
    defaultModelId: route.defaultModelId,
  };
}

async function listConfiguredProviders(kernelInfo?: RuntimeDesktopKernelInfo | null) {
  const routes = await providerRoutingCatalogService.listProviderRoutingRecords();

  const resolvedKernelInfo = kernelInfo ?? await (async () => {
    await kernelPlatformService.ensureRunning().catch(() => null);
    return kernelPlatformService.getInfo().catch(() => null);
  })();

  return routes.map((route) => projectProviderRouteForOpenClawBootstrap(route, resolvedKernelInfo));
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

function readGatewayPort(root: Record<string, unknown>) {
  const gateway =
    root.gateway && typeof root.gateway === 'object' && !Array.isArray(root.gateway)
      ? (root.gateway as Record<string, unknown>)
      : null;

  return parsePort(gateway?.port);
}

async function resolveHomeRoots(
  assessment?: HubInstallAssessmentResult | null,
  kernelInfo?: RuntimeDesktopKernelInfo | null,
) {
  const candidates = new Set<string>();
  const runtimeHome = normalizePath(assessment?.runtime.runtimeHomeDir);
  if (runtimeHome) {
    candidates.add(runtimeHome);
  }
  const kernelRuntimeHome = normalizePath(kernelInfo?.openClawRuntime?.homeDir);
  const kernelUserRoot = normalizePath(kernelInfo?.directories?.userRoot);
  if (kernelRuntimeHome) {
    candidates.add(kernelRuntimeHome);
  }
  if (kernelUserRoot) {
    candidates.add(kernelUserRoot);
  }

  try {
    const runtimeInfo = await runtime.getRuntimeInfo();
    const userRoot = normalizePath(runtimeInfo.paths?.userRoot);
    const userDir = normalizePath(runtimeInfo.paths?.userDir);

    if (userRoot) {
      candidates.add(userRoot);
    }
    if (userDir) {
      candidates.add(userDir);
    }
  } catch {
    // Ignore runtime info lookup failures and fall back to assessment roots.
  }

  return [...candidates];
}

async function resolveConfigPath(input: {
  installResult?: HubInstallResult | null;
  assessment?: HubInstallAssessmentResult | null;
  kernelInfo?: RuntimeDesktopKernelInfo | null;
}) {
  const homeRoots = await resolveHomeRoots(input.assessment, input.kernelInfo);

  return openClawConfigService.resolveInstallConfigPath({
    installRoot: input.installResult?.resolvedInstallRoot || input.assessment?.resolvedInstallRoot,
    workRoot: input.installResult?.resolvedWorkRoot || input.assessment?.resolvedWorkRoot,
    dataRoot: input.installResult?.resolvedDataRoot || input.assessment?.resolvedDataRoot,
    homeRoots,
  });
}

function buildGatewayUrls(root: Record<string, unknown>) {
  const port = readGatewayPort(root);
  const host = '127.0.0.1';
  const baseUrl = `http://${host}:${port}`;
  const websocketUrl = `ws://${host}:${port}`;

  return {
    host,
    port,
    baseUrl,
    websocketUrl,
  };
}

type ClawHubCatalogService = {
  listPackages: () => Promise<SkillPack[]>;
  listSkills: () => Promise<Skill[]>;
};

async function resolveClawHubCatalogService(): Promise<ClawHubCatalogService | null> {
  const module = await import('@sdkwork/claw-core');
  const service = 'clawHubService' in module ? module.clawHubService : null;
  if (
    service
    && typeof service.listPackages === 'function'
    && typeof service.listSkills === 'function'
  ) {
    return service;
  }

  return null;
}

async function loadClawHubCatalogSnapshot(): Promise<{
  packs: SkillPack[];
  skills: Skill[];
}> {
  try {
    const service = await resolveClawHubCatalogService();
    if (!service) {
      return {
        packs: [],
        skills: [],
      };
    }

    const [packs, skills] = await Promise.all([
      service.listPackages().catch(() => []),
      service.listSkills().catch(() => []),
    ]);

    return {
      packs,
      skills,
    };
  } catch {
    // Keep bootstrap usable when ClawHub's shared SDK surface is unavailable in node-safe tests.
    return {
      packs: [],
      skills: [],
    };
  }
}

async function syncLocalExternalInstance(input: {
  configPath: string;
  root: Record<string, unknown>;
  installResult?: HubInstallResult | null;
  assessment?: HubInstallAssessmentResult | null;
}) {
  const workRoot = normalizePath(input.installResult?.resolvedWorkRoot || input.assessment?.resolvedWorkRoot);
  const installRoot = normalizePath(
    input.installResult?.resolvedInstallRoot || input.assessment?.resolvedInstallRoot,
  );
  const dataRoot = normalizePath(input.installResult?.resolvedDataRoot || input.assessment?.resolvedDataRoot);
  const { host, port, baseUrl, websocketUrl } = buildGatewayUrls(input.root);
  const instances = await studio.listInstances();
  const existing = instances.find(
    (instance) =>
      instance.runtimeKind === 'openclaw' &&
      instance.deploymentMode === 'local-external' &&
      (normalizePath(instance.config.workspacePath) === workRoot ||
        normalizePath(instance.baseUrl) === baseUrl ||
        normalizePath(instance.websocketUrl) === websocketUrl),
  );
  const authToken = resolveSyncedOpenClawAuthToken({
    root: input.root,
    existingAuthToken: existing?.config.authToken ?? null,
  });

  const nextInput = {
    name: 'OpenClaw Host',
    description: 'Host-managed OpenClaw runtime synchronized from guided install.',
    runtimeKind: 'openclaw' as const,
    deploymentMode: 'local-external' as const,
    transportKind: 'openclawGatewayWs' as const,
    iconType: 'server' as const,
    version: 'host-managed',
    typeLabel: 'Host Managed OpenClaw',
    host,
    port,
    baseUrl,
    websocketUrl,
    storage: {
      provider: 'localFile' as const,
      namespace: 'openclaw-local-external',
    },
    config: {
      port: String(port),
      sandbox: true,
      autoUpdate: false,
      logLevel: 'info',
      corsOrigins: '*',
      workspacePath: workRoot ?? dataRoot ?? installRoot ?? null,
      baseUrl,
      websocketUrl,
      authToken,
    },
  };

  if (existing) {
    const updated = await studio.updateInstance(existing.id, nextInput);
    return {
      instanceId: updated.id,
      installRoot,
      workRoot,
      dataRoot,
      baseUrl,
      websocketUrl,
    };
  }

  const created = await studio.createInstance(nextInput);
  return {
    instanceId: created.id,
    installRoot,
    workRoot,
    dataRoot,
    baseUrl,
    websocketUrl,
  };
}

async function resolveSelectedSkills(packIds: string[], skillIds: string[]) {
  const {
    packs: allPacks,
    skills: allSkills,
  } = await loadClawHubCatalogSnapshot();
  const selectedSkills = new Map<string, Skill>();

  for (const packId of packIds) {
    const pack = allPacks.find((item) => item.id === packId);
    pack?.skills.forEach((skill) => {
      const key = skill.skillKey?.trim() || skill.id;
      if (key) {
        selectedSkills.set(key, skill);
      }
    });
  }

  const validSkillsById = new Map(
    allSkills.map((skill) => [skill.id, skill] as const),
  );
  for (const skillId of skillIds) {
    const skill = validSkillsById.get(skillId);
    const key = skill?.skillKey?.trim() || skill?.id;
    if (skill && key) {
      selectedSkills.set(key, skill);
    }
  }

  return [...selectedSkills.values()];
}

function getSelectedSkillSlug(skill: Skill) {
  return skill.skillKey?.trim() || skill.id.trim();
}

function isSelectedSkillInitialized(skill: Skill, initializedSkills: Array<Record<string, unknown>>) {
  const selectedSkillId = skill.id.trim();
  const selectedSkillKey = skill.skillKey?.trim();

  return initializedSkills.some((entry) => {
    const entryId = typeof entry.id === 'string' ? entry.id.trim() : '';
    const entrySkillKey = typeof entry.skillKey === 'string' ? entry.skillKey.trim() : '';
    return (
      (selectedSkillKey && entrySkillKey === selectedSkillKey) ||
      entryId === selectedSkillId
    );
  });
}

const saveManagedChannelConfiguration = (
  input: Parameters<typeof openClawConfigService.saveChannelConfiguration>[0],
) => openClawConfigService.saveChannelConfiguration(input);

class OpenClawBootstrapService {
  async loadBootstrapData(input: {
    installResult?: HubInstallResult | null;
    assessment?: HubInstallAssessmentResult | null;
  }): Promise<OpenClawBootstrapData> {
    await kernelPlatformService.ensureRunning().catch(() => null);
    const kernelInfo = await kernelPlatformService.getInfo().catch(() => null);
    const configPath = await resolveConfigPath({
      ...input,
      kernelInfo,
    });

    if (!configPath) {
      throw new Error('Unable to locate the installed OpenClaw config file.');
    }

    const [configSnapshot, allProviders, catalog] = await Promise.all([
      openClawConfigService.readConfigSnapshot(configPath),
      listConfiguredProviders(kernelInfo),
      loadClawHubCatalogSnapshot(),
    ]);
    const syncedInstance = await syncLocalExternalInstance({
      configPath,
      root: configSnapshot.root,
      installResult: input.installResult,
      assessment: input.assessment,
    });

    return {
      configPath,
      syncedInstanceId: syncedInstance.instanceId,
      providers: filterOpenClawCompatibleProviders(allProviders),
      channels: configSnapshot.channelSnapshots,
      packs: catalog.packs,
      skills: catalog.skills,
      installRoot: syncedInstance.installRoot,
      workRoot: syncedInstance.workRoot,
      dataRoot: syncedInstance.dataRoot,
      baseUrl: syncedInstance.baseUrl,
      websocketUrl: syncedInstance.websocketUrl,
    };
  }

  async applyConfiguration(
    input: ApplyOpenClawConfigurationInput,
  ): Promise<ApplyOpenClawConfigurationResult> {
    const routes = await providerRoutingCatalogService.listProviderRoutingRecords();
    const route = routes.find((item) => item.id === input.providerId);

    if (!route) {
      throw new Error('Selected provider route was not found.');
    }

    await kernelPlatformService.ensureRunning();
    const kernelInfo = await kernelPlatformService.getInfo();
    const proxyBaseUrl = resolveOpenClawLocalProxyBaseUrl(kernelInfo, route.clientProtocol);
    if (!proxyBaseUrl) {
      throw new Error('The local AI proxy is not available for OpenClaw bootstrap apply.');
    }

    const projection = createOpenClawLocalProxyProjection({
      routes: [route],
      preferredClientProtocol: route.clientProtocol,
      proxyBaseUrl,
      proxyApiKey: OPENCLAW_LOCAL_PROXY_DEFAULT_API_KEY,
      runtimeConfig: route.config,
      selectionOverride: input.modelSelection,
    });

    await openClawConfigService.saveManagedLocalProxyProjection({
      configPath: input.configPath,
      projection,
    });

    for (const channel of input.channels) {
      await saveManagedChannelConfiguration({
        configPath: input.configPath,
        channelId: channel.channelId,
        values: channel.values,
        enabled: true,
      });
    }

    for (const channelId of input.disabledChannelIds || []) {
      await openClawConfigService.setChannelEnabled({
        configPath: input.configPath,
        channelId,
        enabled: false,
      });
    }

    const configSnapshot = await openClawConfigService.readConfigSnapshot(input.configPath);
    const syncedInstance = await syncLocalExternalInstance({
      configPath: input.configPath,
      root: configSnapshot.root,
      installResult: input.installResult,
      assessment: input.assessment,
    });

    return {
      configPath: input.configPath,
      providerId: route.id,
      syncedInstanceId: input.syncedInstanceId || syncedInstance.instanceId,
      configuredChannelIds: input.channels.map((channel) => channel.channelId),
    };
  }

  async initializeOpenClawInstance(
    input: InitializeOpenClawInstanceInput,
  ): Promise<InitializeOpenClawInstanceResult> {
    const selectedSkills = await resolveSelectedSkills(input.packIds, input.skillIds);
    const installedSkillIds = new Set<string>();

    for (const skill of selectedSkills) {
      const slug = getSelectedSkillSlug(skill);
      if (installedSkillIds.has(skill.id) || !slug) {
        continue;
      }

      const result = await openClawGatewayClient.installSkill(input.instanceId, {
        source: 'clawhub',
        slug,
      });
      if (result.ok === false) {
        throw new Error(
          typeof result.error === 'string'
            ? result.error
            : `Failed to install OpenClaw skill "${skill.name}".`,
        );
      }

      installedSkillIds.add(skill.id);
    }

    return {
      instanceId: input.instanceId,
      installedPackIds: [...input.packIds],
      installedSkillIds: [...installedSkillIds],
    };
  }

  async loadVerificationSnapshot(input: {
    instanceId: string;
    configPath: string;
    selectedChannelIds: string[];
    packIds: string[];
    skillIds: string[];
  }): Promise<OpenClawVerificationSnapshot> {
    const [configSnapshot, installedSkillsStatus, gatewayValidation] = await Promise.all([
      openClawConfigService.readConfigSnapshot(input.configPath),
      openClawGatewayClient
        .getSkillsStatus(input.instanceId, {})
        .catch((): OpenClawSkillsStatusResult => ({ skills: [] })),
      openClawGatewayClient.validateAccess(input.instanceId).catch(() => ({
        status: 'unreachable' as const,
        message: 'Unable to reach the OpenClaw Gateway.',
        endpoint: null,
      })),
    ]);

    const selectedSkills = await resolveSelectedSkills(input.packIds, input.skillIds);
    const installedSkills = (installedSkillsStatus.skills || installedSkillsStatus.entries || [])
      .filter((entry): entry is Record<string, unknown> => Boolean(entry));

    return {
      instanceId: input.instanceId,
      installSucceeded: true,
      gatewayReachable: gatewayValidation.status === 'ok',
      gatewayStatus: gatewayValidation.status,
      hasReadyProvider: configSnapshot.providerSnapshots.some((provider) => provider.status === 'ready'),
      selectedChannelCount: input.selectedChannelIds.length,
      configuredChannelCount: configSnapshot.channelSnapshots.filter(
        (channel) =>
          input.selectedChannelIds.includes(channel.id) &&
          channel.status === 'connected' &&
          channel.enabled,
      ).length,
      selectedSkillCount: selectedSkills.length,
      initializedSkillCount: selectedSkills.filter((skill) =>
        isSelectedSkillInitialized(skill, installedSkills),
      ).length,
    };
  }

  buildDefaultModelSelection(provider: ProxyProvider) {
    return buildOpenClawModelSelection(provider);
  }
}

export const openClawBootstrapService = new OpenClawBootstrapService();
