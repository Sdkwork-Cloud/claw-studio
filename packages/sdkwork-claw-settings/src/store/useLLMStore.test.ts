import assert from 'node:assert/strict';

function createMemoryStorage(): Storage {
  const store = new Map<string, string>();

  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key) {
      return store.get(key) ?? null;
    },
    key(index) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key) {
      store.delete(key);
    },
    setItem(key, value) {
      store.set(key, value);
    },
  };
}

async function runTest(name: string, callback: () => void | Promise<void>) {
  try {
    Object.defineProperty(globalThis, 'localStorage', {
      value: createMemoryStorage(),
      configurable: true,
    });

    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

await runTest('useLLMStore exposes built-in xAI and MiniMax channels aligned with the upgraded OpenClaw runtime', async () => {
  const { useLLMStore } = await import('./useLLMStore.ts');
  const channels = useLLMStore.getState().channels;

  const xai = channels.find((channel) => channel.id === 'xai-grok');
  const minimax = channels.find((channel) => channel.id === 'minimax');
  const qwen = channels.find((channel) => channel.id === 'qwen');

  assert.ok(xai);
  assert.equal(xai?.baseUrl, 'https://api.x.ai/v1');
  assert.equal(xai?.defaultModelId, 'grok-4');
  assert.equal(xai?.models.some((model) => model.id === 'grok-4-fast'), true);

  assert.ok(minimax);
  assert.equal(minimax?.baseUrl, 'https://api.minimax.io/anthropic');
  assert.equal(minimax?.defaultModelId, 'MiniMax-M2.7');
  assert.equal(minimax?.models.some((model) => model.id === 'MiniMax-M2.7-highspeed'), true);

  assert.ok(qwen);
  assert.equal(qwen?.models.some((model) => model.id === 'qwen-turbo'), false);
});
