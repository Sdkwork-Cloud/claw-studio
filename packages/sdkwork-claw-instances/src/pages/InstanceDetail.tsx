import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Brain,
  BriefcaseBusiness,
  CheckCircle2,
  Clock3,
  Copy,
  Edit2,
  FileCode2,
  Files,
  Hash,
  History,
  Loader2,
  MemoryStick,
  MessageSquare,
  Package,
  Pause,
  Play,
  Plus,
  Power,
  RefreshCw,
  Server,
  Settings,
  Sparkles,
  Trash2,
  Wrench,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { CronTasksManager } from '@sdkwork/claw-commons';
import type { OpenClawAgentInput, OpenClawProviderInput } from '@sdkwork/claw-core';
import { normalizeLegacyProviderId, useInstanceStore } from '@sdkwork/claw-core';
import { openExternalUrl } from '@sdkwork/claw-infrastructure';
import {
  Button,
  ChannelWorkspace,
  type ChannelCatalogItem,
  type ChannelWorkspaceItem,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  getTaskCatalogTone,
  getTaskExecutionBadgeTone,
  getTaskHistoryBadgeTone,
  Input,
  Label,
  getTaskPreview,
  getTaskStatusBadgeTone,
  getTaskToggleStatusTarget,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  TaskCatalog,
  TaskExecutionHistoryDrawer,
  Textarea,
  type TaskCatalogItem,
} from '@sdkwork/claw-ui';
import { AgentWorkbenchPanel } from '../components/AgentWorkbenchPanel';
import { InstanceConfigWorkbenchPanel } from '../components/InstanceConfigWorkbenchPanel';
import { InstanceFilesWorkspace } from '../components/InstanceFilesWorkspace';
import { InstanceLLMConfigPanel } from '../components/InstanceLLMConfigPanel';
import { buildInstanceDetailBadgeDescriptors } from './instanceDetailBadgeDescriptors';
import {
  agentWorkbenchService,
  agentSkillManagementService,
  type AgentWorkbenchSnapshot,
  buildOpenClawAgentInputFromForm,
  buildInstanceManagementSummary,
  createOpenClawAgentFormState,
  instanceService,
  instanceWorkbenchService,
  type OpenClawAgentFormState,
} from '../services';
import type {
  InstanceConfig,
  InstanceLLMProviderUpdate,
  InstanceWorkbenchSectionId,
  InstanceWorkbenchSnapshot,
  InstanceWorkbenchTaskExecution,
} from '../types';

interface WorkbenchSectionDefinition {
  id: InstanceWorkbenchSectionId;
  icon: LucideIcon;
  labelKey: string;
  descriptionKey: string;
  sectionTitleKey: string;
  sectionDescriptionKey: string;
}

interface OpenClawProviderFormState {
  id: string;
  name: string;
  endpoint: string;
  apiKeySource: string;
  defaultModelId: string;
  reasoningModelId: string;
  embeddingModelId: string;
  modelsText: string;
}

interface OpenClawProviderModelFormState {
  originalId?: string;
  id: string;
  name: string;
}

interface OpenClawWebSearchSharedFormState {
  enabled: boolean;
  provider: string;
  maxResults: string;
  timeoutSeconds: string;
  cacheTtlMinutes: string;
}

interface OpenClawWebSearchProviderFormState {
  apiKeySource: string;
  baseUrl: string;
  model: string;
  advancedConfig: string;
}

interface OpenClawAuthCooldownsFormState {
  rateLimitedProfileRotations: string;
  overloadedProfileRotations: string;
  overloadedBackoffMs: string;
  billingBackoffHours: string;
  billingMaxHours: string;
  failureWindowHours: string;
}

const workbenchSections: WorkbenchSectionDefinition[] = [
  {
    id: 'overview',
    icon: Server,
    labelKey: 'instances.detail.instanceWorkbench.sidebar.overview',
    descriptionKey: 'instances.detail.instanceWorkbench.sidebar.itemDescriptions.overview',
    sectionTitleKey: 'instances.detail.instanceWorkbench.sections.overview.title',
    sectionDescriptionKey: 'instances.detail.instanceWorkbench.sections.overview.description',
  },
  {
    id: 'channels',
    icon: Hash,
    labelKey: 'instances.detail.instanceWorkbench.sidebar.channels',
    descriptionKey: 'instances.detail.instanceWorkbench.sidebar.itemDescriptions.channels',
    sectionTitleKey: 'instances.detail.instanceWorkbench.sections.channels.title',
    sectionDescriptionKey: 'instances.detail.instanceWorkbench.sections.channels.description',
  },
  {
    id: 'cronTasks',
    icon: Clock3,
    labelKey: 'instances.detail.instanceWorkbench.sidebar.cronTasks',
    descriptionKey: 'instances.detail.instanceWorkbench.sidebar.itemDescriptions.cronTasks',
    sectionTitleKey: 'instances.detail.instanceWorkbench.sections.cronTasks.title',
    sectionDescriptionKey: 'instances.detail.instanceWorkbench.sections.cronTasks.description',
  },
  {
    id: 'llmProviders',
    icon: Sparkles,
    labelKey: 'instances.detail.instanceWorkbench.sidebar.llmProviders',
    descriptionKey: 'instances.detail.instanceWorkbench.sidebar.itemDescriptions.llmProviders',
    sectionTitleKey: 'instances.detail.instanceWorkbench.sections.llmProviders.title',
    sectionDescriptionKey: 'instances.detail.instanceWorkbench.sections.llmProviders.description',
  },
  {
    id: 'agents',
    icon: BriefcaseBusiness,
    labelKey: 'instances.detail.instanceWorkbench.sidebar.agents',
    descriptionKey: 'instances.detail.instanceWorkbench.sidebar.itemDescriptions.agents',
    sectionTitleKey: 'instances.detail.instanceWorkbench.sections.agents.title',
    sectionDescriptionKey: 'instances.detail.instanceWorkbench.sections.agents.description',
  },
  {
    id: 'skills',
    icon: Package,
    labelKey: 'instances.detail.instanceWorkbench.sidebar.skills',
    descriptionKey: 'instances.detail.instanceWorkbench.sidebar.itemDescriptions.skills',
    sectionTitleKey: 'instances.detail.instanceWorkbench.sections.skills.title',
    sectionDescriptionKey: 'instances.detail.instanceWorkbench.sections.skills.description',
  },
  {
    id: 'files',
    icon: Files,
    labelKey: 'instances.detail.instanceWorkbench.sidebar.files',
    descriptionKey: 'instances.detail.instanceWorkbench.sidebar.itemDescriptions.files',
    sectionTitleKey: 'instances.detail.instanceWorkbench.sections.files.title',
    sectionDescriptionKey: 'instances.detail.instanceWorkbench.sections.files.description',
  },
  {
    id: 'memory',
    icon: Brain,
    labelKey: 'instances.detail.instanceWorkbench.sidebar.memory',
    descriptionKey: 'instances.detail.instanceWorkbench.sidebar.itemDescriptions.memory',
    sectionTitleKey: 'instances.detail.instanceWorkbench.sections.memory.title',
    sectionDescriptionKey: 'instances.detail.instanceWorkbench.sections.memory.description',
  },
  {
    id: 'tools',
    icon: Wrench,
    labelKey: 'instances.detail.instanceWorkbench.sidebar.tools',
    descriptionKey: 'instances.detail.instanceWorkbench.sidebar.itemDescriptions.tools',
    sectionTitleKey: 'instances.detail.instanceWorkbench.sections.tools.title',
    sectionDescriptionKey: 'instances.detail.instanceWorkbench.sections.tools.description',
  },
  {
    id: 'config',
    icon: FileCode2,
    labelKey: 'instances.detail.instanceWorkbench.sidebar.config',
    descriptionKey: 'instances.detail.instanceWorkbench.sidebar.itemDescriptions.config',
    sectionTitleKey: 'instances.detail.instanceWorkbench.sections.config.title',
    sectionDescriptionKey: 'instances.detail.instanceWorkbench.sections.config.description',
  },
];

const embeddedCronTaskActionKeys = [
  'tasks.page.actions.edit',
  'tasks.page.actions.runNow',
  'tasks.page.actions.history',
] as const;

function getRuntimeStatusTone(status: string) {
  if (status === 'healthy') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300';
  }
  if (status === 'attention') {
    return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300';
  }
  if (status === 'offline') {
    return 'border-zinc-200 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300';
  }
  return 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300';
}

function getStatusBadge(status: string) {
  if (status === 'online' || status === 'connected' || status === 'active' || status === 'ready') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300';
  }
  if (
    status === 'starting' ||
    status === 'paused' ||
    status === 'disconnected' ||
    status === 'beta' ||
    status === 'configurationRequired'
  ) {
    return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300';
  }
  return 'border-zinc-200 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300';
}

function getDangerBadge(status: string) {
  if (
    status === 'error' ||
    status === 'failed' ||
    status === 'missing' ||
    status === 'restricted' ||
    status === 'degraded'
  ) {
    return 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300';
  }
  return getStatusBadge(status);
}

function getIntervalUnitLabel(
  t: (key: string, options?: Record<string, unknown>) => string,
  unit: 'minute' | 'hour' | 'day',
  value: string | number,
) {
  const numericValue = Number(value);
  const suffix = numericValue === 1 ? unit : `${unit}s`;
  return t(`tasks.page.intervalUnits.${suffix}`);
}

function buildTaskScheduleSummary(
  t: (key: string, options?: Record<string, unknown>) => string,
  task: InstanceWorkbenchSnapshot['tasks'][number],
) {
  if (task.scheduleMode === 'interval') {
    return t('tasks.page.scheduleSummary.interval', {
      value: task.scheduleConfig.intervalValue ?? '--',
      unit: getIntervalUnitLabel(
        t,
        task.scheduleConfig.intervalUnit ?? 'minute',
        task.scheduleConfig.intervalValue ?? 0,
      ),
    });
  }

  if (task.scheduleMode === 'datetime') {
    return t('tasks.page.scheduleSummary.datetime', {
      date: task.scheduleConfig.scheduledDate || '--',
      time: task.scheduleConfig.scheduledTime || '--',
    });
  }

  return task.cronExpression || task.schedule;
}

function SectionHeading({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="mb-5">
      <h2 className="text-xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
        {title}
      </h2>
      <p className="mt-1 text-sm leading-6 text-zinc-500 dark:text-zinc-400">{description}</p>
    </div>
  );
}

function WorkbenchRowList({ children }: { children: React.ReactNode }) {
  return (
    <div
      data-slot="instance-workbench-row-list"
      className="overflow-hidden rounded-[1.5rem] border border-zinc-200/70 bg-white/75 dark:border-zinc-800 dark:bg-zinc-950/35"
    >
      {children}
    </div>
  );
}

function WorkbenchRow({
  children,
  isLast = false,
}: {
  children: React.ReactNode;
  isLast?: boolean;
}) {
  return (
    <div
      className={`grid gap-4 px-5 py-5 xl:grid-cols-[minmax(0,2.2fr)_minmax(0,1.3fr)_auto] xl:items-center ${
        isLast ? '' : 'border-b border-zinc-200/70 dark:border-zinc-800'
      }`}
    >
      {children}
    </div>
  );
}

function RowMetric({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="min-w-[7rem]">
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
        {label}
      </div>
      <div className="mt-1 text-sm font-medium text-zinc-950 dark:text-zinc-50">{value}</div>
    </div>
  );
}

function addPendingId(ids: string[], id: string) {
  return ids.includes(id) ? ids : [...ids, id];
}

function removePendingId(ids: string[], id: string) {
  return ids.filter((item) => item !== id);
}

function formatWorkbenchLabel(value: string) {
  const known: Record<string, string> = {
    openclaw: 'OpenClaw',
    zeroclaw: 'ZeroClaw',
    ironclaw: 'IronClaw',
    appManaged: 'App Managed',
    externalProcess: 'External Process',
    remoteService: 'Remote Service',
    configurationRequired: 'Configuration Required',
    openaiChatCompletions: 'OpenAI Chat Completions',
    openaiResponses: 'OpenAI Responses',
    localManaged: 'Local Managed',
    localExternal: 'Local External',
    customHttp: 'Custom HTTP',
    customWs: 'Custom WebSocket',
    managedFile: 'Managed File',
    managedDirectory: 'Managed Directory',
    storageBinding: 'Storage Binding',
    remoteEndpoint: 'Remote Endpoint',
    metadataOnly: 'Metadata Only',
    available: 'Available',
    configured: 'Configured',
    missing: 'Missing',
    planned: 'Planned',
    writable: 'Writable',
    readonly: 'Read Only',
    authoritative: 'Authoritative',
    derived: 'Derived',
    runtime: 'Runtime',
    config: 'Config',
    storage: 'Storage',
    integration: 'Integration',
    endpoint: 'Endpoint',
    dashboard: 'Dashboard',
    configFile: 'Config File',
    logFile: 'Log File',
    workspaceDirectory: 'Workspace Directory',
    runtimeDirectory: 'Runtime Directory',
    connectivity: 'Connectivity',
  };

  if (known[value]) {
    return known[value];
  }

  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function parseProviderModelsText(modelsText: string) {
  const models = modelsText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const separatorIndex = line.indexOf('=');
      if (separatorIndex <= 0) {
        return {
          id: line,
          name: line,
        };
      }

      const id = line.slice(0, separatorIndex).trim();
      const name = line.slice(separatorIndex + 1).trim();
      return {
        id,
        name: name || id,
      };
    })
    .filter((model) => model.id);

  return Array.from(
    new Map(models.map((model) => [model.id, model] as const)).values(),
  );
}

function createEmptyProviderForm(): OpenClawProviderFormState {
  return {
    id: '',
    name: '',
    endpoint: '',
    apiKeySource: '',
    defaultModelId: '',
    reasoningModelId: '',
    embeddingModelId: '',
    modelsText: '',
  };
}

function createEmptyProviderModelForm(): OpenClawProviderModelFormState {
  return {
    originalId: undefined,
    id: '',
    name: '',
  };
}

function createProviderModelForm(
  model?: InstanceWorkbenchSnapshot['llmProviders'][number]['models'][number] | null,
): OpenClawProviderModelFormState {
  if (!model) {
    return createEmptyProviderModelForm();
  }

  return {
    originalId: model.id,
    id: model.id,
    name: model.name,
  };
}

function createDefaultProviderRuntimeConfig(): InstanceLLMProviderUpdate['config'] {
  return {
    temperature: 0.2,
    topP: 1,
    maxTokens: 8192,
    timeoutMs: 60000,
    streaming: true,
  };
}

function createWebSearchSharedFormState(
  config: InstanceWorkbenchSnapshot['managedWebSearchConfig'] | null | undefined,
): OpenClawWebSearchSharedFormState | null {
  if (!config) {
    return null;
  }

  return {
    enabled: config.enabled,
    provider: config.provider,
    maxResults: String(config.maxResults),
    timeoutSeconds: String(config.timeoutSeconds),
    cacheTtlMinutes: String(config.cacheTtlMinutes),
  };
}

function createWebSearchProviderFormState(
  provider?: NonNullable<InstanceWorkbenchSnapshot['managedWebSearchConfig']>['providers'][number] | null,
): OpenClawWebSearchProviderFormState {
  return {
    apiKeySource: provider?.apiKeySource || '',
    baseUrl: provider?.baseUrl || '',
    model: provider?.model || '',
    advancedConfig: provider?.advancedConfig || '',
  };
}

function formatOptionalWholeNumber(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : '';
}

function createAuthCooldownsFormState(
  config: InstanceWorkbenchSnapshot['managedAuthCooldownsConfig'] | null | undefined,
): OpenClawAuthCooldownsFormState | null {
  if (!config) {
    return null;
  }

  return {
    rateLimitedProfileRotations: formatOptionalWholeNumber(config.rateLimitedProfileRotations),
    overloadedProfileRotations: formatOptionalWholeNumber(config.overloadedProfileRotations),
    overloadedBackoffMs: formatOptionalWholeNumber(config.overloadedBackoffMs),
    billingBackoffHours: formatOptionalWholeNumber(config.billingBackoffHours),
    billingMaxHours: formatOptionalWholeNumber(config.billingMaxHours),
    failureWindowHours: formatOptionalWholeNumber(config.failureWindowHours),
  };
}

function getCapabilityTone(status: string) {
  if (status === 'ready') {
    return getStatusBadge(status);
  }
  if (status === 'degraded') {
    return getDangerBadge(status);
  }
  if (status === 'configurationRequired' || status === 'planned') {
    return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300';
  }
  return 'border-zinc-200 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300';
}

function getManagementEntryTone(tone: 'neutral' | 'success' | 'warning') {
  if (tone === 'success') {
    return 'border-emerald-200/70 bg-emerald-50/80 dark:border-emerald-500/20 dark:bg-emerald-500/10';
  }
  if (tone === 'warning') {
    return 'border-amber-200/70 bg-amber-50/80 dark:border-amber-500/20 dark:bg-amber-500/10';
  }
  return 'border-zinc-200/70 bg-zinc-950/[0.02] dark:border-zinc-800 dark:bg-white/[0.03]';
}

function formatAgentConfigSource(
  source: 'agent' | 'defaults' | 'runtime',
  translate: (key: string) => string,
) {
  return translate(`instances.detail.instanceWorkbench.agents.modelSources.${source}`);
}

function formatAgentStreamingMode(
  mode: OpenClawAgentFormState['streamingMode'],
  translate: (key: string) => string,
) {
  if (mode === 'enabled') {
    return translate('instances.detail.instanceWorkbench.state.enabled');
  }
  if (mode === 'disabled') {
    return translate('instances.detail.instanceWorkbench.agents.skillStates.disabled');
  }
  return translate('instances.detail.instanceWorkbench.agents.panel.inheritDefaults');
}

function formatAgentStreamingValue(value: boolean, translate: (key: string) => string) {
  return value
    ? translate('instances.detail.instanceWorkbench.state.enabled')
    : translate('instances.detail.instanceWorkbench.agents.skillStates.disabled');
}

function SectionAvailabilityNotice({
  status,
  detail,
}: {
  status: string;
  detail: string;
}) {
  return (
    <div className="rounded-[1.5rem] border border-zinc-200/70 bg-white/80 p-5 dark:border-zinc-800 dark:bg-zinc-950/35">
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={`rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${getCapabilityTone(
            status,
          )}`}
        >
          {formatWorkbenchLabel(status)}
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 text-zinc-500 dark:text-zinc-400">{detail}</p>
    </div>
  );
}

export function InstanceDetail() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { activeInstanceId, setActiveInstanceId } = useInstanceStore();
  const [activeSection, setActiveSection] = useState<InstanceWorkbenchSectionId>('overview');
  const [workbench, setWorkbench] = useState<InstanceWorkbenchSnapshot | null>(null);
  const [config, setConfig] = useState<InstanceConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isWorkbenchFilesLoading, setIsWorkbenchFilesLoading] = useState(false);
  const [isWorkbenchMemoryLoading, setIsWorkbenchMemoryLoading] = useState(false);
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  const [providerDrafts, setProviderDrafts] = useState<Record<string, InstanceLLMProviderUpdate>>({});
  const [isSavingProviderConfig, setIsSavingProviderConfig] = useState(false);
  const [isProviderDialogOpen, setIsProviderDialogOpen] = useState(false);
  const [providerDialogDraft, setProviderDialogDraft] = useState<OpenClawProviderFormState>(
    createEmptyProviderForm(),
  );
  const [isSavingProviderDialog, setIsSavingProviderDialog] = useState(false);
  const [isProviderModelDialogOpen, setIsProviderModelDialogOpen] = useState(false);
  const [providerModelDialogDraft, setProviderModelDialogDraft] =
    useState<OpenClawProviderModelFormState>(createEmptyProviderModelForm());
  const [isSavingProviderModelDialog, setIsSavingProviderModelDialog] = useState(false);
  const [providerModelDeleteId, setProviderModelDeleteId] = useState<string | null>(null);
  const [providerDeleteId, setProviderDeleteId] = useState<string | null>(null);
  const [selectedManagedChannelId, setSelectedManagedChannelId] = useState<string | null>(null);
  const [managedChannelDrafts, setManagedChannelDrafts] = useState<Record<string, Record<string, string>>>({});
  const [managedChannelError, setManagedChannelError] = useState<string | null>(null);
  const [isSavingManagedChannel, setIsSavingManagedChannel] = useState(false);
  const [selectedWebSearchProviderId, setSelectedWebSearchProviderId] = useState<string | null>(null);
  const [webSearchSharedDraft, setWebSearchSharedDraft] =
    useState<OpenClawWebSearchSharedFormState | null>(null);
  const [webSearchProviderDrafts, setWebSearchProviderDrafts] =
    useState<Record<string, OpenClawWebSearchProviderFormState>>({});
  const [webSearchError, setWebSearchError] = useState<string | null>(null);
  const [isSavingWebSearch, setIsSavingWebSearch] = useState(false);
  const [authCooldownsDraft, setAuthCooldownsDraft] =
    useState<OpenClawAuthCooldownsFormState | null>(null);
  const [authCooldownsError, setAuthCooldownsError] = useState<string | null>(null);
  const [isSavingAuthCooldowns, setIsSavingAuthCooldowns] = useState(false);
  const [isAgentDialogOpen, setIsAgentDialogOpen] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [selectedAgentWorkbench, setSelectedAgentWorkbench] =
    useState<Awaited<ReturnType<typeof agentWorkbenchService.getAgentWorkbench>> | null>(null);
  const [agentWorkbenchError, setAgentWorkbenchError] = useState<string | null>(null);
  const [isAgentWorkbenchLoading, setIsAgentWorkbenchLoading] = useState(false);
  const [agentDialogDraft, setAgentDialogDraft] = useState<OpenClawAgentFormState>(
    createOpenClawAgentFormState(null),
  );
  const [editingAgentId, setEditingAgentId] = useState<string | null>(null);
  const [isSavingAgentDialog, setIsSavingAgentDialog] = useState(false);
  const [agentDeleteId, setAgentDeleteId] = useState<string | null>(null);
  const [isInstallingAgentSkill, setIsInstallingAgentSkill] = useState(false);
  const [updatingAgentSkillKeys, setUpdatingAgentSkillKeys] = useState<string[]>([]);
  const [removingAgentSkillKeys, setRemovingAgentSkillKeys] = useState<string[]>([]);
  const [taskExecutionsById, setTaskExecutionsById] = useState<Record<string, InstanceWorkbenchTaskExecution[]>>({});
  const [historyTaskId, setHistoryTaskId] = useState<string | null>(null);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [isRefreshingTasks, setIsRefreshingTasks] = useState(false);
  const [cloningTaskIds, setCloningTaskIds] = useState<string[]>([]);
  const [runningTaskIds, setRunningTaskIds] = useState<string[]>([]);
  const [statusTaskIds, setStatusTaskIds] = useState<string[]>([]);
  const [deletingTaskIds, setDeletingTaskIds] = useState<string[]>([]);

  const loadWorkbench = async (
    instanceId: string,
    options: {
      withSpinner?: boolean;
    } = {},
  ) => {
    if (options.withSpinner !== false) {
      setIsLoading(true);
    }
    try {
      const nextWorkbench = await instanceWorkbenchService.getInstanceWorkbench(instanceId);
      setWorkbench(nextWorkbench);
      setConfig(nextWorkbench?.config || null);
    } catch (error) {
      console.error('Failed to fetch instance workbench:', error);
      setWorkbench(null);
      setConfig(null);
    } finally {
      if (options.withSpinner !== false) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    if (!id) {
      setIsLoading(false);
      setWorkbench(null);
      setConfig(null);
      return;
    }

    void loadWorkbench(id);
  }, [id]);

  useEffect(() => {
    const providers = workbench?.llmProviders || [];

    if (providers.length === 0) {
      setSelectedProviderId(null);
      setProviderDrafts({});
      return;
    }

    setSelectedProviderId((current) =>
      current && providers.some((provider) => provider.id === current) ? current : providers[0].id,
    );
    setProviderDrafts({});
  }, [workbench?.llmProviders]);

  useEffect(() => {
    const managedChannels = workbench?.managedChannels || [];

    if (managedChannels.length === 0) {
      setSelectedManagedChannelId(null);
      setManagedChannelDrafts({});
      setManagedChannelError(null);
      return;
    }

    setSelectedManagedChannelId((current) =>
      current && managedChannels.some((channel) => channel.id === current) ? current : null,
    );
    setManagedChannelDrafts({});
  }, [workbench?.managedChannels]);

  useEffect(() => {
    const managedWebSearchConfig = workbench?.managedWebSearchConfig || null;
    const providers = managedWebSearchConfig?.providers || [];

    if (!managedWebSearchConfig || providers.length === 0) {
      setSelectedWebSearchProviderId(null);
      setWebSearchSharedDraft(null);
      setWebSearchProviderDrafts({});
      setWebSearchError(null);
      return;
    }

    setSelectedWebSearchProviderId((current) => {
      if (current && providers.some((provider) => provider.id === current)) {
        return current;
      }
      if (managedWebSearchConfig.provider && providers.some((provider) => provider.id === managedWebSearchConfig.provider)) {
        return managedWebSearchConfig.provider;
      }
      return providers[0]?.id || null;
    });
    setWebSearchSharedDraft(createWebSearchSharedFormState(managedWebSearchConfig));
    setWebSearchProviderDrafts({});
    setWebSearchError(null);
  }, [workbench?.managedWebSearchConfig]);

  useEffect(() => {
    const managedAuthCooldownsConfig = workbench?.managedAuthCooldownsConfig || null;

    if (!managedAuthCooldownsConfig) {
      setAuthCooldownsDraft(null);
      setAuthCooldownsError(null);
      return;
    }

    setAuthCooldownsDraft(createAuthCooldownsFormState(managedAuthCooldownsConfig));
    setAuthCooldownsError(null);
  }, [workbench?.managedAuthCooldownsConfig]);

  useEffect(() => {
    const agents = workbench?.agents || [];

    if (agents.length === 0) {
      setSelectedAgentId(null);
      setSelectedAgentWorkbench(null);
      setAgentWorkbenchError(null);
      setIsAgentWorkbenchLoading(false);
      return;
    }

    setSelectedAgentId((current) =>
      current && agents.some((agent) => agent.agent.id === current) ? current : agents[0].agent.id,
    );
  }, [workbench?.agents]);

  useEffect(() => {
    if (activeSection !== 'agents' || !id || !workbench || !selectedAgentId) {
      if (!selectedAgentId) {
        setSelectedAgentWorkbench(null);
        setAgentWorkbenchError(null);
      }
      return;
    }

    let cancelled = false;
    setSelectedAgentWorkbench(null);
    setAgentWorkbenchError(null);
    setIsAgentWorkbenchLoading(true);

    void agentWorkbenchService
      .getAgentWorkbench({
        instanceId: id,
        workbench,
        agentId: selectedAgentId,
      })
      .then((snapshot) => {
        if (!cancelled) {
          setSelectedAgentWorkbench(snapshot);
          setAgentWorkbenchError(null);
        }
      })
      .catch((error) => {
        console.error('Failed to load agent workbench:', error);
        if (!cancelled) {
          setSelectedAgentWorkbench(null);
          setAgentWorkbenchError(
            error instanceof Error && error.message.trim()
              ? error.message
              : 'Failed to load agent detail.',
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsAgentWorkbenchLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeSection, id, selectedAgentId, workbench]);

  useEffect(() => {
    if (historyTaskId && !workbench?.tasks.some((task) => task.id === historyTaskId)) {
      setHistoryTaskId(null);
    }
  }, [historyTaskId, workbench?.tasks]);

  useEffect(() => {
    setTaskExecutionsById({});
    setHistoryTaskId(null);
    setIsHistoryLoading(false);
    setIsRefreshingTasks(false);
    setCloningTaskIds([]);
    setRunningTaskIds([]);
    setStatusTaskIds([]);
    setDeletingTaskIds([]);
    setIsWorkbenchFilesLoading(false);
    setIsWorkbenchMemoryLoading(false);
    setIsProviderDialogOpen(false);
    setProviderDialogDraft(createEmptyProviderForm());
    setIsProviderModelDialogOpen(false);
    setProviderModelDialogDraft(createEmptyProviderModelForm());
    setProviderModelDeleteId(null);
    setProviderDeleteId(null);
    setSelectedWebSearchProviderId(null);
    setWebSearchSharedDraft(null);
    setWebSearchProviderDrafts({});
    setWebSearchError(null);
    setIsSavingWebSearch(false);
    setAuthCooldownsDraft(null);
    setAuthCooldownsError(null);
    setIsSavingAuthCooldowns(false);
    setIsAgentDialogOpen(false);
    setSelectedAgentId(null);
    setSelectedAgentWorkbench(null);
    setAgentWorkbenchError(null);
    setIsAgentWorkbenchLoading(false);
    setAgentDialogDraft(createOpenClawAgentFormState(null));
    setEditingAgentId(null);
    setAgentDeleteId(null);
    setIsInstallingAgentSkill(false);
    setUpdatingAgentSkillKeys([]);
  }, [id]);

  const instance = workbench?.instance || null;
  const detail = workbench?.detail || null;
  const managedConfigPath = workbench?.managedConfigPath || null;
  const managedChannels = workbench?.managedChannels || [];
  const managedWebSearchConfig = workbench?.managedWebSearchConfig || null;
  const managedAuthCooldownsConfig = workbench?.managedAuthCooldownsConfig || null;
  const consoleAccess = detail?.consoleAccess || null;
  const isOpenClawConfigWritable =
    detail?.instance.runtimeKind === 'openclaw' && Boolean(managedConfigPath);
  const canEditManagedChannels = Boolean(id && managedConfigPath && managedChannels.length);
  const canEditManagedWebSearch = Boolean(
    id && managedConfigPath && managedWebSearchConfig?.providers.length,
  );
  const canEditManagedAuthCooldowns = Boolean(id && managedConfigPath && managedAuthCooldownsConfig);
  const isProviderConfigReadonly =
    detail?.instance.runtimeKind === 'openclaw' ? Boolean(managedConfigPath) : false;
  const canManageOpenClawProviders =
    detail?.instance.runtimeKind === 'openclaw'
      ? Boolean(managedConfigPath) && !isProviderConfigReadonly
      : true;
  const canOpenOpenClawConsole = Boolean(
    consoleAccess?.available && (consoleAccess.autoLoginUrl || consoleAccess.url),
  );
  const historyTask = historyTaskId ? workbench?.tasks.find((task) => task.id === historyTaskId) || null : null;
  const historyEntries = historyTaskId ? taskExecutionsById[historyTaskId] || [] : [];

  const activeSectionMeta = useMemo(
    () => workbenchSections.find((section) => section.id === activeSection),
    [activeSection],
  );
  const managementSummary = useMemo(
    () => (workbench ? buildInstanceManagementSummary(workbench) : null),
    [workbench],
  );

  const selectedProvider = useMemo(
    () => workbench?.llmProviders.find((provider) => provider.id === selectedProviderId) || null,
    [selectedProviderId, workbench],
  );
  const deletingProvider = useMemo(
    () => workbench?.llmProviders.find((provider) => provider.id === providerDeleteId) || null,
    [providerDeleteId, workbench],
  );
  const deletingProviderModel = useMemo(
    () => selectedProvider?.models.find((model) => model.id === providerModelDeleteId) || null,
    [providerModelDeleteId, selectedProvider],
  );
  const selectedManagedChannel = useMemo(
    () => managedChannels.find((channel) => channel.id === selectedManagedChannelId) || null,
    [managedChannels, selectedManagedChannelId],
  );
  const selectedWebSearchProvider = useMemo(
    () =>
      managedWebSearchConfig?.providers.find((provider) => provider.id === selectedWebSearchProviderId) ||
      null,
    [managedWebSearchConfig, selectedWebSearchProviderId],
  );
  const providerDialogModels = useMemo(
    () => parseProviderModelsText(providerDialogDraft.modelsText),
    [providerDialogDraft.modelsText],
  );
  const availableAgentModelOptions = useMemo(
    () => {
      const options = new Map<string, { value: string; label: string }>();
      (workbench?.llmProviders || []).forEach((provider) => {
        provider.models.forEach((model) => {
          const value = `${normalizeLegacyProviderId(provider.id)}/${model.id}`;
          if (!options.has(value)) {
            options.set(value, {
              value,
              label: `${provider.name} / ${model.name}`,
            });
          }
        });
      });
      return [...options.values()];
    },
    [workbench],
  );

  const selectedProviderDraft = selectedProvider
    ? providerDrafts[selectedProvider.id] || {
        endpoint: selectedProvider.endpoint,
        apiKeySource: selectedProvider.apiKeySource,
        defaultModelId: selectedProvider.defaultModelId,
        reasoningModelId: selectedProvider.reasoningModelId,
        embeddingModelId: selectedProvider.embeddingModelId,
        config: { ...selectedProvider.config },
      }
    : null;
  const selectedManagedChannelDraft = selectedManagedChannel
    ? managedChannelDrafts[selectedManagedChannel.id] || selectedManagedChannel.values
    : null;
  const selectedWebSearchProviderDraft = selectedWebSearchProvider
    ? webSearchProviderDrafts[selectedWebSearchProvider.id] ||
      createWebSearchProviderFormState(selectedWebSearchProvider)
    : null;
  const readonlyChannelCatalogItems = useMemo<ChannelCatalogItem[]>(
    () =>
      (workbench?.channels || []).map((channel) => ({
        ...channel,
        setupSteps: [...channel.setupSteps],
      })),
    [workbench],
  );
  const readonlyChannelWorkspaceItems = useMemo<ChannelWorkspaceItem[]>(
    () =>
      readonlyChannelCatalogItems.map((channel) => ({
        ...channel,
        fields: [],
        setupSteps: [...(channel.setupSteps || [])],
        values: {},
      })),
    [readonlyChannelCatalogItems],
  );
  const managedChannelWorkspaceItems = useMemo<ChannelWorkspaceItem[]>(
    () =>
      managedChannels.map((channel) => {
        const runtimeChannel = workbench?.channels.find((item) => item.id === channel.id) || null;
        const draft = managedChannelDrafts[channel.id] || channel.values;
        const configuredFieldCount = channel.fields.filter((field) =>
          Boolean((draft[field.key] || '').trim()),
        ).length;
        const derivedStatus =
          channel.configurationMode === 'none'
            ? channel.enabled
              ? 'connected'
              : 'disconnected'
            : configuredFieldCount === 0
              ? 'not_configured'
              : channel.status === 'connected'
                ? 'connected'
                : 'disconnected';

        return {
          id: channel.id,
          name: channel.name,
          description: runtimeChannel?.description || channel.description,
          status: derivedStatus,
          enabled: channel.enabled,
          configurationMode: channel.configurationMode,
          fieldCount: channel.fieldCount,
          configuredFieldCount,
          setupSteps:
            runtimeChannel?.setupSteps && runtimeChannel.setupSteps.length > 0
              ? [...runtimeChannel.setupSteps]
              : [...channel.setupSteps],
          fields: channel.fields.map((field) => ({ ...field })),
          values: { ...draft },
        };
      }),
    [managedChannelDrafts, managedChannels, workbench?.channels],
  );

  useEffect(() => {
    if (
      !id ||
      !workbench ||
      detail?.instance.runtimeKind !== 'openclaw' ||
      detail.instance.isBuiltIn ||
      workbench.files.length > 0 ||
      !['files', 'agents'].includes(activeSection)
    ) {
      return;
    }

    let cancelled = false;
    setIsWorkbenchFilesLoading(true);

    void instanceWorkbenchService
      .listInstanceFiles(id, workbench.agents)
      .then((files) => {
        if (cancelled) {
          return;
        }
        setWorkbench((current) => {
          if (!current || current.instance.id !== id) {
            return current;
          }

          return {
            ...current,
            files,
            sectionCounts: {
              ...current.sectionCounts,
              files: files.length,
            },
            sectionAvailability: {
              ...current.sectionAvailability,
              files:
                files.length > 0
                  ? {
                      status: 'ready',
                      detail: 'Runtime file data is available for this instance workbench.',
                    }
                  : current.sectionAvailability.files,
            },
          };
        });
      })
      .catch((error) => {
        console.error('Failed to load instance files:', error);
      })
      .finally(() => {
        if (!cancelled) {
          setIsWorkbenchFilesLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeSection, detail, id, workbench]);

  useEffect(() => {
    if (
      activeSection !== 'memory' ||
      !id ||
      !workbench ||
      detail?.instance.runtimeKind !== 'openclaw' ||
      detail.instance.isBuiltIn ||
      workbench.memories.length > 0
    ) {
      return;
    }

    let cancelled = false;
    setIsWorkbenchMemoryLoading(true);

    void instanceWorkbenchService
      .listInstanceMemories(id, workbench.agents)
      .then((memories) => {
        if (cancelled) {
          return;
        }

        setWorkbench((current) => {
          if (!current || current.instance.id !== id) {
            return current;
          }

          return {
            ...current,
            memories,
            sectionCounts: {
              ...current.sectionCounts,
              memory: memories.length,
            },
            sectionAvailability: {
              ...current.sectionAvailability,
              memory:
                memories.length > 0
                  ? {
                      status: 'ready',
                      detail: 'Runtime memory data is available for this instance workbench.',
                    }
                  : current.sectionAvailability.memory,
            },
          };
        });
      })
      .catch((error) => {
        console.error('Failed to load instance memories:', error);
      })
      .finally(() => {
        if (!cancelled) {
          setIsWorkbenchMemoryLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeSection, detail, id, workbench]);

  const hasPendingProviderChanges = Boolean(
    selectedProvider &&
      selectedProviderDraft &&
      JSON.stringify(selectedProviderDraft) !==
        JSON.stringify({
          endpoint: selectedProvider.endpoint,
          apiKeySource: selectedProvider.apiKeySource,
          defaultModelId: selectedProvider.defaultModelId,
          reasoningModelId: selectedProvider.reasoningModelId,
          embeddingModelId: selectedProvider.embeddingModelId,
          config: selectedProvider.config,
        }),
  );
  const editorTheme =
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
      ? 'vs-dark'
      : 'vs';

  const getSharedStatusLabel = (status: string) => t(`instances.shared.status.${status}`);

  const handleProviderFieldChange = (
    field: 'endpoint' | 'apiKeySource' | 'defaultModelId' | 'reasoningModelId' | 'embeddingModelId',
    value: string,
  ) => {
    if (isProviderConfigReadonly || !selectedProvider || !selectedProviderDraft) {
      return;
    }

    const nextDraft: InstanceLLMProviderUpdate = {
      ...selectedProviderDraft,
      [field]: value,
    } as InstanceLLMProviderUpdate;

    if ((field === 'reasoningModelId' || field === 'embeddingModelId') && !value) {
      nextDraft[field] = undefined;
    }

    setProviderDrafts((current) => ({
      ...current,
      [selectedProvider.id]: nextDraft,
    }));
  };

  const handleProviderConfigChange = (
    field: keyof InstanceLLMProviderUpdate['config'],
    value: number | boolean,
  ) => {
    if (isProviderConfigReadonly || !selectedProvider || !selectedProviderDraft) {
      return;
    }

    setProviderDrafts((current) => ({
      ...current,
      [selectedProvider.id]: {
        ...selectedProviderDraft,
        config: {
          ...selectedProviderDraft.config,
          [field]: value,
        },
      },
    }));
  };

  const handleResetProviderDraft = () => {
    if (isProviderConfigReadonly || !selectedProvider) {
      return;
    }

    setProviderDrafts((current) => ({
      ...current,
      [selectedProvider.id]: {
        endpoint: selectedProvider.endpoint,
        apiKeySource: selectedProvider.apiKeySource,
        defaultModelId: selectedProvider.defaultModelId,
        reasoningModelId: selectedProvider.reasoningModelId,
        embeddingModelId: selectedProvider.embeddingModelId,
        config: { ...selectedProvider.config },
      },
    }));
  };

  const handleSaveProviderConfig = async () => {
    if (isProviderConfigReadonly || !id || !selectedProvider || !selectedProviderDraft) {
      return;
    }

    setIsSavingProviderConfig(true);
    try {
      await instanceService.updateInstanceLlmProviderConfig(id, selectedProvider.id, selectedProviderDraft);
      toast.success(t('instances.detail.instanceWorkbench.llmProviders.saved'));
      await loadWorkbench(id);
    } catch (error: any) {
      toast.error(error.message || t('instances.detail.instanceWorkbench.llmProviders.saveFailed'));
    } finally {
      setIsSavingProviderConfig(false);
    }
  };

  const openCreateProviderDialog = () => {
    if (!canManageOpenClawProviders) {
      return;
    }
    setProviderDialogDraft(createEmptyProviderForm());
    setIsProviderDialogOpen(true);
  };

  const handleSubmitProviderDialog = async () => {
    if (isProviderConfigReadonly || !id) {
      return;
    }

    const providerId = providerDialogDraft.id.trim();
    const models = providerDialogModels;
    if (!providerId) {
      toast.error(t('instances.detail.instanceWorkbench.llmProviders.toasts.providerIdRequired'));
      return;
    }
    if (models.length === 0) {
      toast.error(t('instances.detail.instanceWorkbench.llmProviders.toasts.modelsRequired'));
      return;
    }

    const defaultModelId = providerDialogDraft.defaultModelId.trim() || models[0]?.id || '';
    const reasoningModelId = providerDialogDraft.reasoningModelId.trim() || undefined;
    const embeddingModelId = providerDialogDraft.embeddingModelId.trim() || undefined;
    const validModelIds = new Set(models.map((model) => model.id));

    if (!validModelIds.has(defaultModelId)) {
      toast.error(t('instances.detail.instanceWorkbench.llmProviders.toasts.defaultModelMissing'));
      return;
    }
    if (reasoningModelId && !validModelIds.has(reasoningModelId)) {
      toast.error(t('instances.detail.instanceWorkbench.llmProviders.toasts.reasoningModelMissing'));
      return;
    }
    if (embeddingModelId && !validModelIds.has(embeddingModelId)) {
      toast.error(t('instances.detail.instanceWorkbench.llmProviders.toasts.embeddingModelMissing'));
      return;
    }

    const providerInput: OpenClawProviderInput = {
      id: providerId,
      channelId: providerId,
      name: providerDialogDraft.name.trim() || providerId,
      apiKey: providerDialogDraft.apiKeySource.trim(),
      baseUrl: providerDialogDraft.endpoint.trim(),
      models,
      config: createDefaultProviderRuntimeConfig(),
    };

    setIsSavingProviderDialog(true);
    try {
      await instanceService.createInstanceLlmProvider(id, providerInput, {
        defaultModelId,
        reasoningModelId,
        embeddingModelId,
      });
      toast.success(t('instances.detail.instanceWorkbench.llmProviders.toasts.providerSaved'));
        setIsProviderDialogOpen(false);
        setProviderDialogDraft(createEmptyProviderForm());
        await loadWorkbench(id, { withSpinner: false });
        setSelectedProviderId(providerId);
      } catch (error: any) {
        toast.error(error?.message || t('instances.detail.instanceWorkbench.llmProviders.toasts.providerSaveFailed'));
      } finally {
      setIsSavingProviderDialog(false);
    }
  };

  const openCreateProviderModelDialog = () => {
    if (!canManageOpenClawProviders) {
      return;
    }
    setProviderModelDialogDraft(createEmptyProviderModelForm());
    setIsProviderModelDialogOpen(true);
  };

  const openEditProviderModelDialog = (
    model: InstanceWorkbenchSnapshot['llmProviders'][number]['models'][number],
  ) => {
    setProviderModelDialogDraft(createProviderModelForm(model));
    setIsProviderModelDialogOpen(true);
  };

  const handleSubmitProviderModelDialog = async () => {
    if (isProviderConfigReadonly || !id || !selectedProvider) {
      return;
    }

    const modelId = providerModelDialogDraft.id.trim();
    if (!modelId) {
      toast.error(t('instances.detail.instanceWorkbench.llmProviders.toasts.modelIdRequired'));
      return;
    }

    setIsSavingProviderModelDialog(true);
    try {
      if (providerModelDialogDraft.originalId) {
        await instanceService.updateInstanceLlmProviderModel(
          id,
          selectedProvider.id,
          providerModelDialogDraft.originalId,
          {
            id: modelId,
            name: providerModelDialogDraft.name.trim() || modelId,
          },
        );
        toast.success(t('instances.detail.instanceWorkbench.llmProviders.toasts.modelUpdated'));
      } else {
        await instanceService.createInstanceLlmProviderModel(id, selectedProvider.id, {
          id: modelId,
          name: providerModelDialogDraft.name.trim() || modelId,
        });
        toast.success(t('instances.detail.instanceWorkbench.llmProviders.toasts.modelAdded'));
      }
      setIsProviderModelDialogOpen(false);
      setProviderModelDialogDraft(createEmptyProviderModelForm());
      await loadWorkbench(id, { withSpinner: false });
      setSelectedProviderId(selectedProvider.id);
    } catch (error: any) {
      toast.error(error?.message || t('instances.detail.instanceWorkbench.llmProviders.toasts.modelSaveFailed'));
    } finally {
      setIsSavingProviderModelDialog(false);
    }
  };

  const handleDeleteProviderModel = async () => {
    if (isProviderConfigReadonly || !id || !selectedProvider || !providerModelDeleteId) {
      return;
    }

    try {
      await instanceService.deleteInstanceLlmProviderModel(
        id,
        selectedProvider.id,
        providerModelDeleteId,
      );
      toast.success(t('instances.detail.instanceWorkbench.llmProviders.toasts.modelRemoved'));
      setProviderModelDeleteId(null);
      await loadWorkbench(id, { withSpinner: false });
    } catch (error: any) {
      toast.error(error?.message || t('instances.detail.instanceWorkbench.llmProviders.toasts.modelDeleteFailed'));
    }
  };

  const handleDeleteProvider = async () => {
    if (isProviderConfigReadonly || !id || !providerDeleteId) {
      return;
    }

    try {
      await instanceService.deleteInstanceLlmProvider(id, providerDeleteId);
      toast.success(t('instances.detail.instanceWorkbench.llmProviders.toasts.providerRemoved'));
      setProviderDeleteId(null);
      setSelectedProviderId(null);
      await loadWorkbench(id, { withSpinner: false });
    } catch (error: any) {
      toast.error(error?.message || t('instances.detail.instanceWorkbench.llmProviders.toasts.providerDeleteFailed'));
    }
  };

  const openCreateAgentDialog = () => {
    setEditingAgentId(null);
    setAgentDialogDraft(createOpenClawAgentFormState(null));
    setIsAgentDialogOpen(true);
  };

  const openEditAgentDialog = (agent: InstanceWorkbenchSnapshot['agents'][number]) => {
    const modelSource =
      selectedAgentWorkbench?.agent.agent.id === agent.agent.id
        ? selectedAgentWorkbench.model.source
        : 'agent';
    setEditingAgentId(agent.agent.id);
    setAgentDialogDraft(createOpenClawAgentFormState(agent, modelSource));
    setIsAgentDialogOpen(true);
  };

  const handleSaveAgentDialog = async () => {
    if (!id) {
      return;
    }

    const agentInput: OpenClawAgentInput = buildOpenClawAgentInputFromForm(agentDialogDraft);
    if (!agentInput.id) {
      toast.error(t('instances.detail.instanceWorkbench.agents.toasts.agentIdRequired'));
      return;
    }

    setIsSavingAgentDialog(true);
    try {
      if (editingAgentId) {
        await instanceService.updateOpenClawAgent(id, agentInput);
        toast.success(t('instances.detail.instanceWorkbench.agents.toasts.agentUpdated'));
      } else {
        await instanceService.createOpenClawAgent(id, agentInput);
        toast.success(t('instances.detail.instanceWorkbench.agents.toasts.agentCreated'));
      }
      setIsAgentDialogOpen(false);
      setEditingAgentId(null);
      await loadWorkbench(id, { withSpinner: false });
    } catch (error: any) {
      toast.error(error?.message || t('instances.detail.instanceWorkbench.agents.toasts.agentSaveFailed'));
    } finally {
      setIsSavingAgentDialog(false);
    }
  };

  const handleDeleteAgent = async () => {
    if (!id || !agentDeleteId) {
      return;
    }

    try {
      await instanceService.deleteOpenClawAgent(id, agentDeleteId);
      toast.success(t('instances.detail.instanceWorkbench.agents.toasts.agentRemoved'));
      setAgentDeleteId(null);
      await loadWorkbench(id, { withSpinner: false });
    } catch (error: any) {
      toast.error(error?.message || t('instances.detail.instanceWorkbench.agents.toasts.agentDeleteFailed'));
    }
  };

  const handleInstallAgentSkill = async (slug: string) => {
    if (!id || !selectedAgentWorkbench) {
      return;
    }

    setIsInstallingAgentSkill(true);
    try {
      await agentSkillManagementService.installSkill({
        instanceId: id,
        agentId: selectedAgentWorkbench.agent.agent.id,
        isDefaultAgent: Boolean(selectedAgentWorkbench.agent.isDefault),
        slug,
      });
      toast.success(t('instances.detail.instanceWorkbench.agents.toasts.skillInstalled'));
      await loadWorkbench(id, { withSpinner: false });
    } catch (error: any) {
      toast.error(
        error?.message || t('instances.detail.instanceWorkbench.agents.toasts.skillInstallFailed'),
      );
    } finally {
      setIsInstallingAgentSkill(false);
    }
  };

  const handleSetAgentSkillEnabled = async (skillKey: string, enabled: boolean) => {
    if (!id) {
      return;
    }

    setUpdatingAgentSkillKeys((current) => addPendingId(current, skillKey));
    try {
      await agentSkillManagementService.setSkillEnabled({
        instanceId: id,
        skillKey,
        enabled,
      });
      toast.success(
        enabled
          ? t('instances.detail.instanceWorkbench.agents.toasts.skillEnabled')
          : t('instances.detail.instanceWorkbench.agents.toasts.skillDisabled'),
      );
      await loadWorkbench(id, { withSpinner: false });
    } catch (error: any) {
      toast.error(
        error?.message || t('instances.detail.instanceWorkbench.agents.toasts.skillUpdateFailed'),
      );
    } finally {
      setUpdatingAgentSkillKeys((current) => removePendingId(current, skillKey));
    }
  };

  const handleRemoveAgentSkill = async (
    skill: NonNullable<AgentWorkbenchSnapshot['skills'][number]>,
  ) => {
    if (!id || !selectedAgentWorkbench) {
      return;
    }

    setRemovingAgentSkillKeys((current) => addPendingId(current, skill.skillKey));
    try {
      await agentSkillManagementService.removeSkill({
        instanceId: id,
        skillKey: skill.skillKey,
        scope: skill.scope,
        workspacePath: selectedAgentWorkbench.paths.workspacePath,
        baseDir: skill.baseDir,
        filePath: skill.filePath,
      });
      toast.success(t('instances.detail.instanceWorkbench.agents.toasts.skillRemoved'));
      await loadWorkbench(id, { withSpinner: false });
    } catch (error: any) {
      toast.error(
        error?.message || t('instances.detail.instanceWorkbench.agents.toasts.skillRemoveFailed'),
      );
    } finally {
      setRemovingAgentSkillKeys((current) => removePendingId(current, skill.skillKey));
    }
  };

  const handleRestart = async () => {
    if (!id) {
      return;
    }

    try {
      await instanceService.restartInstance(id);
      toast.success(t('instances.detail.toasts.restarted'));
      await loadWorkbench(id);
    } catch (error: any) {
      toast.error(error.message || t('instances.detail.toasts.failedToRestart'));
    }
  };

  const handleStop = async () => {
    if (!id) {
      return;
    }

    try {
      await instanceService.stopInstance(id);
      toast.success(t('instances.detail.toasts.stopped'));
      await loadWorkbench(id);
    } catch (error: any) {
      toast.error(error.message || t('instances.detail.toasts.failedToStop'));
    }
  };

  const handleStart = async () => {
    if (!id) {
      return;
    }

    try {
      await instanceService.startInstance(id);
      toast.success(t('instances.detail.toasts.started'));
      await loadWorkbench(id);
    } catch (error: any) {
      toast.error(error.message || t('instances.detail.toasts.failedToStart'));
    }
  };

  const handleOpenOpenClawConsole = async () => {
    const targetUrl = consoleAccess?.autoLoginUrl || consoleAccess?.url;
    if (!targetUrl) {
      toast.error(t('instances.detail.toasts.failedToOpenOpenClawConsole'));
      return;
    }

    try {
      await openExternalUrl(targetUrl);
      if (!consoleAccess?.autoLoginUrl && consoleAccess?.reason) {
        toast.info(consoleAccess.reason);
      }
    } catch (error: any) {
      toast.error(error?.message || t('instances.detail.toasts.failedToOpenOpenClawConsole'));
    }
  };

  const openOfficialLink = async (href: string) => {
    await openExternalUrl(href);
  };

  const handleManagedChannelSelectionChange = (channelId: string | null) => {
    setManagedChannelError(null);
    setSelectedManagedChannelId(channelId);
  };

  const handleManagedChannelDraftChange = (fieldKey: string, value: string) => {
    if (!selectedManagedChannel) {
      return;
    }

    setManagedChannelError(null);
    setManagedChannelDrafts((current) => ({
      ...current,
      [selectedManagedChannel.id]: {
        ...(current[selectedManagedChannel.id] || selectedManagedChannel.values),
        [fieldKey]: value,
      },
    }));
  };

  const handleToggleManagedChannel = async (
    channel: NonNullable<InstanceWorkbenchSnapshot['managedChannels']>[number],
    nextEnabled: boolean,
  ) => {
    if (!id) {
      return;
    }

    try {
      await instanceService.setOpenClawChannelEnabled(id, channel.id, nextEnabled);
      toast.success(
        nextEnabled ? `${channel.name} enabled.` : `${channel.name} disabled.`,
      );
      await loadWorkbench(id, { withSpinner: false });
    } catch (error: any) {
      toast.error(error?.message || `Failed to update ${channel.name}.`);
    }
  };

  const handleSaveManagedChannel = async () => {
    if (!id || !selectedManagedChannel || !selectedManagedChannelDraft) {
      return;
    }

    for (const field of selectedManagedChannel.fields) {
      if (field.required && !(selectedManagedChannelDraft[field.key] || '').trim()) {
        setManagedChannelError(`${field.label} is required.`);
        return;
      }
    }

    setIsSavingManagedChannel(true);
    setManagedChannelError(null);
    try {
      await instanceService.saveOpenClawChannelConfig(
        id,
        selectedManagedChannel.id,
        selectedManagedChannelDraft,
      );
      toast.success(`${selectedManagedChannel.name} configuration saved.`);
      setSelectedManagedChannelId(null);
      await loadWorkbench(id, { withSpinner: false });
    } catch (error: any) {
      setManagedChannelError(error?.message || `Failed to save ${selectedManagedChannel.name}.`);
    } finally {
      setIsSavingManagedChannel(false);
    }
  };

  const handleDeleteManagedChannelConfiguration = async () => {
    if (!id || !selectedManagedChannel) {
      return;
    }

    const emptyValues = selectedManagedChannel.fields.reduce<Record<string, string>>(
      (accumulator, field) => {
        accumulator[field.key] = '';
        return accumulator;
      },
      {},
    );

    setIsSavingManagedChannel(true);
    setManagedChannelError(null);
    try {
      await instanceService.saveOpenClawChannelConfig(id, selectedManagedChannel.id, emptyValues);
      await instanceService.setOpenClawChannelEnabled(id, selectedManagedChannel.id, false);
      toast.success(`${selectedManagedChannel.name} configuration removed.`);
      setManagedChannelDrafts((current) => ({
        ...current,
        [selectedManagedChannel.id]: emptyValues,
      }));
      setSelectedManagedChannelId(null);
      await loadWorkbench(id, { withSpinner: false });
    } catch (error: any) {
      setManagedChannelError(
        error?.message || `Failed to delete ${selectedManagedChannel.name} configuration.`,
      );
    } finally {
      setIsSavingManagedChannel(false);
    }
  };

  const handleWebSearchSharedDraftChange = (
    key: keyof OpenClawWebSearchSharedFormState,
    value: string | boolean,
  ) => {
    setWebSearchError(null);
    setWebSearchSharedDraft((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        [key]: value,
      };
    });
  };

  const handleWebSearchProviderDraftChange = (
    key: keyof OpenClawWebSearchProviderFormState,
    value: string,
  ) => {
    if (!selectedWebSearchProvider) {
      return;
    }

    setWebSearchError(null);
    setWebSearchProviderDrafts((current) => ({
      ...current,
      [selectedWebSearchProvider.id]: {
        ...(current[selectedWebSearchProvider.id] || createWebSearchProviderFormState(selectedWebSearchProvider)),
        [key]: value,
      },
    }));
  };

  const handleSaveWebSearchConfig = async () => {
    if (
      !id ||
      !webSearchSharedDraft ||
      !selectedWebSearchProvider ||
      !selectedWebSearchProviderDraft
    ) {
      return;
    }

    const maxResults = Number.parseInt(webSearchSharedDraft.maxResults, 10);
    const timeoutSeconds = Number.parseInt(webSearchSharedDraft.timeoutSeconds, 10);
    const cacheTtlMinutes = Number.parseInt(webSearchSharedDraft.cacheTtlMinutes, 10);

    if (!webSearchSharedDraft.provider.trim()) {
      setWebSearchError(t('instances.detail.instanceWorkbench.webSearch.errors.providerRequired'));
      return;
    }
    if (!Number.isFinite(maxResults) || maxResults <= 0) {
      setWebSearchError(t('instances.detail.instanceWorkbench.webSearch.errors.maxResultsInvalid'));
      return;
    }
    if (!Number.isFinite(timeoutSeconds) || timeoutSeconds <= 0) {
      setWebSearchError(t('instances.detail.instanceWorkbench.webSearch.errors.timeoutInvalid'));
      return;
    }
    if (!Number.isFinite(cacheTtlMinutes) || cacheTtlMinutes <= 0) {
      setWebSearchError(t('instances.detail.instanceWorkbench.webSearch.errors.cacheTtlInvalid'));
      return;
    }

    setIsSavingWebSearch(true);
    setWebSearchError(null);
    try {
      await instanceService.saveOpenClawWebSearchConfig(id, {
        enabled: webSearchSharedDraft.enabled,
        provider: webSearchSharedDraft.provider.trim(),
        maxResults,
        timeoutSeconds,
        cacheTtlMinutes,
        providerConfig: {
          providerId: selectedWebSearchProvider.id,
          apiKeySource: selectedWebSearchProviderDraft.apiKeySource,
          baseUrl: selectedWebSearchProviderDraft.baseUrl,
          model: selectedWebSearchProviderDraft.model,
          advancedConfig: selectedWebSearchProviderDraft.advancedConfig,
        },
      });
      toast.success(t('instances.detail.instanceWorkbench.webSearch.toasts.saved'));
      await loadWorkbench(id, { withSpinner: false });
    } catch (error: any) {
      setWebSearchError(
        error?.message || t('instances.detail.instanceWorkbench.webSearch.toasts.saveFailed'),
      );
    } finally {
      setIsSavingWebSearch(false);
    }
  };

  const handleAuthCooldownsDraftChange = (
    key: keyof OpenClawAuthCooldownsFormState,
    value: string,
  ) => {
    setAuthCooldownsError(null);
    setAuthCooldownsDraft((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        [key]: value,
      };
    });
  };

  const handleSaveAuthCooldownsConfig = async () => {
    if (!id || !authCooldownsDraft) {
      return;
    }

    const parseWholeNumber = (
      value: string,
      errorKey: string,
    ) => {
      const normalized = value.trim();
      if (!normalized) {
        return undefined;
      }

      const parsed = Number.parseInt(normalized, 10);
      if (!Number.isFinite(parsed) || parsed < 0) {
        throw new Error(t(errorKey));
      }

      return parsed;
    };

    let rateLimitedProfileRotations: number | undefined;
    let overloadedProfileRotations: number | undefined;
    let overloadedBackoffMs: number | undefined;
    let billingBackoffHours: number | undefined;
    let billingMaxHours: number | undefined;
    let failureWindowHours: number | undefined;

    try {
      rateLimitedProfileRotations = parseWholeNumber(
        authCooldownsDraft.rateLimitedProfileRotations,
        'instances.detail.instanceWorkbench.authCooldowns.errors.rateLimitedProfileRotationsInvalid',
      );
      overloadedProfileRotations = parseWholeNumber(
        authCooldownsDraft.overloadedProfileRotations,
        'instances.detail.instanceWorkbench.authCooldowns.errors.overloadedProfileRotationsInvalid',
      );
      overloadedBackoffMs = parseWholeNumber(
        authCooldownsDraft.overloadedBackoffMs,
        'instances.detail.instanceWorkbench.authCooldowns.errors.overloadedBackoffMsInvalid',
      );
      billingBackoffHours = parseWholeNumber(
        authCooldownsDraft.billingBackoffHours,
        'instances.detail.instanceWorkbench.authCooldowns.errors.billingBackoffHoursInvalid',
      );
      billingMaxHours = parseWholeNumber(
        authCooldownsDraft.billingMaxHours,
        'instances.detail.instanceWorkbench.authCooldowns.errors.billingMaxHoursInvalid',
      );
      failureWindowHours = parseWholeNumber(
        authCooldownsDraft.failureWindowHours,
        'instances.detail.instanceWorkbench.authCooldowns.errors.failureWindowHoursInvalid',
      );
    } catch (error: any) {
      setAuthCooldownsError(error?.message || null);
      return;
    }

    setIsSavingAuthCooldowns(true);
    setAuthCooldownsError(null);
    try {
      await instanceService.saveOpenClawAuthCooldownsConfig(id, {
        rateLimitedProfileRotations,
        overloadedProfileRotations,
        overloadedBackoffMs,
        billingBackoffHours,
        billingMaxHours,
        failureWindowHours,
      });
      toast.success(t('instances.detail.instanceWorkbench.authCooldowns.toasts.saved'));
      await loadWorkbench(id, { withSpinner: false });
    } catch (error: any) {
      setAuthCooldownsError(
        error?.message || t('instances.detail.instanceWorkbench.authCooldowns.toasts.saveFailed'),
      );
    } finally {
      setIsSavingAuthCooldowns(false);
    }
  };

  const openTaskWorkspace = (params?: Record<string, string>) => {
    if (!instance) {
      return;
    }

    if (activeInstanceId !== instance.id) {
      setActiveInstanceId(instance.id);
    }

    const search = params ? new URLSearchParams(params).toString() : '';
    navigate(search ? `/tasks?${search}` : '/tasks');
  };

  async function refreshTasksSection() {
    if (!id) {
      return;
    }

    setIsRefreshingTasks(true);
    try {
      await loadWorkbench(id, { withSpinner: false });
    } finally {
      setIsRefreshingTasks(false);
    }
  }

  async function openTaskHistoryDrawer(taskId: string) {
    setHistoryTaskId(taskId);
    setIsHistoryLoading(true);
    try {
      const entries = await instanceWorkbenchService.listTaskExecutions(taskId);
      setTaskExecutionsById((current) => ({ ...current, [taskId]: entries }));
    } catch {
      toast.error(t('tasks.page.toasts.failedToLoadHistory'));
    } finally {
      setIsHistoryLoading(false);
    }
  }

  async function handleCloneTask(taskId: string, taskName: string) {
    setCloningTaskIds((current) => addPendingId(current, taskId));
    try {
      await instanceWorkbenchService.cloneTask(
        taskId,
        t('tasks.page.actions.cloneName', { name: taskName }),
      );
      toast.success(t('tasks.page.toasts.cloned'));
      await refreshTasksSection();
    } catch (error: any) {
      toast.error(error?.message || t('tasks.page.toasts.failedToClone'));
    } finally {
      setCloningTaskIds((current) => removePendingId(current, taskId));
    }
  }

  async function handleRunTaskNow(taskId: string) {
    setRunningTaskIds((current) => addPendingId(current, taskId));
    try {
      await instanceWorkbenchService.runTaskNow(taskId);
      toast.success(t('tasks.page.toasts.ranNow'));
      await refreshTasksSection();
    } catch (error: any) {
      toast.error(error?.message || t('tasks.page.toasts.failedToRunNow'));
    } finally {
      setRunningTaskIds((current) => removePendingId(current, taskId));
    }
  }

  async function handleToggleTaskStatus(taskId: string, currentStatus: 'active' | 'paused' | 'failed') {
    const nextStatus = getTaskToggleStatusTarget(currentStatus);
    if (!nextStatus) {
      return;
    }

    setStatusTaskIds((current) => addPendingId(current, taskId));
    try {
      await instanceWorkbenchService.updateTaskStatus(taskId, nextStatus);
      toast.success(t(nextStatus === 'active' ? 'tasks.page.toasts.enabled' : 'tasks.page.toasts.disabled'));
      await refreshTasksSection();
    } catch (error: any) {
      toast.error(error?.message || t('tasks.page.toasts.failedToUpdateStatus'));
    } finally {
      setStatusTaskIds((current) => removePendingId(current, taskId));
    }
  }

  async function handleDeleteTask(taskId: string, taskName: string) {
    if (!window.confirm(t('tasks.page.confirmDelete', { name: taskName }))) {
      return;
    }

    setDeletingTaskIds((current) => addPendingId(current, taskId));
    try {
      await instanceWorkbenchService.deleteTask(taskId);
      toast.success(t('tasks.page.toasts.deleted'));
      await refreshTasksSection();
    } catch (error: any) {
      toast.error(error?.message || t('tasks.page.toasts.failedToDelete'));
    } finally {
      setDeletingTaskIds((current) => removePendingId(current, taskId));
    }
  }

  const handleDelete = async () => {
    if (!id) {
      return;
    }

    if (!window.confirm(t('instances.detail.confirmUninstall'))) {
      return;
    }

    try {
      await instanceService.deleteInstance(id);
      toast.success(t('instances.detail.toasts.uninstalled'));
      if (activeInstanceId === id) {
        setActiveInstanceId(null);
      }
      navigate('/instances');
    } catch (error: any) {
      toast.error(error.message || t('instances.detail.toasts.failedToUninstall'));
    }
  };

  const renderSectionAvailability = (sectionId: InstanceWorkbenchSectionId, fallbackKey: string) => {
    const availability = workbench?.sectionAvailability[sectionId];

    if (availability && availability.status !== 'ready') {
      return <SectionAvailabilityNotice status={availability.status} detail={availability.detail} />;
    }

    return (
      <div className="rounded-[1.5rem] bg-zinc-950/[0.03] p-5 text-sm text-zinc-500 dark:bg-white/[0.04] dark:text-zinc-400">
        {t(fallbackKey)}
      </div>
    );
  };

  const renderOverviewSection = () => {
    if (!workbench || !detail) {
      return null;
    }

    return (
      <div data-slot="instance-detail-overview" className="space-y-6">
        <div className="grid gap-4 xl:grid-cols-3">
          <div className="rounded-[1.6rem] border border-zinc-200/70 bg-white/80 p-5 dark:border-zinc-800 dark:bg-zinc-950/35">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
              {t('instances.detail.instanceWorkbench.overview.identity')}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {[detail.instance.runtimeKind, detail.instance.deploymentMode, detail.instance.transportKind].map(
                (value) => (
                  <span
                    key={value}
                    className="rounded-full bg-zinc-950/[0.04] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-600 dark:bg-white/[0.06] dark:text-zinc-300"
                  >
                    {formatWorkbenchLabel(value)}
                  </span>
                ),
              )}
            </div>
            <div className="mt-5 space-y-3">
              <RowMetric
                label={t('instances.detail.instanceWorkbench.overview.lifecycle')}
                value={formatWorkbenchLabel(detail.lifecycle.owner)}
              />
              <RowMetric
                label={t('instances.detail.instanceWorkbench.overview.host')}
                value={detail.instance.host}
              />
              <RowMetric
                label={t('instances.detail.instanceWorkbench.overview.version')}
                value={detail.instance.version}
              />
            </div>
          </div>

          <div className="rounded-[1.6rem] border border-zinc-200/70 bg-white/80 p-5 dark:border-zinc-800 dark:bg-zinc-950/35">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
              {t('instances.detail.instanceWorkbench.overview.storage')}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span
                className={`rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${getCapabilityTone(
                  detail.storage.status,
                )}`}
              >
                {formatWorkbenchLabel(detail.storage.status)}
              </span>
              <span className="rounded-full bg-zinc-950/[0.04] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-600 dark:bg-white/[0.06] dark:text-zinc-300">
                {formatWorkbenchLabel(detail.storage.provider)}
              </span>
            </div>
            <div className="mt-5 space-y-3">
              <RowMetric
                label={t('instances.detail.instanceWorkbench.overview.profile')}
                value={detail.storage.profileId || '--'}
              />
              <RowMetric
                label={t('instances.detail.instanceWorkbench.overview.namespace')}
                value={detail.storage.namespace}
              />
              <RowMetric
                label={t('instances.detail.instanceWorkbench.overview.database')}
                value={detail.storage.database || '--'}
              />
            </div>
          </div>

          <div className="rounded-[1.6rem] border border-zinc-200/70 bg-white/80 p-5 dark:border-zinc-800 dark:bg-zinc-950/35">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
              {t('instances.detail.instanceWorkbench.overview.observability')}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span
                className={`rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${getRuntimeStatusTone(
                  detail.health.status,
                )}`}
              >
                {t(`instances.detail.instanceWorkbench.runtimeStates.${detail.health.status}`)}
              </span>
              <span
                className={`rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${getCapabilityTone(
                  detail.observability.status,
                )}`}
              >
                {formatWorkbenchLabel(detail.observability.status)}
              </span>
            </div>
            <div className="mt-5 space-y-3">
              <RowMetric
                label={t('instances.detail.instanceWorkbench.overview.healthChecks')}
                value={detail.health.checks.length}
              />
              <RowMetric
                label={t('instances.detail.instanceWorkbench.overview.logLines')}
                value={detail.observability.logPreview.length}
              />
              <RowMetric
                label={t('instances.detail.instanceWorkbench.metrics.updatedAt')}
                value={detail.observability.lastSeenAt ? new Date(detail.observability.lastSeenAt).toLocaleString() : '--'}
              />
            </div>
          </div>
        </div>

        {managementSummary ? (
          <div
            data-slot="instance-detail-management-summary"
            className="rounded-[1.6rem] border border-zinc-200/70 bg-white/80 p-5 dark:border-zinc-800 dark:bg-zinc-950/35"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
                  {t('instances.detail.instanceWorkbench.overview.management.title')}
                </h3>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  {t('instances.detail.instanceWorkbench.overview.management.description')}
                </p>
              </div>
              <span className="rounded-full bg-zinc-950/[0.04] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-600 dark:bg-white/[0.06] dark:text-zinc-300">
                {managementSummary.entries.length}
              </span>
            </div>

            <div className="mt-5 grid gap-3 lg:grid-cols-2 2xl:grid-cols-5">
              {managementSummary.entries.map((entry) => (
                <div
                  key={entry.id}
                  className={`rounded-[1.3rem] border p-4 ${getManagementEntryTone(entry.tone)}`}
                >
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                    {t(entry.labelKey)}
                  </div>
                  <div
                    className={`mt-3 break-all text-sm font-semibold text-zinc-950 dark:text-zinc-50 ${
                      entry.mono ? 'font-mono text-[13px]' : ''
                    }`}
                  >
                    {entry.value}
                  </div>
                  <p className="mt-3 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                    {t(entry.detailKey)}
                  </p>
                </div>
              ))}
            </div>

            {managementSummary.notes.length > 0 ? (
              <div className="mt-5 rounded-[1.3rem] border border-zinc-200/70 bg-zinc-950/[0.02] p-4 dark:border-zinc-800 dark:bg-white/[0.03]">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                  {t('instances.detail.instanceWorkbench.overview.management.notes')}
                </div>
                <div className="mt-3 space-y-2">
                  {managementSummary.notes.map((note) => (
                    <p key={note} className="text-sm leading-6 text-zinc-600 dark:text-zinc-300">
                      {note}
                    </p>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        <div
          data-slot="instance-detail-connectivity"
          className="rounded-[1.6rem] border border-zinc-200/70 bg-white/80 p-5 dark:border-zinc-800 dark:bg-zinc-950/35"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
                {t('instances.detail.instanceWorkbench.overview.connectivity')}
              </h3>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                {t('instances.detail.instanceWorkbench.overview.connectivityDescription')}
              </p>
            </div>
            <span className="rounded-full bg-zinc-950/[0.04] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-600 dark:bg-white/[0.06] dark:text-zinc-300">
              {detail.connectivity.endpoints.length}
            </span>
          </div>

          {detail.connectivity.endpoints.length > 0 ? (
            <div className="mt-5 grid gap-3 lg:grid-cols-2">
              {detail.connectivity.endpoints.map((endpoint) => (
                <div
                  key={endpoint.id}
                  className="rounded-[1.3rem] border border-zinc-200/70 bg-zinc-950/[0.02] p-4 dark:border-zinc-800 dark:bg-white/[0.03]"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                      {endpoint.label}
                    </h4>
                    <span
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${getCapabilityTone(
                        endpoint.status,
                      )}`}
                    >
                      {formatWorkbenchLabel(endpoint.status)}
                    </span>
                  </div>
                  <div className="mt-3 rounded-2xl bg-zinc-950/[0.04] px-4 py-3 font-mono text-sm text-zinc-600 dark:bg-white/[0.06] dark:text-zinc-300">
                    {endpoint.url || '--'}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {buildInstanceDetailBadgeDescriptors(endpoint.id, [
                      { slot: 'kind', value: endpoint.kind },
                      { slot: 'exposure', value: endpoint.exposure },
                      { slot: 'auth', value: endpoint.auth },
                    ]).map((badge) => (
                      <span
                        key={badge.key}
                        className="rounded-full bg-zinc-950/[0.04] px-2.5 py-1 text-xs font-medium text-zinc-600 dark:bg-white/[0.06] dark:text-zinc-300"
                      >
                        {formatWorkbenchLabel(badge.value)}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-5 text-sm text-zinc-500 dark:text-zinc-400">
              {t('instances.detail.instanceWorkbench.overview.noConnectivity')}
            </div>
          )}
        </div>

        <div
          data-slot="instance-detail-capability-matrix"
          className="rounded-[1.6rem] border border-zinc-200/70 bg-white/80 p-5 dark:border-zinc-800 dark:bg-zinc-950/35"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
                {t('instances.detail.instanceWorkbench.overview.capabilities')}
              </h3>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                {t('instances.detail.instanceWorkbench.overview.capabilitiesDescription')}
              </p>
            </div>
            <span className="rounded-full bg-zinc-950/[0.04] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-600 dark:bg-white/[0.06] dark:text-zinc-300">
              {detail.capabilities.length}
            </span>
          </div>
          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            {detail.capabilities.map((capability) => (
              <div
                key={capability.id}
                className="rounded-[1.3rem] border border-zinc-200/70 bg-zinc-950/[0.02] p-4 dark:border-zinc-800 dark:bg-white/[0.03]"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                    {formatWorkbenchLabel(capability.id)}
                  </h4>
                  <span
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${getCapabilityTone(
                      capability.status,
                    )}`}
                  >
                    {formatWorkbenchLabel(capability.status)}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                  {capability.detail}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div
          data-slot="instance-detail-data-access"
          className="rounded-[1.6rem] border border-zinc-200/70 bg-white/80 p-5 dark:border-zinc-800 dark:bg-zinc-950/35"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
                {t('instances.detail.instanceWorkbench.overview.dataAccess')}
              </h3>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                {t('instances.detail.instanceWorkbench.overview.dataAccessDescription')}
              </p>
            </div>
            <span className="rounded-full bg-zinc-950/[0.04] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-600 dark:bg-white/[0.06] dark:text-zinc-300">
              {detail.dataAccess.routes.length}
            </span>
          </div>

          {detail.dataAccess.routes.length > 0 ? (
            <div className="mt-5 grid gap-3 lg:grid-cols-2">
              {detail.dataAccess.routes.map((route) => (
                <div
                  key={route.id}
                  className="rounded-[1.3rem] border border-zinc-200/70 bg-zinc-950/[0.02] p-4 dark:border-zinc-800 dark:bg-white/[0.03]"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                      {route.label}
                    </h4>
                    <span
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${getCapabilityTone(
                        route.status,
                      )}`}
                    >
                      {formatWorkbenchLabel(route.status)}
                    </span>
                  </div>
                  <div className="mt-3 rounded-2xl bg-zinc-950/[0.04] px-4 py-3 font-mono text-sm text-zinc-600 dark:bg-white/[0.06] dark:text-zinc-300">
                    {route.target || '--'}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {buildInstanceDetailBadgeDescriptors(route.id, [
                      { slot: 'scope', value: route.scope },
                      { slot: 'mode', value: route.mode },
                      { slot: 'source', value: route.source },
                    ]).map((badge) => (
                      <span
                        key={badge.key}
                        className="rounded-full bg-zinc-950/[0.04] px-2.5 py-1 text-xs font-medium text-zinc-600 dark:bg-white/[0.06] dark:text-zinc-300"
                      >
                        {formatWorkbenchLabel(badge.value)}
                      </span>
                    ))}
                    <span className="rounded-full bg-zinc-950/[0.04] px-2.5 py-1 text-xs font-medium text-zinc-600 dark:bg-white/[0.06] dark:text-zinc-300">
                      {formatWorkbenchLabel(route.authoritative ? 'authoritative' : 'derived')}
                    </span>
                    <span className="rounded-full bg-zinc-950/[0.04] px-2.5 py-1 text-xs font-medium text-zinc-600 dark:bg-white/[0.06] dark:text-zinc-300">
                      {formatWorkbenchLabel(route.readonly ? 'readonly' : 'writable')}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                    {route.detail}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-5 text-sm text-zinc-500 dark:text-zinc-400">
              {t('instances.detail.instanceWorkbench.overview.noDataAccess')}
            </div>
          )}
        </div>

        <div
          data-slot="instance-detail-artifacts"
          className="rounded-[1.6rem] border border-zinc-200/70 bg-white/80 p-5 dark:border-zinc-800 dark:bg-zinc-950/35"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
                {t('instances.detail.instanceWorkbench.overview.artifacts')}
              </h3>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                {t('instances.detail.instanceWorkbench.overview.artifactsDescription')}
              </p>
            </div>
            <span className="rounded-full bg-zinc-950/[0.04] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-600 dark:bg-white/[0.06] dark:text-zinc-300">
              {detail.artifacts.length}
            </span>
          </div>

          {detail.artifacts.length > 0 ? (
            <div className="mt-5 grid gap-3 lg:grid-cols-2">
              {detail.artifacts.map((artifact) => (
                <div
                  key={artifact.id}
                  className="rounded-[1.3rem] border border-zinc-200/70 bg-zinc-950/[0.02] p-4 dark:border-zinc-800 dark:bg-white/[0.03]"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                      {artifact.label}
                    </h4>
                    <span
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${getCapabilityTone(
                        artifact.status,
                      )}`}
                    >
                      {formatWorkbenchLabel(artifact.status)}
                    </span>
                  </div>
                  <div className="mt-3 rounded-2xl bg-zinc-950/[0.04] px-4 py-3 font-mono text-sm text-zinc-600 dark:bg-white/[0.06] dark:text-zinc-300">
                    {artifact.location || '--'}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {buildInstanceDetailBadgeDescriptors(artifact.id, [
                      { slot: 'kind', value: artifact.kind },
                      { slot: 'source', value: artifact.source },
                    ]).map((badge) => (
                      <span
                        key={badge.key}
                        className="rounded-full bg-zinc-950/[0.04] px-2.5 py-1 text-xs font-medium text-zinc-600 dark:bg-white/[0.06] dark:text-zinc-300"
                      >
                        {formatWorkbenchLabel(badge.value)}
                      </span>
                    ))}
                    <span className="rounded-full bg-zinc-950/[0.04] px-2.5 py-1 text-xs font-medium text-zinc-600 dark:bg-white/[0.06] dark:text-zinc-300">
                      {formatWorkbenchLabel(artifact.readonly ? 'readonly' : 'writable')}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                    {artifact.detail}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-5 text-sm text-zinc-500 dark:text-zinc-400">
              {t('instances.detail.instanceWorkbench.overview.noArtifacts')}
            </div>
          )}
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
          <WorkbenchRowList>
            {detail.health.checks.map((check, index) => (
              <WorkbenchRow key={check.id} isLast={index === detail.health.checks.length - 1}>
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
                      {check.label}
                    </h3>
                    <span
                      className={`rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${getRuntimeStatusTone(
                        check.status,
                      )}`}
                    >
                      {t(`instances.detail.instanceWorkbench.runtimeStates.${check.status}`)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                    {check.detail}
                  </p>
                </div>
                <div className="flex flex-wrap gap-5">
                  <RowMetric
                    label={t('instances.detail.instanceWorkbench.summary.healthScore')}
                    value={`${detail.health.score}%`}
                  />
                </div>
                <div className="text-right text-sm text-zinc-500 dark:text-zinc-400">
                  {detail.health.evaluatedAt ? new Date(detail.health.evaluatedAt).toLocaleString() : '--'}
                </div>
              </WorkbenchRow>
            ))}
          </WorkbenchRowList>

          <div className="space-y-4">
            <div className="rounded-[1.6rem] border border-zinc-200/70 bg-white/80 p-5 dark:border-zinc-800 dark:bg-zinc-950/35">
              <h3 className="text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
                {t('instances.detail.instanceWorkbench.overview.runtimeNotes')}
              </h3>
              <div className="mt-4 space-y-4">
                {detail.officialRuntimeNotes.map((note) => (
                  <div key={note.title} className="rounded-2xl bg-zinc-950/[0.03] p-4 dark:bg-white/[0.04]">
                    <div className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">{note.title}</div>
                    <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">{note.content}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[1.6rem] border border-zinc-200/70 bg-white/80 p-5 dark:border-zinc-800 dark:bg-zinc-950/35">
              <h3 className="text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
                {t('instances.detail.instanceWorkbench.overview.logPreview')}
              </h3>
              <div className="mt-4 rounded-2xl bg-zinc-950/[0.04] px-4 py-3 font-mono text-xs leading-6 text-zinc-600 dark:bg-white/[0.06] dark:text-zinc-300 whitespace-pre-wrap">
                {detail.observability.logPreview.length > 0 ? detail.observability.logPreview.join('\n') : '--'}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderChannelsSection = () => {
    if (!workbench || workbench.channels.length === 0) {
      return renderSectionAvailability('channels', 'instances.detail.instanceWorkbench.empty.channels');
    }

    return (
      <ChannelWorkspace
        items={canEditManagedChannels ? managedChannelWorkspaceItems : readonlyChannelWorkspaceItems}
        variant={canEditManagedChannels ? 'management' : 'summary'}
        managedFilePath={managedConfigPath}
        selectedChannelId={canEditManagedChannels ? selectedManagedChannel?.id || null : null}
        valuesByChannelId={managedChannelDrafts}
        error={managedChannelError}
        isSaving={isSavingManagedChannel}
        texts={{
          managedFileLabel: formatWorkbenchLabel('managedFile'),
          statusActive: t('channels.page.status.active'),
          statusConnected: t('dashboard.status.connected'),
          statusDisconnected: t('dashboard.status.disconnected'),
          statusNotConfigured: t('dashboard.status.not_configured'),
          actionConnect: t('channels.page.actions.connect'),
          actionConfigure: t('channels.page.actions.configure'),
          actionDownloadApp: t('channels.page.actions.downloadApp'),
          actionOpenOfficialSite: t('channels.page.actions.openOfficialSite'),
          actionEnableChannel: (name: string) => t('channels.page.actions.enableChannel', { name }),
          metricConfiguredFields: t('instances.detail.instanceWorkbench.metrics.configuredFields'),
          metricSetupSteps: t('instances.detail.instanceWorkbench.metrics.setupSteps'),
          metricDeliveryState: t('instances.detail.instanceWorkbench.metrics.deliveryState'),
          stateEnabled: t('instances.detail.instanceWorkbench.state.enabled'),
          statePending: t('instances.detail.instanceWorkbench.state.pending'),
          summaryFallback: t('instances.detail.instanceWorkbench.empty.channels'),
          panelEyebrow: t('channels.page.panel.configuration'),
          setupGuideTitle: t('channels.page.panel.setupGuide'),
          credentialsTitle: t('channels.page.panel.credentials'),
          saveAction: t('common.save'),
          savingAction: t('common.loading'),
          deleteConfigurationAction: t('channels.page.actions.deleteConfiguration'),
        }}
        onOpenOfficialLink={(_channel, link) => void openOfficialLink(link.href)}
        onSelectedChannelIdChange={handleManagedChannelSelectionChange}
        onFieldChange={(_channel, fieldKey, value) => {
          handleManagedChannelDraftChange(fieldKey, value);
        }}
        onSave={() => void handleSaveManagedChannel()}
        onDeleteConfiguration={() => void handleDeleteManagedChannelConfiguration()}
        onToggleEnabled={(channel, nextEnabled) => {
          const managedChannel = managedChannels.find((item) => item.id === channel.id);
          if (managedChannel) {
            void handleToggleManagedChannel(managedChannel, nextEnabled);
          }
        }}
      />
    );
  };

  const renderTasksSection = () => {
    if (!workbench) {
      return null;
    }

    return <CronTasksManager instanceId={id} embedded />;
  };

  const renderAgentsSection = () => {
    if (!workbench) {
      return null;
    }

    return (
      <div className="space-y-6">
        <AgentWorkbenchPanel
          workbench={workbench}
          snapshot={selectedAgentWorkbench}
          errorMessage={agentWorkbenchError}
          selectedAgentId={selectedAgentId}
          onSelectedAgentIdChange={setSelectedAgentId}
          onOpenAgentMarket={() =>
            navigate(id ? `/agents?instanceId=${encodeURIComponent(id)}` : '/agents')
          }
          onCreateAgent={openCreateAgentDialog}
          onEditAgent={openEditAgentDialog}
          onDeleteAgent={setAgentDeleteId}
          onInstallSkill={handleInstallAgentSkill}
          onSetSkillEnabled={handleSetAgentSkillEnabled}
          onRemoveSkill={handleRemoveAgentSkill}
          isReadonly={!isOpenClawConfigWritable}
          isLoading={isAgentWorkbenchLoading}
          isFilesLoading={isWorkbenchFilesLoading}
          isInstallingSkill={isInstallingAgentSkill}
          updatingSkillKeys={updatingAgentSkillKeys}
          removingSkillKeys={removingAgentSkillKeys}
          onReload={() => (id ? loadWorkbench(id, { withSpinner: false }) : undefined)}
        />

        <Dialog open={isAgentDialogOpen} onOpenChange={setIsAgentDialogOpen}>
          <DialogContent className="sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>
                {editingAgentId
                  ? t('instances.detail.instanceWorkbench.agents.dialog.titleEdit')
                  : t('instances.detail.instanceWorkbench.agents.dialog.titleCreate')}
              </DialogTitle>
              <DialogDescription>
                {t('instances.detail.instanceWorkbench.agents.dialog.description')}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-2 md:grid-cols-2">
              <label className="block">
                <Label className="mb-2">{t('instances.detail.instanceWorkbench.agents.dialog.agentId')}</Label>
                <Input
                  value={agentDialogDraft.id}
                  onChange={(event) =>
                    setAgentDialogDraft((current) => ({ ...current, id: event.target.value }))
                  }
                  placeholder={t('instances.detail.instanceWorkbench.agents.dialog.placeholders.agentId')}
                />
              </label>
              <label className="block">
                <Label className="mb-2">{t('instances.detail.instanceWorkbench.agents.dialog.displayName')}</Label>
                <Input
                  value={agentDialogDraft.name}
                  onChange={(event) =>
                    setAgentDialogDraft((current) => ({ ...current, name: event.target.value }))
                  }
                  placeholder={t('instances.detail.instanceWorkbench.agents.dialog.placeholders.displayName')}
                />
              </label>
              <label className="block">
                <Label className="mb-2">{t('instances.detail.instanceWorkbench.agents.dialog.avatar')}</Label>
                <Input
                  value={agentDialogDraft.avatar}
                  onChange={(event) =>
                    setAgentDialogDraft((current) => ({ ...current, avatar: event.target.value }))
                  }
                  placeholder="*"
                />
              </label>
              <label className="block">
                <Label className="mb-2">{t('instances.detail.instanceWorkbench.agents.panel.primaryModel')}</Label>
                <Select
                  value={agentDialogDraft.primaryModel || '__inherit__'}
                  onValueChange={(value) =>
                    setAgentDialogDraft((current) => ({
                      ...current,
                      primaryModel: value === '__inherit__' ? '' : value,
                    }))
                  }
                >
                  <SelectTrigger className="rounded-2xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__inherit__">
                      {t('instances.detail.instanceWorkbench.agents.panel.inheritDefaults')}
                    </SelectItem>
                    {availableAgentModelOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {agentDialogDraft.fieldSources.model === 'defaults' &&
                (agentDialogDraft.inherited.primaryModel ||
                  agentDialogDraft.inherited.fallbackModelsText) ? (
                  <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                    {formatAgentConfigSource(agentDialogDraft.fieldSources.model, t)}
                    {' · '}
                    {agentDialogDraft.inherited.primaryModel || t('common.none')}
                  </div>
                ) : null}
              </label>
              <label className="block md:col-span-2">
                <Label className="mb-2">{t('instances.detail.instanceWorkbench.agents.panel.fallbackModels')}</Label>
                <Textarea
                  value={agentDialogDraft.fallbackModelsText}
                  onChange={(event) =>
                    setAgentDialogDraft((current) => ({
                      ...current,
                      fallbackModelsText: event.target.value,
                    }))
                  }
                  placeholder={t('instances.detail.instanceWorkbench.agents.dialog.placeholders.fallbackModels')}
                  rows={4}
                />
                {agentDialogDraft.fieldSources.model === 'defaults' &&
                agentDialogDraft.inherited.fallbackModelsText ? (
                  <div className="mt-2 whitespace-pre-line text-xs text-zinc-500 dark:text-zinc-400">
                    {formatAgentConfigSource(agentDialogDraft.fieldSources.model, t)}
                    {' · '}
                    {agentDialogDraft.inherited.fallbackModelsText}
                  </div>
                ) : null}
              </label>
              <label className="block md:col-span-2">
                <Label className="mb-2">{t('instances.detail.instanceWorkbench.agents.dialog.workspace')}</Label>
                <Input
                  value={agentDialogDraft.workspace}
                  onChange={(event) =>
                    setAgentDialogDraft((current) => ({ ...current, workspace: event.target.value }))
                  }
                  placeholder={t('instances.detail.instanceWorkbench.agents.dialog.placeholders.workspace')}
                />
              </label>
              <label className="block md:col-span-2">
                <Label className="mb-2">{t('instances.detail.instanceWorkbench.agents.dialog.agentDir')}</Label>
                <Input
                  value={agentDialogDraft.agentDir}
                  onChange={(event) =>
                    setAgentDialogDraft((current) => ({ ...current, agentDir: event.target.value }))
                  }
                  placeholder={t('instances.detail.instanceWorkbench.agents.dialog.placeholders.agentDir')}
                />
              </label>
              <label className="block">
                <Label className="mb-2">{t('instances.detail.instanceWorkbench.llmProviders.temperature')}</Label>
                <Input
                  value={agentDialogDraft.temperature}
                  onChange={(event) =>
                    setAgentDialogDraft((current) => ({ ...current, temperature: event.target.value }))
                  }
                  placeholder={agentDialogDraft.inherited.temperature || '0.2'}
                />
                {agentDialogDraft.fieldSources.temperature === 'defaults' &&
                agentDialogDraft.inherited.temperature ? (
                  <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                    {formatAgentConfigSource(agentDialogDraft.fieldSources.temperature, t)}
                    {' · '}
                    {agentDialogDraft.inherited.temperature}
                  </div>
                ) : null}
              </label>
              <label className="block">
                <Label className="mb-2">{t('instances.detail.instanceWorkbench.llmProviders.topP')}</Label>
                <Input
                  value={agentDialogDraft.topP}
                  onChange={(event) =>
                    setAgentDialogDraft((current) => ({ ...current, topP: event.target.value }))
                  }
                  placeholder={agentDialogDraft.inherited.topP || '1'}
                />
                {agentDialogDraft.fieldSources.topP === 'defaults' &&
                agentDialogDraft.inherited.topP ? (
                  <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                    {formatAgentConfigSource(agentDialogDraft.fieldSources.topP, t)}
                    {' · '}
                    {agentDialogDraft.inherited.topP}
                  </div>
                ) : null}
              </label>
              <label className="block">
                <Label className="mb-2">{t('instances.detail.instanceWorkbench.llmProviders.maxTokens')}</Label>
                <Input
                  value={agentDialogDraft.maxTokens}
                  onChange={(event) =>
                    setAgentDialogDraft((current) => ({ ...current, maxTokens: event.target.value }))
                  }
                  placeholder={agentDialogDraft.inherited.maxTokens || '32000'}
                />
                {agentDialogDraft.fieldSources.maxTokens === 'defaults' &&
                agentDialogDraft.inherited.maxTokens ? (
                  <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                    {formatAgentConfigSource(agentDialogDraft.fieldSources.maxTokens, t)}
                    {' · '}
                    {agentDialogDraft.inherited.maxTokens}
                  </div>
                ) : null}
              </label>
              <label className="block">
                <Label className="mb-2">{t('instances.detail.instanceWorkbench.llmProviders.timeoutMs')}</Label>
                <Input
                  value={agentDialogDraft.timeoutMs}
                  onChange={(event) =>
                    setAgentDialogDraft((current) => ({ ...current, timeoutMs: event.target.value }))
                  }
                  placeholder={agentDialogDraft.inherited.timeoutMs || '60000'}
                />
                {agentDialogDraft.fieldSources.timeoutMs === 'defaults' &&
                agentDialogDraft.inherited.timeoutMs ? (
                  <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                    {formatAgentConfigSource(agentDialogDraft.fieldSources.timeoutMs, t)}
                    {' · '}
                    {agentDialogDraft.inherited.timeoutMs}
                  </div>
                ) : null}
              </label>
              <label className="flex items-center justify-between gap-4 rounded-2xl border border-zinc-200 bg-white px-4 py-3 md:col-span-2 dark:border-zinc-700 dark:bg-zinc-950">
                <div>
                  <div className="text-sm font-medium text-zinc-950 dark:text-zinc-50">
                    {t('instances.detail.instanceWorkbench.agents.dialog.defaultAgent')}
                  </div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
                    {t('instances.detail.instanceWorkbench.agents.dialog.defaultAgentDescription')}
                  </div>
                </div>
                <Switch
                  checked={agentDialogDraft.isDefault}
                  onCheckedChange={(checked) =>
                    setAgentDialogDraft((current) => ({ ...current, isDefault: checked }))
                  }
                />
              </label>
              <label className="flex items-center justify-between gap-4 rounded-2xl border border-zinc-200 bg-white px-4 py-3 md:col-span-2 dark:border-zinc-700 dark:bg-zinc-950">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-zinc-950 dark:text-zinc-50">
                    {t('instances.detail.instanceWorkbench.llmProviders.streaming')}
                  </div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
                    {t('instances.detail.instanceWorkbench.agents.dialog.streamingDescription')}
                  </div>
                  {agentDialogDraft.fieldSources.streaming === 'defaults' &&
                  agentDialogDraft.inherited.streaming !== null ? (
                    <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                      {formatAgentConfigSource(agentDialogDraft.fieldSources.streaming, t)}
                      {' · '}
                      {formatAgentStreamingValue(agentDialogDraft.inherited.streaming, t)}
                    </div>
                  ) : null}
                </div>
                <Select
                  value={agentDialogDraft.streamingMode}
                  onValueChange={(value) =>
                    setAgentDialogDraft((current) => ({
                      ...current,
                      streamingMode: value as OpenClawAgentFormState['streamingMode'],
                    }))
                  }
                >
                  <SelectTrigger className="w-[12rem] rounded-2xl">
                    <SelectValue>
                      {formatAgentStreamingMode(agentDialogDraft.streamingMode, t)}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inherit">
                      {t('instances.detail.instanceWorkbench.agents.panel.inheritDefaults')}
                    </SelectItem>
                    <SelectItem value="enabled">
                      {t('instances.detail.instanceWorkbench.state.enabled')}
                    </SelectItem>
                    <SelectItem value="disabled">
                      {t('instances.detail.instanceWorkbench.agents.skillStates.disabled')}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </label>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAgentDialogOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button onClick={() => void handleSaveAgentDialog()} disabled={isSavingAgentDialog}>
                {isSavingAgentDialog ? t('common.loading') : t('common.save')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={Boolean(agentDeleteId)} onOpenChange={(open) => !open && setAgentDeleteId(null)}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{t('instances.detail.instanceWorkbench.agents.deleteDialog.title')}</DialogTitle>
              <DialogDescription>
                {t('instances.detail.instanceWorkbench.agents.deleteDialog.description')}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAgentDeleteId(null)}>
                {t('common.cancel')}
              </Button>
              <Button
                onClick={() => void handleDeleteAgent()}
                className="bg-rose-600 text-white hover:bg-rose-700"
              >
                {t('common.delete')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  };

  const renderSkillsSection = () => {
    if (!workbench || workbench.skills.length === 0) {
      return renderSectionAvailability('skills', 'instances.detail.instanceWorkbench.empty.skills');
    }

    return (
      <WorkbenchRowList>
        {workbench.skills.map((skill, index) => (
          <WorkbenchRow key={skill.id} isLast={index === workbench.skills.length - 1}>
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
                  {skill.name}
                </h3>
                <span className="rounded-full bg-zinc-950/[0.04] px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-600 dark:bg-white/[0.06] dark:text-zinc-300">
                  {skill.category}
                </span>
              </div>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                {skill.description}
              </p>
            </div>
            <div className="flex flex-wrap gap-5">
              <RowMetric
                label={t('instances.detail.instanceWorkbench.metrics.version')}
                value={skill.version || '--'}
              />
              <RowMetric
                label={t('instances.detail.instanceWorkbench.metrics.downloads')}
                value={skill.downloads.toLocaleString()}
              />
              <RowMetric
                label={t('instances.detail.instanceWorkbench.metrics.rating')}
                value={skill.rating.toFixed(1)}
              />
            </div>
            <div className="text-right text-sm text-zinc-500 dark:text-zinc-400">
              {skill.author}
            </div>
          </WorkbenchRow>
        ))}
      </WorkbenchRowList>
    );
  };

  const renderLlmProvidersSection = () => renderManagedLlmProviderSection();

    /*

                      {model.name} ·{' '}



    */
  const renderOpenClawProviderDialogs = () => {
    const defaultDialogModelValue =
      providerDialogDraft.defaultModelId &&
      providerDialogModels.some((model) => model.id === providerDialogDraft.defaultModelId)
        ? providerDialogDraft.defaultModelId
        : '__auto__';
    const reasoningDialogModelValue =
      providerDialogDraft.reasoningModelId &&
      providerDialogModels.some((model) => model.id === providerDialogDraft.reasoningModelId)
        ? providerDialogDraft.reasoningModelId
        : '__none__';
    const embeddingDialogModelValue =
      providerDialogDraft.embeddingModelId &&
      providerDialogModels.some((model) => model.id === providerDialogDraft.embeddingModelId)
        ? providerDialogDraft.embeddingModelId
        : '__none__';

    return (
      <>
        <Dialog
          open={isProviderDialogOpen}
          onOpenChange={(open) => {
            setIsProviderDialogOpen(open);
            if (!open) {
              setProviderDialogDraft(createEmptyProviderForm());
            }
          }}
        >
          <DialogContent className="sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>{t('instances.detail.instanceWorkbench.llmProviders.dialog.titleCreate')}</DialogTitle>
              <DialogDescription>
                {t('instances.detail.instanceWorkbench.llmProviders.dialog.description')}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-2 md:grid-cols-2">
              <label className="block">
                <Label className="mb-2">{t('instances.detail.instanceWorkbench.llmProviders.dialog.providerId')}</Label>
                <Input
                  value={providerDialogDraft.id}
                  onChange={(event) =>
                    setProviderDialogDraft((current) => ({ ...current, id: event.target.value }))
                  }
                  placeholder={t('instances.detail.instanceWorkbench.llmProviders.dialog.placeholders.providerId')}
                />
              </label>
              <label className="block">
                <Label className="mb-2">{t('instances.detail.instanceWorkbench.llmProviders.dialog.displayName')}</Label>
                <Input
                  value={providerDialogDraft.name}
                  onChange={(event) =>
                    setProviderDialogDraft((current) => ({ ...current, name: event.target.value }))
                  }
                  placeholder={t('instances.detail.instanceWorkbench.llmProviders.dialog.placeholders.displayName')}
                />
              </label>
              <label className="block">
                <Label className="mb-2">{t('instances.detail.instanceWorkbench.llmProviders.endpoint')}</Label>
                <Input
                  value={providerDialogDraft.endpoint}
                  onChange={(event) =>
                    setProviderDialogDraft((current) => ({ ...current, endpoint: event.target.value }))
                  }
                  placeholder={t('instances.detail.instanceWorkbench.llmProviders.dialog.placeholders.endpoint')}
                />
              </label>
              <label className="block">
                <Label className="mb-2">{t('instances.detail.instanceWorkbench.llmProviders.apiKeySource')}</Label>
                <Input
                  value={providerDialogDraft.apiKeySource}
                  onChange={(event) =>
                    setProviderDialogDraft((current) => ({
                      ...current,
                      apiKeySource: event.target.value,
                    }))
                  }
                  placeholder={t('instances.detail.instanceWorkbench.llmProviders.dialog.placeholders.apiKeySource')}
                />
              </label>
              <label className="block md:col-span-2">
                <Label className="mb-2">{t('instances.detail.instanceWorkbench.llmProviders.dialog.models')}</Label>
                <Textarea
                  value={providerDialogDraft.modelsText}
                  onChange={(event) =>
                    setProviderDialogDraft((current) => ({ ...current, modelsText: event.target.value }))
                  }
                  placeholder={t('instances.detail.instanceWorkbench.llmProviders.dialog.placeholders.models')}
                  rows={6}
                />
              </label>
              <label className="block">
                <Label className="mb-2">{t('instances.detail.instanceWorkbench.llmProviders.defaultModel')}</Label>
                <Select
                  value={defaultDialogModelValue}
                  onValueChange={(value) =>
                    setProviderDialogDraft((current) => ({
                      ...current,
                      defaultModelId: value === '__auto__' ? '' : value,
                    }))
                  }
                  disabled={providerDialogModels.length === 0}
                >
                  <SelectTrigger className="rounded-2xl">
                    <SelectValue
                      placeholder={t('instances.detail.instanceWorkbench.llmProviders.dialog.useFirstModel')}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__auto__">
                      {t('instances.detail.instanceWorkbench.llmProviders.dialog.useFirstModel')}
                    </SelectItem>
                    {providerDialogModels.map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
              <label className="block">
                <Label className="mb-2">{t('instances.detail.instanceWorkbench.llmProviders.reasoningModel')}</Label>
                <Select
                  value={reasoningDialogModelValue}
                  onValueChange={(value) =>
                    setProviderDialogDraft((current) => ({
                      ...current,
                      reasoningModelId: value === '__none__' ? '' : value,
                    }))
                  }
                  disabled={providerDialogModels.length === 0}
                >
                  <SelectTrigger className="rounded-2xl">
                    <SelectValue placeholder={t('common.none')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">{t('common.none')}</SelectItem>
                    {providerDialogModels.map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
              <label className="block md:col-span-2">
                <Label className="mb-2">{t('instances.detail.instanceWorkbench.llmProviders.embeddingModel')}</Label>
                <Select
                  value={embeddingDialogModelValue}
                  onValueChange={(value) =>
                    setProviderDialogDraft((current) => ({
                      ...current,
                      embeddingModelId: value === '__none__' ? '' : value,
                    }))
                  }
                  disabled={providerDialogModels.length === 0}
                >
                  <SelectTrigger className="rounded-2xl">
                    <SelectValue placeholder={t('common.none')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">{t('common.none')}</SelectItem>
                    {providerDialogModels.map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                        {model.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsProviderDialogOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button onClick={() => void handleSubmitProviderDialog()} disabled={isSavingProviderDialog}>
                {isSavingProviderDialog ? t('common.loading') : t('common.save')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={isProviderModelDialogOpen}
          onOpenChange={(open) => {
            setIsProviderModelDialogOpen(open);
            if (!open) {
              setProviderModelDialogDraft(createEmptyProviderModelForm());
            }
          }}
        >
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>
                {providerModelDialogDraft.originalId
                  ? t('instances.detail.instanceWorkbench.llmProviders.modelDialog.titleEdit')
                  : t('instances.detail.instanceWorkbench.llmProviders.modelDialog.titleCreate')}
              </DialogTitle>
              <DialogDescription>
                {t('instances.detail.instanceWorkbench.llmProviders.modelDialog.description')}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <label className="block">
                <Label className="mb-2">{t('instances.detail.instanceWorkbench.llmProviders.modelDialog.modelId')}</Label>
                <Input
                  value={providerModelDialogDraft.id}
                  onChange={(event) =>
                    setProviderModelDialogDraft((current) => ({ ...current, id: event.target.value }))
                  }
                  placeholder={t('instances.detail.instanceWorkbench.llmProviders.modelDialog.placeholders.modelId')}
                />
              </label>
              <label className="block">
                <Label className="mb-2">{t('instances.detail.instanceWorkbench.llmProviders.modelDialog.displayName')}</Label>
                <Input
                  value={providerModelDialogDraft.name}
                  onChange={(event) =>
                    setProviderModelDialogDraft((current) => ({ ...current, name: event.target.value }))
                  }
                  placeholder={t('instances.detail.instanceWorkbench.llmProviders.modelDialog.placeholders.displayName')}
                />
              </label>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsProviderModelDialogOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button onClick={() => void handleSubmitProviderModelDialog()} disabled={isSavingProviderModelDialog}>
                {isSavingProviderModelDialog ? t('common.loading') : t('common.save')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={Boolean(providerDeleteId)} onOpenChange={(open) => !open && setProviderDeleteId(null)}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{t('instances.detail.instanceWorkbench.llmProviders.deleteProviderDialog.title')}</DialogTitle>
              <DialogDescription>
                {t('instances.detail.instanceWorkbench.llmProviders.deleteProviderDialog.descriptionPrefix')}{' '}
                <span className="font-mono text-xs">{deletingProvider?.id || providerDeleteId}</span>{' '}
                {t('instances.detail.instanceWorkbench.llmProviders.deleteProviderDialog.descriptionSuffix')}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setProviderDeleteId(null)}>
                {t('common.cancel')}
              </Button>
              <Button onClick={() => void handleDeleteProvider()} className="bg-rose-600 text-white hover:bg-rose-700">
                {t('common.delete')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={Boolean(providerModelDeleteId)} onOpenChange={(open) => !open && setProviderModelDeleteId(null)}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{t('instances.detail.instanceWorkbench.llmProviders.deleteModelDialog.title')}</DialogTitle>
              <DialogDescription>
                {t('instances.detail.instanceWorkbench.llmProviders.deleteModelDialog.descriptionPrefix')}{' '}
                <span className="font-mono text-xs">{deletingProviderModel?.id || providerModelDeleteId}</span>{' '}
                {t('instances.detail.instanceWorkbench.llmProviders.deleteModelDialog.descriptionSuffix')}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setProviderModelDeleteId(null)}>
                {t('common.cancel')}
              </Button>
              <Button onClick={() => void handleDeleteProviderModel()} className="bg-rose-600 text-white hover:bg-rose-700">
                {t('common.delete')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  };

  const renderManagedLlmProviderSection = () => {
    if (!workbench) {
      return null;
    }

    const hasProviders = workbench.llmProviders.length > 0;
    const providerWorkspaceDescription = isProviderConfigReadonly ? t('instances.detail.instanceWorkbench.llmProviders.readonlyNotice') : t('instances.detail.instanceWorkbench.llmProviders.panel.description');
    const providerWorkspaceActionLabel = isProviderConfigReadonly ? t('providerCenter.page.title') : t('instances.detail.instanceWorkbench.llmProviders.panel.newProvider');

    return (
      <>
        <div className="space-y-6">
          <div className="rounded-[1.5rem] border border-zinc-200/70 bg-white/80 p-5 dark:border-zinc-800 dark:bg-zinc-950/35">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-3xl">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-zinc-950/[0.04] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-600 dark:bg-white/[0.06] dark:text-zinc-300">
                    {t('instances.detail.instanceWorkbench.llmProviders.panel.badge')}
                  </span>
                  {managedConfigPath ? (
                    <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">
                      {t('instances.detail.instanceWorkbench.llmProviders.panel.managedConfig')}
                    </span>
                  ) : null}
                </div>
                <p className="mt-3 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                  {providerWorkspaceDescription}
                </p>
                {managedConfigPath ? (
                  <div className="mt-4 rounded-2xl bg-zinc-950/[0.04] px-4 py-3 text-xs text-zinc-500 dark:bg-white/[0.06] dark:text-zinc-400">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em]">
                      {formatWorkbenchLabel('managedFile')}
                    </div>
                    <div className="mt-1 break-all font-mono">{managedConfigPath}</div>
                  </div>
                ) : null}
              </div>
              <Button
                onClick={
                  isProviderConfigReadonly
                    ? () => navigate('/settings?tab=api')
                    : openCreateProviderDialog
                }
                disabled={isProviderConfigReadonly ? false : !canManageOpenClawProviders}
                className="rounded-2xl px-4 py-3"
              >
                <Plus className="h-4 w-4" />
                {providerWorkspaceActionLabel}
              </Button>
            </div>
          </div>

          {!hasProviders && !isOpenClawConfigWritable ? (
            renderSectionAvailability('llmProviders', 'instances.detail.instanceWorkbench.empty.llmProviders')
          ) : (
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(22rem,0.95fr)]">
              <div data-slot="instance-llm-provider-list" className="space-y-4">
                {!hasProviders ? (
                  <div className="rounded-[1.5rem] border border-dashed border-zinc-300 bg-white/80 p-8 text-center dark:border-zinc-700 dark:bg-zinc-950/35">
                    <h3 className="text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
                      {t('instances.detail.instanceWorkbench.llmProviders.panel.emptyTitle')}
                    </h3>
                    <p className="mt-3 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                      {t('instances.detail.instanceWorkbench.llmProviders.panel.emptyDescription')}
                    </p>
                  </div>
                ) : (
                  workbench.llmProviders.map((providerRecord) => {
                    const isActive = selectedProvider?.id === providerRecord.id;
                    const defaultModel =
                      providerRecord.models.find((model) => model.id === providerRecord.defaultModelId) || null;

                    return (
                      <div
                        key={providerRecord.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelectedProviderId(providerRecord.id)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            setSelectedProviderId(providerRecord.id);
                          }
                        }}
                        className={`rounded-[1.5rem] border p-5 transition-colors ${
                          isActive
                            ? 'border-zinc-950 bg-zinc-950 text-white dark:border-white dark:bg-white dark:text-zinc-950'
                            : 'border-zinc-200/70 bg-white/80 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950/40 dark:hover:bg-zinc-950/60'
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div className="flex min-w-0 items-start gap-3">
                            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-sm font-semibold ${
                              isActive
                                ? 'bg-white/12 text-white dark:bg-zinc-950/10 dark:text-zinc-950'
                                : 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950'
                            }`}>
                              {providerRecord.icon}
                            </div>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-lg font-semibold tracking-tight">{providerRecord.name}</h3>
                                <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${
                                  providerRecord.status === 'degraded'
                                    ? getDangerBadge('degraded')
                                    : getStatusBadge(providerRecord.status)
                                }`}>
                                  {t(`instances.detail.instanceWorkbench.llmProviders.status.${providerRecord.status}`)}
                                </span>
                              </div>
                              <p className={`mt-2 text-sm leading-6 ${
                                isActive ? 'text-white/75 dark:text-zinc-700' : 'text-zinc-500 dark:text-zinc-400'
                              }`}>
                                {providerRecord.description}
                              </p>
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedProviderId(providerRecord.id);
                              setProviderDeleteId(providerRecord.id);
                            }}
                            disabled={!canManageOpenClawProviders}
                            className="rounded-2xl px-3 py-2 text-rose-600 hover:text-rose-600 dark:text-rose-300"
                          >
                            <Trash2 className="h-4 w-4" />
                            {t('common.delete')}
                          </Button>
                        </div>
                        <div className={`mt-4 rounded-2xl px-4 py-3 font-mono text-sm ${
                          isActive
                            ? 'bg-white/10 text-white/80 dark:bg-zinc-950/10 dark:text-zinc-700'
                            : 'bg-zinc-950/[0.04] text-zinc-600 dark:bg-white/[0.06] dark:text-zinc-300'
                        }`}>
                          {providerRecord.endpoint || '--'}
                        </div>
                        <div className="mt-4 grid gap-4 md:grid-cols-4">
                          <div>
                            <div className={`text-[11px] font-semibold uppercase tracking-[0.16em] ${
                              isActive ? 'text-white/60 dark:text-zinc-700' : 'text-zinc-500 dark:text-zinc-400'
                            }`}>
                              {t('instances.detail.instanceWorkbench.llmProviders.panel.defaultShort')}
                            </div>
                            <div className={`mt-1 text-sm font-medium ${
                              isActive ? 'text-white dark:text-zinc-950' : 'text-zinc-950 dark:text-zinc-50'
                            }`}>
                              {defaultModel?.name || '--'}
                            </div>
                          </div>
                          <div>
                            <div className={`text-[11px] font-semibold uppercase tracking-[0.16em] ${
                              isActive ? 'text-white/60 dark:text-zinc-700' : 'text-zinc-500 dark:text-zinc-400'
                            }`}>
                              {t('instances.detail.instanceWorkbench.llmProviders.panel.models')}
                            </div>
                            <div className={`mt-1 text-sm font-medium ${
                              isActive ? 'text-white dark:text-zinc-950' : 'text-zinc-950 dark:text-zinc-50'
                            }`}>
                              {providerRecord.models.length}
                            </div>
                          </div>
                          <div>
                            <div className={`text-[11px] font-semibold uppercase tracking-[0.16em] ${
                              isActive ? 'text-white/60 dark:text-zinc-700' : 'text-zinc-500 dark:text-zinc-400'
                            }`}>
                              {t('instances.detail.instanceWorkbench.llmProviders.temperature')}
                            </div>
                            <div className={`mt-1 text-sm font-medium ${
                              isActive ? 'text-white dark:text-zinc-950' : 'text-zinc-950 dark:text-zinc-50'
                            }`}>
                              {providerRecord.config.temperature}
                            </div>
                          </div>
                          <div>
                            <div className={`text-[11px] font-semibold uppercase tracking-[0.16em] ${
                              isActive ? 'text-white/60 dark:text-zinc-700' : 'text-zinc-500 dark:text-zinc-400'
                            }`}>
                              {t('instances.detail.instanceWorkbench.llmProviders.streaming')}
                            </div>
                            <div className={`mt-1 text-sm font-medium ${
                              isActive ? 'text-white dark:text-zinc-950' : 'text-zinc-950 dark:text-zinc-50'
                            }`}>
                              {providerRecord.config.streaming
                                ? t('instances.detail.instanceWorkbench.llmProviders.on')
                                : t('instances.detail.instanceWorkbench.llmProviders.off')}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="space-y-4">
                <InstanceLLMConfigPanel
                  provider={selectedProvider}
                  draft={selectedProviderDraft}
                  hasPendingChanges={hasPendingProviderChanges}
                  isSaving={isSavingProviderConfig}
                  isReadonly={isProviderConfigReadonly}
                  readonlyMessage={t('instances.detail.instanceWorkbench.llmProviders.readonlyNotice')}
                  onOpenProviderCenter={() => navigate('/settings?tab=api')}
                  openProviderCenterLabel={t('providerCenter.page.title')}
                  onFieldChange={handleProviderFieldChange}
                  onConfigChange={handleProviderConfigChange}
                  onReset={handleResetProviderDraft}
                  onSave={handleSaveProviderConfig}
                />
                <div className="rounded-[1.5rem] border border-zinc-200/70 bg-white/80 p-5 dark:border-zinc-800 dark:bg-zinc-950/40">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
                        {t('instances.detail.instanceWorkbench.llmProviders.panel.providerModelsTitle')}
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                        {t('instances.detail.instanceWorkbench.llmProviders.panel.providerModelsDescription')}
                      </p>
                    </div>
                    <Button
                      onClick={openCreateProviderModelDialog}
                      disabled={!selectedProvider || !canManageOpenClawProviders}
                      className="rounded-2xl px-4 py-3"
                    >
                      <Plus className="h-4 w-4" />
                      {t('instances.detail.instanceWorkbench.llmProviders.panel.addModel')}
                    </Button>
                  </div>
                  {!selectedProvider ? (
                    <div className="mt-5 rounded-2xl bg-zinc-950/[0.04] px-4 py-5 text-sm text-zinc-500 dark:bg-white/[0.06] dark:text-zinc-400">
                      {t('instances.detail.instanceWorkbench.llmProviders.panel.selectProvider')}
                    </div>
                  ) : (
                    <div className="mt-5 space-y-3">
                      {selectedProvider.models.map((model) => (
                        <div key={model.id} className="rounded-2xl border border-zinc-200/70 bg-zinc-950/[0.02] p-4 dark:border-zinc-800 dark:bg-white/[0.03]">
                          <div className="flex flex-wrap items-start justify-between gap-4">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <h4 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">{model.name}</h4>
                                <span className="rounded-full bg-zinc-950/[0.04] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-600 dark:bg-white/[0.06] dark:text-zinc-300">
                                  {t(`instances.detail.instanceWorkbench.llmProviders.modelRoles.${model.role}`)}
                                </span>
                              </div>
                              <div className="mt-2 font-mono text-xs text-zinc-500 dark:text-zinc-400">{model.id}</div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Button
                                variant="outline"
                                onClick={() => openEditProviderModelDialog(model)}
                                disabled={!canManageOpenClawProviders}
                                className="rounded-2xl px-3 py-2"
                              >
                                <Edit2 className="h-4 w-4" />
                                {t('common.edit')}
                              </Button>
                              <Button
                                variant="outline"
                                onClick={() => setProviderModelDeleteId(model.id)}
                                disabled={!canManageOpenClawProviders}
                                className="rounded-2xl px-3 py-2 text-rose-600 hover:text-rose-600 dark:text-rose-300"
                              >
                                <Trash2 className="h-4 w-4" />
                                {t('common.delete')}
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
        {renderOpenClawProviderDialogs()}
      </>
    );
  };

  const renderFilesSection = () => {
    return (
      <div className="space-y-6">
        <div className="rounded-[1.6rem] bg-zinc-950/[0.03] p-5 dark:bg-white/[0.04]">
          <h3 className="text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            {t('instances.detail.instanceWorkbench.files.gatewayProfile')}
          </h3>
          <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
            {t('instances.detail.instanceWorkbench.files.gatewayProfileDescription')}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full bg-zinc-950/[0.04] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-600 dark:bg-white/[0.06] dark:text-zinc-300">
              {t('instances.detail.fields.gatewayPort')}: {config?.port}
            </span>
            <span className="rounded-full bg-zinc-950/[0.04] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-600 dark:bg-white/[0.06] dark:text-zinc-300">
              {t('instances.detail.fields.corsOrigins')}: {config?.corsOrigins}
            </span>
            <span className="rounded-full bg-zinc-950/[0.04] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-600 dark:bg-white/[0.06] dark:text-zinc-300">
              {t('instances.detail.fields.agentSandbox')}: {config?.sandbox
                ? t('instances.detail.instanceWorkbench.files.on')
                : t('instances.detail.instanceWorkbench.files.off')}
            </span>
            <span className="rounded-full bg-zinc-950/[0.04] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-600 dark:bg-white/[0.06] dark:text-zinc-300">
              {t('instances.detail.fields.autoUpdate')}: {config?.autoUpdate
                ? t('instances.detail.instanceWorkbench.files.on')
                : t('instances.detail.instanceWorkbench.files.off')}
            </span>
          </div>
        </div>

        <InstanceFilesWorkspace
          mode="instance"
          instanceId={id ?? ''}
          files={workbench?.files || []}
          agents={workbench?.agents || []}
          selectedAgentId={selectedAgentId}
          onSelectedAgentIdChange={setSelectedAgentId}
          runtimeKind={detail?.instance.runtimeKind}
          isBuiltIn={detail?.instance.isBuiltIn}
          isLoading={isWorkbenchFilesLoading}
          onReload={() => (id ? loadWorkbench(id, { withSpinner: false }) : undefined)}
        />
      </div>
    );
  };

  const renderMemorySection = () => {
    if (isWorkbenchMemoryLoading) {
      return (
        <div className="flex min-h-[20rem] items-center justify-center p-6 text-sm text-zinc-500 dark:text-zinc-400">
          <div className="inline-flex items-center gap-2 rounded-2xl border border-zinc-200/70 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('common.loading')}
          </div>
        </div>
      );
    }

    if (!workbench || workbench.memories.length === 0) {
      return renderSectionAvailability('memory', 'instances.detail.instanceWorkbench.empty.memory');
    }

    return (
      <WorkbenchRowList>
        {workbench.memories.map((entry, index) => (
          <WorkbenchRow key={entry.id} isLast={index === workbench.memories.length - 1}>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-zinc-950/[0.04] px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-600 dark:bg-white/[0.06] dark:text-zinc-300">
                  {t(`instances.detail.instanceWorkbench.memoryTypes.${entry.type}`)}
                </span>
                <span
                  className={`rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${
                    entry.retention === 'expiring' ? getDangerBadge('restricted') : getStatusBadge('ready')
                  }`}
                >
                  {t(`instances.detail.instanceWorkbench.retention.${entry.retention}`)}
                </span>
              </div>
              <h3 className="mt-3 text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
                {entry.title}
              </h3>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                {entry.summary}
              </p>
            </div>
            <div className="flex flex-wrap gap-5">
              <RowMetric
                label={t('instances.detail.instanceWorkbench.metrics.memorySource')}
                value={t(`instances.detail.instanceWorkbench.memorySources.${entry.source}`)}
              />
              <RowMetric
                label={t('instances.detail.instanceWorkbench.metrics.memoryTokens')}
                value={entry.tokens}
              />
              <RowMetric
                label={t('instances.detail.instanceWorkbench.metrics.updatedAt')}
                value={entry.updatedAt}
              />
            </div>
            <div className="text-right text-sm text-zinc-500 dark:text-zinc-400">
              {t(`instances.detail.instanceWorkbench.retention.${entry.retention}`)}
            </div>
          </WorkbenchRow>
        ))}
      </WorkbenchRowList>
    );
  };

  const renderManagedWebSearchPanel = () => {
    if (!managedWebSearchConfig || !webSearchSharedDraft || !selectedWebSearchProvider || !selectedWebSearchProviderDraft) {
      return null;
    }

    return (
      <div className="rounded-[1.8rem] border border-zinc-200/70 bg-white/80 p-5 shadow-[0_16px_36px_rgba(15,23,42,0.06)] dark:border-zinc-800 dark:bg-zinc-950/35">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full bg-primary-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary-600 dark:text-primary-300">
                {t('instances.detail.instanceWorkbench.webSearch.badge')}
              </span>
              <span className="rounded-full bg-zinc-950/[0.04] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-600 dark:bg-white/[0.06] dark:text-zinc-300">
                {formatWorkbenchLabel('managedFile')}
              </span>
            </div>
            <h3 className="mt-3 text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
              {t('instances.detail.instanceWorkbench.webSearch.title')}
            </h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500 dark:text-zinc-400">
              {t('instances.detail.instanceWorkbench.webSearch.description')}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              type="button"
              onClick={() => void handleSaveWebSearchConfig()}
              disabled={!canEditManagedWebSearch || isSavingWebSearch}
            >
              {isSavingWebSearch ? t('common.loading') : t('common.save')}
            </Button>
          </div>
        </div>

        <div className="mt-5 grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <div className="rounded-[1.4rem] bg-zinc-950/[0.03] p-4 dark:bg-white/[0.04]">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-zinc-200/70 bg-white/80 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/40">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                      {t('instances.detail.instanceWorkbench.webSearch.fields.enabled')}
                    </div>
                    <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                      {t('instances.detail.instanceWorkbench.webSearch.enabledDescription')}
                    </p>
                  </div>
                  <Switch
                    checked={webSearchSharedDraft.enabled}
                    onCheckedChange={(checked) => handleWebSearchSharedDraftChange('enabled', checked)}
                    disabled={!canEditManagedWebSearch}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t('instances.detail.instanceWorkbench.webSearch.fields.provider')}</Label>
                <Select
                  value={webSearchSharedDraft.provider || ''}
                  onValueChange={(value) => handleWebSearchSharedDraftChange('provider', value)}
                  disabled={!canEditManagedWebSearch}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('instances.detail.instanceWorkbench.webSearch.placeholders.provider')} />
                  </SelectTrigger>
                  <SelectContent>
                    {managedWebSearchConfig.providers.map((provider) => (
                      <SelectItem key={provider.id} value={provider.id}>
                        {provider.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t('instances.detail.instanceWorkbench.webSearch.fields.maxResults')}</Label>
                <Input
                  value={webSearchSharedDraft.maxResults}
                  onChange={(event) => handleWebSearchSharedDraftChange('maxResults', event.target.value)}
                  disabled={!canEditManagedWebSearch}
                  inputMode="numeric"
                />
              </div>

              <div className="space-y-2">
                <Label>{t('instances.detail.instanceWorkbench.webSearch.fields.timeoutSeconds')}</Label>
                <Input
                  value={webSearchSharedDraft.timeoutSeconds}
                  onChange={(event) => handleWebSearchSharedDraftChange('timeoutSeconds', event.target.value)}
                  disabled={!canEditManagedWebSearch}
                  inputMode="numeric"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label>{t('instances.detail.instanceWorkbench.webSearch.fields.cacheTtlMinutes')}</Label>
                <Input
                  value={webSearchSharedDraft.cacheTtlMinutes}
                  onChange={(event) => handleWebSearchSharedDraftChange('cacheTtlMinutes', event.target.value)}
                  disabled={!canEditManagedWebSearch}
                  inputMode="numeric"
                />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-4">
              <RowMetric
                label={t('instances.detail.instanceWorkbench.webSearch.metrics.activeProvider')}
                value={webSearchSharedDraft.provider || '--'}
              />
              <RowMetric
                label={t('instances.detail.instanceWorkbench.webSearch.metrics.managedProviders')}
                value={String(managedWebSearchConfig.providers.length)}
              />
            </div>
          </div>

          <div className="rounded-[1.4rem] border border-zinc-200/70 bg-white/90 p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                  {t('instances.detail.instanceWorkbench.webSearch.providerPanel')}
                </div>
                <h4 className="mt-2 text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
                  {selectedWebSearchProvider.name}
                </h4>
                <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                  {selectedWebSearchProvider.description}
                </p>
              </div>
              <div className="min-w-[14rem] space-y-2">
                <Label>{t('instances.detail.instanceWorkbench.webSearch.fields.providerEditor')}</Label>
                <Select
                  value={selectedWebSearchProvider.id}
                  onValueChange={setSelectedWebSearchProviderId}
                  disabled={!canEditManagedWebSearch}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {managedWebSearchConfig.providers.map((provider) => (
                      <SelectItem key={provider.id} value={provider.id}>
                        {provider.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {selectedWebSearchProvider.supportsApiKey ? (
                <div className="space-y-2 md:col-span-2">
                  <Label>{t('instances.detail.instanceWorkbench.webSearch.fields.apiKeySource')}</Label>
                  <Input
                    value={selectedWebSearchProviderDraft.apiKeySource}
                    onChange={(event) => handleWebSearchProviderDraftChange('apiKeySource', event.target.value)}
                    disabled={!canEditManagedWebSearch}
                    placeholder={t('instances.detail.instanceWorkbench.webSearch.placeholders.apiKeySource')}
                  />
                </div>
              ) : null}

              {selectedWebSearchProvider.supportsBaseUrl ? (
                <div className="space-y-2 md:col-span-2">
                  <Label>{t('instances.detail.instanceWorkbench.webSearch.fields.baseUrl')}</Label>
                  <Input
                    value={selectedWebSearchProviderDraft.baseUrl}
                    onChange={(event) => handleWebSearchProviderDraftChange('baseUrl', event.target.value)}
                    disabled={!canEditManagedWebSearch}
                    placeholder={t('instances.detail.instanceWorkbench.webSearch.placeholders.baseUrl')}
                  />
                </div>
              ) : null}

              {selectedWebSearchProvider.supportsModel ? (
                <div className="space-y-2 md:col-span-2">
                  <Label>{t('instances.detail.instanceWorkbench.webSearch.fields.model')}</Label>
                  <Input
                    value={selectedWebSearchProviderDraft.model}
                    onChange={(event) => handleWebSearchProviderDraftChange('model', event.target.value)}
                    disabled={!canEditManagedWebSearch}
                    placeholder={t('instances.detail.instanceWorkbench.webSearch.placeholders.model')}
                  />
                </div>
              ) : null}

              <div className="space-y-2 md:col-span-2">
                <Label>{t('instances.detail.instanceWorkbench.webSearch.fields.advancedConfig')}</Label>
                <Textarea
                  value={selectedWebSearchProviderDraft.advancedConfig}
                  onChange={(event) => handleWebSearchProviderDraftChange('advancedConfig', event.target.value)}
                  disabled={!canEditManagedWebSearch}
                  rows={8}
                  placeholder={t('instances.detail.instanceWorkbench.webSearch.placeholders.advancedConfig')}
                />
                <p className="text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                  {t('instances.detail.instanceWorkbench.webSearch.advancedDescription')}
                </p>
              </div>
            </div>

            {webSearchError ? (
              <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
                {webSearchError}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    );
  };

  const renderManagedAuthCooldownsPanel = () => {
    if (!managedAuthCooldownsConfig || !authCooldownsDraft) {
      return null;
    }

    const configuredFieldCount = [
      authCooldownsDraft.rateLimitedProfileRotations,
      authCooldownsDraft.overloadedProfileRotations,
      authCooldownsDraft.overloadedBackoffMs,
      authCooldownsDraft.billingBackoffHours,
      authCooldownsDraft.billingMaxHours,
      authCooldownsDraft.failureWindowHours,
    ].filter((value) => Boolean(value.trim())).length;

    return (
      <div className="rounded-[1.8rem] border border-zinc-200/70 bg-white/80 p-5 shadow-[0_16px_36px_rgba(15,23,42,0.06)] dark:border-zinc-800 dark:bg-zinc-950/35">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full bg-primary-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary-600 dark:text-primary-300">
                {t('instances.detail.instanceWorkbench.authCooldowns.badge')}
              </span>
              <span className="rounded-full bg-zinc-950/[0.04] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-600 dark:bg-white/[0.06] dark:text-zinc-300">
                {formatWorkbenchLabel('managedFile')}
              </span>
            </div>
            <h3 className="mt-3 text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
              {t('instances.detail.instanceWorkbench.authCooldowns.title')}
            </h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500 dark:text-zinc-400">
              {t('instances.detail.instanceWorkbench.authCooldowns.description')}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              type="button"
              onClick={() => void handleSaveAuthCooldownsConfig()}
              disabled={!canEditManagedAuthCooldowns || isSavingAuthCooldowns}
            >
              {isSavingAuthCooldowns ? t('common.loading') : t('common.save')}
            </Button>
          </div>
        </div>

        <div className="mt-5 grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(18rem,0.55fr)]">
          <div className="rounded-[1.4rem] bg-zinc-950/[0.03] p-4 dark:bg-white/[0.04]">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <div className="space-y-2">
                <Label>{t('instances.detail.instanceWorkbench.authCooldowns.fields.rateLimitedProfileRotations')}</Label>
                <Input
                  value={authCooldownsDraft.rateLimitedProfileRotations}
                  onChange={(event) =>
                    handleAuthCooldownsDraftChange('rateLimitedProfileRotations', event.target.value)
                  }
                  disabled={!canEditManagedAuthCooldowns}
                  inputMode="numeric"
                  placeholder={t('instances.detail.instanceWorkbench.authCooldowns.placeholders.defaultValue')}
                />
              </div>

              <div className="space-y-2">
                <Label>{t('instances.detail.instanceWorkbench.authCooldowns.fields.overloadedProfileRotations')}</Label>
                <Input
                  value={authCooldownsDraft.overloadedProfileRotations}
                  onChange={(event) =>
                    handleAuthCooldownsDraftChange('overloadedProfileRotations', event.target.value)
                  }
                  disabled={!canEditManagedAuthCooldowns}
                  inputMode="numeric"
                  placeholder={t('instances.detail.instanceWorkbench.authCooldowns.placeholders.defaultValue')}
                />
              </div>

              <div className="space-y-2">
                <Label>{t('instances.detail.instanceWorkbench.authCooldowns.fields.overloadedBackoffMs')}</Label>
                <Input
                  value={authCooldownsDraft.overloadedBackoffMs}
                  onChange={(event) => handleAuthCooldownsDraftChange('overloadedBackoffMs', event.target.value)}
                  disabled={!canEditManagedAuthCooldowns}
                  inputMode="numeric"
                  placeholder={t('instances.detail.instanceWorkbench.authCooldowns.placeholders.defaultValue')}
                />
              </div>

              <div className="space-y-2">
                <Label>{t('instances.detail.instanceWorkbench.authCooldowns.fields.billingBackoffHours')}</Label>
                <Input
                  value={authCooldownsDraft.billingBackoffHours}
                  onChange={(event) => handleAuthCooldownsDraftChange('billingBackoffHours', event.target.value)}
                  disabled={!canEditManagedAuthCooldowns}
                  inputMode="numeric"
                  placeholder={t('instances.detail.instanceWorkbench.authCooldowns.placeholders.defaultValue')}
                />
              </div>

              <div className="space-y-2">
                <Label>{t('instances.detail.instanceWorkbench.authCooldowns.fields.billingMaxHours')}</Label>
                <Input
                  value={authCooldownsDraft.billingMaxHours}
                  onChange={(event) => handleAuthCooldownsDraftChange('billingMaxHours', event.target.value)}
                  disabled={!canEditManagedAuthCooldowns}
                  inputMode="numeric"
                  placeholder={t('instances.detail.instanceWorkbench.authCooldowns.placeholders.defaultValue')}
                />
              </div>

              <div className="space-y-2">
                <Label>{t('instances.detail.instanceWorkbench.authCooldowns.fields.failureWindowHours')}</Label>
                <Input
                  value={authCooldownsDraft.failureWindowHours}
                  onChange={(event) => handleAuthCooldownsDraftChange('failureWindowHours', event.target.value)}
                  disabled={!canEditManagedAuthCooldowns}
                  inputMode="numeric"
                  placeholder={t('instances.detail.instanceWorkbench.authCooldowns.placeholders.defaultValue')}
                />
              </div>
            </div>

            <p className="mt-4 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
              {t('instances.detail.instanceWorkbench.authCooldowns.note')}
            </p>

            {authCooldownsError ? (
              <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
                {authCooldownsError}
              </div>
            ) : null}
          </div>

          <div className="rounded-[1.4rem] border border-zinc-200/70 bg-white/90 p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
            <div className="grid gap-4">
              <RowMetric
                label={t('instances.detail.instanceWorkbench.metrics.configuredFields')}
                value={configuredFieldCount}
              />
              <RowMetric
                label={t('instances.detail.instanceWorkbench.authCooldowns.metrics.overloadedBackoff')}
                value={
                  authCooldownsDraft.overloadedBackoffMs.trim() ||
                  t('instances.detail.instanceWorkbench.authCooldowns.values.upstreamDefault')
                }
              />
              <RowMetric
                label={t('instances.detail.instanceWorkbench.authCooldowns.metrics.failureWindow')}
                value={
                  authCooldownsDraft.failureWindowHours.trim() ||
                  t('instances.detail.instanceWorkbench.authCooldowns.values.upstreamDefault')
                }
              />
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderToolsSection = () => {
    const hasRuntimeTools = Boolean(workbench && workbench.tools.length > 0);
    const hasManagedAuthCooldowns = Boolean(managedAuthCooldownsConfig && authCooldownsDraft);
    const hasManagedWebSearch = Boolean(managedWebSearchConfig && managedWebSearchConfig.providers.length > 0);

    if (!hasRuntimeTools && !hasManagedAuthCooldowns && !hasManagedWebSearch) {
      return renderSectionAvailability('tools', 'instances.detail.instanceWorkbench.empty.tools');
    }

    return (
      <div className="space-y-6">
        {hasManagedAuthCooldowns ? renderManagedAuthCooldownsPanel() : null}
        {hasManagedWebSearch ? renderManagedWebSearchPanel() : null}

        {hasRuntimeTools ? (
          <WorkbenchRowList>
            {workbench!.tools.map((tool, index) => (
              <WorkbenchRow key={tool.id} isLast={index === workbench!.tools.length - 1}>
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
                      {tool.name}
                    </h3>
                    <span
                      className={`rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${
                        tool.status === 'restricted' ? getDangerBadge(tool.status) : getStatusBadge(tool.status)
                      }`}
                    >
                      {t(`instances.detail.instanceWorkbench.toolStatus.${tool.status}`)}
                    </span>
                  </div>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                    {tool.description}
                  </p>
                  <div className="mt-3 rounded-2xl bg-zinc-950/[0.04] px-4 py-3 text-sm font-mono text-zinc-600 dark:bg-white/[0.05] dark:text-zinc-300">
                    {tool.command}
                  </div>
                </div>
                <div className="flex flex-wrap gap-5">
                  <RowMetric
                    label={t('instances.detail.instanceWorkbench.sections.tools.title')}
                    value={t(`instances.detail.instanceWorkbench.toolCategories.${tool.category}`)}
                  />
                  <RowMetric
                    label={t('instances.detail.instanceWorkbench.sidebar.agents')}
                    value={tool.agentNames?.join(', ') || tool.agentIds?.join(', ') || '--'}
                  />
                  <RowMetric
                    label={t('instances.detail.instanceWorkbench.metrics.actionType')}
                    value={t(`instances.detail.instanceWorkbench.toolAccess.${tool.access}`)}
                  />
                  <RowMetric
                    label={t('instances.detail.instanceWorkbench.metrics.lastRun')}
                    value={tool.lastUsedAt || '--'}
                  />
                </div>
                <div className="text-right text-sm text-zinc-500 dark:text-zinc-400">
                  {tool.lastUsedAt || '--'}
                </div>
              </WorkbenchRow>
            ))}
          </WorkbenchRowList>
        ) : (
          renderSectionAvailability('tools', 'instances.detail.instanceWorkbench.empty.tools')
        )}
      </div>
    );
  };

  const renderConfigSection = () => {
    if (!workbench?.managedConfigPath || !id) {
      return renderSectionAvailability('config', 'instances.detail.instanceWorkbench.empty.config');
    }

    return (
      <InstanceConfigWorkbenchPanel
        instanceId={id}
        workbench={workbench}
        onReload={() => loadWorkbench(id, { withSpinner: false })}
      />
    );
  };

  const renderSectionContent = () => {
    switch (activeSection) {
      case 'overview':
        return renderOverviewSection();
      case 'channels':
        return renderChannelsSection();
      case 'cronTasks':
        return renderTasksSection();
      case 'llmProviders':
        return renderLlmProvidersSection();
      case 'agents':
        return renderAgentsSection();
      case 'skills':
        return renderSkillsSection();
      case 'files':
        return renderFilesSection();
      case 'memory':
        return renderMemorySection();
      case 'tools':
        return renderToolsSection();
      case 'config':
        return renderConfigSection();
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto flex h-64 max-w-6xl items-center justify-center p-4 md:p-8">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  if (!instance || !workbench || !config) {
    return (
      <div className="mx-auto max-w-6xl p-4 text-center md:p-8">
        <h2 className="mb-4 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          {t('instances.detail.notFoundTitle')}
        </h2>
        <button
          onClick={() => navigate('/instances')}
          className="text-primary-600 hover:underline dark:text-primary-400"
        >
          {t('instances.detail.returnToInstances')}
        </button>
      </div>
    );
  }

  return (
    <div className="w-full p-4 md:p-6 xl:p-8 2xl:p-10">
      <button
        onClick={() => navigate('/instances')}
        className="mb-6 flex items-center gap-2 text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('instances.detail.backToInstances')}
      </button>

      <div className="rounded-[2rem] bg-white/80 p-6 shadow-[0_18px_48px_rgba(15,23,42,0.08)] backdrop-blur dark:bg-zinc-900/82 md:p-8">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary-500/10 text-primary-500 dark:text-primary-300">
              <Server className="h-8 w-8" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
                  {instance.name}
                </h1>
                {activeInstanceId === instance.id ? (
                  <div className="flex items-center gap-1 rounded-full bg-primary-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-primary-600 dark:text-primary-300">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {t('instances.detail.activeBadge')}
                  </div>
                ) : null}
                <span
                  className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${getStatusBadge(
                    instance.status,
                  )}`}
                >
                  {getSharedStatusLabel(instance.status)}
                </span>
                <span
                  className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${getRuntimeStatusTone(
                    workbench.runtimeStatus,
                  )}`}
                >
                  {t(`instances.detail.instanceWorkbench.runtimeStates.${workbench.runtimeStatus}`)}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-zinc-500 dark:text-zinc-400">
                <span className="font-mono">{instance.ip}</span>
                <span className="h-1 w-1 rounded-full bg-zinc-300 dark:bg-zinc-700" />
                <span>{t('instances.detail.uptime', { value: instance.uptime })}</span>
                <span className="h-1 w-1 rounded-full bg-zinc-300 dark:bg-zinc-700" />
                <span>{instance.type}</span>
                <span className="h-1 w-1 rounded-full bg-zinc-300 dark:bg-zinc-700" />
                <span>{instance.version}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            {activeInstanceId !== instance.id && instance.status === 'online' ? (
              <button
                type="button"
                onClick={() => setActiveInstanceId(instance.id)}
                className="flex items-center gap-2 rounded-2xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
              >
                <CheckCircle2 className="h-4 w-4" />
                {t('instances.detail.actions.setAsActive')}
              </button>
            ) : null}
            {canOpenOpenClawConsole ? (
              <button
                type="button"
                onClick={handleOpenOpenClawConsole}
                className="flex items-center gap-2 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
              >
                <Wrench className="h-4 w-4" />
                {t('instances.detail.actions.openOpenClawConsole')}
              </button>
            ) : null}
            <button
              type="button"
              onClick={handleRestart}
              className="flex items-center gap-2 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
            >
              <RefreshCw className="h-4 w-4" />
              {t('instances.detail.actions.restart')}
            </button>
            {instance.status === 'online' ? (
              <button
                type="button"
                onClick={handleStop}
                className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-600 transition-colors hover:bg-rose-100 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300 dark:hover:bg-rose-500/20"
              >
                <Power className="h-4 w-4" />
                {t('instances.detail.actions.stop')}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStart}
                className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-600 transition-colors hover:bg-emerald-100 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300 dark:hover:bg-emerald-500/20"
              >
                <Power className="h-4 w-4" />
                {t('instances.detail.actions.start')}
              </button>
            )}
            <button
              type="button"
              onClick={handleDelete}
              className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-white px-4 py-3 text-sm font-semibold text-rose-600 transition-colors hover:bg-rose-50 dark:border-rose-500/20 dark:bg-zinc-950 dark:text-rose-300 dark:hover:bg-rose-500/10"
            >
              <Trash2 className="h-4 w-4" />
              {t('instances.detail.actions.uninstallInstance')}
            </button>
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <div className="rounded-[1.5rem] bg-zinc-950/[0.03] p-4 dark:bg-white/[0.04]">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
              {t('instances.detail.instanceWorkbench.summary.healthScore')}
            </div>
            <div className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
              {workbench.healthScore}%
            </div>
          </div>
          <div className="rounded-[1.5rem] bg-zinc-950/[0.03] p-4 dark:bg-white/[0.04]">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
              {t('instances.detail.instanceWorkbench.summary.connectedChannels')}
            </div>
            <div className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
              {workbench.connectedChannelCount}
            </div>
          </div>
          <div className="rounded-[1.5rem] bg-zinc-950/[0.03] p-4 dark:bg-white/[0.04]">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
              {t('instances.detail.instanceWorkbench.summary.activeTasks')}
            </div>
            <div className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
              {workbench.activeTaskCount}
            </div>
          </div>
          <div className="rounded-[1.5rem] bg-zinc-950/[0.03] p-4 dark:bg-white/[0.04]">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
              {t('instances.detail.instanceWorkbench.summary.readyTools')}
            </div>
            <div className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
              {workbench.readyToolCount}
            </div>
          </div>
          <div className="rounded-[1.5rem] bg-zinc-950/[0.03] p-4 dark:bg-white/[0.04]">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
              {t('instances.detail.instanceWorkbench.summary.agents')}
            </div>
            <div className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
              {workbench.agents.length}
            </div>
          </div>
          <div className="rounded-[1.5rem] bg-zinc-950/[0.03] p-4 dark:bg-white/[0.04]">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
              {t('instances.detail.instanceWorkbench.summary.skills')}
            </div>
            <div className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
              {workbench.installedSkillCount}
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-[18rem_minmax(0,1fr)]">
          <aside className="space-y-4">
            <div
              data-slot="instance-workbench-sidebar"
              className="flex gap-2 overflow-x-auto xl:flex-col"
            >
              {workbenchSections.map((section) => {
                const Icon = section.icon;
                const isActive = section.id === activeSection;
                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => setActiveSection(section.id)}
                    className={`min-w-[14rem] rounded-[1.4rem] px-4 py-4 text-left transition-colors xl:min-w-0 ${
                      isActive
                        ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950'
                        : 'bg-zinc-950/[0.03] text-zinc-700 hover:bg-zinc-950/[0.06] dark:bg-white/[0.04] dark:text-zinc-200 dark:hover:bg-white/[0.08]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-10 w-10 items-center justify-center rounded-2xl ${
                            isActive
                              ? 'bg-white/12 text-white dark:bg-zinc-950/10 dark:text-zinc-950'
                              : 'bg-white/70 text-zinc-700 dark:bg-zinc-950/50 dark:text-zinc-200'
                          }`}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="text-sm font-semibold">{t(section.labelKey)}</div>
                          <div
                            className={`mt-1 text-xs leading-5 ${
                              isActive
                                ? 'text-white/75 dark:text-zinc-700'
                                : 'text-zinc-500 dark:text-zinc-400'
                            }`}
                          >
                            {t(section.descriptionKey)}
                          </div>
                        </div>
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          isActive
                            ? 'bg-white/12 text-white dark:bg-zinc-950/10 dark:text-zinc-950'
                            : 'bg-white/70 text-zinc-700 dark:bg-zinc-950/50 dark:text-zinc-200'
                        }`}
                      >
                        {workbench.sectionCounts[section.id]}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-3 xl:grid-cols-1">
              <div className="rounded-[1.4rem] bg-zinc-950/[0.03] p-4 dark:bg-white/[0.04]">
                <div className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-200">
                  <Settings className="h-4 w-4" />
                  {t('instances.detail.instanceWorkbench.summary.cpuLoad')}
                </div>
                <div className="mt-3 text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
                  {instance.cpu}%
                </div>
              </div>
              <div className="rounded-[1.4rem] bg-zinc-950/[0.03] p-4 dark:bg-white/[0.04]">
                <div className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-200">
                  <MemoryStick className="h-4 w-4" />
                  {t('instances.detail.instanceWorkbench.summary.memoryPressure')}
                </div>
                <div className="mt-3 text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
                  {instance.memory}%
                </div>
                <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  {instance.totalMemory}
                </div>
              </div>
            </div>
          </aside>

          <section className="rounded-[1.8rem] bg-zinc-950/[0.03] p-5 dark:bg-white/[0.04] md:p-6">
            <SectionHeading
              title={activeSectionMeta ? t(activeSectionMeta.sectionTitleKey) : ''}
              description={activeSectionMeta ? t(activeSectionMeta.sectionDescriptionKey) : ''}
            />
            {renderSectionContent()}
          </section>
        </div>
      </div>

      <TaskExecutionHistoryDrawer
        isOpen={Boolean(historyTask)}
        onClose={() => setHistoryTaskId(null)}
        taskName={historyTask?.name}
        entries={historyEntries}
        isLoading={isHistoryLoading}
        title={t('tasks.page.history.title')}
        getSubtitle={(taskName) => t('tasks.page.history.subtitle', { name: taskName })}
        description={t('tasks.page.history.description')}
        loadingText={t('tasks.page.history.loading')}
        emptyTitle={t('tasks.page.history.emptyTitle')}
        emptyDescription={t('tasks.page.history.emptyDescription')}
        startedAtLabel={t('tasks.page.history.startedAt')}
        finishedAtLabel={t('tasks.page.history.finishedAt')}
        getStatusLabel={(status) => t(`tasks.page.history.status.${status}`)}
        getTriggerLabel={(trigger) => t(`tasks.page.history.triggers.${trigger}`)}
      />
    </div>
  );
}
