import type { Task } from './taskService';
import {
  createDefaultTaskFormValues,
  type TaskFormValues,
} from './taskSchedule';

export function buildTaskFormValuesFromTask(task: Task): TaskFormValues {
  const defaults = createDefaultTaskFormValues();

  return {
    ...defaults,
    name: task.name,
    description: task.description || '',
    prompt: task.prompt,
    actionType: task.actionType,
    enabled: task.status !== 'paused',
    scheduleMode: task.scheduleMode,
    intervalValue: task.scheduleConfig.intervalValue
      ? String(task.scheduleConfig.intervalValue)
      : defaults.intervalValue,
    intervalUnit: task.scheduleConfig.intervalUnit || defaults.intervalUnit,
    scheduledDate: task.scheduleConfig.scheduledDate || '',
    scheduledTime: task.scheduleConfig.scheduledTime || defaults.scheduledTime,
    cronExpression: task.cronExpression || task.scheduleConfig.cronExpression || defaults.cronExpression,
    cronTimezone: task.scheduleConfig.cronTimezone || '',
    staggerMs:
      typeof task.scheduleConfig.staggerMs === 'number' ? String(task.scheduleConfig.staggerMs) : '',
    sessionMode: task.sessionMode,
    customSessionId: task.customSessionId || '',
    wakeUpMode: task.wakeUpMode,
    executionContent: task.executionContent,
    timeoutSeconds: task.timeoutSeconds ? String(task.timeoutSeconds) : '',
    deleteAfterRun:
      typeof task.deleteAfterRun === 'boolean'
        ? task.deleteAfterRun
        : task.scheduleMode === 'datetime',
    agentId: task.agentId || '',
    model: task.model || '',
    thinking: task.thinking || '',
    lightContext: Boolean(task.lightContext),
    deliveryMode: task.deliveryMode,
    deliveryBestEffort: Boolean(task.deliveryBestEffort),
    deliveryChannel: task.deliveryChannel || '',
    recipient: task.recipient || '',
  };
}
