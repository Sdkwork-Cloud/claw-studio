import type { StudioInstanceDetailRecord } from '@sdkwork/claw-types';

export interface OpenClawConfigPathFallbackApi {
  resolveInstanceConfigPath?(
    detail: StudioInstanceDetailRecord | null | undefined,
  ): string | null | undefined;
  resolveAttachedKernelConfigFile?(
    detail: StudioInstanceDetailRecord | null | undefined,
  ): string | null | undefined;
}

export function resolveOpenClawConfigPathWithFallback(
  api: OpenClawConfigPathFallbackApi,
  detail: StudioInstanceDetailRecord | null | undefined,
) {
  return (
    api.resolveInstanceConfigPath?.(detail) ??
    api.resolveAttachedKernelConfigFile?.(detail) ??
    null
  );
}
