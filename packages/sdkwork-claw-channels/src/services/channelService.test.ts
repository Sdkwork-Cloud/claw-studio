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
  const result = await channelService.getList('local-built-in', { page: 1, pageSize: 20 });

  assert.equal(result.items[0]?.id, 'telegram');
  assert.equal(result.items.some((channel) => channel.id === 'whatsapp'), true);
  assert.equal(result.items[0]?.fieldCount, 2);
  assert.equal(result.items[0]?.configuredFieldCount, 2);
  assert.equal(result.items[0]?.status, 'connected');
});

await runTest('saveChannelConfig and deleteChannelConfig keep state in sync with v3 behavior', async () => {
  await channelService.saveChannelConfig('local-built-in', 'whatsapp', {
    defaultTo: '+15551234567',
    messagePrefix: '[Ops]',
    responsePrefix: 'Assistant:',
  });

  let whatsapp = await channelService.getById('local-built-in', 'whatsapp');
  assert.equal(whatsapp?.enabled, true);
  assert.equal(whatsapp?.status, 'connected');

  await channelService.deleteChannelConfig('local-built-in', 'whatsapp');

  whatsapp = await channelService.getById('local-built-in', 'whatsapp');
  assert.equal(whatsapp?.enabled, false);
  assert.equal(whatsapp?.status, 'not_configured');
});

await runTest('create preserves the v3 unimplemented mutation contract', async () => {
  await assert.rejects(
    () =>
      channelService.create('local-built-in', {
        name: 'Custom Channel',
        description: 'Custom integration',
        icon: 'Webhook',
        fields: [],
        setupGuide: [],
      }),
    /Method not implemented\./,
  );
});
