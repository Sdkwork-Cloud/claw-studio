import assert from 'node:assert/strict';
import {
  createInitialPointsRechargeDialogState,
  shouldResetPointsRechargeDialogState,
} from './pointsRechargeDialogState.ts';

async function runTest(name: string, callback: () => Promise<void> | void) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

await runTest('pointsRechargeDialogState picks the preferred default preset and payment method when opening', async () => {
  const state = createInitialPointsRechargeDialogState([500, 1000, 2000]);

  assert.equal(state.selectedPreset, 1000);
  assert.equal(state.customPointsValue, '');
  assert.equal(state.paymentMethod, 'wechat');
});

await runTest('pointsRechargeDialogState keeps the user selection intact while the dialog stays open', async () => {
  assert.equal(shouldResetPointsRechargeDialogState(false, true), true);
  assert.equal(shouldResetPointsRechargeDialogState(true, true), false);
  assert.equal(shouldResetPointsRechargeDialogState(true, false), false);
});
