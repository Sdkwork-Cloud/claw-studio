export interface HubInstallProgressBatcher<T> {
  push(event: T): void;
  flush(): void;
  cancel(): void;
}

interface HubInstallProgressBatcherOptions {
  fallbackMs?: number;
}

const DEFAULT_FALLBACK_MS = 32;

export function createHubInstallProgressBatcher<T>(
  onFlush: (events: T[]) => void,
  options: HubInstallProgressBatcherOptions = {},
): HubInstallProgressBatcher<T> {
  const fallbackMs = options.fallbackMs ?? DEFAULT_FALLBACK_MS;
  let queue: T[] = [];
  let animationFrameId: number | null = null;
  let timeoutId: number | null = null;

  const clearSchedule = () => {
    if (animationFrameId !== null && typeof window !== 'undefined') {
      window.cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }

    if (timeoutId !== null && typeof window !== 'undefined') {
      window.clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  const flush = () => {
    clearSchedule();
    if (!queue.length) {
      return;
    }

    const events = queue;
    queue = [];
    onFlush(events);
  };

  const schedule = () => {
    if (animationFrameId !== null || timeoutId !== null) {
      return;
    }

    if (
      typeof window !== 'undefined' &&
      typeof window.requestAnimationFrame === 'function'
    ) {
      animationFrameId = window.requestAnimationFrame(() => {
        animationFrameId = null;
        flush();
      });
      return;
    }

    if (typeof window !== 'undefined') {
      timeoutId = window.setTimeout(() => {
        timeoutId = null;
        flush();
      }, fallbackMs);
      return;
    }

    flush();
  };

  return {
    push(event) {
      queue.push(event);
      schedule();
    },
    flush,
    cancel() {
      clearSchedule();
      queue = [];
    },
  };
}
