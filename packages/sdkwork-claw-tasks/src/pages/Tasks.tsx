import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
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
import { useInstanceStore } from '@sdkwork/claw-core';
import {
  Button,
  DateInput,
  Input,
  Label,
  OverlaySurface,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Textarea,
  cn,
} from '@sdkwork/claw-ui';
import { toast } from 'sonner';
import type { Task, TaskDeliveryChannelOption, TaskExecutionHistoryEntry } from '../services';
import {
  buildTaskCardState,
  buildTaskCreateWorkspaceState,
  buildCreateTaskInput,
  buildTaskFormValuesFromTask,
  collectTaskFormErrors,
  createDefaultTaskFormValues,
  getActionTypeFromExecutionContent,
  serializeTaskSchedule,
  taskService,
  type TaskDeliveryMode,
  type TaskExecutionContent,
  type TaskFormErrorKey,
  type TaskFormValues,
  type TaskIntervalUnit,
  type TaskScheduleMode,
  type TaskSessionMode,
  type TaskWakeUpMode,
} from '../services';

type CreateSectionId = 'basicInfo' | 'execution';

const fieldSectionMap: Record<TaskFormErrorKey, CreateSectionId> = {
  name: 'basicInfo',
  prompt: 'basicInfo',
  intervalValue: 'basicInfo',
  scheduledDate: 'basicInfo',
  scheduledTime: 'basicInfo',
  cronExpression: 'basicInfo',
  timeoutSeconds: 'execution',
};

function addPendingId(ids: string[], id: string) {
  return ids.includes(id) ? ids : [...ids, id];
}

function removePendingId(ids: string[], id: string) {
  return ids.filter((item) => item !== id);
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

  return values.cronExpression || t('tasks.page.scheduleSummary.cron');
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

  return task.cronExpression || task.schedule;
}

export function Tasks() {
  const { t } = useTranslation();
  const { activeInstanceId } = useInstanceStore();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [executionsByTaskId, setExecutionsByTaskId] = useState<Record<string, TaskExecutionHistoryEntry[]>>({});
  const [deliveryChannels, setDeliveryChannels] = useState<TaskDeliveryChannelOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [editorMode, setEditorMode] = useState<'create' | 'edit' | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [historyTaskId, setHistoryTaskId] = useState<string | null>(null);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [isSavingEditor, setIsSavingEditor] = useState(false);
  const [cloningTaskIds, setCloningTaskIds] = useState<string[]>([]);
  const [runningTaskIds, setRunningTaskIds] = useState<string[]>([]);
  const [statusTaskIds, setStatusTaskIds] = useState<string[]>([]);
  const [deletingTaskIds, setDeletingTaskIds] = useState<string[]>([]);
  const [taskForm, setTaskForm] = useState<TaskFormValues>(createDefaultTaskFormValues());
  const [activeCreateSection, setActiveCreateSection] = useState<CreateSectionId>('basicInfo');
  const [attemptedSave, setAttemptedSave] = useState(false);

  const editorErrors = collectTaskFormErrors(taskForm);
  const workspaceState = buildTaskCreateWorkspaceState(taskForm, editorErrors);
  const schedulePreview = buildSchedulePreview(taskForm);
  const historyTask = historyTaskId ? tasks.find((task) => task.id === historyTaskId) || null : null;
  const historyEntries = historyTaskId ? executionsByTaskId[historyTaskId] || [] : [];
  const readyToSave = Boolean(activeInstanceId) && workspaceState.readiness.ready;
  const channelNameMap = Object.fromEntries(
    deliveryChannels.map((channel) => [channel.id, channel.name]),
  ) as Record<string, string>;

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
  }, [activeInstanceId]);

  async function refreshTaskStudio(mode: 'initial' | 'refresh' = 'refresh') {
    if (!activeInstanceId) {
      setTasks([]);
      setExecutionsByTaskId({});
      setDeliveryChannels([]);
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
      const [nextTasks, nextChannels] = await Promise.all([
        taskService.getTasks(activeInstanceId),
        taskService.listDeliveryChannels(activeInstanceId).catch(() => {
          toast.error(t('tasks.page.toasts.failedToLoadChannels'));
          return [];
        }),
      ]);
      const executionEntries = await Promise.all(
        nextTasks.map(async (task) => {
          try {
            return [task.id, await taskService.listTaskExecutions(task.id)] as const;
          } catch {
            return [task.id, [] as TaskExecutionHistoryEntry[]] as const;
          }
        }),
      );

      setTasks(nextTasks);
      setDeliveryChannels(nextChannels);
      setExecutionsByTaskId(
        Object.fromEntries(executionEntries) as Record<string, TaskExecutionHistoryEntry[]>,
      );

      if (historyTaskId && !nextTasks.some((task) => task.id === historyTaskId)) {
        setHistoryTaskId(null);
      }
    } catch {
      toast.error(t('tasks.page.toasts.failedToLoad'));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }

  useEffect(() => {
    void refreshTaskStudio('initial');
  }, [activeInstanceId]);

  function updateTaskFormField<Key extends keyof TaskFormValues>(field: Key, value: TaskFormValues[Key]) {
    setTaskForm((current) => ({ ...current, [field]: value }));
  }

  function updateExecutionContent(value: TaskExecutionContent) {
    setTaskForm((current) => ({
      ...current,
      executionContent: value,
      actionType: getActionTypeFromExecutionContent(value),
    }));
  }

  function updateDeliveryMode(value: TaskDeliveryMode) {
    setTaskForm((current) => ({
      ...current,
      deliveryMode: value,
      deliveryChannel: value === 'none' ? '' : current.deliveryChannel,
      recipient: value === 'none' ? '' : current.recipient,
    }));
  }

  function updateScheduleMode(value: TaskScheduleMode) {
    setTaskForm((current) => ({ ...current, scheduleMode: value }));
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
  }

  function openEditEditor(task: Task) {
    setEditorMode('edit');
    setEditingTaskId(task.id);
    setTaskForm(buildTaskFormValuesFromTask(task));
    setAttemptedSave(false);
    setActiveCreateSection('basicInfo');
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
    setStatusTaskIds((current) => addPendingId(current, task.id));
    const nextStatus = task.status === 'active' ? 'paused' : 'active';
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

  function renderBasicInfoSection() {
    return (
      <div className="grid gap-6 xl:grid-cols-[1.08fr,0.92fr]">
        <section className="space-y-6">
          <div className="rounded-[28px] border border-zinc-200/80 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="text-base font-bold text-zinc-950 dark:text-zinc-50">
              {t('tasks.page.workspace.overviewTitle')}
            </h3>
            <p className="mt-1 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
              {t('tasks.page.workspace.overviewDescription')}
            </p>
            <div className="mt-5 space-y-5">
              <div>
                <Label className="mb-2 block">{t('tasks.page.fields.taskName')}</Label>
                <Input
                  value={taskForm.name}
                  onChange={(event) => updateTaskFormField('name', event.target.value)}
                  placeholder={t('tasks.page.fields.taskNamePlaceholder')}
                />
                {renderFieldMeta('name')}
              </div>
              <div>
                <Label className="mb-2 block">{t('tasks.page.fields.description')}</Label>
                <Input
                  value={taskForm.description}
                  onChange={(event) => updateTaskFormField('description', event.target.value)}
                  placeholder={t('tasks.page.fields.descriptionPlaceholder')}
                />
              </div>
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

          <div className="rounded-[28px] border border-zinc-200/80 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="text-base font-bold text-zinc-950 dark:text-zinc-50">
              {t('tasks.page.workspace.promptTitle')}
            </h3>
            <p className="mt-1 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
              {t('tasks.page.workspace.promptDescription')}
            </p>
            <div className="mt-5">
              <Label className="mb-2 block">{t('tasks.page.fields.prompt')}</Label>
              <Textarea
                rows={12}
                value={taskForm.prompt}
                onChange={(event) => updateTaskFormField('prompt', event.target.value)}
                placeholder={t('tasks.page.fields.promptPlaceholder')}
                className="min-h-[260px] resize-none"
              />
              {renderFieldMeta('prompt', t('tasks.page.fields.promptHelp'))}
            </div>
          </div>
        </section>

        <section className="rounded-[28px] border border-zinc-200/80 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h3 className="text-base font-bold text-zinc-950 dark:text-zinc-50">
            {t('tasks.page.workspace.scheduleTitle')}
          </h3>
          <p className="mt-1 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
            {t('tasks.page.workspace.scheduleDescription')}
          </p>
          <div className="mt-5 space-y-5">
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
              <div className="grid gap-4 md:grid-cols-[1.1fr,0.9fr]">
                <div>
                  <Label className="mb-2 block">{t('tasks.page.fields.intervalValue')}</Label>
                  <Input
                    type="number"
                    min="1"
                    value={taskForm.intervalValue}
                    onChange={(event) => updateTaskFormField('intervalValue', event.target.value)}
                    placeholder="30"
                  />
                  {renderFieldMeta('intervalValue')}
                </div>
                <div>
                  <Label className="mb-2 block">{t('tasks.page.fields.intervalUnit')}</Label>
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
                </div>
              </div>
            ) : null}

            {taskForm.scheduleMode === 'datetime' ? (
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label className="mb-2 block">{t('tasks.page.fields.scheduledDate')}</Label>
                  <DateInput
                    calendarLabel={t('tasks.page.fields.scheduledDate')}
                    value={taskForm.scheduledDate}
                    onChange={(event) => updateTaskFormField('scheduledDate', event.target.value)}
                  />
                  {renderFieldMeta('scheduledDate')}
                </div>
                <div>
                  <Label className="mb-2 block">{t('tasks.page.fields.scheduledTime')}</Label>
                  <Input
                    type="time"
                    value={taskForm.scheduledTime}
                    onChange={(event) => updateTaskFormField('scheduledTime', event.target.value)}
                  />
                  {renderFieldMeta('scheduledTime')}
                </div>
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
                <div className="mt-4">
                  <Label className="mb-2 block">{t('tasks.page.fields.cronExpression')}</Label>
                  <Input
                    value={taskForm.cronExpression}
                    onChange={(event) => updateTaskFormField('cronExpression', event.target.value)}
                    placeholder={t('tasks.page.fields.cronExpressionPlaceholder')}
                    className="font-mono"
                  />
                  {renderFieldMeta('cronExpression', t('tasks.page.fields.cronExpressionHelp'))}
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
      <div className="space-y-6">
        <div className="grid gap-6 xl:grid-cols-2">
          <section className="rounded-[28px] border border-zinc-200/80 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="text-base font-bold text-zinc-950 dark:text-zinc-50">
              {t('tasks.page.workspace.commonConfigTitle')}
            </h3>
            <p className="mt-1 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
              {t('tasks.page.workspace.commonConfigDescription')}
            </p>
            <div className="mt-5 space-y-5">
              <div>
                <div className="mb-2 text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                  {t('tasks.page.fields.executionContent')}
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {(['runAssistantTask', 'sendPromptMessage'] as TaskExecutionContent[]).map((value) => (
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
                {(['isolated', 'main'] as TaskSessionMode[]).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => updateTaskFormField('sessionMode', value)}
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

          <section className="rounded-[28px] border border-zinc-200/80 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="text-base font-bold text-zinc-950 dark:text-zinc-50">
              {t('tasks.page.workspace.deliveryTitle')}
            </h3>
            <p className="mt-1 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
              {t('tasks.page.workspace.deliveryDescription')}
            </p>
            <div className="mt-5 space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                {(['publishSummary', 'none'] as TaskDeliveryMode[]).map((value) => (
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
                  <div>
                    <Label className="mb-2 block">{t('tasks.page.fields.deliveryChannel')}</Label>
                    <Select
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
                    <p className="mt-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                      {deliveryChannels.length > 0
                        ? t('tasks.page.fields.deliveryChannelHelp')
                        : t('tasks.page.fields.noConnectedChannels')}
                    </p>
                  </div>
                  <div>
                    <Label className="mb-2 block">{t('tasks.page.fields.recipient')}</Label>
                    <Input
                      value={taskForm.recipient}
                      onChange={(event) => updateTaskFormField('recipient', event.target.value)}
                      placeholder={t('tasks.page.fields.recipientPlaceholder')}
                    />
                    <p className="mt-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                      {t('tasks.page.fields.recipientHelp')}
                    </p>
                  </div>
                </>
              ) : null}
            </div>
          </section>
        </div>

        <section className="rounded-[28px] border border-zinc-200/80 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h3 className="text-base font-bold text-zinc-950 dark:text-zinc-50">
            {t('tasks.page.workspace.executionAdvancedTitle')}
          </h3>
          <p className="mt-1 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
            {t('tasks.page.workspace.executionAdvancedDescription')}
          </p>
          <div className="mt-5 grid gap-5 xl:grid-cols-[0.86fr,1.14fr]">
            <div className="rounded-2xl border border-primary-200 bg-primary-50/70 p-5 dark:border-primary-500/20 dark:bg-primary-500/10">
              <div className="flex items-center gap-2 text-sm font-semibold text-primary-900 dark:text-primary-100">
                <Shield className="h-4 w-4" />
                {t('tasks.page.workspace.executionSafeguardsTitle')}
              </div>
              <p className="mt-2 text-xs leading-6 text-primary-700 dark:text-primary-200">
                {t('tasks.page.workspace.executionSafeguardsDescription')}
              </p>
            </div>
            <div>
              <Label className="mb-2 block">{t('tasks.page.fields.timeoutSeconds')}</Label>
              <Input
                type="number"
                min="1"
                value={taskForm.timeoutSeconds}
                onChange={(event) => updateTaskFormField('timeoutSeconds', event.target.value)}
                placeholder={t('tasks.page.fields.timeoutSecondsPlaceholder')}
              />
              {renderFieldMeta('timeoutSeconds', t('tasks.page.fields.timeoutSecondsHelp'))}
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
            <section className="grid gap-6 xl:grid-cols-2">
              {tasks.map((task) => {
                const cardState = buildTaskCardState(task, executionsByTaskId[task.id] || []);
                const isBusy =
                  cloningTaskIds.includes(task.id) ||
                  runningTaskIds.includes(task.id) ||
                  statusTaskIds.includes(task.id) ||
                  deletingTaskIds.includes(task.id);
                const latest = cardState.latestExecution;
                const delivery =
                  task.deliveryMode === 'none'
                    ? t('tasks.page.deliveryModes.none.title')
                    : channelNameMap[task.deliveryChannel || ''] || task.deliveryChannel || t('common.none');

                return (
                  <article key={task.id} className="rounded-[30px] border border-zinc-200/80 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-xl font-bold text-zinc-950 dark:text-zinc-50">{task.name}</h2>
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-semibold text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
                            <span className="h-2 w-2 rounded-full bg-current" />
                            {t(`tasks.page.status.${task.status}`)}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
                            {task.executionContent === 'sendPromptMessage' ? (
                              <MessageSquare className="h-3.5 w-3.5" />
                            ) : (
                              <Zap className="h-3.5 w-3.5" />
                            )}
                            {t(`tasks.page.executionContents.${task.executionContent}.title`)}
                          </span>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                          {task.description || t('tasks.page.cards.noDescription')}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-right dark:border-zinc-800 dark:bg-zinc-950">
                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                          {t('tasks.page.cards.nextRun')}
                        </div>
                        <div className="mt-2 text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                          {cardState.nextRunLabel}
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 grid gap-4 xl:grid-cols-[1.15fr,0.85fr]">
                      <div className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
                            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                              <Calendar className="h-3.5 w-3.5" />
                              {t('tasks.page.cards.schedule')}
                            </div>
                            <div className="mt-2 text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                              {buildTaskScheduleSummary(t, task)}
                            </div>
                          </div>
                          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
                            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                              {t('tasks.page.cards.delivery')}
                            </div>
                            <div className="mt-2 text-sm font-semibold text-zinc-950 dark:text-zinc-50">{delivery}</div>
                            <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                              {task.recipient || t('common.none')}
                            </div>
                          </div>
                        </div>
                        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
                          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                            {t('tasks.page.cards.prompt')}
                          </div>
                          <p className="mt-3 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
                            {cardState.promptExcerpt}
                          </p>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                            {t('tasks.page.cards.latestExecution')}
                          </div>
                          <div className="text-xs text-zinc-500 dark:text-zinc-400">
                            {t('tasks.page.cards.lastRun')}: {task.lastRun || '-'}
                          </div>
                        </div>
                        {latest ? (
                          <>
                            <div className="mt-4 flex flex-wrap gap-2">
                              <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-semibold text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
                                <span className="h-2 w-2 rounded-full bg-current" />
                                {t(`tasks.page.history.status.${latest.status}`)}
                              </span>
                              <span className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
                                {t(`tasks.page.history.triggers.${latest.trigger}`)}
                              </span>
                            </div>
                            <div className="mt-3 text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                              {latest.summary}
                            </div>
                            {latest.details ? (
                              <p className="mt-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                                {latest.details}
                              </p>
                            ) : null}
                          </>
                        ) : (
                          <div className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
                            {t('tasks.page.cards.noExecutionYet')}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-6 flex flex-wrap gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-800">
                      <Button variant="outline" size="sm" onClick={() => openEditEditor(task)} disabled={isBusy}>
                        <Edit2 className="h-4 w-4" />
                        {t('tasks.page.actions.edit')}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => void handleCloneTask(task)} disabled={isBusy}>
                        {cloningTaskIds.includes(task.id) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
                        {t('tasks.page.actions.clone')}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => void handleToggleTaskStatus(task)} disabled={isBusy}>
                        {statusTaskIds.includes(task.id) ? <Loader2 className="h-4 w-4 animate-spin" /> : task.status === 'active' ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                        {task.status === 'active' ? t('tasks.page.actions.disable') : t('tasks.page.actions.enable')}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => void handleRunTaskNow(task)} disabled={isBusy || !cardState.canRunNow}>
                        {runningTaskIds.includes(task.id) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                        {t('tasks.page.actions.runNow')}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => void openHistoryDrawer(task)} disabled={isBusy}>
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
                        {deletingTaskIds.includes(task.id) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        {t('tasks.page.actions.delete')}
                      </Button>
                    </div>
                  </article>
                );
              })}
            </section>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden bg-zinc-50 dark:bg-zinc-950">
      {renderMainContent()}
      <OverlaySurface
        isOpen={editorMode !== null}
        onClose={closeEditor}
        closeOnBackdrop={false}
        className="max-w-[1180px]"
      >
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <aside className="hidden w-[310px] shrink-0 border-r border-zinc-200/80 bg-zinc-50/90 dark:border-zinc-800 dark:bg-zinc-950/70 lg:flex lg:flex-col">
            <div className="border-b border-zinc-200/80 px-6 py-6 dark:border-zinc-800">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                {t('tasks.page.workspace.navigationTitle')}
              </div>
              <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                {t('tasks.page.workspace.navigationHint')}
              </p>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
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
            <div className="border-b border-zinc-200/80 px-6 py-5 dark:border-zinc-800 lg:px-8">
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

            <div className="flex-1 overflow-y-auto px-6 py-6 lg:px-8 lg:py-8">
              {activeCreateSection === 'basicInfo' ? renderBasicInfoSection() : renderExecutionSection()}
            </div>

            <div className="border-t border-zinc-200/80 bg-zinc-50/70 px-6 py-4 dark:border-zinc-800 dark:bg-zinc-950/80 lg:px-8">
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
      <OverlaySurface
        isOpen={Boolean(historyTask)}
        onClose={() => setHistoryTaskId(null)}
        variant="drawer"
        className="max-w-[560px]"
      >
        {historyTask ? (
          <>
            <div className="flex items-start justify-between gap-4 border-b border-zinc-200/80 bg-zinc-50/80 px-6 py-5 dark:border-zinc-800 dark:bg-zinc-950/70">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                  {t('tasks.page.history.title')}
                </div>
                <h2 className="mt-2 text-xl font-bold text-zinc-950 dark:text-zinc-50">
                  {t('tasks.page.history.subtitle', { name: historyTask.name })}
                </h2>
                <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                  {t('tasks.page.history.description')}
                </p>
              </div>
              <button type="button" onClick={() => setHistoryTaskId(null)} className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-6">
              {isHistoryLoading ? (
                <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">{t('tasks.page.history.loading')}</p>
                </div>
              ) : historyEntries.length === 0 ? (
                <div className="rounded-[28px] border border-dashed border-zinc-200 bg-zinc-50 px-6 py-10 text-center dark:border-zinc-800 dark:bg-zinc-950">
                  <h3 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
                    {t('tasks.page.history.emptyTitle')}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                    {t('tasks.page.history.emptyDescription')}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {historyEntries.map((entry) => (
                    <article key={entry.id} className="rounded-[26px] border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                      <div className="flex flex-wrap gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-semibold text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
                          <span className="h-2 w-2 rounded-full bg-current" />
                          {t(`tasks.page.history.status.${entry.status}`)}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
                          {t(`tasks.page.history.triggers.${entry.trigger}`)}
                        </span>
                      </div>
                      <h3 className="mt-4 text-base font-semibold text-zinc-950 dark:text-zinc-50">{entry.summary}</h3>
                      {entry.details ? (
                        <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">{entry.details}</p>
                      ) : null}
                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
                          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                            {t('tasks.page.history.startedAt')}
                          </div>
                          <div className="mt-2 text-sm font-semibold text-zinc-950 dark:text-zinc-50">{entry.startedAt}</div>
                        </div>
                        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
                          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                            {t('tasks.page.history.finishedAt')}
                          </div>
                          <div className="mt-2 text-sm font-semibold text-zinc-950 dark:text-zinc-50">{entry.finishedAt || '-'}</div>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : null}
      </OverlaySurface>
    </div>
  );
}
