import { openClawConfigService } from '@sdkwork/claw-core';
import {
  openClawGatewayClient,
  type OpenClawSkillsStatusResult,
  type OpenClawSkillStatusEntry as OpenClawSkillStatusRecord,
  type OpenClawToolCatalogEntry,
  type OpenClawToolsCatalogResult,
} from '@sdkwork/claw-infrastructure';
import type { Skill } from '@sdkwork/claw-types';
import type {
  InstanceWorkbenchAgent,
  InstanceWorkbenchChannel,
  InstanceWorkbenchFile,
  InstanceWorkbenchLLMProvider,
  InstanceWorkbenchSnapshot,
  InstanceWorkbenchTask,
  InstanceWorkbenchTool,
} from '../types/index.ts';
import {
  getArrayValue,
  getObjectValue,
  getStringValue,
  parseOpenClawAgentFileId,
  titleCaseIdentifier,
} from './openClawSupport.ts';

type ManagedOpenClawConfigSnapshot = Awaited<
  ReturnType<typeof openClawConfigService.readConfigSnapshot>
>;

export type AgentWorkbenchChannelRouteStatus = 'bound' | 'available' | 'notConfigured';

export interface AgentWorkbenchModelSelection {
  primary?: string;
  fallbacks: string[];
  source: 'agent' | 'defaults' | 'runtime';
}

export interface AgentWorkbenchPaths {
  workspacePath: string | null;
  skillsDirectoryPath: string | null;
  agentDirPath: string | null;
  authProfilesPath: string | null;
  modelsRegistryPath: string | null;
  sessionsPath: string | null;
}

export interface AgentWorkbenchChannel extends InstanceWorkbenchChannel {
  routeStatus: AgentWorkbenchChannelRouteStatus;
  accountIds: string[];
  availableAccountIds: string[];
}

export interface AgentWorkbenchSkillInstallOption {
  id: string;
  kind: string;
  label: string;
  bins: string[];
}

export interface AgentWorkbenchSkillMissingRequirements {
  bins: string[];
  anyBins: string[];
  env: string[];
  config: string[];
}

export type AgentWorkbenchSkillScope =
  | 'workspace'
  | 'managed'
  | 'bundled'
  | 'unknown';

export interface AgentWorkbenchSkill extends Skill {
  skillKey: string;
  source: string;
  scope: AgentWorkbenchSkillScope;
  bundled: boolean;
  eligible: boolean;
  disabled: boolean;
  blockedByAllowlist: boolean;
  primaryEnv?: string;
  homepage?: string;
  filePath?: string;
  baseDir?: string;
  installOptions: AgentWorkbenchSkillInstallOption[];
  missing: AgentWorkbenchSkillMissingRequirements;
}

export interface AgentWorkbenchSnapshot {
  agent: InstanceWorkbenchAgent;
  model: AgentWorkbenchModelSelection;
  paths: AgentWorkbenchPaths;
  tasks: InstanceWorkbenchTask[];
  files: InstanceWorkbenchFile[];
  skills: AgentWorkbenchSkill[];
  tools: InstanceWorkbenchTool[];
  modelProviders: InstanceWorkbenchLLMProvider[];
  channels: AgentWorkbenchChannel[];
}

export interface AgentWorkbenchRequest {
  instanceId: string;
  workbench: InstanceWorkbenchSnapshot;
  agentId: string;
}

interface AgentWorkbenchServiceDependencies {
  readOpenClawConfigSnapshot: (configPath: string) => Promise<ManagedOpenClawConfigSnapshot>;
  openClawGatewayClient: {
    getSkillsStatus: (
      instanceId: string,
      args?: Record<string, unknown>,
    ) => Promise<OpenClawSkillsStatusResult>;
    getToolsCatalog: (
      instanceId: string,
      args?: Record<string, unknown>,
    ) => Promise<OpenClawToolsCatalogResult>;
  };
}

export interface AgentWorkbenchServiceDependencyOverrides {
  readOpenClawConfigSnapshot?: AgentWorkbenchServiceDependencies['readOpenClawConfigSnapshot'];
  openClawGatewayClient?: Partial<AgentWorkbenchServiceDependencies['openClawGatewayClient']>;
}

export interface AgentWorkbenchService {
  getAgentWorkbench(input: AgentWorkbenchRequest): Promise<AgentWorkbenchSnapshot>;
}

function normalizePath(path?: string | null) {
  const trimmed = path?.trim();
  return trimmed ? trimmed.replace(/\\/g, '/') : null;
}

function joinPath(root?: string | null, ...segments: string[]) {
  const normalizedRoot = normalizePath(root);
  if (!normalizedRoot) {
    return null;
  }

  return [normalizedRoot.replace(/\/+$/g, ''), ...segments].join('/');
}

function getParentDirectory(path?: string | null) {
  const normalized = normalizePath(path)?.replace(/\/+$/g, '');
  if (!normalized) {
    return null;
  }

  const lastSlashIndex = normalized.lastIndexOf('/');
  if (lastSlashIndex <= 0) {
    return normalized;
  }

  return normalized.slice(0, lastSlashIndex);
}

function toUniqueStringList(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      values
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  );
}

function readModelSelection(value: unknown) {
  if (typeof value === 'string' && value.trim()) {
    return {
      primary: value.trim(),
      fallbacks: [] as string[],
    };
  }

  const objectValue = value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  const primary = getStringValue(objectValue, ['primary']);
  const fallbacks = getArrayValue(objectValue, ['fallbacks']) || [];

  return {
    primary: primary || undefined,
    fallbacks: toUniqueStringList(
      fallbacks.map((entry) => (typeof entry === 'string' ? entry : null)),
    ),
  };
}

function hasModelSelection(selection: { primary?: string; fallbacks: string[] }) {
  return Boolean(selection.primary || selection.fallbacks.length > 0);
}

function resolveDefaultAgentId(
  configSnapshot: ManagedOpenClawConfigSnapshot | null,
  workbench: InstanceWorkbenchSnapshot,
) {
  const agentSnapshots = Array.isArray(configSnapshot?.agentSnapshots)
    ? configSnapshot.agentSnapshots
    : [];
  const snapshotDefaultAgentId = agentSnapshots.find((agent) => agent.isDefault)?.id;
  if (snapshotDefaultAgentId) {
    return snapshotDefaultAgentId;
  }

  const rootAgentEntries = getArrayValue(configSnapshot?.root, ['agents', 'list']) || [];
  const rootDefaultAgentId = rootAgentEntries.find(
    (entry) =>
      entry &&
      typeof entry === 'object' &&
      !Array.isArray(entry) &&
      (entry as Record<string, unknown>).default === true,
  );
  const rootDefaultAgent = getStringValue(rootDefaultAgentId, ['id']);
  if (rootDefaultAgent) {
    return rootDefaultAgent;
  }

  return workbench.agents.find((agent) => agent.isDefault)?.agent.id || workbench.agents[0]?.agent.id || null;
}

function resolveAgentModel(
  agent: InstanceWorkbenchAgent,
  configSnapshot: ManagedOpenClawConfigSnapshot | null,
) {
  const rootAgentEntries = getArrayValue(configSnapshot?.root, ['agents', 'list']) || [];
  const rootAgentEntry = rootAgentEntries.find(
    (entry) => getStringValue(entry, ['id']) === agent.agent.id,
  );
  const agentModel = readModelSelection(getObjectValue(rootAgentEntry, ['model']));
  if (hasModelSelection(agentModel)) {
    return {
      primary: agentModel.primary,
      fallbacks: [...agentModel.fallbacks],
      source: 'agent' as const,
    };
  }

  const defaultsModel = readModelSelection(getObjectValue(configSnapshot?.root, ['agents', 'defaults', 'model']));
  if (hasModelSelection(defaultsModel)) {
    return {
      primary: defaultsModel.primary,
      fallbacks: [...defaultsModel.fallbacks],
      source: 'defaults' as const,
    };
  }

  return {
    primary: agent.model?.primary,
    fallbacks: [...(agent.model?.fallbacks || [])],
    source: 'runtime' as const,
  };
}

function buildAgentPaths(agent: InstanceWorkbenchAgent): AgentWorkbenchPaths {
  const workspacePath = normalizePath(agent.workspace);
  const agentDirPath = normalizePath(agent.agentDir);
  const agentStateRoot =
    agentDirPath?.endsWith('/agent') ? getParentDirectory(agentDirPath) : agentDirPath;

  return {
    workspacePath,
    skillsDirectoryPath: joinPath(workspacePath, 'skills'),
    agentDirPath,
    authProfilesPath: joinPath(agentDirPath, 'auth-profiles.json'),
    modelsRegistryPath: joinPath(agentDirPath, 'models.json'),
    sessionsPath: joinPath(agentStateRoot, 'sessions'),
  };
}

function taskBelongsToAgent(task: InstanceWorkbenchTask, agentId: string, isDefault: boolean) {
  const taskAgentId = task.agentId?.trim();
  if (taskAgentId) {
    return taskAgentId === agentId;
  }

  return isDefault;
}

function fileBelongsToAgent(file: InstanceWorkbenchFile, agent: InstanceWorkbenchAgent) {
  const parsed = parseOpenClawAgentFileId(file.id);
  if (parsed) {
    return parsed.agentId === agent.agent.id;
  }

  const workspacePath = normalizePath(agent.workspace);
  const filePath = normalizePath(file.path);
  if (!workspacePath || !filePath) {
    return false;
  }

  return filePath === workspacePath || filePath.startsWith(`${workspacePath}/`);
}

function buildSkillEntry(entry: OpenClawSkillStatusRecord, fallbackCategory = 'Automation'): Skill {
  const name = entry.name?.trim() || titleCaseIdentifier(entry.id?.trim() || 'skill');

  return {
    id: entry.id?.trim() || name.toLowerCase().replace(/\s+/g, '-'),
    name,
    description: entry.description?.trim() || `${name} skill`,
    author: entry.author?.trim() || 'OpenClaw',
    rating: 0,
    downloads: 0,
    category: fallbackCategory,
    version: entry.version?.trim() || undefined,
    size: entry.size?.trim() || undefined,
    updatedAt: entry.updatedAt?.trim() || undefined,
    readme: entry.readme?.trim() || undefined,
  };
}

function toRequirementList(value: unknown) {
  return Array.isArray(value)
    ? value
        .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
        .filter(Boolean)
    : [];
}

function mapMissingRequirements(
  entry: OpenClawSkillStatusRecord,
): AgentWorkbenchSkillMissingRequirements {
  const missing = entry.missing && typeof entry.missing === 'object' ? entry.missing : {};

  return {
    bins: toRequirementList((missing as Record<string, unknown>).bins),
    anyBins: toRequirementList((missing as Record<string, unknown>).anyBins),
    env: toRequirementList((missing as Record<string, unknown>).env),
    config: toRequirementList((missing as Record<string, unknown>).config),
  };
}

function mapSkillInstallOptions(entry: OpenClawSkillStatusRecord) {
  const install = Array.isArray(entry.install) ? entry.install : [];

  return install.map((option, index): AgentWorkbenchSkillInstallOption => ({
    id:
      (typeof option?.id === 'string' && option.id.trim()) ||
      `${typeof option?.kind === 'string' && option.kind.trim() ? option.kind.trim() : 'install'}-${index}`,
    kind:
      (typeof option?.kind === 'string' && option.kind.trim()) || 'installer',
    label:
      (typeof option?.label === 'string' && option.label.trim()) ||
      (typeof option?.kind === 'string' && option.kind.trim()) ||
      'Install',
    bins: toRequirementList(option?.bins),
  }));
}

function resolveSkillScope(
  entry: OpenClawSkillStatusRecord,
  workspacePath?: string | null,
): AgentWorkbenchSkillScope {
  const source = entry.source?.trim().toLowerCase() || '';
  const baseDir = normalizePath(entry.baseDir);
  const filePath = normalizePath(entry.filePath);
  const workspaceSkillsPath = joinPath(workspacePath, 'skills');

  if (entry.bundled === true || source.includes('bundled')) {
    return 'bundled';
  }

  if (
    workspaceSkillsPath &&
    ((baseDir && (baseDir === workspaceSkillsPath || baseDir.startsWith(`${workspaceSkillsPath}/`))) ||
      (filePath &&
        (filePath === workspaceSkillsPath || filePath.startsWith(`${workspaceSkillsPath}/`))) ||
      source.includes('workspace'))
  ) {
    return 'workspace';
  }

  if (
    source.includes('managed') ||
    source.includes('.openclaw/skills') ||
    baseDir?.includes('/.openclaw/skills') ||
    filePath?.includes('/.openclaw/skills')
  ) {
    return 'managed';
  }

  return 'unknown';
}

function buildAgentWorkbenchSkill(
  entry: OpenClawSkillStatusRecord,
  workspacePath?: string | null,
  fallbackCategory = 'Automation',
): AgentWorkbenchSkill {
  const base = buildSkillEntry(entry, fallbackCategory);
  const source = entry.source?.trim() || 'unknown';
  const skillKey = entry.skillKey?.trim() || base.id;

  return {
    ...base,
    skillKey,
    source,
    scope: resolveSkillScope(entry, workspacePath),
    bundled: entry.bundled === true || source.toLowerCase().includes('bundled'),
    eligible: entry.eligible !== false,
    disabled: entry.disabled === true,
    blockedByAllowlist: entry.blockedByAllowlist === true,
    primaryEnv: entry.primaryEnv?.trim() || undefined,
    homepage: entry.homepage?.trim() || undefined,
    filePath: normalizePath(entry.filePath),
    baseDir: normalizePath(entry.baseDir),
    installOptions: mapSkillInstallOptions(entry),
    missing: mapMissingRequirements(entry),
  };
}

function mapSkillStatusToSkills(
  result: OpenClawSkillsStatusResult,
  workspacePath?: string | null,
) {
  const entries = result.skills?.length ? result.skills : result.entries || [];
  return entries.map((entry) => buildAgentWorkbenchSkill(entry, workspacePath));
}

function inferToolCategory(
  groupId: string,
  tool: OpenClawToolCatalogEntry,
): InstanceWorkbenchTool['category'] {
  const source = `${groupId} ${tool.id} ${tool.source || ''}`.toLowerCase();

  if (source.includes('file') || source.includes('fs')) {
    return 'filesystem';
  }
  if (source.includes('observe') || source.includes('search') || source.includes('browser')) {
    return 'observability';
  }
  if (source.includes('reason') || source.includes('model')) {
    return 'reasoning';
  }
  if (source.includes('exec') || source.includes('cron') || source.includes('agent')) {
    return 'automation';
  }

  return 'integration';
}

function mapToolsCatalogToTools(result: OpenClawToolsCatalogResult) {
  return result.groups.flatMap((group) =>
    group.tools.map(
      (tool): InstanceWorkbenchTool => ({
        id: tool.id,
        name: tool.label || titleCaseIdentifier(tool.id),
        description: tool.description || group.label,
        category: inferToolCategory(group.id, tool),
        status: 'ready',
        access: 'execute',
        command: tool.id,
      }),
    ),
  );
}

function buildPreferredProviderIds(model: AgentWorkbenchModelSelection) {
  return toUniqueStringList(
    [model.primary, ...model.fallbacks].map((modelRef) => {
      if (!modelRef) {
        return null;
      }

      const separatorIndex = modelRef.indexOf('/');
      if (separatorIndex <= 0) {
        return null;
      }

      return modelRef.slice(0, separatorIndex).trim() || null;
    }),
  );
}

function resolveChannelAccountIds(
  configSnapshot: ManagedOpenClawConfigSnapshot | null,
  channelId: string,
) {
  const accountsRoot = getObjectValue(configSnapshot?.root, ['channels', channelId, 'accounts']) || {};
  return Object.keys(accountsRoot).sort((left, right) => left.localeCompare(right));
}

function resolveDefaultChannelAccountId(
  configSnapshot: ManagedOpenClawConfigSnapshot | null,
  channelId: string,
  availableAccountIds: string[],
) {
  const explicitDefaultAccountId = getStringValue(configSnapshot?.root, [
    'channels',
    channelId,
    'defaultAccount',
  ]);
  if (explicitDefaultAccountId) {
    return explicitDefaultAccountId;
  }

  if (availableAccountIds.includes('default')) {
    return 'default';
  }

  return availableAccountIds[0] || null;
}

function resolveBoundChannelAccountIds(
  configSnapshot: ManagedOpenClawConfigSnapshot | null,
  agentId: string,
  channelId: string,
  availableAccountIds: string[],
) {
  const bindings = getArrayValue(configSnapshot?.root, ['bindings']) || [];
  const defaultAccountId = resolveDefaultChannelAccountId(
    configSnapshot,
    channelId,
    availableAccountIds,
  );

  return toUniqueStringList(
    bindings.flatMap((binding) => {
      if (getStringValue(binding, ['agentId']) !== agentId) {
        return [];
      }
      if (getStringValue(binding, ['match', 'channel']) !== channelId) {
        return [];
      }

      const accountId = getStringValue(binding, ['match', 'accountId']);
      if (accountId === '*') {
        return availableAccountIds.length > 0 ? availableAccountIds : ['*'];
      }
      if (accountId) {
        return [accountId];
      }
      if (defaultAccountId) {
        return [defaultAccountId];
      }

      return availableAccountIds.length > 0 ? [availableAccountIds[0]] : [];
    }),
  );
}

function mapAgentChannels(params: {
  channels: InstanceWorkbenchChannel[];
  configSnapshot: ManagedOpenClawConfigSnapshot | null;
  agentId: string;
}) {
  const statusOrder: Record<AgentWorkbenchChannelRouteStatus, number> = {
    bound: 0,
    available: 1,
    notConfigured: 2,
  };

  return params.channels
    .map((channel) => {
      const availableAccountIds = resolveChannelAccountIds(params.configSnapshot, channel.id);
      const accountIds = resolveBoundChannelAccountIds(
        params.configSnapshot,
        params.agentId,
        channel.id,
        availableAccountIds,
      );
      const routeStatus: AgentWorkbenchChannelRouteStatus =
        accountIds.length > 0
          ? 'bound'
          : channel.configurationMode === 'none' ||
              channel.status === 'connected' ||
              availableAccountIds.length > 0
            ? 'available'
            : 'notConfigured';

      return {
        ...channel,
        routeStatus,
        accountIds,
        availableAccountIds,
      };
    })
    .sort((left, right) => {
      const statusDelta = statusOrder[left.routeStatus] - statusOrder[right.routeStatus];
      if (statusDelta !== 0) {
        return statusDelta;
      }

      return left.name.localeCompare(right.name);
    });
}

function cloneAgent(agent: InstanceWorkbenchAgent): InstanceWorkbenchAgent {
  return {
    ...agent,
    agent: { ...agent.agent },
    focusAreas: [...agent.focusAreas],
    model: agent.model
      ? {
          primary: agent.model.primary,
          fallbacks: [...agent.model.fallbacks],
        }
      : undefined,
    params: agent.params ? { ...agent.params } : undefined,
  };
}

class DefaultAgentWorkbenchService implements AgentWorkbenchService {
  private readonly dependencies: AgentWorkbenchServiceDependencies;

  constructor(dependencies: AgentWorkbenchServiceDependencies) {
    this.dependencies = dependencies;
  }

  async getAgentWorkbench(input: AgentWorkbenchRequest): Promise<AgentWorkbenchSnapshot> {
    const agent = input.workbench.agents.find((entry) => entry.agent.id === input.agentId);
    if (!agent) {
      throw new Error(`Agent "${input.agentId}" was not found in the instance workbench.`);
    }

    const configSnapshot = input.workbench.managedConfigPath
      ? await this.dependencies.readOpenClawConfigSnapshot(input.workbench.managedConfigPath)
      : null;
    const defaultAgentId = resolveDefaultAgentId(configSnapshot, input.workbench);
    const effectiveModel = resolveAgentModel(agent, configSnapshot);
    const [skillsResult, toolsResult] = await Promise.all([
      this.dependencies.openClawGatewayClient.getSkillsStatus(input.instanceId, {
        agentId: input.agentId,
      }),
      this.dependencies.openClawGatewayClient.getToolsCatalog(input.instanceId, {
        agentId: input.agentId,
      }),
    ]);

    return {
      agent: cloneAgent(agent),
      model: effectiveModel,
      paths: buildAgentPaths(agent),
      tasks: input.workbench.tasks.filter((task) =>
        taskBelongsToAgent(task, input.agentId, defaultAgentId === input.agentId),
      ),
      files: input.workbench.files.filter((file) => fileBelongsToAgent(file, agent)),
      skills: mapSkillStatusToSkills(skillsResult, agent.workspace),
      tools: mapToolsCatalogToTools(toolsResult),
      modelProviders: buildPreferredProviderIds(effectiveModel)
        .map((providerId) =>
          input.workbench.llmProviders.find((provider) => provider.id === providerId),
        )
        .filter((provider): provider is InstanceWorkbenchLLMProvider => Boolean(provider)),
      channels: mapAgentChannels({
        channels: input.workbench.channels,
        configSnapshot,
        agentId: input.agentId,
      }),
    };
  }
}

function createDefaultDependencies(): AgentWorkbenchServiceDependencies {
  return {
    readOpenClawConfigSnapshot: (configPath) => openClawConfigService.readConfigSnapshot(configPath),
    openClawGatewayClient: {
      getSkillsStatus: (instanceId, args = {}) =>
        openClawGatewayClient.getSkillsStatus(instanceId, args),
      getToolsCatalog: (instanceId, args = {}) =>
        openClawGatewayClient.getToolsCatalog(instanceId, args),
    },
  };
}

export function createAgentWorkbenchService(
  overrides: AgentWorkbenchServiceDependencyOverrides = {},
) {
  const defaults = createDefaultDependencies();

  return new DefaultAgentWorkbenchService({
    readOpenClawConfigSnapshot:
      overrides.readOpenClawConfigSnapshot || defaults.readOpenClawConfigSnapshot,
    openClawGatewayClient: {
      ...defaults.openClawGatewayClient,
      ...(overrides.openClawGatewayClient || {}),
    },
  });
}

export const agentWorkbenchService = createAgentWorkbenchService();
