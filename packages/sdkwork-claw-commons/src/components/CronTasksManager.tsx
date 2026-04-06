import { startTransition, type ReactNode, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Clock,
  Copy,
  Edit2,
  History,
  Loader2,
  MessageSquare,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Shield,
  Trash2,
  X,
  Zap,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  buildTaskAgentSelectState,
  buildTaskCardState,
  buildTaskCreateWorkspaceState,
  buildCreateTaskInput,
  buildTaskFormValuesFromTask,
  collectTaskFormErrors,
  createDefaultTaskFormValues,
  DEFAULT_TASK_AGENT_SELECT_VALUE,
  getActionTypeFromExecutionContent,
  isTaskThinkingLevel,
  openClawAgentCatalogService,
  type OpenClawAgentCatalog,
  serializeTaskSchedule,
  supportsTaskToolAllowlistConfig,
  taskService,
  taskThinkingLevels,
  type Task,
  type TaskCreateSectionId,
  type TaskDeliveryChannelOption,
  type TaskDeliveryMode,
  type TaskExecutionContent,
  type TaskExecutionHistoryEntry,
  type TaskFormErrorKey,
  type TaskFormValues,
  type TaskIntervalUnit,
  type TaskScheduleMode,
  type TaskSessionMode,
  type TaskWakeUpMode,
} from '@sdkwork/claw-core';
import {
  Button,
  DateInput,
  getTaskExecutionBadgeTone,
  getTaskHistoryBadgeTone,
  getTaskStatusBadgeTone,
  getTaskToggleStatusTarget,
  Input,
  Label,
  OverlaySurface,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  TaskCatalog,
  TaskExecutionHistoryDrawer,
  type TaskCatalogItem,
  Textarea,
  cn,
} from '@sdkwork/claw-ui';
import { toast } from 'sonner';
import { loadTaskStudioSnapshot } from './cronTasksManagerData.ts';

type TaskRouteIntent =
  | { mode: 'create' }
  | { mode: 'edit'; taskId: string }
  | null;

const fieldSectionMap: Record<TaskFormErrorKey, TaskCreateSectionId> = {
  name: 'basicInfo',
  prompt: 'basicInfo',
  intervalValue: 'basicInfo',
  scheduledDate: 'basicInfo',
  scheduledTime: 'basicInfo',
  cronExpression: 'basicInfo',
  staggerMs: 'basicInfo',
  customSessionId: 'execution',
  timeoutSeconds: 'execution',
  recipient: 'execution',
};

function addPendingId(ids: string[], id: string) {
  return ids.includes(id) ? ids : [...ids, id];
}

function removePendingId(ids: string[], id: string) {
  return ids.filter((item) => item !== id);
}

function readTaskRouteIntent(): TaskRouteIntent {
  if (typeof window === 'undefined') {
    return null;
  }

  const params = new URLSearchParams(window.location.search);
  const mode = params.get('taskMode');
  if (mode === 'create') {
    return { mode: 'create' };
  }

  if (mode === 'edit') {
    const taskId = params.get('taskId');
    if (taskId) {
      return { mode: 'edit', taskId };
    }
  }

  return null;
}

function clearTaskRouteIntent() {
  if (typeof window === 'undefined') {
    return;
  }

  const url = new URL(window.location.href);
  url.searchParams.delete('taskMode');
  url.searchParams.delete('taskId');
  const nextSearch = url.search ? `${url.search}` : '';
  window.history.replaceState({}, '', `${url.pathname}${nextSearch}${url.hash}`);
}

function getIntervalUnitLabel(
  t: (key: string, options?: Record<string, unknown>) => string,
  unit: TaskIntervalUnit,
  value: string | number,
) {
  const numericValue = Number(value);
  const suffix = numericValue === 1 ? unit : `${unit}s`;
  return t(`tasks.page.intervalUnits.${suffix}`);
}

function getValidationMessage(
  t: (key: string, options?: Record<string, unknown>) => string,
  field: TaskFormErrorKey,
  reason: 'required' | 'invalid',
) {
  const suffix = reason === 'required' ? 'Required' : 'Invalid';
  return t(`tasks.page.validation.${field}${suffix}`);
}

function buildSchedulePreview(values: TaskFormValues) {
  try {
    return serializeTaskSchedule(values);
  } catch {
    return null;
  }
}

function buildFormScheduleSummary(
  t: (key: string, options?: Record<string, unknown>) => string,
  values: TaskFormValues,
) {
  if (values.scheduleMode === 'interval') {
    return t('tasks.page.scheduleSummary.interval', {
      value: values.intervalValue || '--',
      unit: getIntervalUnitLabel(t, values.intervalUnit, values.intervalValue || 0),
    });
  }

  if (values.scheduleMode === 'datetime') {
    return t('tasks.page.scheduleSummary.datetime', {
      date: values.scheduledDate || '--',
      time: values.scheduledTime || '--',
    });
  }

  if (!values.cronExpression) {
    return t('tasks.page.scheduleSummary.cron');
  }

  return values.cronTimezone
    ? `${values.cronExpression} (${values.cronTimezone})`
    : values.cronExpression;
}

function buildTaskScheduleSummary(
  t: (key: string, options?: Record<string, unknown>) => string,
  task: Task,
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

  const cronExpression = task.cronExpression || task.schedule;
  return task.scheduleConfig.cronTimezone
    ? `${cronExpression} (${task.scheduleConfig.cronTimezone})`
    : cronExpression;
}

function getAvailableExecutionContents(sessionMode: TaskSessionMode) {
  return sessionMode === 'main'
    ? (['sendPromptMessage'] as TaskExecutionContent[])
    : (['runAssistantTask'] as TaskExecutionContent[]);
}

function getAvailableDeliveryModes(sessionMode: TaskSessionMode) {
  return sessionMode === 'main'
    ? (['webhook', 'none'] as TaskDeliveryMode[])
    : (['publishSummary', 'webhook', 'none'] as TaskDeliveryMode[]);
}

function buildTaskDeliverySummary(
  t: (key: string, options?: Record<string, unknown>) => string,
  task: Task,
  channelNameMap: Record<string, string>,
) {
  if (task.deliveryMode === 'none') {
    return t('tasks.page.deliveryModes.none.title');
  }

  if (task.deliveryMode === 'webhook') {
    return t('tasks.page.deliveryModes.webhook.title');
  }

  return channelNameMap[task.deliveryChannel || ''] || task.deliveryChannel || t('common.none');
}

export interface CronTasksManagerProps {
  instanceId?: string;
  embedded?: boolean;
}

export function CronTasksManager({
  instanceId,
  embedded = false,
}: CronTasksManagerProps) {
  const { t } = useTranslation();
  const activeInstanceId = instanceId;
  const [tasks, setTasks] = useState<Task[]>([]);
  const [executionsByTaskId, setExecutionsByTaskId] = useState<Record<string, TaskExecutionHistoryEntry[]>>({});
  const [deliveryChannels, setDeliveryChannels] = useState<TaskDeliveryChannelOption[]>([]);
  const [agentCatalog, setAgentCatalog] = useState<OpenClawAgentCatalog>({
    agents: [],
    defaultAgentId: null,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [editorMode, setEditorMode] = useState<'create' | 'edit' | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [historyTaskId, setHistoryTaskId] = useState<string | null>(null);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [isEditorResourcesLoading, setIsEditorResourcesLoading] = useState(false);
  const [isSavingEditor, setIsSavingEditor] = useState(false);
  const [cloningTaskIds, setCloningTaskIds] = useState<string[]>([]);
  const [runningTaskIds, setRunningTaskIds] = useState<string[]>([]);
  const [statusTaskIds, setStatusTaskIds] = useState<string[]>([]);
  const [deletingTaskIds, setDeletingTaskIds] = useState<string[]>([]);
  const [taskForm, setTaskForm] = useState<TaskFormValues>(createDefaultTaskFormValues());
  const [activeCreateSection, setActiveCreateSection] = useState<TaskCreateSectionId>('basicInfo');
  const [attemptedSave, setAttemptedSave] = useState(false);
  const [hasConsumedRouteIntent, setHasConsumedRouteIntent] = useState(false);
  const [editorResourcesInstanceId, setEditorResourcesInstanceId] = useState<string | null>(null);
  const editorResourcesRequestRef = useRef<Promise<void> | null>(null);
  const activeInstanceIdRef = useRef(activeInstanceId);

  const editorErrors = collectTaskFormErrors(taskForm);
  const workspaceState = buildTaskCreateWorkspaceState(taskForm, editorErrors);
  const schedulePreview = buildSchedulePreview(taskForm);
  const historyTask = historyTaskId ? tasks.find((task) => task.id === historyTaskId) || null : null;
  const historyEntries = historyTaskId ? executionsByTaskId[historyTaskId] || [] : [];
  const readyToSave = Boolean(activeInstanceId) && workspaceState.readiness.ready;
  const channelNameMap = Object.fromEntries(
    deliveryChannels.map((channel) => [channel.id, channel.name]),
  ) as Record<string, string>;
  const taskAgentSelectState = buildTaskAgentSelectState({
    catalog: agentCatalog,
    selectedAgentId: taskForm.agentId,
  });
  const selectedTaskAgentOption =
    taskAgentSelectState.options.find((option) => option.value === taskAgentSelectState.value) || null;
  const defaultTaskAgent =
    agentCatalog.agents.find((agent) => agent.isDefault) ||
    agentCatalog.agents.find((agent) => agent.id === agentCatalog.defaultAgentId) ||
    null;
  const supportsAgentCatalogSelection =
    isEditorResourcesLoading || agentCatalog.defaultAgentId !== null;
  const defaultTaskAgentId = agentCatalog.defaultAgentId || defaultTaskAgent?.id || 'main';
  const defaultTaskAgentName = defaultTaskAgent?.name || defaultTaskAgentId;
  const supportsToolAllowlist = supportsTaskToolAllowlistConfig(
    taskForm.sessionMode,
    taskForm.executionContent,
  );

  useEffect(() => {
    activeInstanceIdRef.current = activeInstanceId;
  }, [activeInstanceId]);

  const stats = {
    total: tasks.length,
    active: tasks.filter((task) => task.status === 'active').length,
    paused: tasks.filter((task) => task.status === 'paused').length,
    failed: tasks.filter((task) => task.status === 'failed').length,
  };

  useEffect(() => {
    setEditorMode(null);
    setEditingTaskId(null);
    setHistoryTaskId(null);
    setTaskForm(createDefaultTaskFormValues());
    setAttemptedSave(false);
    setActiveCreateSection('basicInfo');
    setHasConsumedRouteIntent(false);
    setIsEditorResourcesLoading(false);
    setEditorResourcesInstanceId(null);
    editorResourcesRequestRef.current = null;
    setAgentCatalog({
      agents: [],
      defaultAgentId: null,
    });
  }, [activeInstanceId]);

  async function refreshTaskStudio(
    mode: 'initial' | 'refresh' = 'refresh',
    options: {
      includeEditorResources?: boolean;
    } = {},
  ) {
    if (!activeInstanceId) {
      setTasks([]);
      setExecutionsByTaskId({});
      setDeliveryChannels([]);
      setAgentCatalog({
        agents: [],
        defaultAgentId: null,
      });
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    if (mode === 'initial') {
      setIsLoading(true);
    } else {
      setIsRefreshing(true);
    }

    try {
      const snapshot = await loadTaskStudioSnapshot({
        instanceId: activeInstanceId,
        includeEditorResources: options.includeEditorResources,
        historyTaskIds: historyTaskId ? [historyTaskId] : [],
        getTasks: (instanceId) => taskService.getTasks(instanceId),
        listDeliveryChannels: (instanceId) =>
          taskService.listDeliveryChannels(instanceId).catch(() => {
            toast.error(t('tasks.page.toasts.failedToLoadChannels'));
            return [];
          }),
        getAgentCatalog: (instanceId) =>
          openClawAgentCatalogService.getCatalog(instanceId).catch(() => ({
            agents: [],
            defaultAgentId: null,
          })),
        listTaskExecutions: async (taskId) => {
          try {
            return await taskService.listTaskExecutions(taskId);
          } catch {
            return [] as TaskExecutionHistoryEntry[];
          }
        },
      });
      const nextTaskIds = new Set(snapshot.tasks.map((task) => task.id));

      startTransition(() => {
        setTasks(snapshot.tasks);
        if (options.includeEditorResources) {
          setDeliveryChannels(snapshot.deliveryChannels);
          setAgentCatalog(snapshot.agentCatalog);
          setEditorResourcesInstanceId(activeInstanceId);
        }
        setExecutionsByTaskId((current) => {
          const preservedEntries = Object.fromEntries(
            Object.entries(current).filter(([taskId]) => nextTaskIds.has(taskId)),
          ) as Record<string, TaskExecutionHistoryEntry[]>;

          return {
            ...preservedEntries,
            ...snapshot.executionsByTaskId,
          };
        });

        if (historyTaskId && !snapshot.tasks.some((task) => task.id === historyTaskId)) {
          setHistoryTaskId(null);
        }
      });
    } catch {
      toast.error(t('tasks.page.toasts.failedToLoad'));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }

  useEffect(() => {
    void refreshTaskStudio('initial', { includeEditorResources: false });
  }, [activeInstanceId]);

  async function ensureEditorResources() {
    if (!activeInstanceId) {
      return;
    }

    if (editorResourcesInstanceId === activeInstanceId) {
      return;
    }

    if (editorResourcesRequestRef.current) {
      return editorResourcesRequestRef.current;
    }

    const requestedInstanceId = activeInstanceId;
    setIsEditorResourcesLoading(true);

    const request = Promise.all([
      taskService.listDeliveryChannels(requestedInstanceId).catch(() => {
        toast.error(t('tasks.page.toasts.failedToLoadChannels'));
        return [] as TaskDeliveryChannelOption[];
      }),
      openClawAgentCatalogService.getCatalog(requestedInstanceId).catch(() => ({
        agents: [],
        defaultAgentId: null,
      })),
    ])
      .then(([nextDeliveryChannels, nextAgentCatalog]) => {
        if (activeInstanceIdRef.current !== requestedInstanceId) {
          return;
        }

        startTransition(() => {
          setDeliveryChannels(nextDeliveryChannels);
          setAgentCatalog(nextAgentCatalog);
          setEditorResourcesInstanceId(requestedInstanceId);
        });
      })
      .finally(() => {
        if (editorResourcesRequestRef.current === request) {
          editorResourcesRequestRef.current = null;
        }

        if (activeInstanceIdRef.current === requestedInstanceId) {
          setIsEditorResourcesLoading(false);
        }
      });

    editorResourcesRequestRef.current = request;
    return request;
  }

  useEffect(() => {
    if (embedded || isLoading || !activeInstanceId || hasConsumedRouteIntent) {
      return;
    }

    const intent = readTaskRouteIntent();
    if (!intent) {
      setHasConsumedRouteIntent(true);
      return;
    }

    if (intent.mode === 'create') {
      openCreateEditor();
      clearTaskRouteIntent();
      setHasConsumedRouteIntent(true);
      return;
    }

    const task = tasks.find((item) => item.id === intent.taskId);
    if (task) {
      openEditEditor(task);
    }
    clearTaskRouteIntent();
    setHasConsumedRouteIntent(true);
  }, [activeInstanceId, hasConsumedRouteIntent, isLoading, tasks]);

  function updateTaskFormField<Key extends keyof TaskFormValues>(field: Key, value: TaskFormValues[Key]) {
    setTaskForm((current) => ({ ...current, [field]: value }));
  }

  function updateExecutionContent(value: TaskExecutionContent) {
    setTaskForm((current) => {
      const sessionMode = value === 'sendPromptMessage'
        ? 'main'
        : current.sessionMode === 'main'
          ? 'isolated'
          : current.sessionMode;
      const deliveryMode =
        sessionMode === 'main' && current.deliveryMode === 'publishSummary'
          ? 'none'
          : current.deliveryMode;

      return {
        ...current,
        sessionMode,
        executionContent: value,
        actionType: getActionTypeFromExecutionContent(value),
        deliveryMode,
      };
    });
  }

  function updateDeliveryMode(value: TaskDeliveryMode) {
    setTaskForm((current) => ({
      ...current,
      deliveryMode: value,
      deliveryBestEffort: value === 'none' ? false : current.deliveryBestEffort,
      deliveryChannel: value === 'publishSummary' ? current.deliveryChannel : '',
      recipient: value === 'none' ? '' : current.recipient,
    }));
  }

  function updateScheduleMode(value: TaskScheduleMode) {
    setTaskForm((current) => ({ ...current, scheduleMode: value }));
  }

  function updateSessionMode(value: TaskSessionMode) {
    setTaskForm((current) => {
      const executionContent =
        value === 'main'
          ? 'sendPromptMessage'
          : current.executionContent === 'sendPromptMessage'
            ? 'runAssistantTask'
            : current.executionContent;
      const deliveryMode =
        value === 'main' && current.deliveryMode === 'publishSummary'
          ? 'none'
          : current.deliveryMode;

      return {
        ...current,
        sessionMode: value,
        customSessionId: value === 'custom' ? current.customSessionId : '',
        executionContent,
        actionType: getActionTypeFromExecutionContent(executionContent),
        deliveryMode,
        deliveryChannel: deliveryMode === 'publishSummary' ? current.deliveryChannel : '',
      };
    });
  }

  function openCreateEditor() {
    if (!activeInstanceId) {
      toast.error(t('tasks.page.toasts.noActiveInstance'));
      return;
    }
    setEditorMode('create');
    setEditingTaskId(null);
    setTaskForm(createDefaultTaskFormValues());
    setAttemptedSave(false);
    setActiveCreateSection('basicInfo');
    void ensureEditorResources();
  }

  function openEditEditor(task: Task) {
    setEditorMode('edit');
    setEditingTaskId(task.id);
    setTaskForm(buildTaskFormValuesFromTask(task));
    setAttemptedSave(false);
    setActiveCreateSection('basicInfo');
    void ensureEditorResources();
  }

  function closeEditor() {
    setEditorMode(null);
    setEditingTaskId(null);
    setTaskForm(createDefaultTaskFormValues());
    setAttemptedSave(false);
    setActiveCreateSection('basicInfo');
  }

  async function openHistoryDrawer(task: Task) {
    setHistoryTaskId(task.id);
    setIsHistoryLoading(true);
    try {
      const entries = await taskService.listTaskExecutions(task.id);
      setExecutionsByTaskId((current) => ({ ...current, [task.id]: entries }));
    } catch {
      toast.error(t('tasks.page.toasts.failedToLoadHistory'));
    } finally {
      setIsHistoryLoading(false);
    }
  }

  async function handleCloneTask(task: Task) {
    setCloningTaskIds((current) => addPendingId(current, task.id));
    try {
      await taskService.cloneTask(task.id, {
        name: t('tasks.page.actions.cloneName', { name: task.name }),
      });
      toast.success(t('tasks.page.toasts.cloned'));
      await refreshTaskStudio('refresh');
    } catch {
      toast.error(t('tasks.page.toasts.failedToClone'));
    } finally {
      setCloningTaskIds((current) => removePendingId(current, task.id));
    }
  }

  async function handleRunTaskNow(task: Task) {
    setRunningTaskIds((current) => addPendingId(current, task.id));
    try {
      await taskService.runTaskNow(task.id);
      toast.success(t('tasks.page.toasts.ranNow'));
      await refreshTaskStudio('refresh');
    } catch {
      toast.error(t('tasks.page.toasts.failedToRunNow'));
    } finally {
      setRunningTaskIds((current) => removePendingId(current, task.id));
    }
  }

  async function handleToggleTaskStatus(task: Task) {
    const nextStatus = getTaskToggleStatusTarget(task.status);
    if (!nextStatus) {
      return;
    }

    setStatusTaskIds((current) => addPendingId(current, task.id));
    try {
      await taskService.updateTaskStatus(task.id, nextStatus);
      toast.success(t(nextStatus === 'active' ? 'tasks.page.toasts.enabled' : 'tasks.page.toasts.disabled'));
      await refreshTaskStudio('refresh');
    } catch {
      toast.error(t('tasks.page.toasts.failedToUpdateStatus'));
    } finally {
      setStatusTaskIds((current) => removePendingId(current, task.id));
    }
  }

  async function handleDeleteTask(task: Task) {
    if (!window.confirm(t('tasks.page.confirmDelete', { name: task.name }))) {
      return;
    }
    setDeletingTaskIds((current) => addPendingId(current, task.id));
    try {
      await taskService.deleteTask(task.id);
      toast.success(t('tasks.page.toasts.deleted'));
      await refreshTaskStudio('refresh');
    } catch {
      toast.error(t('tasks.page.toasts.failedToDelete'));
    } finally {
      setDeletingTaskIds((current) => removePendingId(current, task.id));
    }
  }

  async function handleSaveTask() {
    if (!activeInstanceId) {
      toast.error(t('tasks.page.validation.activeInstanceRequired'));
      return;
    }
    setAttemptedSave(true);
    if (!workspaceState.readiness.ready) {
      const firstBlockingField = workspaceState.readiness.blockingFields[0];
      if (firstBlockingField && editorErrors[firstBlockingField]) {
        setActiveCreateSection(fieldSectionMap[firstBlockingField]);
        toast.error(getValidationMessage(t, firstBlockingField, editorErrors[firstBlockingField]));
      } else {
        toast.error(t('tasks.page.validation.description'));
      }
      return;
    }

    setIsSavingEditor(true);
    try {
      const payload = buildCreateTaskInput(taskForm);
      if (editorMode === 'edit' && editingTaskId) {
        await taskService.updateTask(editingTaskId, payload);
        toast.success(t('tasks.page.toasts.updated'));
      } else {
        await taskService.createTask(activeInstanceId, payload);
        toast.success(t('tasks.page.toasts.created'));
      }
      closeEditor();
      await refreshTaskStudio('refresh');
    } catch {
      toast.error(
        t(editorMode === 'edit' ? 'tasks.page.toasts.failedToUpdate' : 'tasks.page.toasts.failedToCreate'),
      );
    } finally {
      setIsSavingEditor(false);
    }
  }

  function renderFieldMeta(field: TaskFormErrorKey, hint?: string) {
    if (attemptedSave && editorErrors[field]) {
      return (
        <p className="mt-2 text-xs font-medium text-red-600 dark:text-red-400">
          {getValidationMessage(t, field, editorErrors[field])}
        </p>
      );
    }

    if (!hint) {
      return null;
    }

    return <p className="mt-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400">{hint}</p>;
  }

  function renderCompactField({
    label,
    field,
    hint,
    meta,
    align = 'start',
    bodyClassName,
    children,
  }: {
    label: string;
    field?: TaskFormErrorKey;
    hint?: string;
    meta?: ReactNode;
    align?: 'start' | 'center';
    bodyClassName?: string;
    children: ReactNode;
  }) {
    const resolvedMeta =
      meta !== undefined
        ? meta
        : field
          ? renderFieldMeta(field, hint)
          : hint
            ? <p className="text-xs leading-5 text-zinc-500 dark:text-zinc-400">{hint}</p>
            : null;

    return (
      <div
        className={cn(
          'grid gap-2 md:grid-cols-[10rem,minmax(0,1fr)] md:gap-3',
          align === 'center' ? 'md:items-center' : 'md:items-start',
        )}
      >
        <Label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400 md:pt-2">
          {label}
        </Label>
        <div className={cn('min-w-0 space-y-2', bodyClassName)}>
          {children}
          {resolvedMeta}
        </div>
      </div>
    );
  }

  function renderBasicInfoSection() {
    return (
      <div className="grid gap-5 xl:grid-cols-[1.08fr,0.92fr]">
        <section className="space-y-5">
          <div className="rounded-[26px] border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="text-base font-bold text-zinc-950 dark:text-zinc-50">
              {t('tasks.page.workspace.overviewTitle')}
            </h3>
            <p className="mt-1 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
              {t('tasks.page.workspace.overviewDescription')}
            </p>
            <div className="mt-4 space-y-4">
              {renderCompactField({
                label: t('tasks.page.fields.taskName'),
                field: 'name',
                children: (
                  <Input
                    value={taskForm.name}
                    onChange={(event) => updateTaskFormField('name', event.target.value)}
                    placeholder={t('tasks.page.fields.taskNamePlaceholder')}
                  />
                ),
              })}
              {renderCompactField({
                label: t('tasks.page.fields.description'),
                children: (
                  <Input
                    value={taskForm.description}
                    onChange={(event) => updateTaskFormField('description', event.target.value)}
                    placeholder={t('tasks.page.fields.descriptionPlaceholder')}
                  />
                ),
              })}
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                      {t('tasks.page.fields.enabled')}
                    </div>
                    <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                      {t('tasks.page.fields.enabledHelp')}
                    </p>
                  </div>
                  <Switch
                    checked={taskForm.enabled}
                    onCheckedChange={(checked) => updateTaskFormField('enabled', checked)}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[26px] border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="text-base font-bold text-zinc-950 dark:text-zinc-50">
              {t('tasks.page.workspace.promptTitle')}
            </h3>
            <p className="mt-1 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
              {t('tasks.page.workspace.promptDescription')}
            </p>
            <div className="mt-4">
              {renderCompactField({
                label: t('tasks.page.fields.prompt'),
                field: 'prompt',
                hint: t('tasks.page.fields.promptHelp'),
                align: 'start',
                bodyClassName: 'space-y-3',
                children: (
                  <Textarea
                    rows={10}
                    value={taskForm.prompt}
                    onChange={(event) => updateTaskFormField('prompt', event.target.value)}
                    placeholder={t('tasks.page.fields.promptPlaceholder')}
                    className="min-h-[220px] resize-none"
                  />
                ),
              })}
            </div>
          </div>
        </section>

        <section className="rounded-[26px] border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h3 className="text-base font-bold text-zinc-950 dark:text-zinc-50">
            {t('tasks.page.workspace.scheduleTitle')}
          </h3>
          <p className="mt-1 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
            {t('tasks.page.workspace.scheduleDescription')}
          </p>
          <div className="mt-4 space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              {(['interval', 'datetime', 'cron'] as TaskScheduleMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => updateScheduleMode(mode)}
                  className={cn(
                    'rounded-2xl border px-4 py-4 text-left transition-all',
                    taskForm.scheduleMode === mode
                      ? 'border-primary-300 bg-primary-50 dark:border-primary-500/30 dark:bg-primary-500/10'
                      : 'border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700',
                  )}
                >
                  <div className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                    {t(`tasks.page.scheduleModes.${mode}`)}
                  </div>
                  <div className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                    {t(`tasks.page.scheduleModeHelp.${mode}`)}
                  </div>
                </button>
              ))}
            </div>

            {taskForm.scheduleMode === 'interval' ? (
              <div className="space-y-3">
                {renderCompactField({
                  label: t('tasks.page.fields.intervalValue'),
                  field: 'intervalValue',
                  children: (
                    <Input
                      type="number"
                      min="1"
                      value={taskForm.intervalValue}
                      onChange={(event) => updateTaskFormField('intervalValue', event.target.value)}
                      placeholder="30"
                    />
                  ),
                })}
                {renderCompactField({
                  label: t('tasks.page.fields.intervalUnit'),
                  children: (
                    <Select
                      value={taskForm.intervalUnit}
                      onValueChange={(value) => updateTaskFormField('intervalUnit', value as TaskIntervalUnit)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="minute">{t('tasks.page.intervalUnits.minutes')}</SelectItem>
                        <SelectItem value="hour">{t('tasks.page.intervalUnits.hours')}</SelectItem>
                        <SelectItem value="day">{t('tasks.page.intervalUnits.days')}</SelectItem>
                      </SelectContent>
                    </Select>
                  ),
                })}
              </div>
            ) : null}

            {taskForm.scheduleMode === 'datetime' ? (
              <div className="space-y-3">
                {renderCompactField({
                  label: t('tasks.page.fields.scheduledDate'),
                  field: 'scheduledDate',
                  children: (
                    <DateInput
                      calendarLabel={t('tasks.page.fields.scheduledDate')}
                      value={taskForm.scheduledDate}
                      onChange={(event) => updateTaskFormField('scheduledDate', event.target.value)}
                    />
                  ),
                })}
                {renderCompactField({
                  label: t('tasks.page.fields.scheduledTime'),
                  field: 'scheduledTime',
                  children: (
                    <Input
                      type="time"
                      value={taskForm.scheduledTime}
                      onChange={(event) => updateTaskFormField('scheduledTime', event.target.value)}
                    />
                  ),
                })}
              </div>
            ) : null}

            {taskForm.scheduleMode === 'cron' ? (
              <div className="rounded-2xl border border-primary-200 bg-primary-50/70 p-4 dark:border-primary-500/20 dark:bg-primary-500/10">
                <div className="text-sm font-semibold text-primary-900 dark:text-primary-100">
                  {t('tasks.page.workspace.advancedTitle')}
                </div>
                <p className="mt-1 text-xs leading-5 text-primary-700 dark:text-primary-200">
                  {t('tasks.page.workspace.cronManagedInAdvanced')}
                </p>
                <div className="mt-4 space-y-3">
                  {renderCompactField({
                    label: t('tasks.page.fields.cronExpression'),
                    field: 'cronExpression',
                    hint: t('tasks.page.fields.cronExpressionHelp'),
                    children: (
                      <Input
                        value={taskForm.cronExpression}
                        onChange={(event) => updateTaskFormField('cronExpression', event.target.value)}
                        placeholder={t('tasks.page.fields.cronExpressionPlaceholder')}
                        className="font-mono"
                      />
                    ),
                  })}
                  {renderCompactField({
                    label: t('tasks.page.fields.cronTimezone'),
                    meta: (
                      <p className="text-xs leading-5 text-primary-700 dark:text-primary-200">
                        {t('tasks.page.fields.cronTimezoneHelp')}
                      </p>
                    ),
                    children: (
                      <Input
                        value={taskForm.cronTimezone}
                        onChange={(event) => updateTaskFormField('cronTimezone', event.target.value)}
                        placeholder={t('tasks.page.fields.cronTimezonePlaceholder')}
                      />
                    ),
                  })}
                  {renderCompactField({
                    label: t('tasks.page.fields.staggerMs'),
                    field: 'staggerMs',
                    hint: t('tasks.page.fields.staggerMsHelp'),
                    children: (
                      <Input
                        type="number"
                        min="0"
                        step="1000"
                        value={taskForm.staggerMs}
                        onChange={(event) => updateTaskFormField('staggerMs', event.target.value)}
                        placeholder={t('tasks.page.fields.staggerMsPlaceholder')}
                      />
                    ),
                  })}
                </div>
              </div>
            ) : null}

            {taskForm.scheduleMode === 'datetime' ? (
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                      {t('tasks.page.fields.deleteAfterRun')}
                    </div>
                    <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                      {t('tasks.page.fields.deleteAfterRunHelp')}
                    </p>
                  </div>
                  <Switch
                    checked={taskForm.deleteAfterRun}
                    onCheckedChange={(checked) => updateTaskFormField('deleteAfterRun', checked)}
                  />
                </div>
              </div>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                  {t('tasks.page.fields.generatedSchedule')}
                </div>
                <div className="mt-2 text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                  {schedulePreview?.schedule || buildFormScheduleSummary(t, taskForm)}
                </div>
                {!schedulePreview ? (
                  <p className="mt-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                    {t('tasks.page.fields.schedulePreviewPending')}
                  </p>
                ) : null}
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                  {t('tasks.page.fields.cronPreview')}
                </div>
                <div className="mt-2 break-all font-mono text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                  {schedulePreview?.cronExpression || t('tasks.page.fields.cronPreviewPending')}
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    );
  }

  function renderExecutionSection() {
    return (
      <div className="space-y-5">
        <div className="grid gap-5 xl:grid-cols-2">
          <section className="rounded-[26px] border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="text-base font-bold text-zinc-950 dark:text-zinc-50">
              {t('tasks.page.workspace.commonConfigTitle')}
            </h3>
            <p className="mt-1 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
              {t('tasks.page.workspace.commonConfigDescription')}
            </p>
            <div className="mt-4 space-y-4">
              <div>
                <div className="mb-2 text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                  {t('tasks.page.fields.executionContent')}
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {getAvailableExecutionContents(taskForm.sessionMode).map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => updateExecutionContent(value)}
                      className={cn(
                        'rounded-2xl border px-4 py-4 text-left transition-all',
                        taskForm.executionContent === value
                          ? 'border-primary-300 bg-primary-50 dark:border-primary-500/30 dark:bg-primary-500/10'
                          : 'border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700',
                      )}
                    >
                      <div className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                        {t(`tasks.page.executionContents.${value}.title`)}
                      </div>
                      <div className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                        {t(`tasks.page.executionContents.${value}.description`)}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {(['isolated', 'current', 'custom', 'main'] as TaskSessionMode[]).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => updateSessionMode(value)}
                    className={cn(
                      'rounded-2xl border px-4 py-4 text-left transition-all',
                      taskForm.sessionMode === value
                        ? 'border-primary-300 bg-primary-50 dark:border-primary-500/30 dark:bg-primary-500/10'
                        : 'border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700',
                    )}
                  >
                    <div className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                      {t(`tasks.page.sessionModes.${value}.title`)}
                    </div>
                    <div className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                      {t(`tasks.page.sessionModes.${value}.description`)}
                    </div>
                  </button>
                ))}
              </div>

              {taskForm.sessionMode === 'custom' ? (
                renderCompactField({
                  label: t('tasks.page.fields.customSessionId'),
                  field: 'customSessionId',
                  hint: t('tasks.page.fields.customSessionIdHelp'),
                  children: (
                    <Input
                      value={taskForm.customSessionId}
                      onChange={(event) => updateTaskFormField('customSessionId', event.target.value)}
                      placeholder={t('tasks.page.fields.customSessionIdPlaceholder')}
                    />
                  ),
                })
              ) : null}

              <div className="grid gap-4 md:grid-cols-2">
                {(['immediate', 'nextCycle'] as TaskWakeUpMode[]).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => updateTaskFormField('wakeUpMode', value)}
                    className={cn(
                      'rounded-2xl border px-4 py-4 text-left transition-all',
                      taskForm.wakeUpMode === value
                        ? 'border-primary-300 bg-primary-50 dark:border-primary-500/30 dark:bg-primary-500/10'
                        : 'border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700',
                    )}
                  >
                    <div className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                      {t(`tasks.page.wakeUpModes.${value}.title`)}
                    </div>
                    <div className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                      {t(`tasks.page.wakeUpModes.${value}.description`)}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="rounded-[26px] border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="text-base font-bold text-zinc-950 dark:text-zinc-50">
              {t('tasks.page.workspace.deliveryTitle')}
            </h3>
            <p className="mt-1 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
              {t('tasks.page.workspace.deliveryDescription')}
            </p>
            <div className="mt-4 space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                {getAvailableDeliveryModes(taskForm.sessionMode).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => updateDeliveryMode(value)}
                    className={cn(
                      'rounded-2xl border px-4 py-4 text-left transition-all',
                      taskForm.deliveryMode === value
                        ? 'border-primary-300 bg-primary-50 dark:border-primary-500/30 dark:bg-primary-500/10'
                        : 'border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700',
                    )}
                  >
                    <div className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                      {t(`tasks.page.deliveryModes.${value}.title`)}
                    </div>
                    <div className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                      {t(`tasks.page.deliveryModes.${value}.description`)}
                    </div>
                  </button>
                ))}
              </div>

              {taskForm.deliveryMode === 'publishSummary' ? (
                <>
                  {renderCompactField({
                    label: t('tasks.page.fields.deliveryChannel'),
                    meta: (
                      <p className="text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                        {isEditorResourcesLoading
                          ? t('common.loading')
                          : deliveryChannels.length > 0
                          ? t('tasks.page.fields.deliveryChannelHelp')
                          : t('tasks.page.fields.noConnectedChannels')}
                      </p>
                    ),
                    children: (
                      <Select
                        disabled={isEditorResourcesLoading || deliveryChannels.length === 0}
                        value={taskForm.deliveryChannel || undefined}
                        onValueChange={(value) => updateTaskFormField('deliveryChannel', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={t('tasks.page.fields.deliveryChannelPlaceholder')} />
                        </SelectTrigger>
                        <SelectContent>
                          {deliveryChannels.map((channel) => (
                            <SelectItem key={channel.id} value={channel.id}>
                              {channel.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ),
                  })}
                  {renderCompactField({
                    label: t('tasks.page.fields.recipient'),
                    hint: t('tasks.page.fields.recipientHelp'),
                    children: (
                      <Input
                        value={taskForm.recipient}
                        onChange={(event) => updateTaskFormField('recipient', event.target.value)}
                        placeholder={t('tasks.page.fields.recipientPlaceholder')}
                      />
                    ),
                  })}
                </>
              ) : null}

              {taskForm.deliveryMode === 'webhook' ? (
                renderCompactField({
                  label: t('tasks.page.fields.webhookUrl'),
                  field: 'recipient',
                  hint: t('tasks.page.fields.webhookUrlHelp'),
                  children: (
                    <Input
                      value={taskForm.recipient}
                      onChange={(event) => updateTaskFormField('recipient', event.target.value)}
                      placeholder={t('tasks.page.fields.webhookUrlPlaceholder')}
                    />
                  ),
                })
              ) : null}

              {taskForm.deliveryMode !== 'none' ? (
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                        {t('tasks.page.fields.deliveryBestEffort')}
                      </div>
                      <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                        {t('tasks.page.fields.deliveryBestEffortHelp')}
                      </p>
                    </div>
                    <Switch
                      checked={taskForm.deliveryBestEffort}
                      onCheckedChange={(checked) => updateTaskFormField('deliveryBestEffort', checked)}
                    />
                  </div>
                </div>
              ) : null}
            </div>
          </section>
        </div>

        <section className="rounded-[26px] border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h3 className="text-base font-bold text-zinc-950 dark:text-zinc-50">
            {t('tasks.page.workspace.executionAdvancedTitle')}
          </h3>
          <p className="mt-1 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
            {t('tasks.page.workspace.executionAdvancedDescription')}
          </p>
          <div className="mt-4 grid gap-4 xl:grid-cols-[0.84fr,1.16fr]">
            <div className="rounded-2xl border border-primary-200 bg-primary-50/70 p-5 dark:border-primary-500/20 dark:bg-primary-500/10">
              <div className="flex items-center gap-2 text-sm font-semibold text-primary-900 dark:text-primary-100">
                <Shield className="h-4 w-4" />
                {t('tasks.page.workspace.executionSafeguardsTitle')}
              </div>
              <p className="mt-2 text-xs leading-6 text-primary-700 dark:text-primary-200">
                {t('tasks.page.workspace.executionSafeguardsDescription')}
              </p>
            </div>
            <div className="grid gap-3">
              {taskForm.executionContent === 'runAssistantTask' ? (
                <>
                  {renderCompactField({
                    label: t('tasks.page.fields.timeoutSeconds'),
                    field: 'timeoutSeconds',
                    hint: t('tasks.page.fields.timeoutSecondsHelp'),
                    children: (
                      <Input
                        type="number"
                        min="1"
                        value={taskForm.timeoutSeconds}
                        onChange={(event) => updateTaskFormField('timeoutSeconds', event.target.value)}
                        placeholder={t('tasks.page.fields.timeoutSecondsPlaceholder')}
                      />
                    ),
                  })}
                  {renderCompactField({
                    label: t('tasks.page.fields.model'),
                    hint: t('tasks.page.fields.modelHelp'),
                    children: (
                      <Input
                        value={taskForm.model}
                        onChange={(event) => updateTaskFormField('model', event.target.value)}
                        placeholder={t('tasks.page.fields.modelPlaceholder')}
                      />
                    ),
                  })}
                  {renderCompactField({
                    label: t('tasks.page.fields.thinking'),
                    hint: t('tasks.page.fields.thinkingHelp'),
                    children: (
                      <Select
                        value={taskForm.thinking || 'inherit'}
                        onValueChange={(value) =>
                          updateTaskFormField(
                            'thinking',
                            value === 'inherit' ? '' : isTaskThinkingLevel(value) ? value : '',
                          )
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={t('tasks.page.fields.thinkingPlaceholder')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="inherit">{t('tasks.page.thinkingLevels.inherit')}</SelectItem>
                          {taskThinkingLevels.map((value) => (
                            <SelectItem key={value} value={value}>
                              {t(`tasks.page.thinkingLevels.${value}`)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ),
                  })}
                  <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                          {t('tasks.page.fields.lightContext')}
                        </div>
                        <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                          {t('tasks.page.fields.lightContextHelp')}
                        </p>
                      </div>
                      <Switch
                        checked={taskForm.lightContext}
                        onCheckedChange={(checked) => updateTaskFormField('lightContext', checked)}
                      />
                    </div>
                  </div>
                </>
              ) : null}
              {supportsToolAllowlist
                ? renderCompactField({
                    label: t('tasks.page.fields.toolAllowlist'),
                    meta: (
                      <div className="space-y-2">
                        <p className="text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                          {t('tasks.page.fields.toolAllowlistHelp')}
                        </p>
                        <p className="text-[11px] leading-5 text-zinc-400 dark:text-zinc-500">
                          {t('tasks.page.fields.toolAllowlistTokensHelp')}
                        </p>
                      </div>
                    ),
                    bodyClassName: 'space-y-3',
                    children: (
                      <Textarea
                        value={taskForm.toolAllowlist}
                        onChange={(event) => updateTaskFormField('toolAllowlist', event.target.value)}
                        placeholder={t('tasks.page.fields.toolAllowlistPlaceholder')}
                        rows={6}
                        className="font-mono text-xs leading-6"
                      />
                    ),
                  })
                : null}
              {renderCompactField({
                label: t('tasks.page.fields.agentId'),
                meta: (
                  <p className="text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                    {isEditorResourcesLoading
                      ? t('common.loading')
                      : supportsAgentCatalogSelection
                      ? selectedTaskAgentOption?.defaultRoute
                        ? t('tasks.page.fields.agentIdDefaultHelp', {
                            name: defaultTaskAgentName,
                            agentId: defaultTaskAgentId,
                          })
                        : selectedTaskAgentOption?.missing
                          ? t('tasks.page.fields.agentIdUnavailableHelp', {
                              agentId: selectedTaskAgentOption.agentId || taskForm.agentId,
                            })
                          : t('tasks.page.fields.agentIdCatalogHelp')
                      : t('tasks.page.fields.agentIdHelp')}
                  </p>
                ),
                children: supportsAgentCatalogSelection ? (
                  <Select
                    disabled={isEditorResourcesLoading}
                    value={taskAgentSelectState.value}
                    onValueChange={(value) =>
                      updateTaskFormField(
                        'agentId',
                        value === DEFAULT_TASK_AGENT_SELECT_VALUE ? '' : value,
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('tasks.page.fields.agentIdPlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      {taskAgentSelectState.options.map((option) => {
                        const baseLabel =
                          option.agentId && option.name !== option.agentId
                            ? `${option.name} (${option.agentId})`
                            : option.name;

                        return (
                          <SelectItem key={option.value} value={option.value}>
                            {option.defaultRoute
                              ? t('tasks.page.fields.agentIdDefaultOption', {
                                  name: defaultTaskAgentName,
                                  agentId: defaultTaskAgentId,
                                })
                              : option.missing
                                ? t('tasks.page.fields.agentIdUnavailableOption', {
                                    agentId: option.agentId || option.value,
                                  })
                                : option.defaultAgent
                                  ? `${baseLabel} (${t('tasks.page.fields.agentIdDefaultLabel')})`
                                  : baseLabel}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={taskForm.agentId}
                    onChange={(event) => updateTaskFormField('agentId', event.target.value)}
                    placeholder={t('tasks.page.fields.agentIdPlaceholder')}
                  />
                ),
              })}
            </div>
          </div>
        </section>
      </div>
    );
  }

  function renderMainContent() {
    if (isLoading) {
      return (
        <div className="flex flex-1 items-center justify-center p-8">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
        </div>
      );
    }

    const taskCatalogItems: TaskCatalogItem[] = tasks.map((task) => {
      const cardState = buildTaskCardState(task, executionsByTaskId[task.id] || []);
      const isBusy =
        cloningTaskIds.includes(task.id) ||
        runningTaskIds.includes(task.id) ||
        statusTaskIds.includes(task.id) ||
        deletingTaskIds.includes(task.id);
      const latest = cardState.latestExecution;
      const delivery = buildTaskDeliverySummary(t, task, channelNameMap);

      return {
        id: task.id,
        name: task.name,
        tone: cardState.tone,
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
            <p>{cardState.summaryText}</p>
            {task.description?.trim() ? (
              <div className="text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                <span className="font-semibold uppercase tracking-[0.16em]">
                  {t('tasks.page.cards.prompt')}
                </span>{' '}
                {cardState.promptExcerpt}
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
            value: cardState.nextRunLabel,
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
        summaryContent: latest
          ? cardState.latestExecutionSummary
          : t('tasks.page.cards.noExecutionYet'),
        summaryDetails: latest?.details || (!latest ? cardState.promptExcerpt : undefined),
        summaryFooter: (
          <>
            {t('tasks.page.cards.delivery')}: {delivery}
            {task.recipient ? ` / ${task.recipient}` : ''}
          </>
        ),
        actions: (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => openEditEditor(task)}
              disabled={isBusy}
            >
              <Edit2 className="h-4 w-4" />
              {t('tasks.page.actions.edit')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleCloneTask(task)}
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
              onClick={() => void handleToggleTaskStatus(task)}
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
              onClick={() => void handleRunTaskNow(task)}
              disabled={isBusy || !cardState.canRunNow}
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
              onClick={() => void openHistoryDrawer(task)}
              disabled={isBusy}
            >
              <History className="h-4 w-4" />
              {t('tasks.page.actions.history')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-500/10 dark:hover:text-red-300"
              onClick={() => void handleDeleteTask(task)}
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

    if (embedded) {
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
                onClick={() => void refreshTaskStudio('refresh')}
                disabled={isRefreshing}
              >
                {isRefreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                {t('tasks.page.actions.refresh')}
              </Button>
              <Button size="sm" onClick={openCreateEditor} disabled={!activeInstanceId}>
                <Plus className="h-4 w-4" />
                {t('tasks.page.actions.newTask')}
              </Button>
            </div>
          </div>

          {!activeInstanceId ? (
            <div className="rounded-[1.5rem] border border-zinc-200/70 bg-white/75 px-6 py-12 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-950/35">
              <Clock className="mx-auto h-10 w-10 text-primary-500 dark:text-primary-300" />
              <h3 className="mt-5 text-xl font-semibold text-zinc-950 dark:text-zinc-50">
                {t('tasks.page.empty.noInstanceTitle')}
              </h3>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                {t('tasks.page.empty.noInstanceDescription')}
              </p>
            </div>
          ) : (
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
                  <Button className="mt-6" onClick={openCreateEditor}>
                    <Plus className="h-4 w-4" />
                    {t('tasks.page.actions.newTask')}
                  </Button>
                </div>
              }
            />
          )}
        </div>
      );
    }

    return (
      <div className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="mx-auto max-w-[1440px] space-y-8">
          <section className="rounded-[32px] border border-zinc-200/80 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 md:p-8">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
              <div className="max-w-3xl">
                <h1 className="text-3xl font-black tracking-tight text-zinc-950 dark:text-zinc-50 md:text-[34px]">
                  {t('tasks.page.title')}
                </h1>
                <p className="mt-3 text-base leading-7 text-zinc-500 dark:text-zinc-400">
                  {t('tasks.page.subtitle')}
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button variant="outline" onClick={() => void refreshTaskStudio('refresh')} disabled={isRefreshing}>
                  {isRefreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  {t('tasks.page.actions.refresh')}
                </Button>
                <Button onClick={openCreateEditor}>
                  <Plus className="h-4 w-4" />
                  {t('tasks.page.actions.newTask')}
                </Button>
              </div>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              {
                key: 'total',
                value: stats.total,
                icon: <Clock className="h-6 w-6 text-zinc-600 dark:text-zinc-300" />,
                shell: 'bg-zinc-100 dark:bg-zinc-800',
              },
              {
                key: 'active',
                value: stats.active,
                icon: <Play className="h-6 w-6 text-emerald-600 dark:text-emerald-300" />,
                shell: 'bg-emerald-50 dark:bg-emerald-500/10',
              },
              {
                key: 'paused',
                value: stats.paused,
                icon: <Pause className="h-6 w-6 text-amber-600 dark:text-amber-300" />,
                shell: 'bg-amber-50 dark:bg-amber-500/10',
              },
              {
                key: 'failed',
                value: stats.failed,
                icon: <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-300" />,
                shell: 'bg-red-50 dark:bg-red-500/10',
              },
            ].map((item) => (
              <div key={item.key} className="rounded-[28px] border border-zinc-200/80 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex items-center gap-4">
                  <div className={cn('flex h-14 w-14 items-center justify-center rounded-2xl', item.shell)}>
                    {item.icon}
                  </div>
                  <div>
                    <div className="text-3xl font-black tracking-tight text-zinc-950 dark:text-zinc-50">
                      {item.value}
                    </div>
                    <div className="mt-1 text-xs font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                      {t(`tasks.page.stats.${item.key}`)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </section>

          {!activeInstanceId ? (
            <section className="rounded-[32px] border border-zinc-200/80 bg-white p-14 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <Clock className="mx-auto h-12 w-12 text-primary-500 dark:text-primary-300" />
              <h2 className="mt-6 text-2xl font-bold text-zinc-950 dark:text-zinc-50">
                {t('tasks.page.empty.noInstanceTitle')}
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-base leading-7 text-zinc-500 dark:text-zinc-400">
                {t('tasks.page.empty.noInstanceDescription')}
              </p>
            </section>
          ) : tasks.length === 0 ? (
            <section className="rounded-[32px] border border-zinc-200/80 bg-white p-14 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <Zap className="mx-auto h-12 w-12 text-primary-500 dark:text-primary-300" />
              <h2 className="mt-6 text-2xl font-bold text-zinc-950 dark:text-zinc-50">
                {t('tasks.page.empty.title')}
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-base leading-7 text-zinc-500 dark:text-zinc-400">
                {t('tasks.page.empty.description')}
              </p>
              <Button className="mt-8" onClick={openCreateEditor}>
                <Plus className="h-4 w-4" />
                {t('tasks.page.actions.newTask')}
              </Button>
            </section>
          ) : (
            <section>
              <TaskCatalog items={taskCatalogItems} />
            </section>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className={embedded ? 'space-y-4' : 'flex h-full overflow-hidden bg-zinc-50 dark:bg-zinc-950'}>
        {renderMainContent()}
      </div>
      <OverlaySurface
        isOpen={editorMode !== null}
        onClose={closeEditor}
        closeOnBackdrop={false}
        className="max-w-[1280px]"
      >
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <aside className="hidden w-[292px] shrink-0 border-r border-zinc-200/80 bg-zinc-50/90 dark:border-zinc-800 dark:bg-zinc-950/70 lg:flex lg:flex-col">
            <div className="border-b border-zinc-200/80 px-5 py-5 dark:border-zinc-800">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                {t('tasks.page.workspace.navigationTitle')}
              </div>
              <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                {t('tasks.page.workspace.navigationHint')}
              </p>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              <div className="space-y-3">
                {workspaceState.sections.map((section) => (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => setActiveCreateSection(section.id)}
                    className={cn(
                      'w-full rounded-2xl border px-4 py-4 text-left transition-all',
                      activeCreateSection === section.id
                        ? 'border-primary-300 bg-white shadow-sm dark:border-primary-500/30 dark:bg-zinc-900'
                        : 'border-transparent bg-transparent hover:border-zinc-200 hover:bg-white dark:hover:border-zinc-800 dark:hover:bg-zinc-900',
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                          {t(`tasks.page.sections.${section.id}`)}
                        </div>
                        <div className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                          {t(`tasks.page.workspace.sectionDescriptions.${section.id}`)}
                        </div>
                      </div>
                      <ChevronRight className="mt-0.5 h-4 w-4 text-zinc-400" />
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs">
                      <span className="font-medium text-zinc-500 dark:text-zinc-400">
                        {t(`tasks.page.workspace.sectionStatus.${section.status}`)}
                      </span>
                      <span className="font-semibold text-zinc-700 dark:text-zinc-200">
                        {section.completedRequired}/{section.totalRequired}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
              <div className="mt-6 rounded-[24px] border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex items-center gap-2 text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                  {readyToSave ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-300" />
                  )}
                  {readyToSave ? t('tasks.page.validation.ready') : t('tasks.page.validation.title')}
                </div>
                <p className="mt-2 text-xs leading-6 text-zinc-600 dark:text-zinc-400">
                  {!activeInstanceId
                    ? t('tasks.page.validation.activeInstanceRequired')
                    : attemptedSave
                      ? t('tasks.page.validation.description')
                      : t('tasks.page.validation.neutral')}
                </p>
              </div>
            </div>
          </aside>

          <div className="flex min-h-0 flex-1 flex-col">
            <div className="border-b border-zinc-200/80 px-5 py-5 dark:border-zinc-800 lg:px-7">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50">
                    {t(editorMode === 'edit' ? 'tasks.page.modal.editTitle' : 'tasks.page.modal.createTitle')}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                    {t(editorMode === 'edit' ? 'tasks.page.modal.editSubtitle' : 'tasks.page.modal.createSubtitle')}
                  </p>
                </div>
                <button type="button" onClick={closeEditor} className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="mt-5 flex gap-2 overflow-x-auto lg:hidden">
                {workspaceState.sections.map((section) => (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => setActiveCreateSection(section.id)}
                    className={cn(
                      'rounded-full border px-4 py-2 text-sm font-medium whitespace-nowrap',
                      activeCreateSection === section.id
                        ? 'border-primary-300 bg-primary-50 text-primary-700 dark:border-primary-500/30 dark:bg-primary-500/10 dark:text-primary-300'
                        : 'border-zinc-200 bg-white text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300',
                    )}
                  >
                    {t(`tasks.page.sections.${section.id}`)}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5 lg:px-7 lg:py-6">
              {activeCreateSection === 'basicInfo' ? renderBasicInfoSection() : renderExecutionSection()}
            </div>

            <div className="border-t border-zinc-200/80 bg-zinc-50/70 px-5 py-4 dark:border-zinc-800 dark:bg-zinc-950/80 lg:px-7">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap gap-2">
                  {activeCreateSection === 'basicInfo' ? (
                    <Button variant="outline" onClick={() => setActiveCreateSection('execution')}>
                      {t('tasks.page.sections.execution')}
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button variant="outline" onClick={() => setActiveCreateSection('basicInfo')}>
                      {t('tasks.page.sections.basicInfo')}
                    </Button>
                  )}
                </div>
                <div className="flex flex-col-reverse gap-3 sm:flex-row">
                  <Button variant="ghost" onClick={closeEditor}>
                    {t('common.cancel')}
                  </Button>
                  <Button onClick={() => void handleSaveTask()} disabled={isSavingEditor || !activeInstanceId}>
                    {isSavingEditor ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {t(
                      isSavingEditor
                        ? editorMode === 'edit'
                          ? 'tasks.page.modal.saving'
                          : 'tasks.page.modal.creating'
                        : editorMode === 'edit'
                          ? 'tasks.page.modal.saveTask'
                          : 'tasks.page.modal.createTask',
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </OverlaySurface>
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
    </>
  );
}


