import assert from 'node:assert/strict';
import { createInstanceDirectoryService } from './instanceDirectoryService.ts';

async function runTest(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

function createStudioInstance(id: string, status: 'online' | 'offline' | 'starting' | 'syncing' | 'error' = 'online') {
  return {
    id,
    name: `Instance ${id}`,
    host: `127.0.0.${id}`,
    status,
    iconType: 'server' as const,
  };
}

await runTest('instanceDirectoryService deduplicates concurrent list requests and caches short-lived results', async () => {
  let callCount = 0;
  let nowMs = 1_000;
  const service = createInstanceDirectoryService({
    listInstances: async () => {
      callCount += 1;
      return [createStudioInstance('1'), createStudioInstance('2', 'syncing')];
    },
    now: () => nowMs,
    cacheTtlMs: 1_000,
  });

  const [first, second] = await Promise.all([
    service.listInstances(),
    service.listInstances(),
  ]);

  assert.equal(callCount, 1);
  assert.equal(first, second);
  assert.equal(first[1]?.status, 'starting');

  nowMs = 1_500;
  const cached = await service.listInstances();
  assert.equal(callCount, 1);
  assert.equal(cached, first);

  nowMs = 2_500;
  const refreshed = await service.listInstances();
  assert.equal(callCount, 2);
  assert.notEqual(refreshed, first);
});

await runTest('instanceDirectoryService can force-refresh after cache invalidation', async () => {
  let callCount = 0;
  const service = createInstanceDirectoryService({
    listInstances: async () => {
      callCount += 1;
      return [createStudioInstance(String(callCount))];
    },
    cacheTtlMs: 60_000,
  });

  const first = await service.listInstances();
  service.invalidate();
  const second = await service.listInstances();
  const forced = await service.listInstances({ force: true });

  assert.equal(callCount, 3);
  assert.equal(first[0]?.id, '1');
  assert.equal(second[0]?.id, '2');
  assert.equal(forced[0]?.id, '3');
});
