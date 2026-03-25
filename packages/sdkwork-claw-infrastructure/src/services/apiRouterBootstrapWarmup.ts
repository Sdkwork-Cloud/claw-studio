import { ensureApiRouterAdminSession } from '../auth/apiRouterAdminSession.ts';
import { getRuntimePlatform, type RuntimeApiRouterRuntimeStatus } from '../platform/index.ts';

function canWarmApiRouterBootstrapSession(
  status: RuntimeApiRouterRuntimeStatus | null,
) {
  if (!status) {
    return false;
  }

  const localRuntimeReady =
    (status.mode === 'managedActive' || status.mode === 'attachedExternal')
    && status.admin.enabled
    && status.admin.healthy
    && status.gateway.healthy;

  return localRuntimeReady;
}

export async function warmApiRouterAdminSession(): Promise<boolean> {
  try {
    const runtimePlatform = getRuntimePlatform();
    let runtimeStatus = await runtimePlatform.getApiRouterRuntimeStatus();
    if (runtimeStatus?.mode === 'needsManagedStart' && runtimePlatform.ensureApiRouterRuntimeStarted) {
      runtimeStatus = await runtimePlatform.ensureApiRouterRuntimeStarted();
    }

    if (!canWarmApiRouterBootstrapSession(runtimeStatus)) {
      return false;
    }

    const session = await ensureApiRouterAdminSession();
    return Boolean(session?.token);
  } catch {
    return false;
  }
}
