import {
  APP_ENV,
  readApiRouterAdminToken as readConfiguredApiRouterAdminToken,
} from '../config/env.ts';
import {
  getRuntimePlatform,
  type RuntimeApiRouterAdminBootstrapSession,
} from '../platform/index.ts';

const API_ROUTER_ADMIN_SESSION_STORAGE_KEY = 'claw-studio-api-router-admin-session';
let apiRouterAdminBootstrapSessionPromise: Promise<ApiRouterAdminSession | null> | null = null;

export type ApiRouterAdminSessionSource = 'manual' | 'managedBootstrap';

export interface ApiRouterAdminSessionUser {
  id: string;
  email: string;
  displayName: string;
  active: boolean;
  createdAtMs: number;
}

export interface ApiRouterAdminSession {
  token: string;
  user: ApiRouterAdminSessionUser;
  source?: ApiRouterAdminSessionSource;
}

function getStorage(): Storage | null {
  if (typeof globalThis.localStorage !== 'undefined') {
    return globalThis.localStorage;
  }

  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }

  return null;
}

function normalizeSessionUser(value: Partial<ApiRouterAdminSessionUser> | null | undefined) {
  if (!value) {
    return null;
  }

  const id = typeof value.id === 'string' ? value.id.trim() : '';
  const email = typeof value.email === 'string' ? value.email.trim() : '';
  const displayName = typeof value.displayName === 'string' ? value.displayName.trim() : '';
  const active = typeof value.active === 'boolean' ? value.active : false;
  const createdAtMs = typeof value.createdAtMs === 'number' ? value.createdAtMs : 0;

  if (!id || !email || !displayName) {
    return null;
  }

  return {
    id,
    email,
    displayName,
    active,
    createdAtMs,
  };
}

function normalizeSessionSource(value: unknown): ApiRouterAdminSessionSource {
  return value === 'managedBootstrap' ? 'managedBootstrap' : 'manual';
}

function normalizeSession(value: Partial<ApiRouterAdminSession> | null | undefined) {
  if (!value) {
    return null;
  }

  const token = typeof value.token === 'string' ? value.token.trim() : '';
  const user = normalizeSessionUser(value.user);
  if (!token || !user) {
    return null;
  }

  return {
    token,
    user,
    source: normalizeSessionSource(value.source),
  } satisfies ApiRouterAdminSession;
}

function mapBootstrapSession(
  value: RuntimeApiRouterAdminBootstrapSession,
): ApiRouterAdminSession {
  return {
    token: value.token,
    user: {
      id: value.user.id,
      email: value.user.email,
      displayName: value.user.displayName,
      active: value.user.active,
      createdAtMs: value.user.createdAtMs,
    },
    source: 'managedBootstrap',
  };
}

export function readApiRouterAdminSession(): ApiRouterAdminSession | null {
  const storage = getStorage();
  if (!storage) {
    return null;
  }

  const rawValue = storage.getItem(API_ROUTER_ADMIN_SESSION_STORAGE_KEY);
  if (!rawValue) {
    return null;
  }

  try {
    return normalizeSession(JSON.parse(rawValue) as Partial<ApiRouterAdminSession>);
  } catch {
    return null;
  }
}

export function writeApiRouterAdminSession(session: ApiRouterAdminSession) {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  const normalized = normalizeSession(session);
  if (!normalized) {
    return;
  }

  storage.setItem(API_ROUTER_ADMIN_SESSION_STORAGE_KEY, JSON.stringify(normalized));
}

export function clearApiRouterAdminSession() {
  apiRouterAdminBootstrapSessionPromise = null;
  const storage = getStorage();
  if (!storage) {
    return;
  }

  storage.removeItem(API_ROUTER_ADMIN_SESSION_STORAGE_KEY);
}

async function resolveBootstrapAdminSession() {
  if (!apiRouterAdminBootstrapSessionPromise) {
    const bootstrapSessionPromise = (async () => {
      try {
        const bootstrap = await getRuntimePlatform().getApiRouterAdminBootstrapSession();
        if (!bootstrap?.token) {
          return null;
        }

        const session = mapBootstrapSession(bootstrap);
        writeApiRouterAdminSession(session);
        return session;
      } catch {
        return null;
      }
    })();

    apiRouterAdminBootstrapSessionPromise = bootstrapSessionPromise;
    void bootstrapSessionPromise.finally(() => {
      if (apiRouterAdminBootstrapSessionPromise === bootstrapSessionPromise) {
        apiRouterAdminBootstrapSessionPromise = null;
      }
    });
  }

  return apiRouterAdminBootstrapSessionPromise;
}

export async function ensureApiRouterAdminSession(
  options: { forceBootstrap?: boolean } = {},
): Promise<ApiRouterAdminSession | null> {
  const configuredToken = readConfiguredApiRouterAdminToken(APP_ENV);
  const existing = options.forceBootstrap ? null : readApiRouterAdminSession();
  if (configuredToken) {
    return existing ?? null;
  }

  if (options.forceBootstrap) {
    clearApiRouterAdminSession();
  }

  const shouldAttemptBootstrap =
    options.forceBootstrap || !existing || existing.source !== 'managedBootstrap';
  if (shouldAttemptBootstrap) {
    const bootstrapSession = await resolveBootstrapAdminSession();
    if (bootstrapSession) {
      return bootstrapSession;
    }
  }

  return existing ?? null;
}

export async function ensureApiRouterAdminSessionToken(
  options: { forceBootstrap?: boolean } = {},
) {
  const configuredToken = readConfiguredApiRouterAdminToken(APP_ENV);
  if (configuredToken) {
    return configuredToken;
  }

  return (
    (await ensureApiRouterAdminSession(options))?.token
  );
}

export function readApiRouterAdminSessionToken() {
  return readConfiguredApiRouterAdminToken(APP_ENV) || readApiRouterAdminSession()?.token;
}

export { API_ROUTER_ADMIN_SESSION_STORAGE_KEY };
