import type { StudioInstanceDetailRecord } from '@sdkwork/claw-types';

export function resolveFallbackInstanceConfigPath(
  detail: StudioInstanceDetailRecord | null | undefined,
) {
  const configRoute = detail?.dataAccess?.routes?.find((route) => route.scope === 'config');
  if (configRoute) {
    if (configRoute.mode === 'managedFile' && configRoute.target) {
      return configRoute.target;
    }

    return null;
  }

  const configArtifact = detail?.artifacts?.find(
    (artifact) => artifact.kind === 'configFile' && artifact.location,
  );
  if (configArtifact?.location) {
    return configArtifact.location;
  }

  return null;
}
