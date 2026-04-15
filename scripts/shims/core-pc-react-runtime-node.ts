type PcReactRuntimeSession = {
  authToken?: string;
  accessToken?: string;
  refreshToken?: string;
};

type ConfigurePcReactRuntimeOptions = {
  legacyStorageKeys?: {
    runtimeSession?: string[];
  };
};

type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

const AUTH_TOKEN_STORAGE_KEY = 'sdkwork.core.pc-react.auth-token';
const ACCESS_TOKEN_STORAGE_KEY = 'sdkwork.core.pc-react.access-token';
const REFRESH_TOKEN_STORAGE_KEY = 'sdkwork.core.pc-react.refresh-token';

const memoryStorage = new Map<string, string>();

let runtimeOptions: ConfigurePcReactRuntimeOptions = {};

function resolveStorage(): StorageLike {
  const candidate = (globalThis as { localStorage?: unknown }).localStorage;
  if (
    candidate
    && typeof candidate === 'object'
    && typeof (candidate as StorageLike).getItem === 'function'
    && typeof (candidate as StorageLike).setItem === 'function'
    && typeof (candidate as StorageLike).removeItem === 'function'
  ) {
    return candidate as StorageLike;
  }

  return {
    getItem(key) {
      return memoryStorage.get(key) ?? null;
    },
    setItem(key, value) {
      memoryStorage.set(key, value);
    },
    removeItem(key) {
      memoryStorage.delete(key);
    },
  };
}

function normalizeToken(value: unknown) {
  return typeof value === 'string' && value.trim()
    ? value.trim()
    : undefined;
}

function readStorageValue(key: string) {
  try {
    return resolveStorage().getItem(key) ?? undefined;
  } catch {
    return undefined;
  }
}

function writeStorageValue(key: string, value: string | undefined) {
  try {
    if (value) {
      resolveStorage().setItem(key, value);
      return;
    }

    resolveStorage().removeItem(key);
  } catch {
    // Keep in-memory state authoritative for Node-only checks.
  }
}

function readLegacyRuntimeSession(): PcReactRuntimeSession {
  const keys = runtimeOptions.legacyStorageKeys?.runtimeSession ?? [];
  for (const key of keys) {
    const rawValue = readStorageValue(key);
    if (!rawValue) {
      continue;
    }

    try {
      const parsed = JSON.parse(rawValue) as PcReactRuntimeSession;
      const authToken = normalizeToken(parsed.authToken);
      const accessToken = normalizeToken(parsed.accessToken);
      const refreshToken = normalizeToken(parsed.refreshToken);
      if (!authToken && !accessToken && !refreshToken) {
        continue;
      }

      return {
        authToken,
        accessToken,
        refreshToken,
      };
    } catch {
      // Ignore malformed legacy payloads.
    }
  }

  return {};
}

export function configurePcReactRuntime(
  options: ConfigurePcReactRuntimeOptions = {},
): ConfigurePcReactRuntimeOptions {
  runtimeOptions = {
    ...runtimeOptions,
    ...options,
    legacyStorageKeys: {
      ...runtimeOptions.legacyStorageKeys,
      ...options.legacyStorageKeys,
    },
  };
  return runtimeOptions;
}

export function readPcReactRuntimeSession(): PcReactRuntimeSession {
  const legacySession = readLegacyRuntimeSession();
  return {
    authToken: normalizeToken(readStorageValue(AUTH_TOKEN_STORAGE_KEY)) ?? legacySession.authToken,
    accessToken: normalizeToken(readStorageValue(ACCESS_TOKEN_STORAGE_KEY)) ?? legacySession.accessToken,
    refreshToken: normalizeToken(readStorageValue(REFRESH_TOKEN_STORAGE_KEY)) ?? legacySession.refreshToken,
  };
}

export function persistPcReactRuntimeSession(
  session: PcReactRuntimeSession,
): PcReactRuntimeSession {
  const current = readPcReactRuntimeSession();
  const nextSession = {
    authToken: session.authToken !== undefined
      ? normalizeToken(session.authToken)
      : current.authToken,
    accessToken: session.accessToken !== undefined
      ? normalizeToken(session.accessToken)
      : current.accessToken,
    refreshToken: session.refreshToken !== undefined
      ? normalizeToken(session.refreshToken)
      : current.refreshToken,
  };

  writeStorageValue(AUTH_TOKEN_STORAGE_KEY, nextSession.authToken);
  writeStorageValue(ACCESS_TOKEN_STORAGE_KEY, nextSession.accessToken);
  writeStorageValue(REFRESH_TOKEN_STORAGE_KEY, nextSession.refreshToken);

  return nextSession;
}

export async function clearPcReactRuntimeSession(): Promise<void> {
  writeStorageValue(AUTH_TOKEN_STORAGE_KEY, undefined);
  writeStorageValue(ACCESS_TOKEN_STORAGE_KEY, undefined);
  writeStorageValue(REFRESH_TOKEN_STORAGE_KEY, undefined);
}

export function resetPcReactRuntime(
  options: { clearStorage?: boolean; clearConfiguration?: boolean } = {},
): void {
  if (options.clearStorage ?? true) {
    void clearPcReactRuntimeSession();
    memoryStorage.clear();
  }

  if (options.clearConfiguration ?? true) {
    runtimeOptions = {};
  }
}
