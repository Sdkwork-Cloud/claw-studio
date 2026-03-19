import assert from 'node:assert/strict';
import type { StateStorage } from 'zustand/middleware';
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

async function runTest(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

await runTest('useAuthStore signs in and persists the entered email', async () => {
  const storage = createMemoryStorage();
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
});

await runTest('useAuthStore registers and signs out cleanly', async () => {
  const storage = createMemoryStorage();
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
});
