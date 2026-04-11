import type {
  DesktopAppInfo,
  DesktopAppPaths,
  DesktopHostedRuntimeReadinessSnapshot,
  DesktopKernelInfo,
} from '../tauriBridge';

type StartupLogLevel = 'info' | 'warn' | 'error';

export interface DesktopRuntimeConnectionBaseContext {
  appInfo: DesktopAppInfo | null;
  appPaths: DesktopAppPaths | null;
}

export interface DesktopRuntimeConnectionReadyContext
  extends DesktopRuntimeConnectionBaseContext {
  readinessSnapshot: DesktopHostedRuntimeReadinessSnapshot;
  localAiProxy: DesktopKernelInfo['localAiProxy'] | null;
}

export interface DesktopRuntimeConnectionFailureContext
  extends DesktopRuntimeConnectionBaseContext {
  error: unknown;
  localAiProxy: DesktopKernelInfo['localAiProxy'] | null;
}

export interface DesktopRuntimeConnectionOptions {
  isTauriRuntime: () => boolean;
  getAppInfo: () => Promise<DesktopAppInfo | null>;
  getAppPaths: () => Promise<DesktopAppPaths | null>;
  probeHostedRuntimeReadiness: () => Promise<DesktopHostedRuntimeReadinessSnapshot>;
  captureLocalAiProxyEvidence: () => Promise<DesktopKernelInfo['localAiProxy'] | null>;
  onBaseContext: (
    context: DesktopRuntimeConnectionBaseContext,
  ) => Promise<void> | void;
  onReadinessReady: (
    context: DesktopRuntimeConnectionReadyContext,
  ) => Promise<void> | void;
  onReadinessFailed: (
    context: DesktopRuntimeConnectionFailureContext,
  ) => Promise<void> | void;
  log?: (level: StartupLogLevel, message: string, details?: unknown) => void;
}

export async function connectDesktopRuntimeDuringStartup(
  options: DesktopRuntimeConnectionOptions,
): Promise<void> {
  const [appInfo, appPaths] = await Promise.all([
    options.getAppInfo(),
    options.getAppPaths(),
  ]);
  const baseContext = {
    appInfo,
    appPaths,
  };

  await options.onBaseContext(baseContext);

  if (options.isTauriRuntime() && !appInfo) {
    throw new Error('The desktop runtime did not respond during startup.');
  }

  if (!options.isTauriRuntime()) {
    return;
  }

  options.log?.(
    'info',
    'Desktop runtime metadata connected. Hosted runtime readiness will continue in the background.',
  );

  const readinessTask = (async () => {
    try {
      const readinessSnapshot = await options.probeHostedRuntimeReadiness();
      const localAiProxy = await options.captureLocalAiProxyEvidence();

      await options.onReadinessReady({
        ...baseContext,
        readinessSnapshot,
        localAiProxy,
      });
    } catch (error) {
      const localAiProxy = await options.captureLocalAiProxyEvidence();

      await options.onReadinessFailed({
        ...baseContext,
        error,
        localAiProxy,
      });
    }
  })();

  void readinessTask.catch((error) => {
    options.log?.(
      'warn',
      'Hosted runtime readiness background handling failed unexpectedly.',
      {
        error,
      },
    );
  });
}
