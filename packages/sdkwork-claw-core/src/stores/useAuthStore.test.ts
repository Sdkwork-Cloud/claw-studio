import assert from 'node:assert/strict';
import type { StateStorage } from 'zustand/middleware';
import { AUTH_SESSION_STORAGE_KEY } from '@sdkwork/claw-infrastructure';
import { createAuthStore } from './useAuthStore.ts';

function createMemoryStorage(): StateStorage {
  const store = new Map<string, string>();

  return {
    getItem(name) {
      return store.get(name) ?? null;
    },
    setItem(name, value) {
      store.set(name, value);
    },
    removeItem(name) {
      store.delete(name);
    },
  };
}

const fetchCalls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];

globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  fetchCalls.push({ input, init });
  const url = String(input);

  if (url.endsWith('/app/v3/api/auth/login')) {
    const body = JSON.parse(String(init?.body || '{}')) as { username?: string };
    return new Response(
      JSON.stringify({
        code: '2000',
        msg: 'success',
        requestId: 'req-login',
        errorName: '',
        data: {
          authToken: 'jwt-token',
          refreshToken: 'refresh-token',
          tokenType: 'Bearer',
          expiresIn: 3600,
          userInfo: {
            username: body.username,
            email: body.username,
            nickname: 'Night Operator',
          },
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }

  if (url.endsWith('/app/v3/api/auth/register')) {
    return new Response(JSON.stringify({
      code: '2000',
      msg: 'success',
      requestId: 'req-register',
      errorName: '',
      data: {},
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (url.endsWith('/app/v3/api/auth/logout')) {
    return new Response(JSON.stringify({
      code: '2000',
      msg: 'success',
      requestId: 'req-logout',
      errorName: '',
      data: null,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (url.endsWith('/app/v3/api/auth/password/reset/request')) {
    return new Response(JSON.stringify({
      code: '2000',
      msg: 'success',
      requestId: 'req-reset',
      errorName: '',
      data: null,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ code: 404, message: 'Not found' }), {
    status: 404,
    headers: { 'Content-Type': 'application/json' },
  });
}) as typeof fetch;

async function runTest(name: string, fn: () => Promise<void> | void) {
  try {
    fetchCalls.length = 0;
    await fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

await runTest('useAuthStore signs in and persists the entered email', async () => {
  const storage = createMemoryStorage();
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });
  const store = createAuthStore(storage);

  assert.equal(store.getState().isAuthenticated, false);
  assert.equal(store.getState().user, null);

  await store.getState().signIn({
    email: 'night-operator@example.com',
    password: 'secret',
  });

  assert.equal(store.getState().isAuthenticated, true);
  assert.equal(store.getState().user?.email, 'night-operator@example.com');
  assert.match(store.getState().user?.displayName ?? '', /\S/);
  assert.ok(storage.getItem(AUTH_SESSION_STORAGE_KEY));
});

await runTest('useAuthStore registers and signs out cleanly', async () => {
  const storage = createMemoryStorage();
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });
  const store = createAuthStore(storage);

  await store.getState().register({
    name: 'Night Operator',
    email: 'night-operator@example.com',
    password: 'secret',
  });

  assert.equal(store.getState().isAuthenticated, true);
  assert.equal(store.getState().user?.displayName, 'Night Operator');

  await store.getState().signOut();

  assert.equal(store.getState().isAuthenticated, false);
  assert.equal(store.getState().user, null);
  assert.equal(storage.getItem(AUTH_SESSION_STORAGE_KEY), null);
});

await runTest('useAuthStore sends password reset requests through the backend auth client', async () => {
  const storage = createMemoryStorage();
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });
  const store = createAuthStore(storage);

  await store.getState().sendPasswordReset(' night-operator@example.com ');

  const resetRequest = fetchCalls.find(({ input }) =>
    String(input).endsWith('/app/v3/api/auth/password/reset/request'),
  );

  assert.ok(resetRequest);
  assert.equal(resetRequest.init?.method, 'POST');
  assert.deepEqual(JSON.parse(String(resetRequest.init?.body ?? '{}')), {
    account: 'night-operator@example.com',
    channel: 'EMAIL',
  });
});
