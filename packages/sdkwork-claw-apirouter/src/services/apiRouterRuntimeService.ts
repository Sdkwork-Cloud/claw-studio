import {
  getRuntimePlatform,
  type RuntimeApiRouterRuntimeStatus,
} from '@sdkwork/claw-infrastructure';

export type ApiRouterRuntimeTone = 'healthy' | 'warning' | 'danger';

export interface ApiRouterRuntimeDescription {
  tone: ApiRouterRuntimeTone;
  modeKey:
    | 'apiRouterPage.runtime.mode.attachedExternal'
    | 'apiRouterPage.runtime.mode.managedActive'
    | 'apiRouterPage.runtime.mode.needsManagedStart'
    | 'apiRouterPage.runtime.mode.conflicted';
  summaryKey:
    | 'apiRouterPage.runtime.summary.attachedExternal'
    | 'apiRouterPage.runtime.summary.managedActive'
    | 'apiRouterPage.runtime.summary.needsManagedStart'
    | 'apiRouterPage.runtime.summary.conflicted';
  showManagedHint: boolean;
  showConflictWarning: boolean;
  recommendedManagedModeKey?: 'apiRouterPage.runtime.managedMode.inProcess';
}

export interface ApiRouterRuntimeService {
  getStatus(): Promise<RuntimeApiRouterRuntimeStatus | null>;
}

export function describeApiRouterRuntimeStatus(
  status: RuntimeApiRouterRuntimeStatus,
): ApiRouterRuntimeDescription {
  switch (status.mode) {
    case 'attachedExternal':
      return {
        tone: 'healthy',
        modeKey: 'apiRouterPage.runtime.mode.attachedExternal',
        summaryKey: 'apiRouterPage.runtime.summary.attachedExternal',
        showManagedHint: false,
        showConflictWarning: false,
      };
    case 'managedActive':
      return {
        tone: 'healthy',
        modeKey: 'apiRouterPage.runtime.mode.managedActive',
        summaryKey: 'apiRouterPage.runtime.summary.managedActive',
        showManagedHint: false,
        showConflictWarning: false,
      };
    case 'needsManagedStart':
      return {
        tone: 'warning',
        modeKey: 'apiRouterPage.runtime.mode.needsManagedStart',
        summaryKey: 'apiRouterPage.runtime.summary.needsManagedStart',
        showManagedHint: Boolean(status.recommendedManagedMode),
        showConflictWarning: false,
        recommendedManagedModeKey:
          status.recommendedManagedMode === 'inProcess'
            ? 'apiRouterPage.runtime.managedMode.inProcess'
            : undefined,
      };
    case 'conflicted':
      return {
        tone: 'danger',
        modeKey: 'apiRouterPage.runtime.mode.conflicted',
        summaryKey: 'apiRouterPage.runtime.summary.conflicted',
        showManagedHint: false,
        showConflictWarning: true,
      };
    default: {
      const exhaustiveCheck: never = status.mode;
      throw new Error(`Unsupported API Router runtime mode: ${exhaustiveCheck}`);
    }
  }
}

class DefaultApiRouterRuntimeService implements ApiRouterRuntimeService {
  async getStatus() {
    return getRuntimePlatform().getApiRouterRuntimeStatus();
  }
}

export const apiRouterRuntimeService = new DefaultApiRouterRuntimeService();
