import type { StartupAppearanceSnapshot } from './startupPresentation.ts';

export interface BackgroundRuntimeReadinessRecoveryToastCopy {
  retryActionLabel: string;
  detailsActionLabel: string;
  loadingTitle: string;
  loadingDescription: string;
  startedTitle: string;
  startedDescription: string;
  failedTitle: string;
  readyTitle: string;
  readyDescription: string;
}

interface RetryBackgroundRuntimeReadinessRecoveryArgs {
  instanceId: string;
  clearFailureState: () => void;
  restartInstance: (instanceId: string) => Promise<unknown>;
  reconnectHostedRuntimeReadiness: () => Promise<void>;
}

export async function retryBackgroundRuntimeReadinessRecovery({
  instanceId,
  clearFailureState,
  restartInstance,
  reconnectHostedRuntimeReadiness,
}: RetryBackgroundRuntimeReadinessRecoveryArgs): Promise<void> {
  clearFailureState();

  const restartedInstance = await restartInstance(instanceId);
  if (!restartedInstance) {
    throw new Error('The built-in OpenClaw instance could not be resolved for retry.');
  }

  await reconnectHostedRuntimeReadiness();
}

export function resolveBackgroundRuntimeReadinessRecoveryToastCopy(
  language: StartupAppearanceSnapshot['language'],
): BackgroundRuntimeReadinessRecoveryToastCopy {
  if (language === 'zh') {
    return {
      retryActionLabel: '\u7acb\u5373\u91cd\u8bd5',
      detailsActionLabel: '\u67e5\u770b\u8be6\u60c5',
      loadingTitle: '\u6b63\u5728\u91cd\u8bd5\u5185\u7f6e OpenClaw',
      loadingDescription:
        'Claw Studio \u6b63\u5728\u91cd\u542f\u5185\u7f6e OpenClaw \u5e76\u91cd\u65b0\u68c0\u67e5\u540e\u53f0\u5c31\u7eea\u72b6\u6001\u3002',
      startedTitle: '\u5df2\u8bf7\u6c42\u91cd\u8bd5\u5185\u7f6e OpenClaw',
      startedDescription:
        'Claw Studio \u5df2\u53d1\u8d77\u5185\u7f6e OpenClaw \u91cd\u542f\uff0c\u540e\u53f0\u5c31\u7eea\u68c0\u67e5\u4ecd\u5728\u7ee7\u7eed\u3002',
      failedTitle: '\u5185\u7f6e OpenClaw \u91cd\u8bd5\u5931\u8d25',
      readyTitle: '\u5185\u7f6e OpenClaw \u5df2\u7ecf\u5c31\u7eea',
      readyDescription:
        'Claw Studio \u5df2\u786e\u8ba4\u5185\u7f6e OpenClaw \u7f51\u5173\u6062\u590d\u53ef\u7528\uff0c\u73b0\u5728\u53ef\u4ee5\u76f4\u63a5\u4f7f\u7528\u3002',
    };
  }

  return {
    retryActionLabel: 'Retry now',
    detailsActionLabel: 'View details',
    loadingTitle: 'Retrying built-in OpenClaw',
    loadingDescription:
      'Claw Studio is restarting the bundled OpenClaw runtime and re-checking background readiness.',
    startedTitle: 'Built-in OpenClaw retry requested',
    startedDescription:
      'Claw Studio restarted the bundled OpenClaw runtime. Background readiness checks are running again.',
    failedTitle: 'Built-in OpenClaw retry failed',
    readyTitle: 'Built-in OpenClaw is ready',
    readyDescription:
      'Claw Studio confirmed the bundled OpenClaw gateway is available again and ready to use.',
  };
}
