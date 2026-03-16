import assert from 'node:assert/strict';
import { channelService } from './channelService.ts';

async function runTest(name: string, callback: () => Promise<void> | void) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

await runTest('getList exposes the seeded channel catalog', async () => {
  const result = await channelService.getList({ page: 1, pageSize: 20 });

  assert.equal(result.items.some((channel) => channel.id === 'discord' && channel.enabled), true);
  assert.equal(result.items.some((channel) => channel.id === 'webhook' && channel.status === 'connected'), true);
});

await runTest('saveChannelConfig and deleteChannelConfig keep state in sync with v3 behavior', async () => {
  await channelService.saveChannelConfig('telegram', { bot_token: '123' });

  let telegram = await channelService.getById('telegram');
  assert.equal(telegram?.enabled, true);
  assert.equal(telegram?.status, 'connected');

  await channelService.deleteChannelConfig('telegram');

  telegram = await channelService.getById('telegram');
  assert.equal(telegram?.enabled, false);
  assert.equal(telegram?.status, 'not_configured');
});

await runTest('create preserves the v3 unimplemented mutation contract', async () => {
  await assert.rejects(
    () =>
      channelService.create({
        name: 'Custom Channel',
        description: 'Custom integration',
        icon: 'Webhook',
        fields: [],
        setupGuide: [],
      }),
    /Method not implemented\./,
  );
});
