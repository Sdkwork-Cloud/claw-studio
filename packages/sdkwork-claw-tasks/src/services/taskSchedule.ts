export type TaskActionType = 'message' | 'skill';
export type TaskStatus = 'active' | 'paused' | 'failed';
export type TaskScheduleMode = 'interval' | 'datetime' | 'cron';
export type TaskIntervalUnit = 'minute' | 'hour' | 'day';
export type TaskSessionMode = 'isolated' | 'main';
export type TaskWakeUpMode = 'immediate' | 'nextCycle';
export type TaskExecutionContent = 'runAssistantTask' | 'sendPromptMessage';
export type TaskDeliveryMode = 'publishSummary' | 'none';

export interface TaskScheduleConfig {
  intervalValue?: number;
  intervalUnit?: TaskIntervalUnit;
  scheduledDate?: string;
  scheduledTime?: string;
  cronExpression?: string;
}

export interface SerializedTaskSchedule {
  schedule: string;
  cronExpression?: string;
  scheduleMode: TaskScheduleMode;
  scheduleConfig: TaskScheduleConfig;
}

export interface TaskExecutionConfig {
  sessionMode: TaskSessionMode;
  wakeUpMode: TaskWakeUpMode;
  executionContent: TaskExecutionContent;
  timeoutSeconds?: number;
  deliveryMode: TaskDeliveryMode;
  deliveryChannel?: string;
  recipient?: string;
}

export interface TaskFormValues {
  name: string;
  description: string;
  prompt: string;
  actionType: TaskActionType;
  enabled: boolean;
  scheduleMode: TaskScheduleMode;
  intervalValue: string;
  intervalUnit: TaskIntervalUnit;
  scheduledDate: string;
  scheduledTime: string;
  cronExpression: string;
  sessionMode: TaskSessionMode;
  wakeUpMode: TaskWakeUpMode;
  executionContent: TaskExecutionContent;
  timeoutSeconds: string;
  deliveryMode: TaskDeliveryMode;
  deliveryChannel: string;
  recipient: string;
}

export type TaskFormErrorKey =
  | 'name'
  | 'prompt'
  | 'intervalValue'
  | 'scheduledDate'
  | 'scheduledTime'
  | 'cronExpression'
  | 'timeoutSeconds';

export type TaskFormErrors = Partial<Record<TaskFormErrorKey, 'required' | 'invalid'>>;

export interface TaskCreateInput extends SerializedTaskSchedule, TaskExecutionConfig {
  name: string;
  description?: string;
  prompt: string;
  actionType: TaskActionType;
  status: TaskStatus;
}

export function createDefaultTaskFormValues(): TaskFormValues {
  return {
    name: '',
    description: '',
    prompt: '',
    actionType: 'skill',
    enabled: true,
    scheduleMode: 'interval',
    intervalValue: '30',
    intervalUnit: 'minute',
    scheduledDate: '',
    scheduledTime: '09:00',
    cronExpression: '0 9 * * *',
    sessionMode: 'isolated',
    wakeUpMode: 'immediate',
    executionContent: 'runAssistantTask',
    timeoutSeconds: '',
    deliveryMode: 'publishSummary',
    deliveryChannel: '',
    recipient: '',
  };
}

function parsePositiveInteger(raw: string) {
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    return null;
  }
  return value;
}

function normalizeTimeSegment(segment: string) {
  return String(Number(segment));
}

function isValidCronExpression(expression: string) {
  return expression.trim().split(/\s+/).length === 5;
}

function buildIntervalCronExpression(value: number, unit: TaskIntervalUnit) {
  switch (unit) {
    case 'minute':
      return value <= 59 ? `*/${value} * * * *` : undefined;
    case 'hour':
      return value <= 23 ? `0 */${value} * * *` : undefined;
    case 'day':
      return value <= 31 ? `0 0 */${value} * *` : undefined;
    default:
      return undefined;
  }
}

function assertNoErrors(errors: TaskFormErrors) {
  if (Object.keys(errors).length > 0) {
    throw new Error(`Invalid task form: ${JSON.stringify(errors)}`);
  }
}

export function getActionTypeFromExecutionContent(
  executionContent: TaskExecutionContent,
): TaskActionType {
  return executionContent === 'sendPromptMessage' ? 'message' : 'skill';
}

function collectScheduleErrors(values: TaskFormValues): TaskFormErrors {
  const errors: TaskFormErrors = {};

  switch (values.scheduleMode) {
    case 'interval': {
      if (!values.intervalValue.trim()) {
        errors.intervalValue = 'required';
      } else if (parsePositiveInteger(values.intervalValue) == null) {
        errors.intervalValue = 'invalid';
      }
      break;
    }
    case 'datetime': {
      if (!values.scheduledDate.trim()) {
        errors.scheduledDate = 'required';
      }
      if (!values.scheduledTime.trim()) {
        errors.scheduledTime = 'required';
      }
      break;
    }
    case 'cron': {
      if (!values.cronExpression.trim()) {
        errors.cronExpression = 'required';
      } else if (!isValidCronExpression(values.cronExpression)) {
        errors.cronExpression = 'invalid';
      }
      break;
    }
  }

  return errors;
}

export function collectTaskFormErrors(values: TaskFormValues): TaskFormErrors {
  const errors = collectScheduleErrors(values);

  if (!values.name.trim()) {
    errors.name = 'required';
  }

  if (!values.prompt.trim()) {
    errors.prompt = 'required';
  }

  if (values.timeoutSeconds.trim()) {
    const timeout = parsePositiveInteger(values.timeoutSeconds);
    if (timeout == null) {
      errors.timeoutSeconds = 'invalid';
    }
  }

  return errors;
}

export function serializeTaskSchedule(values: TaskFormValues): SerializedTaskSchedule {
  const errors = collectScheduleErrors(values);
  assertNoErrors(errors);

  if (values.scheduleMode === 'interval') {
    const intervalValue = parsePositiveInteger(values.intervalValue)!;

    return {
      schedule: `@every ${intervalValue}${values.intervalUnit[0]}`,
      cronExpression: buildIntervalCronExpression(intervalValue, values.intervalUnit),
      scheduleMode: 'interval',
      scheduleConfig: {
        intervalValue,
        intervalUnit: values.intervalUnit,
      },
    };
  }

  if (values.scheduleMode === 'datetime') {
    const [, month, day] = values.scheduledDate.split('-');
    const [hour, minute] = values.scheduledTime.split(':');

    return {
      schedule: `at ${values.scheduledDate} ${values.scheduledTime}`,
      cronExpression: `${normalizeTimeSegment(minute)} ${normalizeTimeSegment(hour)} ${normalizeTimeSegment(day)} ${normalizeTimeSegment(month)} *`,
      scheduleMode: 'datetime',
      scheduleConfig: {
        scheduledDate: values.scheduledDate,
        scheduledTime: values.scheduledTime,
      },
    };
  }

  return {
    schedule: values.cronExpression.trim(),
    cronExpression: values.cronExpression.trim(),
    scheduleMode: 'cron',
    scheduleConfig: {
      cronExpression: values.cronExpression.trim(),
    },
  };
}

export function buildCreateTaskInput(values: TaskFormValues): TaskCreateInput {
  const serializedSchedule = serializeTaskSchedule(values);
  const description = values.description.trim();
  const recipient = values.recipient.trim();
  const timeoutSeconds = values.timeoutSeconds.trim()
    ? parsePositiveInteger(values.timeoutSeconds) ?? undefined
    : undefined;

  return {
    name: values.name.trim(),
    description: description || undefined,
    prompt: values.prompt.trim(),
    actionType: getActionTypeFromExecutionContent(values.executionContent),
    status: values.enabled ? 'active' : 'paused',
    sessionMode: values.sessionMode,
    wakeUpMode: values.wakeUpMode,
    executionContent: values.executionContent,
    timeoutSeconds,
    deliveryMode: values.deliveryMode,
    deliveryChannel: values.deliveryChannel || undefined,
    recipient: recipient || undefined,
    ...serializedSchedule,
  };
}
