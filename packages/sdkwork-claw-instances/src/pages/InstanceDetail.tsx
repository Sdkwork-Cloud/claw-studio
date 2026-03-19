import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Bot,
  Brain,
  Check,
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
import { useInstanceStore } from '@sdkwork/claw-core';
import { openExternalUrl } from '@sdkwork/claw-infrastructure';
import {
  Button,
  ChannelCatalog,
  getTaskCatalogTone,
  getTaskExecutionBadgeTone,
  getTaskHistoryBadgeTone,
  getTaskPreview,
  getTaskStatusBadgeTone,
  getTaskToggleStatusTarget,
  Input,
  TaskCatalog,
  TaskExecutionHistoryDrawer,
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

const MonacoEditor = React.lazy(() => import('@monaco-editor/react'));

function getRuntimeStatusTone(status: string) {
  if (status === 'healthy') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300';
  }
  if (status === 'attention') {
    return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300';
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

export function InstanceDetail() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { activeInstanceId, setActiveInstanceId } = useInstanceStore();
  const [activeSection, setActiveSection] = useState<InstanceWorkbenchSectionId>('llmProviders');
  const [workbench, setWorkbench] = useState<InstanceWorkbenchSnapshot | null>(null);
  const [config, setConfig] = useState<InstanceConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [fileDrafts, setFileDrafts] = useState<Record<string, string>>({});
  const [isSavingFile, setIsSavingFile] = useState(false);
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  const [providerDrafts, setProviderDrafts] = useState<Record<string, InstanceLLMProviderUpdate>>({});
  const [isSavingProviderConfig, setIsSavingProviderConfig] = useState(false);
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
  const token = workbench?.token || '';
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

  const handleCopyToken = () => {
    navigator.clipboard.writeText(token);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
  };

  const handleSave = async () => {
    if (!id || !config) {
      return;
    }

    setIsSaving(true);
    try {
      await instanceService.updateInstanceConfig(id, config);
      toast.success(t('instances.detail.toasts.configurationSaved'));
      await loadWorkbench(id);
    } catch {
      toast.error(t('instances.detail.toasts.failedToSaveConfiguration'));
    } finally {
      setIsSaving(false);
    }
  };

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
    if (!selectedProvider || !selectedProviderDraft) {
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
    if (!selectedProvider || !selectedProviderDraft) {
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
    if (!selectedProvider) {
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
    if (!id || !selectedProvider || !selectedProviderDraft) {
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

  const openOfficialLink = async (href: string) => {
    await openExternalUrl(href);
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
    } catch {
      toast.error(t('tasks.page.toasts.failedToClone'));
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
    } catch {
      toast.error(t('tasks.page.toasts.failedToRunNow'));
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
    } catch {
      toast.error(t('tasks.page.toasts.failedToUpdateStatus'));
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
    } catch {
      toast.error(t('tasks.page.toasts.failedToDelete'));
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

  const renderChannelsSection = () => {
    if (!workbench || workbench.channels.length === 0) {
      return (
        <div className="rounded-[1.5rem] bg-zinc-950/[0.03] p-5 text-sm text-zinc-500 dark:bg-white/[0.04] dark:text-zinc-400">
          {t('instances.detail.instanceWorkbench.empty.channels')}
        </div>
      );
    }

    return (
      <ChannelCatalog
        items={workbench.channels}
        variant="summary"
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
      />
    );
  };

  const renderTasksSection = () => {
    if (!workbench) {
      return null;
    }

    const taskCatalogItems: TaskCatalogItem[] = workbench.tasks.map((task) => {
      const latest = task.latestExecution;
      const isBusy =
        cloningTaskIds.includes(task.id) ||
        runningTaskIds.includes(task.id) ||
        statusTaskIds.includes(task.id) ||
        deletingTaskIds.includes(task.id);
      const deliveryTarget =
        task.deliveryMode === 'none'
          ? t('tasks.page.deliveryModes.none.title')
          : task.deliveryLabel || task.deliveryChannel || t('common.none');
      const promptPreview = getTaskPreview(task.prompt);
      const description = getTaskPreview(task.description) || promptPreview;
      const latestExecutionSummary = getTaskPreview(latest?.summary);

      return {
        id: task.id,
        name: task.name,
        tone: getTaskCatalogTone(task.status, latest?.status),
        badges: [
          {
            id: 'status',
            tone: getTaskStatusBadgeTone(task.status),
            icon: <span className="h-2 w-2 rounded-full bg-current" />,
            label: t(`tasks.page.status.${task.status}`),
          },
          {
            id: 'execution-content',
            tone: getTaskExecutionBadgeTone(task.executionContent),
            icon:
              task.executionContent === 'sendPromptMessage' ? (
                <MessageSquare className="h-3.5 w-3.5" />
              ) : (
                <Zap className="h-3.5 w-3.5" />
              ),
            label: t(`tasks.page.executionContents.${task.executionContent}.title`),
          },
        ],
        description: (
          <div className="space-y-2">
            <p>{description}</p>
            {task.description?.trim() ? (
              <div className="text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                <span className="font-semibold uppercase tracking-[0.16em]">
                  {t('tasks.page.cards.prompt')}
                </span>{' '}
                {promptPreview}
              </div>
            ) : null}
          </div>
        ),
        metrics: [
          {
            id: 'schedule',
            label: t('tasks.page.cards.schedule'),
            value: buildTaskScheduleSummary(t, task),
          },
          {
            id: 'next-run',
            label: t('tasks.page.cards.nextRun'),
            value: task.nextRun || '-',
          },
          {
            id: 'last-run',
            label: t('tasks.page.cards.lastRun'),
            value: task.lastRun || '-',
          },
        ],
        summaryTitle: t('tasks.page.cards.latestExecution'),
        summaryBadges: latest
          ? [
              {
                id: 'execution-status',
                tone: getTaskHistoryBadgeTone(latest.status),
                icon: <span className="h-2 w-2 rounded-full bg-current" />,
                label: t(`tasks.page.history.status.${latest.status}`),
              },
              {
                id: 'execution-trigger',
                tone: 'neutral',
                label: t(`tasks.page.history.triggers.${latest.trigger}`),
              },
            ]
          : undefined,
        summaryContent: latestExecutionSummary || t('tasks.page.cards.noExecutionYet'),
        summaryDetails: latest?.details || (!latest ? promptPreview : undefined),
        summaryFooter: deliveryTarget ? (
          <span>
            {t('tasks.page.cards.delivery')}: {deliveryTarget}
            {task.recipient ? ` / ${task.recipient}` : ''}
          </span>
        ) : undefined,
        actions: (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => openTaskWorkspace({ taskMode: 'edit', taskId: task.id })}
              disabled={isBusy}
            >
              <Edit2 className="h-4 w-4" />
              {t('tasks.page.actions.edit')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleCloneTask(task.id, task.name)}
              disabled={isBusy}
            >
              {cloningTaskIds.includes(task.id) ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              {t('tasks.page.actions.clone')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleToggleTaskStatus(task.id, task.status)}
              disabled={isBusy || !getTaskToggleStatusTarget(task.status)}
            >
              {statusTaskIds.includes(task.id) ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : task.status === 'active' ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              {task.status === 'active'
                ? t('tasks.page.actions.disable')
                : t('tasks.page.actions.enable')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleRunTaskNow(task.id)}
              disabled={isBusy}
            >
              {runningTaskIds.includes(task.id) ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              {t('tasks.page.actions.runNow')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void openTaskHistoryDrawer(task.id)}
              disabled={isBusy}
            >
              <History className="h-4 w-4" />
              {t('tasks.page.actions.history')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-500/10 dark:hover:text-red-300"
              onClick={() => void handleDeleteTask(task.id, task.name)}
              disabled={isBusy}
            >
              {deletingTaskIds.includes(task.id) ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              {t('tasks.page.actions.delete')}
            </Button>
          </>
        ),
      };
    });

    return (
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
            {t('tasks.page.title')}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void refreshTasksSection()}
              disabled={isRefreshingTasks}
            >
              {isRefreshingTasks ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {t('tasks.page.actions.refresh')}
            </Button>
            <Button
              size="sm"
              onClick={() => openTaskWorkspace({ taskMode: 'create' })}
            >
              <Plus className="h-4 w-4" />
              {t('tasks.page.actions.newTask')}
            </Button>
          </div>
        </div>

        <TaskCatalog
          className="bg-white/75 shadow-none dark:bg-zinc-950/35"
          items={taskCatalogItems}
          emptyState={
            <div className="rounded-[1.5rem] border border-zinc-200/70 bg-white/75 px-6 py-12 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-950/35">
              <Zap className="mx-auto h-10 w-10 text-primary-500 dark:text-primary-300" />
              <h3 className="mt-5 text-xl font-semibold text-zinc-950 dark:text-zinc-50">
                {t('tasks.page.empty.title')}
              </h3>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                {t('tasks.page.empty.description')}
              </p>
              <Button
                className="mt-6"
                onClick={() => openTaskWorkspace({ taskMode: 'create' })}
              >
                <Plus className="h-4 w-4" />
                {t('tasks.page.actions.newTask')}
              </Button>
            </div>
          }
        />
      </div>
    );
  };

  const renderAgentsSection = () => {
    if (!workbench || workbench.agents.length === 0) {
      return (
        <div className="rounded-[1.5rem] bg-zinc-950/[0.03] p-5 text-sm text-zinc-500 dark:bg-white/[0.04] dark:text-zinc-400">
          {t('instances.detail.instanceWorkbench.empty.agents')}
        </div>
      );
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
      return (
        <div className="rounded-[1.5rem] bg-zinc-950/[0.03] p-5 text-sm text-zinc-500 dark:bg-white/[0.04] dark:text-zinc-400">
          {t('instances.detail.instanceWorkbench.empty.skills')}
        </div>
      );
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
      return (
        <div className="rounded-[1.5rem] bg-zinc-950/[0.03] p-5 text-sm text-zinc-500 dark:bg-white/[0.04] dark:text-zinc-400">
          {t('instances.detail.instanceWorkbench.empty.llmProviders')}
        </div>
      );
    }

    return (
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_24rem]">
        <div data-slot="instance-llm-provider-list" className="space-y-3">
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
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto]">
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

          <div className="flex flex-col gap-3">
            <div className="rounded-[1.6rem] bg-zinc-950/[0.03] p-4 dark:bg-white/[0.04]">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                {t('instances.detail.fields.apiToken')}
              </div>
              <div className="mt-3 flex gap-2">
                <Input
                  type="password"
                  value={token || ''}
                  readOnly
                  className="min-w-0 flex-1 rounded-2xl bg-white px-4 py-3 font-mono dark:bg-zinc-950"
                />
                <button
                  type="button"
                  onClick={handleCopyToken}
                  className="flex items-center gap-2 rounded-2xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
                >
                  {copiedToken ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copiedToken ? t('common.copied') : t('common.copy')}
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center justify-center gap-2 rounded-2xl bg-primary-500 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-600 disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  {t('instances.detail.actions.saving')}
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  {t('instances.detail.actions.saveConfiguration')}
                </>
              )}
            </button>
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
                            disabled={!hasPendingFileChanges || isSavingFile || selectedFile.isReadonly}
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
            <div className="p-5 text-sm text-zinc-500 dark:text-zinc-400">
              {t('instances.detail.instanceWorkbench.empty.files')}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderMemorySection = () => {
    if (!workbench || workbench.memories.length === 0) {
      return (
        <div className="rounded-[1.5rem] bg-zinc-950/[0.03] p-5 text-sm text-zinc-500 dark:bg-white/[0.04] dark:text-zinc-400">
          {t('instances.detail.instanceWorkbench.empty.memory')}
        </div>
      );
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
    return (
      <div className="space-y-6">
        {workbench && workbench.tools.length > 0 ? (
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
        ) : (
          <div className="rounded-[1.5rem] bg-zinc-950/[0.03] p-5 text-sm text-zinc-500 dark:bg-white/[0.04] dark:text-zinc-400">
            {t('instances.detail.instanceWorkbench.empty.tools')}
          </div>
        )}

        <div className="rounded-[1.6rem] border border-rose-200 bg-rose-50/80 p-5 dark:border-rose-500/20 dark:bg-rose-500/8">
          <h3 className="text-lg font-semibold tracking-tight text-rose-700 dark:text-rose-300">
            {t('instances.detail.dangerZone')}
          </h3>
          <p className="mt-2 text-sm leading-6 text-rose-600 dark:text-rose-300">
            {t('instances.detail.dangerDescription')}
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            {instance?.status === 'online' ? (
              <button
                type="button"
                onClick={handleStop}
                className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-white px-4 py-3 text-sm font-semibold text-rose-600 transition-colors hover:bg-rose-50 dark:border-rose-500/20 dark:bg-zinc-950 dark:text-rose-300 dark:hover:bg-rose-500/10"
              >
                <Power className="h-4 w-4" />
                {t('instances.detail.actions.stop')}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStart}
                className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-sm font-semibold text-emerald-600 transition-colors hover:bg-emerald-50 dark:border-emerald-500/20 dark:bg-zinc-950 dark:text-emerald-300 dark:hover:bg-emerald-500/10"
              >
                <Power className="h-4 w-4" />
                {t('instances.detail.actions.start')}
              </button>
            )}
            <button
              type="button"
              onClick={handleRestart}
              className="flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
            >
              <RefreshCw className="h-4 w-4" />
              {t('instances.detail.actions.restart')}
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="flex items-center gap-2 rounded-2xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-rose-700"
            >
              <Trash2 className="h-4 w-4" />
              {t('instances.detail.actions.uninstallInstance')}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderSectionContent = () => {
    switch (activeSection) {
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
