import assert from 'node:assert/strict';
import { appStoreService } from './appStoreService.ts';

async function runTest(name: string, callback: () => Promise<void> | void) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

await runTest('getList supports keyword pagination over the v3 app catalog', async () => {
  const result = await appStoreService.getList({ keyword: 'claw', page: 1, pageSize: 10 });

  assert.equal(result.total, 1);
  assert.equal(result.items[0]?.id, 'app-1');
  assert.equal(result.items[0]?.name, 'Claw AI Studio');
});

await runTest('getById returns extended app metadata from the v3 seed data', async () => {
  const app = await appStoreService.getById('app-1');

  assert.equal(app?.version, '2.1.0');
  assert.equal(app?.screenshots?.length, 3);
  assert.equal(app?.reviewsCount, '12.4K');
});

await runTest('create preserves the v3 unimplemented mutation contract', async () => {
  await assert.rejects(
    () =>
      appStoreService.create({
        name: 'New App',
        developer: 'Claw Studio',
        category: 'Utilities',
        icon: 'https://example.com/icon.png',
      }),
    /Method not implemented\./,
  );
});
