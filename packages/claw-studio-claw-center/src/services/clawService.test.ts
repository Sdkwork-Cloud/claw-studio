import assert from 'node:assert/strict';
import { clawService } from './clawService.ts';

async function runTest(name: string, callback: () => Promise<void> | void) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

await runTest('clawService exposes the v3 commerce categories', async () => {
  const categories = await clawService.getCategories();

  assert.equal(categories.length, 9);
  assert.equal(categories[0]?.id, 'Data Processing');
  assert.equal(categories.at(-1)?.id, 'Dining');
});

await runTest('clawService getList filters providers by keyword and keeps pagination metadata', async () => {
  const result = await clawService.getList({ keyword: 'medical', page: 1, pageSize: 10 });

  assert.equal(result.total, 1);
  assert.equal(result.items[0]?.name, 'HealthConnect Plus');
  assert.equal(result.hasMore, false);
});

await runTest('clawService getClawDetail returns the richer v3 product catalog', async () => {
  const detail = await clawService.getClawDetail('claw-009');

  assert.ok(detail);
  assert.equal(detail?.products.length, 2);
  assert.deepEqual(detail?.products.map((product) => product.type), ['food', 'coupon']);
  assert.equal(detail?.reviews[0]?.user, 'FoodieNYC');
});
