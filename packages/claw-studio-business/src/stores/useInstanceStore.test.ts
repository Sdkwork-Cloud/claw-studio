import assert from 'node:assert/strict';
import type { StateStorage } from 'zustand/middleware';
import { createInstanceStore } from './useInstanceStore.ts';

async function runTest(name: string, callback: () => Promise<void> | void) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

function createMemoryStorage(): StateStorage & { dump(): Record<string, string> } {
  const state = new Map<string, string>();

  return {
    getItem(name) {
      return state.get(name) ?? null;
    },
    setItem(name, value) {
      state.set(name, value);
    },
    removeItem(name) {
      state.delete(name);
    },
    dump() {
      return Object.fromEntries(state.entries());
    },
  };
}

await runTest('createInstanceStore starts with no active instance', () => {
  const store = createInstanceStore(createMemoryStorage());

  assert.equal(store.getState().activeInstanceId, null);
});

await runTest('setActiveInstanceId updates the current instance and persists it', () => {
  const storage = createMemoryStorage();
  const store = createInstanceStore(storage);

  store.getState().setActiveInstanceId('inst-1');

  assert.equal(store.getState().activeInstanceId, 'inst-1');
  assert.match(storage.dump()['claw-studio-instance-storage'] ?? '', /inst-1/);
});

await runTest('reset clears the active instance state', () => {
  const store = createInstanceStore(createMemoryStorage());

  store.getState().setActiveInstanceId('inst-2');
  store.getState().reset();

  assert.equal(store.getState().activeInstanceId, null);
});
