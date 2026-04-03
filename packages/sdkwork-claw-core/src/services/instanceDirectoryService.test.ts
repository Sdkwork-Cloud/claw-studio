import assert from 'node:assert/strict';
import { createInstanceDirectoryService } from './instanceDirectoryService.ts';

async function runTest(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

await runTest('instanceDirectoryService deduplicates rapid listInstances calls', async () => {
  let now = 1_000;
  let loadCount = 0;
  const service = createInstanceDirectoryService({
    cacheTtlMs: 1_000,
    now: () => now,
    loadInstances: async () => {
      loadCount += 1;
      return [
        {
          id: 'instance-alpha',
          name: 'Instance Alpha',
          host: '127.0.0.1',
          status: 'online',
          iconType: 'server',
        },
      ];
    },
  });

  const [first, second] = await Promise.all([service.listInstances(), service.listInstances()]);
  const third = await service.listInstances();

  assert.equal(loadCount, 1);
  assert.deepEqual(first, second);
  assert.deepEqual(second, third);

  now += 1_500;
  await service.listInstances();

  assert.equal(loadCount, 2);
});
