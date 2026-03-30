import { openClawConfigService } from '@sdkwork/claw-core';
import {
  openClawGatewayClient,
  type OpenClawAgentFileResult,
  type OpenClawAgentFilesListResult,
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
  buildOpenClawAgentFileId,
  formatSize,
  getArrayValue,
  getObjectValue,
  getStringValue,
  inferLanguageFromPath,
  parseOpenClawAgentFileId,
  titleCaseIdentifier,
  toIsoStringFromMs,
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

export interface AgentWorkbenchSkillSelection {
  usesAllowlist: boolean;
  configuredSkillNames: string[];
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
  os: string[];
}

export interface AgentWorkbenchSkillConfigCheck {
  path: string;
  satisfied: boolean;
}

export interface AgentWorkbenchSkillConfigEntry {
  apiKey: string;
  env: Record<string, string>;
  hasEntry: boolean;
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
  always: boolean;
  eligible: boolean;
  disabled: boolean;
  blockedByAllowlist: boolean;
  primaryEnv?: string;
  homepage?: string;
  emoji?: string;
  filePath?: string;
  baseDir?: string;
  installOptions: AgentWorkbenchSkillInstallOption[];
  missing: AgentWorkbenchSkillMissingRequirements;
  configChecks: AgentWorkbenchSkillConfigCheck[];
  configEntry: AgentWorkbenchSkillConfigEntry;
}

export interface AgentWorkbenchSnapshot {
  agent: InstanceWorkbenchAgent;
  model: AgentWorkbenchModelSelection;
  skillSelection: AgentWorkbenchSkillSelection;
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
    listAgentFiles: (
      instanceId: string,
      args: { agentId: string },
    ) => Promise<OpenClawAgentFilesListResult>;
    getAgentFile: (
      instanceId: string,
      args: { agentId: string; name: string },
    ) => Promise<OpenClawAgentFileResult>;
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

function getLastPathSegment(path?: string | null) {
  const normalized = normalizePath(path)?.replace(/\/+$/g, '');
  if (!normalized) {
    return null;
  }

  const lastSlashIndex = normalized.lastIndexOf('/');
  return lastSlashIndex >= 0 ? normalized.slice(lastSlashIndex + 1) || null : normalized;
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

function resolveRootAgentEntry(
  configSnapshot: ManagedOpenClawConfigSnapshot | null,
  agentId: string,
) {
  const rootAgentEntries = getArrayValue(configSnapshot?.root, ['agents', 'list']) || [];
  return rootAgentEntries.find((entry) => getStringValue(entry, ['id']) === agentId);
}

function normalizeAgentSkillNames(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
        .filter(Boolean),
    ),
  );
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
  const rootAgentEntry = resolveRootAgentEntry(configSnapshot, agent.agent.id);
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

function resolveAgentSkillSelection(
  agent: InstanceWorkbenchAgent,
  configSnapshot: ManagedOpenClawConfigSnapshot | null,
): AgentWorkbenchSkillSelection {
  const rootAgentEntry = resolveRootAgentEntry(configSnapshot, agent.agent.id);
  const usesAllowlist = Boolean(
    rootAgentEntry &&
      typeof rootAgentEntry === 'object' &&
      !Array.isArray(rootAgentEntry) &&
      Object.prototype.hasOwnProperty.call(rootAgentEntry, 'skills'),
  );

  return {
    usesAllowlist,
    configuredSkillNames: usesAllowlist
      ? normalizeAgentSkillNames(
          rootAgentEntry &&
            typeof rootAgentEntry === 'object' &&
            !Array.isArray(rootAgentEntry)
            ? (rootAgentEntry as Record<string, unknown>).skills
            : undefined,
        )
      : [],
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

  const filePath = normalizePath(file.path);
  if (!filePath) {
    return false;
  }

  const roots = new Set<string>();
  const workspacePath = normalizePath(agent.workspace);
  const workspaceBasename = getLastPathSegment(workspacePath);
  const normalizedAgentId = agent.agent.id.trim();
  const isDefaultAgent = agent.isDefault === true || normalizedAgentId === 'main';

  if (workspacePath) {
    roots.add(workspacePath);
  }
  if (workspaceBasename) {
    roots.add(`/${workspaceBasename}`);
  }
  if (normalizedAgentId) {
    roots.add(`/workspace-${normalizedAgentId}`);
    roots.add(`/workspace/${normalizedAgentId}`);
  }
  if (isDefaultAgent) {
    roots.add('/workspace');
    roots.add('/workspace/main');
    roots.add('/workspace-main');
  }

  return Array.from(roots).some(
    (root) => filePath === root || filePath.startsWith(`${root}/`),
  );
}

function inferOpenClawFileCategory(
  name: string,
  path: string,
): InstanceWorkbenchFile['category'] {
  const normalized = `${name} ${path}`.toLowerCase();

  if (normalized.includes('memory.md')) {
    return 'memory';
  }
  if (normalized.endsWith('.log')) {
    return 'log';
  }
  if (
    normalized.endsWith('.json') ||
    normalized.endsWith('.json5') ||
    normalized.includes('config')
  ) {
    return 'config';
  }
  if (normalized.endsWith('.md')) {
    return 'prompt';
  }

  return 'artifact';
}

async function buildGatewayAgentFiles(
  instanceId: string,
  agent: InstanceWorkbenchAgent,
  dependencies: AgentWorkbenchServiceDependencies,
) {
  const listed = await dependencies.openClawGatewayClient
    .listAgentFiles(instanceId, {
      agentId: agent.agent.id,
    })
    .catch(() => ({ files: [] }) as OpenClawAgentFilesListResult);
  const workspacePath = normalizePath(listed.workspace) || normalizePath(agent.workspace);

  const files = await Promise.all(
    listed.files.map(async (entry) => {
      const name = typeof entry.name === 'string' ? entry.name.trim() : '';
      if (!name) {
        return null;
      }

      const fetched = await dependencies.openClawGatewayClient
        .getAgentFile(instanceId, {
          agentId: agent.agent.id,
          name,
        })
        .catch(() => null);
      const fileRecord = fetched?.file || entry;
      const path =
        (typeof fileRecord.path === 'string' && fileRecord.path.trim()) ||
        (workspacePath ? `${workspacePath.replace(/\/+$/g, '')}/${name}` : name);
      const normalizedPath = normalizePath(path) || path;

      const nextFile: InstanceWorkbenchFile = {
        id: buildOpenClawAgentFileId(agent.agent.id, name, normalizedPath),
        name,
        path: normalizedPath,
        category: inferOpenClawFileCategory(name, normalizedPath),
        language: inferLanguageFromPath(normalizedPath),
        size: formatSize(typeof fileRecord.size === 'number' ? fileRecord.size : undefined),
        updatedAt:
          toIsoStringFromMs(
            typeof fileRecord.updatedAtMs === 'number' ? fileRecord.updatedAtMs : undefined,
          ) || 'Unknown',
        status: fileRecord.missing === true ? 'missing' : 'synced',
        description: `${name} bootstrap file for ${agent.agent.name}.`,
        content: typeof fileRecord.content === 'string' ? fileRecord.content : '',
        isReadonly: false,
      };

      return nextFile;
    }),
  );

  return {
    workspacePath,
    files: files.filter((file): file is InstanceWorkbenchFile => file !== null),
  };
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
    os: toRequirementList((missing as Record<string, unknown>).os),
  };
}

function mapSkillConfigChecks(entry: OpenClawSkillStatusRecord): AgentWorkbenchSkillConfigCheck[] {
  const checks = Array.isArray(entry.configChecks) ? entry.configChecks : [];

  return checks
    .map((check) => {
      const path = getStringValue(check, ['path']);
      if (!path) {
        return null;
      }

      return {
        path,
        satisfied:
          Boolean(
            check &&
              typeof check === 'object' &&
              !Array.isArray(check) &&
              (check as Record<string, unknown>).satisfied === true,
          ),
      };
    })
    .filter((check): check is AgentWorkbenchSkillConfigCheck => check !== null);
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

function readSkillConfigEnv(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(
        ([key, envValue]) =>
          typeof key === 'string' &&
          key.trim().length > 0 &&
          typeof envValue === 'string' &&
          envValue.trim().length > 0,
      )
      .map(([key, envValue]) => [key.trim(), (envValue as string).trim()]),
  );
}

function readSkillConfigEntry(
  configSnapshot: ManagedOpenClawConfigSnapshot | null,
  skillKey: string,
): AgentWorkbenchSkillConfigEntry {
  const skillConfig = getObjectValue(configSnapshot?.root, ['skills', 'entries', skillKey]);
  if (!skillConfig) {
    return {
      apiKey: '',
      env: {},
      hasEntry: false,
    };
  }

  return {
    apiKey: getStringValue(skillConfig, ['apiKey']) || '',
    env: readSkillConfigEnv(getObjectValue(skillConfig, ['env'])),
    hasEntry: Object.keys(skillConfig).length > 0,
  };
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
  configSnapshot?: ManagedOpenClawConfigSnapshot | null,
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
    always: entry.always === true,
    eligible: entry.eligible !== false,
    disabled: entry.disabled === true,
    blockedByAllowlist: entry.blockedByAllowlist === true,
    primaryEnv: entry.primaryEnv?.trim() || undefined,
    homepage: entry.homepage?.trim() || undefined,
    emoji: entry.emoji?.trim() || undefined,
    filePath: normalizePath(entry.filePath),
    baseDir: normalizePath(entry.baseDir),
    installOptions: mapSkillInstallOptions(entry),
    missing: mapMissingRequirements(entry),
    configChecks: mapSkillConfigChecks(entry),
    configEntry: readSkillConfigEntry(configSnapshot || null, skillKey),
  };
}

function mapSkillStatusToSkills(
  result: OpenClawSkillsStatusResult,
  workspacePath?: string | null,
  configSnapshot?: ManagedOpenClawConfigSnapshot | null,
) {
  const entries = result.skills?.length ? result.skills : result.entries || [];
  return entries.map((entry) => buildAgentWorkbenchSkill(entry, workspacePath, configSnapshot));
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

function isChannelAvailableForRouting(
  channel: InstanceWorkbenchChannel,
  availableAccountIds: string[],
) {
  if (channel.configurationMode === 'none') {
    return true;
  }

  if (availableAccountIds.length > 0) {
    return true;
  }

  if (channel.configuredFieldCount > 0) {
    return true;
  }

  return channel.status !== 'not_configured';
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
          : isChannelAvailableForRouting(channel, availableAccountIds)
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
      ? await this.dependencies
          .readOpenClawConfigSnapshot(input.workbench.managedConfigPath)
          .catch(() => null)
      : null;
    const defaultAgentId = resolveDefaultAgentId(configSnapshot, input.workbench);
    const effectiveModel = resolveAgentModel(agent, configSnapshot);
    const skillSelection = resolveAgentSkillSelection(agent, configSnapshot);
    const aggregatedFiles = input.workbench.files.filter((file) => fileBelongsToAgent(file, agent));
    const aggregatedFilesAreGatewayScoped =
      aggregatedFiles.length > 0 &&
      aggregatedFiles.every((file) => parseOpenClawAgentFileId(file.id)?.agentId === agent.agent.id);
    const [skillsResult, toolsResult] = await Promise.all([
      this.dependencies.openClawGatewayClient
        .getSkillsStatus(input.instanceId, {
          agentId: input.agentId,
        })
        .catch(() => ({ agentId: input.agentId, skills: [] }) as OpenClawSkillsStatusResult),
      this.dependencies.openClawGatewayClient
        .getToolsCatalog(input.instanceId, {
          agentId: input.agentId,
        })
        .catch(
          () =>
            ({
              agentId: input.agentId,
              profiles: [],
              groups: [],
            }) as OpenClawToolsCatalogResult,
        ),
    ]);
    const gatewayFiles = aggregatedFilesAreGatewayScoped
      ? {
          workspacePath:
            normalizePath(skillsResult.workspace) || normalizePath(agent.workspace),
          files: aggregatedFiles,
        }
      : await buildGatewayAgentFiles(input.instanceId, agent, this.dependencies);
    const resolvedWorkspacePath =
      gatewayFiles.workspacePath ||
      normalizePath(skillsResult.workspace) ||
      normalizePath(agent.workspace);
    const selectedFiles =
      gatewayFiles.files.length > 0
        ? gatewayFiles.files
        : aggregatedFiles;
    const resolvedAgent = cloneAgent({
      ...agent,
      workspace: resolvedWorkspacePath || agent.workspace,
    });
    const paths = buildAgentPaths(resolvedAgent);

    return {
      agent: resolvedAgent,
      model: effectiveModel,
      skillSelection,
      paths,
      tasks: input.workbench.tasks.filter((task) =>
        taskBelongsToAgent(task, input.agentId, defaultAgentId === input.agentId),
      ),
      files: selectedFiles,
      skills: mapSkillStatusToSkills(skillsResult, paths.workspacePath, configSnapshot),
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
      listAgentFiles: (instanceId, args) =>
        openClawGatewayClient.listAgentFiles(instanceId, args),
      getAgentFile: (instanceId, args) =>
        openClawGatewayClient.getAgentFile(instanceId, args),
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
