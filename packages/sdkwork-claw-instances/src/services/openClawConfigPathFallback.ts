import { openClawConfigService } from '@sdkwork/claw-core';
import type { StudioInstanceDetailRecord } from '@sdkwork/claw-types';

export function resolveFallbackInstanceConfigPath(
  detail: StudioInstanceDetailRecord | null | undefined,
) {
  return openClawConfigService.resolveInstanceConfigPath(detail);
}
