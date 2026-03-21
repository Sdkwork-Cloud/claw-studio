import { APP_ENV, readAccessToken } from '../config/env.ts';

const AUTH_SESSION_STORAGE_KEY = 'claw-studio-auth-session';

export interface AuthSession {
  authToken: string;
  refreshToken?: string;
  tokenType?: string;
  expiresIn?: number;
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

export function readAuthSession(): AuthSession | null {
  const storage = getStorage();
  if (!storage) {
    return null;
  }

  const rawValue = storage.getItem(AUTH_SESSION_STORAGE_KEY);
  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<AuthSession>;
    if (!parsed || typeof parsed.authToken !== 'string' || !parsed.authToken.trim()) {
      return null;
    }

    return {
      authToken: parsed.authToken.trim(),
      refreshToken: typeof parsed.refreshToken === 'string' ? parsed.refreshToken.trim() : undefined,
      tokenType: typeof parsed.tokenType === 'string' ? parsed.tokenType.trim() : undefined,
      expiresIn: typeof parsed.expiresIn === 'number' ? parsed.expiresIn : undefined,
    };
  } catch {
    return null;
  }
}

export function writeAuthSession(session: AuthSession) {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  storage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(session));
}

export function clearAuthSession() {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  storage.removeItem(AUTH_SESSION_STORAGE_KEY);
}

export function readAuthorizationToken() {
  return readAuthSession()?.authToken || readAccessToken(APP_ENV);
}

export { AUTH_SESSION_STORAGE_KEY };
