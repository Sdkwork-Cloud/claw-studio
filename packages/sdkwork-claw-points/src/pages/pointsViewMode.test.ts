import assert from 'node:assert/strict';
import { resolvePointsPageView } from './pointsViewMode.ts';

async function runTest(name: string, callback: () => Promise<void> | void) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

runTest('points view mode defaults to wallet when no explicit view is provided', () => {
  assert.equal(resolvePointsPageView(null), 'wallet');
  assert.equal(resolvePointsPageView(undefined), 'wallet');
});

runTest('points view mode recognizes supported view values and rejects unknown ones', () => {
  assert.equal(resolvePointsPageView('membership'), 'membership');
  assert.equal(resolvePointsPageView('wallet'), 'wallet');
  assert.equal(resolvePointsPageView('overview'), 'wallet');
  assert.equal(resolvePointsPageView(''), 'wallet');
});
