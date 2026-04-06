export interface DesktopHostRuntimeDescriptorLike {
  mode: 'desktopCombined';
  lifecycle: string;
  apiBasePath: string;
  manageBasePath: string;
  internalBasePath: string;
  browserBaseUrl: string;
  browserSessionToken: string;
  lastError?: string | null;
  endpointId?: string | null;
  requestedPort?: number | null;
  activePort?: number | null;
  loopbackOnly?: boolean | null;
  dynamicPort?: boolean | null;
  stateStoreDriver?: string | null;
  stateStoreProfileId?: string | null;
  runtimeDataDir?: string | null;
  webDistDir?: string | null;
}

export interface CreateDesktopHostRuntimeResolverOptions<
  TRuntime extends DesktopHostRuntimeDescriptorLike | null,
> {
  waitForRuntime: () => Promise<boolean>;
  loadRuntime: () => Promise<TRuntime>;
  retryTimeoutMs?: number;
  retryPollMs?: number;
}

export interface DesktopHostRuntimeResolver<TRuntime> {
  resolve(): Promise<TRuntime | null>;
}

export interface RetryDesktopHostRuntimeOperationRetryContext {
  attempt: number;
  elapsedMs: number;
  error: unknown;
}

export interface RetryDesktopHostRuntimeOperationOptions<TResult> {
  operation: () => Promise<TResult>;
  retryTimeoutMs?: number;
  retryPollMs?: number;
  shouldRetry?: (
    context: RetryDesktopHostRuntimeOperationRetryContext,
  ) => boolean;
  onRetry?: (context: RetryDesktopHostRuntimeOperationRetryContext) => void;
}

async function sleep(ms: number) {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function retryDesktopHostRuntimeOperation<TResult>(
  options: RetryDesktopHostRuntimeOperationOptions<TResult>,
): Promise<TResult> {
  const retryTimeoutMs = Math.max(0, options.retryTimeoutMs ?? 5000);
  const retryPollMs = Math.max(1, options.retryPollMs ?? 60);
  const startedAt = Date.now();
  let attempt = 0;

  while (true) {
    attempt += 1;

    try {
      return await options.operation();
    } catch (error) {
      const context: RetryDesktopHostRuntimeOperationRetryContext = {
        attempt,
        elapsedMs: Date.now() - startedAt,
        error,
      };
      const canRetry =
        context.elapsedMs < retryTimeoutMs
        && (options.shouldRetry ? options.shouldRetry(context) : true);

      if (!canRetry) {
        throw error;
      }

      options.onRetry?.(context);
      await sleep(retryPollMs);
    }
  }
}

export function createDesktopHostRuntimeResolver<
  TRuntime extends DesktopHostRuntimeDescriptorLike | null,
>(
  options: CreateDesktopHostRuntimeResolverOptions<TRuntime>,
): DesktopHostRuntimeResolver<TRuntime> {
  let inFlightRuntime: Promise<TRuntime | null> | null = null;

  async function loadRuntimeWithRetry(): Promise<TRuntime | null> {
    const retryTimeoutMs = Math.max(0, options.retryTimeoutMs ?? 5000);
    const retryPollMs = Math.max(1, options.retryPollMs ?? 60);
    const startedAt = Date.now();

    while (true) {
      try {
        const runtime = await options.loadRuntime();
        if (runtime) {
          return runtime;
        }
      } catch {
        // Retry within the current resolution window, but never resurrect a stale runtime descriptor.
      }

      if (Date.now() - startedAt >= retryTimeoutMs) {
        return null;
      }

      await sleep(retryPollMs);
    }
  }

  return {
    async resolve() {
      if (!(await options.waitForRuntime())) {
        return null;
      }

      if (!inFlightRuntime) {
        inFlightRuntime = (async () => {
          try {
            return await loadRuntimeWithRetry();
          } finally {
            inFlightRuntime = null;
          }
        })();
      }

      return inFlightRuntime;
    },
  };
}
