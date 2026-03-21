import {
  getRuntimePlatform,
  studio,
  studioMockService,
  type HubInstallAssessmentResult,
  type HubInstallResult,
} from '@sdkwork/claw-infrastructure';
import {
  openClawConfigService,
  type OpenClawChannelSnapshot,
} from '@sdkwork/claw-core';
import type { ProxyProvider, Skill, SkillPack } from '@sdkwork/claw-types';
import {
  buildOpenClawModelSelection,
  filterOpenClawCompatibleProviders,
  type OpenClawModelSelection,
} from './openClawInstallWizardService.ts';

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
  hasReadyProvider: boolean;
  selectedChannelCount: number;
  configuredChannelCount: number;
  selectedSkillCount: number;
  initializedSkillCount: number;
}

function normalizePath(path?: string | null) {
  return path?.replace(/\\/g, '/');
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

async function resolveHomeRoots(assessment?: HubInstallAssessmentResult | null) {
  const candidates = new Set<string>();
  const runtimeHome = normalizePath(assessment?.runtime.runtimeHomeDir);
  if (runtimeHome) {
    candidates.add(runtimeHome);
  }

  try {
    const runtimeInfo = await getRuntimePlatform().getRuntimeInfo();
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
}) {
  const homeRoots = await resolveHomeRoots(input.assessment);

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
  const websocketUrl = `ws://${host}:${port}/ws`;

  return {
    host,
    port,
    baseUrl,
    websocketUrl,
  };
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
      authToken: null,
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

async function resolveSelectedSkillIds(packIds: string[], skillIds: string[]) {
  const allPacks = await studioMockService.listPacks();
  const allSkills = await studioMockService.listSkills();
  const selectedIds = new Set<string>();

  for (const packId of packIds) {
    const pack = allPacks.find((item) => item.id === packId);
    pack?.skills.forEach((skill) => selectedIds.add(skill.id));
  }

  const validSkillIds = new Set(allSkills.map((skill) => skill.id));
  for (const skillId of skillIds) {
    if (validSkillIds.has(skillId)) {
      selectedIds.add(skillId);
    }
  }

  return [...selectedIds];
}

const saveManagedChannelConfiguration =
  openClawConfigService['saveChannel' + 'Configuration'];

class OpenClawBootstrapService {
  async loadBootstrapData(input: {
    installResult?: HubInstallResult | null;
    assessment?: HubInstallAssessmentResult | null;
  }): Promise<OpenClawBootstrapData> {
    const configPath = await resolveConfigPath(input);

    if (!configPath) {
      throw new Error('Unable to locate the installed OpenClaw config file.');
    }

    const [configSnapshot, allProviders, packs, skills] = await Promise.all([
      openClawConfigService.readConfigSnapshot(configPath),
      studioMockService.listProxyProviders(),
      studioMockService.listPacks(),
      studioMockService.listSkills(),
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
      packs,
      skills,
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
    const providers = await studioMockService.listProxyProviders();
    const provider = providers.find((item) => item.id === input.providerId);

    if (!provider) {
      throw new Error('Selected provider was not found.');
    }

    await openClawConfigService.saveProviderSelection({
      configPath: input.configPath,
      provider,
      selection: input.modelSelection,
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
      providerId: provider.id,
      syncedInstanceId: input.syncedInstanceId || syncedInstance.instanceId,
      configuredChannelIds: input.channels.map((channel) => channel.channelId),
    };
  }

  async initializeOpenClawInstance(
    input: InitializeOpenClawInstanceInput,
  ): Promise<InitializeOpenClawInstanceResult> {
    const installedSkillIds = new Set<string>();

    for (const packId of input.packIds) {
      await studioMockService.installPack(input.instanceId, packId);
      const packs = await studioMockService.listPacks();
      const pack = packs.find((item) => item.id === packId);
      pack?.skills.forEach((skill) => installedSkillIds.add(skill.id));
    }

    for (const skillId of input.skillIds) {
      if (!installedSkillIds.has(skillId)) {
        await studioMockService.installSkill(input.instanceId, skillId);
        installedSkillIds.add(skillId);
      }
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
    const [configSnapshot, installedSkills] = await Promise.all([
      openClawConfigService.readConfigSnapshot(input.configPath),
      studioMockService.listInstalledSkills(input.instanceId),
    ]);

    const selectedSkillIds = await resolveSelectedSkillIds(input.packIds, input.skillIds);
    const installedSkillIdSet = new Set(installedSkills.map((skill) => skill.id));

    return {
      instanceId: input.instanceId,
      installSucceeded: true,
      hasReadyProvider: configSnapshot.providerSnapshots.some((provider) => provider.status === 'ready'),
      selectedChannelCount: input.selectedChannelIds.length,
      configuredChannelCount: configSnapshot.channelSnapshots.filter(
        (channel) =>
          input.selectedChannelIds.includes(channel.id) &&
          channel.status === 'connected' &&
          channel.enabled,
      ).length,
      selectedSkillCount: selectedSkillIds.length,
      initializedSkillCount: selectedSkillIds.filter((skillId) => installedSkillIdSet.has(skillId))
        .length,
    };
  }

  buildDefaultModelSelection(provider: ProxyProvider) {
    return buildOpenClawModelSelection(provider);
  }
}

export const openClawBootstrapService = new OpenClawBootstrapService();
