import assert from 'node:assert/strict';
import { useLLMStore } from './useLLMStore.ts';

async function runTest(name: string, callback: () => Promise<void> | void) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

function resetStore() {
  useLLMStore.setState(useLLMStore.getInitialState(), true);
}

await runTest('useLLMStore returns a default config for each instance', () => {
  resetStore();

  const config = useLLMStore.getState().getInstanceConfig('instance-a');

  assert.equal(config.activeChannelId, 'google-gemini');
  assert.equal(config.activeModelId, 'gemini-3-flash-preview');
  assert.equal(config.config.temperature, 0.7);
});

await runTest('useLLMStore isolates channel, model, and config per instance', () => {
  resetStore();

  const store = useLLMStore.getState();
  store.setActiveChannel('instance-a', 'moonshot');
  store.setActiveModel('instance-a', 'moonshot-v1-32k');
  store.updateConfig('instance-a', { temperature: 0.2 });

  store.setActiveChannel('instance-b', 'qwen');
  store.setActiveModel('instance-b', 'qwen-plus');

  const instanceA = useLLMStore.getState().getInstanceConfig('instance-a');
  const instanceB = useLLMStore.getState().getInstanceConfig('instance-b');

  assert.equal(instanceA.activeChannelId, 'moonshot');
  assert.equal(instanceA.activeModelId, 'moonshot-v1-32k');
  assert.equal(instanceA.config.temperature, 0.2);

  assert.equal(instanceB.activeChannelId, 'qwen');
  assert.equal(instanceB.activeModelId, 'qwen-plus');
  assert.equal(instanceB.config.temperature, 0.7);
});
