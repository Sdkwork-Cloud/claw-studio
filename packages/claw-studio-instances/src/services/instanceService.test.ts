import assert from 'node:assert/strict';

async function runTest(name: string, callback: () => Promise<void> | void) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

await runTest('instances package re-exports the shared instanceService as its only source of truth', async () => {
  const originalLog = console.log;
  console.log = () => {};

  try {
    const [{ instanceService: sharedInstanceService }, { instanceService }] = await Promise.all([
      import('@sdkwork/claw-studio-business'),
      import('./instanceService.ts'),
    ]);

    assert.equal(instanceService, sharedInstanceService);
  } finally {
    console.log = originalLog;
  }
});
