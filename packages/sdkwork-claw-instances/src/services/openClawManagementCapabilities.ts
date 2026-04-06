import type { StudioInstanceDetailRecord } from '@sdkwork/claw-types';

function isOpenClawDetail(
  detail: StudioInstanceDetailRecord | null | undefined,
): detail is StudioInstanceDetailRecord & {
  instance: StudioInstanceDetailRecord['instance'] & {
    runtimeKind: 'openclaw';
  };
} {
  return detail?.instance.runtimeKind === 'openclaw';
}

function isBuiltInManagedOpenClawProbeCandidate(
  detail: StudioInstanceDetailRecord | null | undefined,
) {
  return (
    isOpenClawDetail(detail) &&
    detail.instance.isBuiltIn === true &&
    detail.instance.deploymentMode === 'local-managed' &&
    detail.lifecycle.owner === 'appManaged' &&
    detail.lifecycle.workbenchManaged === true &&
    detail.lifecycle.endpointObserved === true
  );
}

export function hasManagedOpenClawConfigRoute(
  detail: StudioInstanceDetailRecord | null | undefined,
) {
  if (!isOpenClawDetail(detail)) {
    return false;
  }

  return detail.dataAccess.routes.some(
    (route) =>
      route.scope === 'config' &&
      Boolean(route.target) &&
      (route.mode === 'managedFile' || route.mode === 'managedDirectory') &&
      route.readonly !== true,
  );
}

export function isProviderCenterManagedOpenClawDetail(
  detail: StudioInstanceDetailRecord | null | undefined,
) {
  if (!isOpenClawDetail(detail)) {
    return false;
  }

  if (detail.lifecycle.workbenchManaged === true) {
    return true;
  }

  return hasManagedOpenClawConfigRoute(detail);
}

export function hasReadyOpenClawGateway(
  detail: StudioInstanceDetailRecord | null | undefined,
) {
  if (!isOpenClawDetail(detail)) {
    return false;
  }

  if (detail.instance.status === 'online') {
    return true;
  }

  return detail.lifecycle.endpointObserved === true && detail.health.status !== 'offline';
}

export function shouldProbeOpenClawGateway(
  detail: StudioInstanceDetailRecord | null | undefined,
) {
  return hasReadyOpenClawGateway(detail) || isBuiltInManagedOpenClawProbeCandidate(detail);
}
