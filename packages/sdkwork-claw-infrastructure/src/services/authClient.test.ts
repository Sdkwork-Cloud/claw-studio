import assert from 'node:assert/strict';
import { AUTH_SESSION_STORAGE_KEY, clearAuthSession, readAuthSession } from '../auth/authSession.ts';
import { login, logout } from './authClient.ts';
import { getUserProfile } from './userClient.ts';

type FetchCall = {
  input: RequestInfo | URL;
  init?: RequestInit;
};

const fetchCalls: FetchCall[] = [];

function createStorage() {
  const store = new Map<string, string>();

  return {
    getItem(key: string) {
      return store.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
    removeItem(key: string) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
}

const storage = createStorage();

Object.defineProperty(globalThis, 'window', {
  value: {
    localStorage: storage,
  },
  configurable: true,
});

globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  fetchCalls.push({ input, init });
  const url = String(input);

  if (url.endsWith('/app/v3/api/auth/login')) {
    return new Response(
      JSON.stringify({
        code: 0,
        data: {
          authToken: 'jwt-token',
          refreshToken: 'refresh-token',
          tokenType: 'Bearer',
          expiresIn: 3600,
          userInfo: {
            id: 7,
            username: 'night-operator',
            email: 'night-operator@example.com',
            nickname: 'Night Operator',
          },
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }

  if (url.endsWith('/app/v3/api/auth/logout')) {
    return new Response(JSON.stringify({ code: 0, data: null }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (url.endsWith('/app/v3/api/user/profile')) {
    return new Response(
      JSON.stringify({
        code: 0,
        data: {
          nickname: 'Night Operator',
          email: 'night-operator@example.com',
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }

  return new Response(JSON.stringify({ code: 404, message: 'Not found' }), {
    status: 404,
    headers: { 'Content-Type': 'application/json' },
  });
}) as typeof fetch;

function resetState() {
  fetchCalls.length = 0;
  storage.clear();
  clearAuthSession();
}

async function runTest(name: string, fn: () => Promise<void> | void) {
  resetState();
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

await runTest('authClient login stores the issued auth session', async () => {
  const result = await login({
    username: 'night-operator@example.com',
    password: 'secret',
  });

  assert.equal(result.userInfo?.nickname, 'Night Operator');
  assert.deepEqual(readAuthSession(), {
    authToken: 'jwt-token',
    refreshToken: 'refresh-token',
    tokenType: 'Bearer',
    expiresIn: 3600,
  });
  assert.ok(storage.getItem(AUTH_SESSION_STORAGE_KEY));
});

await runTest('userClient attaches the stored bearer token automatically', async () => {
  await login({
    username: 'night-operator@example.com',
    password: 'secret',
  });

  const profile = await getUserProfile();

  assert.equal(profile.email, 'night-operator@example.com');
  const profileCall = fetchCalls.at(-1);
  assert.equal(
    new Headers(profileCall?.init?.headers).get('Authorization'),
    'Bearer jwt-token',
  );
});

await runTest('authClient logout clears persisted auth session', async () => {
  await login({
    username: 'night-operator@example.com',
    password: 'secret',
  });

  await logout();

  assert.equal(readAuthSession(), null);
  assert.equal(storage.getItem(AUTH_SESSION_STORAGE_KEY), null);
});
