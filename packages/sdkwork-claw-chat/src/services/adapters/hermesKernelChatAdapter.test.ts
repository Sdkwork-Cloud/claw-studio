import assert from 'node:assert/strict';
import { createHermesKernelChatAdapter } from './hermesKernelChatAdapter.ts';

function runTest(name: string, fn: () => Promise<void> | void) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      console.log(`ok - ${name}`);
    })
    .catch((error) => {
      console.error(`not ok - ${name}`);
      throw error;
    });
}

await runTest('hermes kernel chat adapter exposes sqlite authority semantics while remaining explicitly unsupported', () => {
  const adapter = createHermesKernelChatAdapter();
  const capabilities = adapter.getCapabilities();

  assert.deepEqual(capabilities, {
    adapterId: 'hermes',
    authorityKind: 'sqlite',
    supported: false,
    durable: true,
    writable: true,
    supportsStreaming: true,
    supportsRuns: true,
    supportsAgentProfiles: true,
    supportsSessionMutation: true,
    reason: 'Hermes chat transport is not wired yet.',
  });
});
