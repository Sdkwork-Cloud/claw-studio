import { APP_ENV } from '@sdkwork/claw-infrastructure';

export interface AppSdkSessionTokens {
  authToken?: string;
  accessToken?: string;
  refreshToken?: string;
}

const APP_SDK_SESSION_STORAGE_KEY = 'claw-studio-auth-session';

let configuredAccessToken: string | undefined;

function getStorage(): Storage | null {
  if (typeof globalThis.localStorage !== 'undefined') {
    return globalThis.localStorage;
  }

  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }

  return null;
}

function readStorage(key: string): string | undefined {
  const storage = getStorage();
  if (!storage) {
    return undefined;
  }

  try {
    return storage.getItem(key) || undefined;
  } catch {
    return undefined;
  }
}

function writeStorage(key: string, value?: string): void {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  try {
    if (value && value.trim()) {
      storage.setItem(key, value.trim());
      return;
    }

    storage.removeItem(key);
  } catch {
    // ignore storage errors
  }
}

function removeStorage(key: string): void {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  try {
    storage.removeItem(key);
  } catch {
    // ignore storage errors
  }
}

export function normalizeAppSdkAuthToken(value?: string): string {
  const normalized = (value || '').trim();
  if (!normalized) {
    return '';
  }

  if (normalized.toLowerCase().startsWith('bearer ')) {
    return normalized.slice(7).trim();
  }

  return normalized;
}

function readPersistedSession(): Pick<AppSdkSessionTokens, 'authToken' | 'refreshToken'> {
  const rawValue = readStorage(APP_SDK_SESSION_STORAGE_KEY);
  if (!rawValue) {
    return {};
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<AppSdkSessionTokens>;
    return {
      authToken: normalizeAppSdkAuthToken(parsed.authToken),
      refreshToken:
        typeof parsed.refreshToken === 'string' ? parsed.refreshToken.trim() : undefined,
    };
  } catch {
    return {};
  }
}

export function setConfiguredAppSdkAccessToken(value?: string): void {
  const normalized = normalizeAppSdkAuthToken(value);
  configuredAccessToken = normalized || undefined;
}

export function resetConfiguredAppSdkAccessToken(): void {
  configuredAccessToken = undefined;
}

export function resolveAppSdkAccessToken(): string {
  return (configuredAccessToken || APP_ENV.auth.accessToken || '').trim();
}

export function readAppSdkSessionTokens(): AppSdkSessionTokens {
  const stored = readPersistedSession();
  const accessToken = resolveAppSdkAccessToken();

  return {
    authToken: stored.authToken || undefined,
    accessToken: accessToken || undefined,
    refreshToken: stored.refreshToken || undefined,
  };
}

export function persistAppSdkSessionStorage(
  tokens: Pick<AppSdkSessionTokens, 'authToken' | 'refreshToken'>,
): void {
  const authToken = normalizeAppSdkAuthToken(tokens.authToken);
  const refreshToken = (tokens.refreshToken || '').trim();

  if (!authToken) {
    removeStorage(APP_SDK_SESSION_STORAGE_KEY);
    return;
  }

  writeStorage(
    APP_SDK_SESSION_STORAGE_KEY,
    JSON.stringify({
      authToken,
      refreshToken: refreshToken || undefined,
    }),
  );
}

export function clearAppSdkSessionStorage(): void {
  removeStorage(APP_SDK_SESSION_STORAGE_KEY);
}
