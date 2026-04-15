import type {
  StudioBuiltInOpenClawActivationStage,
  StudioInstanceDetailRecord,
} from '@sdkwork/claw-types';

export interface BundledOpenClawStartupAlertDiagnostic {
  id: 'lastActivationStage' | 'gatewayLogPath' | 'desktopMainLogPath';
  labelKey: string;
  value: string;
  detailKey: string;
  mono?: boolean;
}

export interface BundledOpenClawStartupAlert {
  tone: 'warning';
  titleKey: string;
  detailKey: string;
  message: string;
  recommendedActionDetailKey: string;
  diagnostics: BundledOpenClawStartupAlertDiagnostic[];
}

type BundledOpenClawStartupDetail = Pick<
  StudioInstanceDetailRecord,
  'instance' | 'lifecycle' | 'observability' | 'artifacts'
>;

export function buildBundledOpenClawStartupAlert(
  detail: BundledOpenClawStartupDetail | null | undefined,
): BundledOpenClawStartupAlert | null {
  const resolvedDetail = detail;
  const startupError = resolvedDetail?.lifecycle.lastError?.trim();
  if (
    !resolvedDetail ||
    !startupError ||
    resolvedDetail.instance.runtimeKind !== 'openclaw' ||
    resolvedDetail.lifecycle.owner !== 'appManaged' ||
    !resolvedDetail.instance.isBuiltIn
  ) {
    return null;
  }

  return {
    tone: 'warning',
    titleKey:
      'instances.detail.instanceWorkbench.overview.management.alerts.bundledStartupFailure.title',
    detailKey:
      'instances.detail.instanceWorkbench.overview.management.alerts.bundledStartupFailure.description',
    message: startupError,
    recommendedActionDetailKey: resolveBundledStartupFailureActionDetailKey(startupError),
    diagnostics: buildBundledStartupFailureDiagnostics(resolvedDetail),
  };
}

function resolveBundledStartupFailureActionDetailKey(startupError: string) {
  const normalizedError = startupError.toLowerCase();
  const includesLocalizedAccessDenied = startupError.includes('\u62d2\u7edd\u8bbf\u95ee');

  if (
    normalizedError.includes('access denied') ||
    normalizedError.includes('access is denied') ||
    normalizedError.includes('os error 5') ||
    includesLocalizedAccessDenied
  ) {
    return 'instances.detail.instanceWorkbench.overview.management.alerts.bundledStartupFailure.actions.runtimeAccessDenied';
  }

  if (
    normalizedError.includes('timeout') ||
    normalizedError.includes('timed out') ||
    normalizedError.includes('did not become ready') ||
    normalizedError.includes('could not connect') ||
    normalizedError.includes('not accepting connections')
  ) {
    return 'instances.detail.instanceWorkbench.overview.management.alerts.bundledStartupFailure.actions.gatewayReadinessTimeout';
  }

  return 'instances.detail.instanceWorkbench.overview.management.alerts.bundledStartupFailure.actions.checkLogsAndRetry';
}

function buildBundledStartupFailureDiagnostics(
  detail: BundledOpenClawStartupDetail,
): BundledOpenClawStartupAlertDiagnostic[] {
  const diagnostics: BundledOpenClawStartupAlertDiagnostic[] = [];
  const lastActivationStage = detail.lifecycle.lastActivationStage || null;
  const gatewayLogPath = detail.observability.logFilePath?.trim();
  const desktopMainLogPath =
    detail.artifacts
      .find((artifact) => artifact.id === 'desktop-main-log-file' && artifact.location)
      ?.location?.trim() || null;

  if (lastActivationStage) {
    diagnostics.push({
      id: 'lastActivationStage',
      labelKey:
        'instances.detail.instanceWorkbench.overview.management.alerts.bundledStartupFailure.diagnostics.lastActivationStage.label',
      detailKey:
        'instances.detail.instanceWorkbench.overview.management.alerts.bundledStartupFailure.diagnostics.lastActivationStage.description',
      value: formatBundledStartupStage(lastActivationStage),
    });
  }

  if (gatewayLogPath) {
    diagnostics.push({
      id: 'gatewayLogPath',
      labelKey:
        'instances.detail.instanceWorkbench.overview.management.alerts.bundledStartupFailure.diagnostics.gatewayLogPath.label',
      detailKey:
        'instances.detail.instanceWorkbench.overview.management.alerts.bundledStartupFailure.diagnostics.gatewayLogPath.description',
      value: gatewayLogPath,
      mono: true,
    });
  }

  if (desktopMainLogPath) {
    diagnostics.push({
      id: 'desktopMainLogPath',
      labelKey:
        'instances.detail.instanceWorkbench.overview.management.alerts.bundledStartupFailure.diagnostics.desktopMainLogPath.label',
      detailKey:
        'instances.detail.instanceWorkbench.overview.management.alerts.bundledStartupFailure.diagnostics.desktopMainLogPath.description',
      value: desktopMainLogPath,
      mono: true,
    });
  }

  return diagnostics;
}

function formatBundledStartupStage(stage: StudioBuiltInOpenClawActivationStage) {
  switch (stage) {
    case 'prepareRuntimeActivation':
      return 'Prepare Runtime Activation';
    case 'bundledRuntimeReady':
      return 'Bundled Runtime Ready';
    case 'gatewayConfigured':
      return 'Gateway Configured';
    case 'localAiProxyReady':
      return 'Local AI Proxy Ready';
    case 'desktopKernelRunning':
      return 'Desktop Kernel Running';
    case 'builtInInstanceOnline':
      return 'Built-In Instance Online';
    default:
      return String(stage)
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/[-_]+/g, ' ')
        .replace(/\b\w/g, (segment: string) => segment.toUpperCase());
  }
}
