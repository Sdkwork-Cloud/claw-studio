import { APP_ENV, type AppEnvConfig } from '../config/env.ts';
import {
  getRuntimePlatform,
  type RuntimeApiRouterRuntimeStatus,
} from '../platform/index.ts';

export interface ApiRouterAccessResolveOptions {
  adminBaseUrl?: string;
  gatewayBaseUrl?: string;
  env?: AppEnvConfig;
}

export interface ApiRouterResolvedEndpoints {
  runtimeStatus: RuntimeApiRouterRuntimeStatus | null;
  adminBaseUrl: string;
  gatewayBaseUrl: string;
}

export function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/g, '');
}

export function normalizeBaseUrl(value: string) {
  return trimTrailingSlash(value.trim());
}

export function normalizeAdminBaseUrl(value: string) {
  const trimmed = normalizeBaseUrl(value);
  if (!trimmed) {
    return '';
  }

  return trimmed.endsWith('/admin') ? trimmed : `${trimmed}/admin`;
}

export async function getApiRouterRuntimeStatusSafe() {
  try {
    return await getRuntimePlatform().getApiRouterRuntimeStatus();
  } catch {
    return null;
  }
}

export function canSilentlyBootstrapManagedApiRouter(
  status: RuntimeApiRouterRuntimeStatus | null | undefined,
) {
  return !!(
    status
    && status.mode === 'managedActive'
    && status.admin.enabled
    && status.admin.healthy
    && status.gateway.healthy
  );
}

function resolveRuntimeAdminBaseUrl(status: RuntimeApiRouterRuntimeStatus | null) {
  const publicBaseUrl = normalizeAdminBaseUrl(status?.admin.publicBaseUrl || '');
  if (publicBaseUrl) {
    return publicBaseUrl;
  }

  const healthUrl = status?.admin.healthUrl || '';
  if (!healthUrl) {
    return '';
  }

  try {
    const url = new URL(healthUrl);
    url.pathname = url.pathname.replace(/\/health$/i, '');
    return trimTrailingSlash(url.toString());
  } catch {
    return '';
  }
}

function resolveRuntimeGatewayBaseUrl(status: RuntimeApiRouterRuntimeStatus | null) {
  const publicBaseUrl = normalizeBaseUrl(status?.gateway.publicBaseUrl || '');
  if (publicBaseUrl) {
    return publicBaseUrl;
  }

  const healthUrl = status?.gateway.healthUrl || '';
  if (!healthUrl) {
    return '';
  }

  try {
    const url = new URL(healthUrl);
    url.pathname = url.pathname.replace(/\/health$/i, '');
    return trimTrailingSlash(url.toString());
  } catch {
    return '';
  }
}

export async function resolveApiRouterResolvedEndpoints(
  options: ApiRouterAccessResolveOptions = {},
): Promise<ApiRouterResolvedEndpoints> {
  const env = options.env ?? APP_ENV;
  const runtimeStatus = await getApiRouterRuntimeStatusSafe();

  const adminBaseUrl = (() => {
    const explicitBaseUrl = normalizeAdminBaseUrl(options.adminBaseUrl || '');
    if (explicitBaseUrl) {
      return explicitBaseUrl;
    }

    const envBaseUrl = normalizeAdminBaseUrl(env.apiRouter.adminBaseUrl);
    if (envBaseUrl) {
      return envBaseUrl;
    }

    const runtimeBaseUrl = resolveRuntimeAdminBaseUrl(runtimeStatus);
    if (runtimeBaseUrl) {
      return runtimeBaseUrl;
    }

    return '/admin';
  })();

  const gatewayBaseUrl = (() => {
    const explicitBaseUrl = normalizeBaseUrl(options.gatewayBaseUrl || '');
    if (explicitBaseUrl) {
      return explicitBaseUrl;
    }

    const envBaseUrl = normalizeBaseUrl(env.apiRouter.gatewayBaseUrl);
    if (envBaseUrl) {
      return envBaseUrl;
    }

    const runtimeBaseUrl = resolveRuntimeGatewayBaseUrl(runtimeStatus);
    if (runtimeBaseUrl) {
      return runtimeBaseUrl;
    }

    return '';
  })();

  return {
    runtimeStatus,
    adminBaseUrl,
    gatewayBaseUrl,
  };
}
