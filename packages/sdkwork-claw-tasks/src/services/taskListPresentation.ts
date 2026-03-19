import type { Task, TaskExecutionHistoryEntry } from './taskService';

export type TaskCardTone = 'healthy' | 'paused' | 'danger';

export interface TaskCardState {
  tone: TaskCardTone;
  latestExecution: TaskExecutionHistoryEntry | null;
  canRunNow: boolean;
  nextRunLabel: string;
  promptExcerpt: string;
}

function truncatePrompt(prompt: string, maxLength = 160) {
  const normalized = prompt.trim().replace(/\s+/g, ' ');
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength - 3)}...`;
}

export function buildTaskCardState(
  task: Task,
  executions: TaskExecutionHistoryEntry[],
): TaskCardState {
  const latestExecution = executions[0] || null;

  let tone: TaskCardTone = 'healthy';
  if (task.status === 'paused') {
    tone = 'paused';
  }
  if (task.status === 'failed' || latestExecution?.status === 'failed') {
    tone = 'danger';
  }

  return {
    tone,
    latestExecution,
    canRunNow: true,
    nextRunLabel: task.nextRun || '-',
    promptExcerpt: truncatePrompt(task.prompt),
  };
}
