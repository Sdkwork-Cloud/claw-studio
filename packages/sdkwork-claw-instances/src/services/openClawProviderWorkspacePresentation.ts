import type { StudioInstanceDetailRecord } from '@sdkwork/claw-types';
import { isProviderCenterManagedOpenClawDetail } from './openClawManagementCapabilities.ts';

export interface OpenClawProviderWorkspaceState {
  providerCenterManaged: boolean;
  isProviderConfigReadonly: boolean;
  canManageProviderCatalog: boolean;
}

export function buildOpenClawProviderWorkspaceState(
  detail: StudioInstanceDetailRecord | null | undefined,
): OpenClawProviderWorkspaceState {
  if (detail?.instance.runtimeKind !== 'openclaw') {
    return {
      providerCenterManaged: false,
      isProviderConfigReadonly: false,
      canManageProviderCatalog: true,
    };
  }

  const providerCenterManaged = isProviderCenterManagedOpenClawDetail(detail);

  return {
    providerCenterManaged,
    isProviderConfigReadonly: providerCenterManaged,
    canManageProviderCatalog: false,
  };
}
