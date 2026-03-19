import type { Task } from './taskService.ts';
import {
  createDefaultTaskFormValues,
  type TaskFormValues,
} from './taskSchedule.ts';

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
    sessionMode: task.sessionMode,
    wakeUpMode: task.wakeUpMode,
    executionContent: task.executionContent,
    timeoutSeconds: task.timeoutSeconds ? String(task.timeoutSeconds) : '',
    deliveryMode: task.deliveryMode,
    deliveryChannel: task.deliveryChannel || '',
    recipient: task.recipient || '',
  };
}
