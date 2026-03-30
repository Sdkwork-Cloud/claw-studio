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
  | 'needsConfiguration'
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
  allowsManualLogin: boolean;
  allowsManualDisconnect: boolean;
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

function getConfiguredTokenRejectedMessage() {
  return 'The configured sdkwork-api-router admin token was rejected. Update or remove VITE_API_ROUTER_ADMIN_TOKEN before retrying. Manual sign-in is disabled while that token is configured.';
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

function resolveAuthSource(
  session: ApiRouterAdminSession | null,
  configuredToken: string,
): ApiRouterAdminAuthSource {
  if (configuredToken) {
    return 'configuredToken';
  }

  if (session?.token) {
    return session.source === 'managedBootstrap'
      ? 'managedBootstrap'
      : 'session';
  }

  return 'none';
}

function resolveInteractionPolicy(
  state: ApiRouterAdminConnectionState,
  authSource: ApiRouterAdminAuthSource,
  authenticated: boolean,
) {
  return {
    allowsManualLogin:
      !authenticated &&
      state === 'needsLogin' &&
      (authSource === 'none' || authSource === 'session'),
    allowsManualDisconnect: authenticated && authSource === 'session',
  };
}

function createStatus(
  input: Omit<ApiRouterAdminStatus, 'allowsManualLogin' | 'allowsManualDisconnect'>,
): ApiRouterAdminStatus {
  return {
    ...input,
    ...resolveInteractionPolicy(
      input.state,
      input.authSource,
      input.authenticated,
    ),
  };
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
    const bootstrapSession = await ensureApiRouterAdminSession({
      forceBootstrap: readApiRouterAdminSession()?.source === 'managedBootstrap',
    });
    const session = bootstrapSession || readApiRouterAdminSession();
    const configuredToken = readApiRouterAdminToken();
    const authSource = resolveAuthSource(session, configuredToken);

    if (authSource === 'none') {
      return createStatus({
        ...endpoints,
        state: 'needsLogin',
        authSource,
        authenticated: false,
        sessionUser: null,
        operator: null,
        message: 'Sign in to the sdkwork-api-router admin API to use router-backed control-plane features.',
      });
    }

    if (authSource === 'managedBootstrap') {
      const runtimeStatus = await getRuntimePlatform()
        .getApiRouterRuntimeStatus()
        .catch(() => null);
      const trustedLocalRuntimeHealthy =
        !runtimeStatus || (runtimeStatus.admin.healthy && runtimeStatus.gateway.healthy);

      if (!trustedLocalRuntimeHealthy) {
        clearApiRouterAdminSession();

        if (runtimeStatus?.mode === 'attachedExternal') {
          return createStatus({
            ...endpoints,
            state: 'needsLogin',
            authSource: 'none',
            authenticated: false,
            sessionUser: null,
            operator: null,
            message:
              'Sign in to the sdkwork-api-router admin API to use router-backed control-plane features.',
          });
        }

        return createStatus({
          ...endpoints,
          state: 'unavailable',
          authSource: 'none',
          authenticated: false,
          sessionUser: null,
          operator: null,
          message:
            runtimeStatus?.reason || 'sdkwork-api-router admin is unavailable.',
        });
      }

      return createStatus({
        ...endpoints,
        state: 'authenticated',
        authSource,
        authenticated: true,
        sessionUser: session?.user || null,
        operator: mapSessionUserToOperator(session?.user || null),
        message:
          'Connected to the local sdkwork-api-router admin API through Claw Studio bootstrap auth.',
      });
    }

    try {
      const operator = await sdkworkApiRouterAdminClient.getMe();

      return createStatus({
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
      });
    } catch (error) {
      const message = normalizeErrorMessage(error);
      const authFailure = isAuthFailure(message);
      if (session && authFailure) {
        clearApiRouterAdminSession();
      }

      return createStatus({
        ...endpoints,
        state: authFailure
          ? authSource === 'configuredToken'
            ? 'needsConfiguration'
            : 'needsLogin'
          : 'unavailable',
        authSource,
        authenticated: false,
        sessionUser: session?.user || null,
        operator: null,
        message:
          authFailure && authSource === 'configuredToken'
            ? getConfiguredTokenRejectedMessage()
            : message,
      });
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
