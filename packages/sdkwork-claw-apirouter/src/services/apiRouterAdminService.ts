import {
  clearApiRouterAdminSession,
  ensureApiRouterAdminSession,
  getRuntimePlatform,
  readApiRouterAdminSession,
  readApiRouterAdminToken,
  resolveApiRouterAdminBaseUrl,
  resolveApiRouterGatewayBaseUrl,
  sdkworkApiRouterAdminClient,
  type ApiRouterAdminLoginRequest,
  type ApiRouterAdminSession,
  type ApiRouterAdminSessionUser,
  type ApiRouterAdminUserProfile,
} from '@sdkwork/claw-infrastructure';

export type ApiRouterAdminConnectionState =
  | 'authenticated'
  | 'needsLogin'
  | 'unavailable';

export type ApiRouterAdminAuthSource =
  | 'session'
  | 'managedBootstrap'
  | 'configuredToken'
  | 'none';

export interface ApiRouterAdminStatus {
  state: ApiRouterAdminConnectionState;
  authSource: ApiRouterAdminAuthSource;
  authenticated: boolean;
  adminBaseUrl: string;
  gatewayBaseUrl: string;
  sessionUser: ApiRouterAdminSessionUser | null;
  operator: ApiRouterAdminUserProfile | null;
  message: string;
}

function normalizeErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return 'sdkwork-api-router admin is unavailable.';
}

function isAuthFailure(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes('401') ||
    normalized.includes('403') ||
    normalized.includes('unauthorized') ||
    normalized.includes('forbidden')
  );
}

async function resolveAdminEndpoints() {
  const [adminBaseUrl, gatewayBaseUrl] = await Promise.all([
    resolveApiRouterAdminBaseUrl(),
    resolveApiRouterGatewayBaseUrl(),
  ]);

  return {
    adminBaseUrl,
    gatewayBaseUrl,
  };
}

function mapSessionUserToOperator(
  user: ApiRouterAdminSessionUser | null,
): ApiRouterAdminUserProfile | null {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    active: user.active,
    createdAtMs: user.createdAtMs,
  };
}

class DefaultApiRouterAdminService {
  async getStatus(): Promise<ApiRouterAdminStatus> {
    const endpoints = await resolveAdminEndpoints();
    const bootstrapSession = await ensureApiRouterAdminSession();
    const session = bootstrapSession || readApiRouterAdminSession();
    const configuredToken = readApiRouterAdminToken();
    const authSource: ApiRouterAdminAuthSource = session?.token
      ? session.source === 'managedBootstrap'
        ? 'managedBootstrap'
        : 'session'
      : configuredToken
        ? 'configuredToken'
        : 'none';

    if (authSource === 'none') {
      return {
        ...endpoints,
        state: 'needsLogin',
        authSource,
        authenticated: false,
        sessionUser: null,
        operator: null,
        message: 'Sign in to the sdkwork-api-router admin API to use router-backed control-plane features.',
      };
    }

    if (authSource === 'managedBootstrap') {
      const runtimeStatus = await getRuntimePlatform()
        .getApiRouterRuntimeStatus()
        .catch(() => null);
      const managedRuntimeHealthy =
        runtimeStatus?.mode === 'managedActive'
        && runtimeStatus.admin.healthy
        && runtimeStatus.gateway.healthy;

      if (!managedRuntimeHealthy) {
        clearApiRouterAdminSession();

        if (runtimeStatus?.mode === 'attachedExternal') {
          return {
            ...endpoints,
            state: 'needsLogin',
            authSource: 'none',
            authenticated: false,
            sessionUser: null,
            operator: null,
            message:
              'Sign in to the sdkwork-api-router admin API to use router-backed control-plane features.',
          };
        }

        return {
          ...endpoints,
          state: 'unavailable',
          authSource: 'none',
          authenticated: false,
          sessionUser: null,
          operator: null,
          message:
            runtimeStatus?.reason || 'sdkwork-api-router admin is unavailable.',
        };
      }

      return {
        ...endpoints,
        state: 'authenticated',
        authSource,
        authenticated: true,
        sessionUser: session?.user || null,
        operator: mapSessionUserToOperator(session?.user || null),
        message:
          'Connected to the local managed sdkwork-api-router admin API through Claw Studio bootstrap auth.',
      };
    }

    try {
      const operator = await sdkworkApiRouterAdminClient.getMe();

      return {
        ...endpoints,
        state: 'authenticated',
        authSource,
        authenticated: true,
        sessionUser: session?.user || null,
        operator,
        message:
          authSource === 'configuredToken'
            ? 'Connected to the sdkwork-api-router admin API through the configured admin token.'
            : 'Connected to the sdkwork-api-router admin API with the current operator session.',
      };
    } catch (error) {
      const message = normalizeErrorMessage(error);
      if (session && isAuthFailure(message)) {
        clearApiRouterAdminSession();
      }

      return {
        ...endpoints,
        state: isAuthFailure(message) ? 'needsLogin' : 'unavailable',
        authSource: session?.token ? 'session' : authSource,
        authenticated: false,
        sessionUser: session?.user || null,
        operator: null,
        message,
      };
    }
  }

  async login(input: ApiRouterAdminLoginRequest): Promise<ApiRouterAdminSession> {
    return sdkworkApiRouterAdminClient.login(input);
  }

  async logout(): Promise<void> {
    await sdkworkApiRouterAdminClient.logout();
  }
}

export const apiRouterAdminService = new DefaultApiRouterAdminService();
