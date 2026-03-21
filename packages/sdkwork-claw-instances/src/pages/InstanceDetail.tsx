import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Bot,
  Brain,
  CheckCircle2,
  Clock3,
  Copy,
  Edit2,
  FileCode2,
  Files,
  FolderTree,
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
  RotateCcw,
  Save,
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
import { useInstanceStore } from '@sdkwork/claw-core';
import { openExternalUrl } from '@sdkwork/claw-infrastructure';
import {
  Button,
  ChannelCatalog,
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
  getTaskPreview,
  getTaskStatusBadgeTone,
  getTaskToggleStatusTarget,
  TaskCatalog,
  TaskExecutionHistoryDrawer,
  Textarea,
  type TaskCatalogItem,
} from '@sdkwork/claw-ui';
import { InstanceFileExplorer } from '../components/InstanceFileExplorer';
import { InstanceLLMConfigPanel } from '../components/InstanceLLMConfigPanel';
import { instanceService, instanceWorkbenchService } from '../services';
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
    icon: Bot,
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
];

const embeddedCronTaskActionKeys = [
  'tasks.page.actions.edit',
  'tasks.page.actions.runNow',
  'tasks.page.actions.history',
] as const;

const MonacoEditor = React.lazy(() => import('@monaco-editor/react'));

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
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [fileDrafts, setFileDrafts] = useState<Record<string, string>>({});
  const [isSavingFile, setIsSavingFile] = useState(false);
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  const [providerDrafts, setProviderDrafts] = useState<Record<string, InstanceLLMProviderUpdate>>({});
  const [isSavingProviderConfig, setIsSavingProviderConfig] = useState(false);
  const [selectedManagedChannelId, setSelectedManagedChannelId] = useState<string | null>(null);
  const [managedChannelDrafts, setManagedChannelDrafts] = useState<Record<string, Record<string, string>>>({});
  const [managedChannelError, setManagedChannelError] = useState<string | null>(null);
  const [isSavingManagedChannel, setIsSavingManagedChannel] = useState(false);
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
    const files = workbench?.files || [];

    if (files.length === 0) {
      setSelectedFileId(null);
      setFileDrafts({});
      return;
    }

    setSelectedFileId((current) =>
      current && files.some((file) => file.id === current) ? current : files[0].id,
    );
    setFileDrafts(Object.fromEntries(files.map((file) => [file.id, file.content])));
  }, [workbench]);

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
    setProviderDrafts(
      Object.fromEntries(
        providers.map((provider) => [
          provider.id,
          {
            endpoint: provider.endpoint,
            apiKeySource: provider.apiKeySource,
            defaultModelId: provider.defaultModelId,
            reasoningModelId: provider.reasoningModelId,
            embeddingModelId: provider.embeddingModelId,
            config: { ...provider.config },
          },
        ]),
      ),
    );
  }, [workbench]);

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
    setManagedChannelDrafts(
      Object.fromEntries(
        managedChannels.map((channel) => [
          channel.id,
          { ...channel.values },
        ]),
      ),
    );
  }, [workbench]);

  useEffect(() => {
    if (historyTaskId && !workbench?.tasks.some((task) => task.id === historyTaskId)) {
      setHistoryTaskId(null);
    }
  }, [historyTaskId, workbench]);

  useEffect(() => {
    setTaskExecutionsById({});
    setHistoryTaskId(null);
    setIsHistoryLoading(false);
    setIsRefreshingTasks(false);
    setCloningTaskIds([]);
    setRunningTaskIds([]);
    setStatusTaskIds([]);
    setDeletingTaskIds([]);
  }, [id]);

  const instance = workbench?.instance || null;
  const detail = workbench?.detail || null;
  const managedConfigPath = workbench?.managedConfigPath || null;
  const managedChannels = workbench?.managedChannels || [];
  const consoleAccess = detail?.consoleAccess || null;
  const isOpenClawWorkbench = detail?.instance.runtimeKind === 'openclaw' && Boolean(detail?.workbench);
  const isOpenClawConfigWritable =
    detail?.instance.runtimeKind === 'openclaw' && Boolean(managedConfigPath);
  const canEditManagedChannels = Boolean(id && managedConfigPath && managedChannels.length);
  const isProviderConfigReadonly =
    detail?.instance.runtimeKind === 'openclaw' ? !managedConfigPath : false;
  const canOpenOpenClawConsole = Boolean(
    consoleAccess?.available && (consoleAccess.autoLoginUrl || consoleAccess.url),
  );
  const historyTask = historyTaskId ? workbench?.tasks.find((task) => task.id === historyTaskId) || null : null;
  const historyEntries = historyTaskId ? taskExecutionsById[historyTaskId] || [] : [];

  const activeSectionMeta = useMemo(
    () => workbenchSections.find((section) => section.id === activeSection),
    [activeSection],
  );

  const selectedFile = useMemo(
    () => workbench?.files.find((file) => file.id === selectedFileId) || null,
    [selectedFileId, workbench],
  );
  const selectedProvider = useMemo(
    () => workbench?.llmProviders.find((provider) => provider.id === selectedProviderId) || null,
    [selectedProviderId, workbench],
  );
  const selectedManagedChannel = useMemo(
    () => managedChannels.find((channel) => channel.id === selectedManagedChannelId) || null,
    [managedChannels, selectedManagedChannelId],
  );

  const selectedFileDraft = selectedFile ? fileDrafts[selectedFile.id] ?? selectedFile.content : '';
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
  const hasPendingFileChanges = Boolean(
    selectedFile && !selectedFile.isReadonly && selectedFileDraft !== selectedFile.content,
  );
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

  const handleFileDraftChange = (value: string) => {
    if (!selectedFile || selectedFile.isReadonly) {
      return;
    }

    setFileDrafts((current) => ({
      ...current,
      [selectedFile.id]: value,
    }));
  };

  const handleResetFileDraft = () => {
    if (!selectedFile) {
      return;
    }

    setFileDrafts((current) => ({
      ...current,
      [selectedFile.id]: selectedFile.content,
    }));
  };

  const handleSaveFile = async () => {
    if (!id || !selectedFile || selectedFile.isReadonly) {
      return;
    }

    setIsSavingFile(true);
    try {
      await instanceService.updateInstanceFileContent(id, selectedFile.id, selectedFileDraft);
      toast.success(t('instances.detail.instanceWorkbench.files.fileSaved'));
      await loadWorkbench(id);
    } catch (error: any) {
      toast.error(error.message || t('instances.detail.instanceWorkbench.files.fileSaveFailed'));
    } finally {
      setIsSavingFile(false);
    }
  };

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
                    {[endpoint.kind, endpoint.exposure, endpoint.auth].map((value) => (
                      <span
                        key={`${endpoint.id}-${value}`}
                        className="rounded-full bg-zinc-950/[0.04] px-2.5 py-1 text-xs font-medium text-zinc-600 dark:bg-white/[0.06] dark:text-zinc-300"
                      >
                        {formatWorkbenchLabel(value)}
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
                    {[route.scope, route.mode, route.source].map((value) => (
                      <span
                        key={`${route.id}-${value}`}
                        className="rounded-full bg-zinc-950/[0.04] px-2.5 py-1 text-xs font-medium text-zinc-600 dark:bg-white/[0.06] dark:text-zinc-300"
                      >
                        {formatWorkbenchLabel(value)}
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
                    {[artifact.kind, artifact.source].map((value) => (
                      <span
                        key={`${artifact.id}-${value}`}
                        className="rounded-full bg-zinc-950/[0.04] px-2.5 py-1 text-xs font-medium text-zinc-600 dark:bg-white/[0.06] dark:text-zinc-300"
                      >
                        {formatWorkbenchLabel(value)}
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
      <>
        <div className="space-y-4">
          {managedConfigPath ? (
            <div className="rounded-[1.5rem] border border-zinc-200/70 bg-white/80 p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950/35 dark:text-zinc-300">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                {formatWorkbenchLabel('managedFile')}
              </div>
              <div className="mt-2 break-all font-mono text-xs leading-6 text-zinc-500 dark:text-zinc-400">
                {managedConfigPath}
              </div>
            </div>
          ) : null}

          <ChannelCatalog
            items={
              canEditManagedChannels
                ? managedChannels.map((channel) => {
                    const draft = managedChannelDrafts[channel.id] || channel.values;
                    const configuredFieldCount = channel.fields.filter((field) =>
                      Boolean((draft[field.key] || '').trim()),
                    ).length;

                    return {
                      id: channel.id,
                      name: channel.name,
                      description: channel.description,
                      status:
                        configuredFieldCount === 0
                          ? 'not_configured'
                          : channel.status === 'connected'
                            ? 'connected'
                            : 'disconnected',
                      enabled: channel.enabled,
                      fieldCount: channel.fieldCount,
                      configuredFieldCount,
                      setupSteps: channel.setupSteps,
                    };
                  })
                : workbench.channels
            }
            variant={canEditManagedChannels ? 'management' : 'summary'}
            texts={{
              statusActive: t('channels.page.status.active'),
              statusConnected: t('dashboard.status.connected'),
              statusDisconnected: t('dashboard.status.disconnected'),
              statusNotConfigured: t('dashboard.status.not_configured'),
              actionConnect: t('channels.page.actions.connect'),
              actionConfigure: t('channels.page.actions.configure'),
              actionOpenOfficialSite: t('channels.page.actions.openOfficialSite'),
              actionEnableChannel: (name: string) => t('channels.page.actions.enableChannel', { name }),
              metricConfiguredFields: t('instances.detail.instanceWorkbench.metrics.configuredFields'),
              metricSetupSteps: t('instances.detail.instanceWorkbench.metrics.setupSteps'),
              metricDeliveryState: t('instances.detail.instanceWorkbench.metrics.deliveryState'),
              stateEnabled: t('instances.detail.instanceWorkbench.state.enabled'),
              statePending: t('instances.detail.instanceWorkbench.state.pending'),
              summaryFallback: t('instances.detail.instanceWorkbench.empty.channels'),
            }}
            onOpenOfficialLink={(_channel, link) => void openOfficialLink(link.href)}
            onConfigure={
              canEditManagedChannels
                ? (channel) => {
                    setManagedChannelError(null);
                    setSelectedManagedChannelId(channel.id);
                  }
                : undefined
            }
            onToggleEnabled={
              canEditManagedChannels
                ? (channel, nextEnabled) => {
                    const managedChannel = managedChannels.find((item) => item.id === channel.id);
                    if (managedChannel) {
                      void handleToggleManagedChannel(managedChannel, nextEnabled);
                    }
                  }
                : undefined
            }
          />
        </div>

        <Dialog
          open={Boolean(selectedManagedChannel)}
          onOpenChange={(open) => {
            if (!open) {
              setManagedChannelError(null);
              setSelectedManagedChannelId(null);
            }
          }}
        >
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{selectedManagedChannel?.name || 'Channel configuration'}</DialogTitle>
              <DialogDescription>
                {selectedManagedChannel?.description || ''}
              </DialogDescription>
            </DialogHeader>

            {selectedManagedChannel && selectedManagedChannelDraft ? (
              <div className="space-y-4">
                {selectedManagedChannel.fields.map((field) =>
                  field.multiline ? (
                    <label key={field.key} className="block">
                      <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                        {field.label}
                        {field.required ? ' *' : ''}
                      </div>
                      <Textarea
                        value={selectedManagedChannelDraft[field.key] || ''}
                        onChange={(event) =>
                          handleManagedChannelDraftChange(field.key, event.target.value)
                        }
                        placeholder={field.placeholder}
                        rows={5}
                        className="min-h-[7rem] w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition-colors focus:border-primary-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                      />
                      {field.helpText ? (
                        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                          {field.helpText}
                        </p>
                      ) : null}
                    </label>
                  ) : (
                    <label key={field.key} className="block">
                      <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                        {field.label}
                        {field.required ? ' *' : ''}
                      </div>
                      <Input
                        type={
                          field.sensitive
                            ? 'password'
                            : field.inputMode === 'numeric'
                              ? 'number'
                              : field.inputMode === 'url'
                                ? 'url'
                                : 'text'
                        }
                        value={selectedManagedChannelDraft[field.key] || ''}
                        onChange={(event) =>
                          handleManagedChannelDraftChange(field.key, event.target.value)
                        }
                        placeholder={field.placeholder}
                        className="h-12 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition-colors focus:border-primary-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                      />
                      {field.helpText ? (
                        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                          {field.helpText}
                        </p>
                      ) : null}
                    </label>
                  ),
                )}

                {managedChannelError ? (
                  <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
                    {managedChannelError}
                  </div>
                ) : null}
              </div>
            ) : null}

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setManagedChannelError(null);
                  setSelectedManagedChannelId(null);
                }}
              >
                {t('common.cancel')}
              </Button>
              <Button onClick={() => void handleSaveManagedChannel()} disabled={isSavingManagedChannel}>
                {isSavingManagedChannel ? t('common.loading') : t('common.save')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  };

  const renderTasksSection = () => {
    if (!workbench) {
      return null;
    }

    return <CronTasksManager instanceId={id} embedded />;
  };

  const renderAgentsSection = () => {
    if (!workbench || workbench.agents.length === 0) {
      return renderSectionAvailability('agents', 'instances.detail.instanceWorkbench.empty.agents');
    }

    return (
      <WorkbenchRowList>
        {workbench.agents.map(({ agent, focusAreas, automationFitScore }, index) => (
          <WorkbenchRow key={agent.id} isLast={index === workbench.agents.length - 1}>
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sky-500/10 text-xl">
                {agent.avatar}
              </div>
              <div>
                <h3 className="text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
                  {agent.name}
                </h3>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                  {agent.description}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {focusAreas.map((focusArea) => (
                <span
                  key={focusArea}
                  className="rounded-full bg-zinc-950/[0.04] px-2.5 py-1 text-xs font-medium text-zinc-600 dark:bg-white/[0.06] dark:text-zinc-300"
                >
                  {focusArea}
                </span>
              ))}
            </div>
            <div className="text-right">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                {t('instances.detail.instanceWorkbench.metrics.automationFitScore')}
              </div>
              <div className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
                {automationFitScore}%
              </div>
            </div>
          </WorkbenchRow>
        ))}
      </WorkbenchRowList>
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

  const renderLlmProvidersSection = () => {
    if (!workbench || workbench.llmProviders.length === 0) {
      return renderSectionAvailability('llmProviders', 'instances.detail.instanceWorkbench.empty.llmProviders');
    }

    return (
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_24rem]">
        <div data-slot="instance-llm-provider-list" className="space-y-3">
          {managedConfigPath ? (
            <div className="rounded-[1.5rem] border border-zinc-200/70 bg-white/80 p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950/35 dark:text-zinc-300">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                {formatWorkbenchLabel('managedFile')}
              </div>
              <div className="mt-2 break-all font-mono text-xs leading-6 text-zinc-500 dark:text-zinc-400">
                {managedConfigPath}
              </div>
            </div>
          ) : null}
          {workbench.llmProviders.map((provider) => {
            const isActive = selectedProvider?.id === provider.id;
            const defaultModel = provider.models.find((model) => model.id === provider.defaultModelId);
            const reasoningModel = provider.models.find(
              (model) => model.id === provider.reasoningModelId,
            );

            return (
              <button
                key={provider.id}
                type="button"
                onClick={() => setSelectedProviderId(provider.id)}
                className={`w-full rounded-[1.5rem] border p-5 text-left transition-colors ${
                  isActive
                    ? 'border-zinc-950 bg-zinc-950 text-white dark:border-white dark:bg-white dark:text-zinc-950'
                    : 'border-zinc-200/70 bg-white/80 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950/40 dark:hover:bg-zinc-950/60'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex min-w-0 items-start gap-3">
                    <div
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-sm font-semibold ${
                        isActive
                          ? 'bg-white/12 text-white dark:bg-zinc-950/10 dark:text-zinc-950'
                          : 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950'
                      }`}
                    >
                      {provider.icon}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold tracking-tight">{provider.name}</h3>
                        <span
                          className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${
                            provider.status === 'degraded'
                              ? getDangerBadge('degraded')
                              : getStatusBadge(provider.status)
                          }`}
                        >
                          {t(
                            `instances.detail.instanceWorkbench.llmProviders.status.${provider.status}`,
                          )}
                        </span>
                      </div>
                      <p
                        className={`mt-2 text-sm leading-6 ${
                          isActive ? 'text-white/75 dark:text-zinc-700' : 'text-zinc-500 dark:text-zinc-400'
                        }`}
                      >
                        {provider.description}
                      </p>
                    </div>
                  </div>

                  <div
                    className={`rounded-2xl px-3 py-2 text-xs font-medium ${
                      isActive
                        ? 'bg-white/10 text-white/80 dark:bg-zinc-950/10 dark:text-zinc-700'
                        : 'bg-zinc-950/[0.04] text-zinc-500 dark:bg-white/[0.06] dark:text-zinc-400'
                    }`}
                  >
                    {provider.lastCheckedAt}
                  </div>
                </div>

                <div
                  className={`mt-4 truncate rounded-2xl px-4 py-3 font-mono text-sm ${
                    isActive
                      ? 'bg-white/10 text-white/80 dark:bg-zinc-950/10 dark:text-zinc-700'
                      : 'bg-zinc-950/[0.04] text-zinc-600 dark:bg-white/[0.06] dark:text-zinc-300'
                  }`}
                >
                  {provider.endpoint}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {provider.models.map((model) => (
                    <span
                      key={model.id}
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        isActive
                          ? 'bg-white/10 text-white/85 dark:bg-zinc-950/10 dark:text-zinc-700'
                          : 'bg-zinc-950/[0.04] text-zinc-600 dark:bg-white/[0.06] dark:text-zinc-300'
                      }`}
                    >
                      {model.name} ·{' '}
                      {t(`instances.detail.instanceWorkbench.llmProviders.modelRoles.${model.role}`)}
                    </span>
                  ))}
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-5">
                  {[
                    {
                      label: t('instances.detail.instanceWorkbench.llmProviders.defaultModel'),
                      value: defaultModel?.name || '--',
                    },
                    {
                      label: t('instances.detail.instanceWorkbench.llmProviders.reasoningModel'),
                      value: reasoningModel?.name || '--',
                    },
                    {
                      label: t('instances.detail.instanceWorkbench.llmProviders.temperature'),
                      value: provider.config.temperature,
                    },
                    {
                      label: t('instances.detail.instanceWorkbench.llmProviders.topP'),
                      value: provider.config.topP,
                    },
                    {
                      label: t('instances.detail.instanceWorkbench.llmProviders.streaming'),
                      value: provider.config.streaming
                        ? t('instances.detail.instanceWorkbench.files.on')
                        : t('instances.detail.instanceWorkbench.files.off'),
                    },
                  ].map((metric) => (
                    <div key={metric.label} className="min-w-[7rem]">
                      <div
                        className={`text-[11px] font-semibold uppercase tracking-[0.16em] ${
                          isActive ? 'text-white/60 dark:text-zinc-700' : 'text-zinc-500 dark:text-zinc-400'
                        }`}
                      >
                        {metric.label}
                      </div>
                      <div
                        className={`mt-1 text-sm font-medium ${
                          isActive ? 'text-white dark:text-zinc-950' : 'text-zinc-950 dark:text-zinc-50'
                        }`}
                      >
                        {metric.value}
                      </div>
                    </div>
                  ))}
                </div>
              </button>
            );
          })}
        </div>

        <InstanceLLMConfigPanel
          provider={selectedProvider}
          draft={selectedProviderDraft}
          hasPendingChanges={hasPendingProviderChanges}
          isSaving={isSavingProviderConfig}
          isReadonly={isProviderConfigReadonly}
          readonlyMessage={t('instances.detail.instanceWorkbench.llmProviders.readonlyNotice')}
          onFieldChange={handleProviderFieldChange}
          onConfigChange={handleProviderConfigChange}
          onReset={handleResetProviderDraft}
          onSave={handleSaveProviderConfig}
        />
      </div>
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

        <div className="rounded-[1.75rem] border border-zinc-200/70 bg-white/75 dark:border-zinc-800 dark:bg-zinc-950/35">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200/70 px-5 py-4 dark:border-zinc-800">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                <FolderTree className="h-4 w-4" />
                {t('instances.detail.instanceWorkbench.files.runtimeArtifacts')}
              </div>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                {t('instances.detail.instanceWorkbench.files.runtimeArtifactsDescription')}
              </p>
            </div>
            {selectedFile ? (
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-zinc-950/[0.04] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-600 dark:bg-white/[0.06] dark:text-zinc-300">
                  {selectedFile.language}
                </span>
                <span
                  className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${
                    selectedFile.status === 'missing'
                      ? getDangerBadge(selectedFile.status)
                      : getStatusBadge(selectedFile.status)
                  }`}
                >
                  {t(`instances.detail.instanceWorkbench.fileStatus.${selectedFile.status}`)}
                </span>
              </div>
            ) : null}
          </div>

          {workbench && workbench.files.length > 0 ? (
            <div className="grid min-h-[42rem] xl:grid-cols-[20rem_minmax(0,1fr)]">
              <aside
                data-slot="instance-files-explorer"
                className="border-b border-zinc-200/70 bg-zinc-950/[0.02] p-3 dark:border-zinc-800 dark:bg-white/[0.02] xl:border-r xl:border-b-0"
              >
                <div className="flex items-center justify-between gap-3 px-2 pb-3 pt-1">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                    {t('instances.detail.instanceWorkbench.files.explorer')}
                  </div>
                  <div className="rounded-full bg-zinc-950/[0.04] px-2.5 py-1 text-[11px] font-semibold text-zinc-500 dark:bg-white/[0.06] dark:text-zinc-400">
                    {workbench.files.length}
                  </div>
                </div>
                <InstanceFileExplorer
                  files={workbench.files}
                  selectedFileId={selectedFileId}
                  onSelectFile={setSelectedFileId}
                />
              </aside>

              <div data-slot="instance-files-editor" className="flex min-h-[42rem] flex-col">
                {selectedFile ? (
                  <>
                    <div className="border-b border-zinc-200/70 px-5 py-4 dark:border-zinc-800">
                      <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-3">
                            <h3 className="truncate text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
                              {selectedFile.name}
                            </h3>
                            <span className="rounded-full bg-zinc-950/[0.04] px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-600 dark:bg-white/[0.06] dark:text-zinc-300">
                              {selectedFile.isReadonly
                                ? t('instances.detail.instanceWorkbench.files.previewMode')
                                : t('instances.detail.instanceWorkbench.files.editMode')}
                            </span>
                            {hasPendingFileChanges ? (
                              <span className="rounded-full bg-amber-500/12 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-amber-700 dark:text-amber-300">
                                {t('instances.detail.instanceWorkbench.files.unsavedChanges')}
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-2 truncate font-mono text-sm text-zinc-500 dark:text-zinc-400">
                            {selectedFile.path}
                          </p>
                        </div>
                        {selectedFile.isReadonly ? (
                          <div className="rounded-[1.25rem] border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm leading-6 text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
                            {t('instances.detail.instanceWorkbench.files.readonlyNotice')}
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={handleResetFileDraft}
                              disabled={!hasPendingFileChanges}
                              className="flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
                            >
                              <RotateCcw className="h-4 w-4" />
                              {t('instances.detail.instanceWorkbench.files.revertDraft')}
                            </button>
                            <button
                              type="button"
                              onClick={handleSaveFile}
                              disabled={!hasPendingFileChanges || isSavingFile}
                              className="flex items-center gap-2 rounded-2xl bg-primary-500 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-600 disabled:opacity-50"
                            >
                              {isSavingFile ? (
                                <>
                                  <RefreshCw className="h-4 w-4 animate-spin" />
                                  {t('instances.detail.instanceWorkbench.files.savingFile')}
                                </>
                              ) : (
                                <>
                                  <Save className="h-4 w-4" />
                                  {t('instances.detail.instanceWorkbench.files.saveFile')}
                                </>
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                        <span className="rounded-full bg-zinc-950/[0.04] px-2.5 py-1 dark:bg-white/[0.06]">
                          {selectedFile.size}
                        </span>
                        <span className="rounded-full bg-zinc-950/[0.04] px-2.5 py-1 dark:bg-white/[0.06]">
                          {selectedFile.updatedAt}
                        </span>
                        <span className="rounded-full bg-zinc-950/[0.04] px-2.5 py-1 dark:bg-white/[0.06]">
                          {t(`instances.detail.instanceWorkbench.fileCategories.${selectedFile.category}`)}
                        </span>
                      </div>
                    </div>

                    <div className="min-h-[34rem] flex-1">
                      <Suspense
                        fallback={
                          <div className="flex h-full min-h-[34rem] items-center justify-center px-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
                            {t('common.loading')}
                          </div>
                        }
                      >
                        <MonacoEditor
                          height="100%"
                          language={selectedFile.language}
                          theme={editorTheme}
                          value={selectedFileDraft}
                          onChange={(value) => handleFileDraftChange(value ?? '')}
                          options={{
                            automaticLayout: true,
                            fontSize: 13,
                            lineHeight: 20,
                            minimap: { enabled: true },
                            padding: { top: 16, bottom: 16 },
                            readOnly: selectedFile.isReadonly,
                            roundedSelection: true,
                            scrollBeyondLastLine: false,
                            smoothScrolling: true,
                            wordWrap: 'on',
                          }}
                        />
                      </Suspense>
                    </div>
                  </>
                ) : (
                  <div className="flex h-full min-h-[34rem] items-center justify-center px-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
                    {t('instances.detail.instanceWorkbench.files.selectFile')}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-5">
              {renderSectionAvailability('files', 'instances.detail.instanceWorkbench.empty.files')}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderMemorySection = () => {
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

  const renderToolsSection = () => {
    if (!workbench || workbench.tools.length === 0) {
      return renderSectionAvailability('tools', 'instances.detail.instanceWorkbench.empty.tools');
    }

    return (
      <WorkbenchRowList>
        {workbench.tools.map((tool, index) => (
          <WorkbenchRow key={tool.id} isLast={index === workbench.tools.length - 1}>
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
