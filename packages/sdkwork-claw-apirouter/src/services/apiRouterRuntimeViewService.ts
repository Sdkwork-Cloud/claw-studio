import type {
  ApiRouterOwnershipMode,
  ApiRouterRuntimeStatus,
} from '@sdkwork/claw-infrastructure';

export type ApiRouterRuntimeTone = 'success' | 'warning' | 'neutral';

export interface ApiRouterRuntimeOwnershipView {
  mode: ApiRouterOwnershipMode;
  tone: ApiRouterRuntimeTone;
}

export interface ApiRouterRuntimeSignalView {
  id: 'gateway' | 'admin' | 'authSession' | 'adminAuth';
  ready: boolean;
  tone: ApiRouterRuntimeTone;
}

export interface ApiRouterRuntimeEndpointView {
  id: 'gateway' | 'admin';
  url: string;
  binding: string;
  host: string;
  port: string;
  pathname: string;
}

export interface ApiRouterRuntimeProcessView {
  id: 'gatewayPid' | 'adminPid';
  value: string | null;
}

export interface ApiRouterRuntimePathView {
  id: 'routerHomeDir' | 'metadataDir' | 'databasePath' | 'extractionDir';
  value: string;
}

export interface ApiRouterRuntimeViewModel {
  ownership: ApiRouterRuntimeOwnershipView;
  signals: ApiRouterRuntimeSignalView[];
  endpoints: ApiRouterRuntimeEndpointView[];
  processes: ApiRouterRuntimeProcessView[];
  paths: ApiRouterRuntimePathView[];
}

function buildTone(ready: boolean): ApiRouterRuntimeTone {
  return ready ? 'success' : 'warning';
}

function buildOwnershipTone(status: ApiRouterRuntimeStatus): ApiRouterRuntimeTone {
  const runtimeHealthy = status.gatewayHealthy && status.adminHealthy;
  if (status.ownership === 'managed' && runtimeHealthy) {
    return 'success';
  }

  if (status.ownership === 'attached' && runtimeHealthy) {
    return 'neutral';
  }

  return 'warning';
}

function parseRuntimeUrl(url: string): Omit<ApiRouterRuntimeEndpointView, 'id'> {
  const trimmedUrl = url.trim();
  if (!trimmedUrl) {
    return {
      url: '',
      binding: '',
      host: '',
      port: '',
      pathname: '',
    };
  }

  try {
    const parsedUrl = new URL(trimmedUrl);
    const host = parsedUrl.hostname;
    const port = parsedUrl.port;
    return {
      url: trimmedUrl,
      binding: port ? `${host}:${port}` : host,
      host,
      port,
      pathname: parsedUrl.pathname === '/' ? '' : parsedUrl.pathname,
    };
  } catch {
    return {
      url: trimmedUrl,
      binding: '',
      host: '',
      port: '',
      pathname: '',
    };
  }
}

export function buildApiRouterRuntimeView(
  status: ApiRouterRuntimeStatus,
): ApiRouterRuntimeViewModel {
  return {
    ownership: {
      mode: status.ownership,
      tone: buildOwnershipTone(status),
    },
    signals: [
      {
        id: 'gateway',
        ready: status.gatewayHealthy,
        tone: buildTone(status.gatewayHealthy),
      },
      {
        id: 'admin',
        ready: status.adminHealthy,
        tone: buildTone(status.adminHealthy),
      },
      {
        id: 'authSession',
        ready: status.authSessionReady,
        tone: buildTone(status.authSessionReady),
      },
      {
        id: 'adminAuth',
        ready: status.adminAuthReady,
        tone: buildTone(status.adminAuthReady),
      },
    ],
    endpoints: [
      {
        id: 'gateway',
        ...parseRuntimeUrl(status.gatewayBaseUrl),
      },
      {
        id: 'admin',
        ...parseRuntimeUrl(status.adminBaseUrl),
      },
    ],
    processes: [
      {
        id: 'gatewayPid',
        value: status.gatewayPid == null ? null : String(status.gatewayPid),
      },
      {
        id: 'adminPid',
        value: status.adminPid == null ? null : String(status.adminPid),
      },
    ],
    paths: [
      {
        id: 'routerHomeDir',
        value: status.routerHomeDir,
      },
      {
        id: 'metadataDir',
        value: status.metadataDir,
      },
      {
        id: 'databasePath',
        value: status.databasePath,
      },
      {
        id: 'extractionDir',
        value: status.extractionDir,
      },
    ],
  };
}
