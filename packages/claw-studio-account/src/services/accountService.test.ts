import assert from 'node:assert/strict';
import { createAccountService } from './accountService.ts';

async function runTest(name: string, callback: () => Promise<void> | void) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

await runTest('getSummary returns the seeded wallet totals', async () => {
  const service = createAccountService();

  const summary = await service.getSummary();

  assert.equal(summary.balance, 1250.5);
  assert.equal(summary.totalIncome > 0, true);
  assert.equal(summary.totalExpense > 0, true);
});

await runTest('getTransactions filters income-related activity and keeps newest items first', async () => {
  const service = createAccountService();

  const transactions = await service.getTransactions('income');

  assert.equal(transactions.every((transaction) => transaction.type === 'income' || transaction.type === 'recharge'), true);
  assert.equal(new Date(transactions[0].date).getTime() >= new Date(transactions.at(-1)?.date ?? 0).getTime(), true);
});

await runTest('recharge increases balance and prepends a recharge transaction', async () => {
  const service = createAccountService();

  await service.recharge(50, 'credit_card');
  const summary = await service.getSummary();
  const transactions = await service.getTransactions();

  assert.equal(summary.balance, 1300.5);
  assert.equal(transactions[0]?.type, 'recharge');
  assert.match(transactions[0]?.desc ?? '', /credit_card/);
});

await runTest('withdraw rejects when the amount exceeds balance', async () => {
  const service = createAccountService();

  await assert.rejects(() => service.withdraw(5000, 'bank_account'), /Insufficient balance/);
});
