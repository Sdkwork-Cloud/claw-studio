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

async function withMockedWindowStorage(fn: () => Promise<void>) {
  const globalWithWindow = globalThis as unknown as { window?: unknown };
  const originalWindow = globalWithWindow.window;
  const storage = new Map<string, string>();
  const localStorage: Storage = {
    get length() {
      return storage.size;
    },
    clear() {
      storage.clear();
    },
    getItem(key: string) {
      return storage.get(key) ?? null;
    },
    key(index: number) {
      return [...storage.keys()][index] ?? null;
    },
    setItem(key: string, value: string) {
      storage.set(key, value);
    },
    removeItem(key: string) {
      storage.delete(key);
    },
  };

  globalWithWindow.window = {
    localStorage,
  };

  try {
    await fn();
  } finally {
    globalWithWindow.window = originalWindow;
  }
}

await runTest('getList exposes the seeded channel catalog', async () => {
  await withMockedWindowStorage(async () => {
    const result = await channelService.getList('local-built-in', { page: 1, pageSize: 20 });

    assert.equal(result.items[0]?.id, 'sdkworkchat');
    assert.equal(result.items.some((channel) => channel.id === 'wehcat'), true);
    assert.equal(result.items[0]?.fieldCount, 0);
    assert.equal(result.items[0]?.configuredFieldCount, 0);
    assert.equal(result.items[0]?.status, 'connected');
  });
});

await runTest('saveChannelConfig and deleteChannelConfig keep state in sync with v3 behavior', async () => {
  await withMockedWindowStorage(async () => {
    await channelService.saveChannelConfig('local-built-in', 'wehcat', {
      appId: 'wx1234567890abcdef',
      appSecret: 'secret',
      token: 'token',
    });

    let wehcat = await channelService.getById('local-built-in', 'wehcat');
    assert.equal(wehcat?.enabled, true);
    assert.equal(wehcat?.status, 'connected');
    assert.equal(
      wehcat?.fields.find((field) => field.key === 'appId')?.value,
      'wx1234567890abcdef',
    );

    await channelService.deleteChannelConfig('local-built-in', 'wehcat');

    wehcat = await channelService.getById('local-built-in', 'wehcat');
    assert.equal(wehcat?.enabled, false);
    assert.equal(wehcat?.status, 'not_configured');
    assert.equal(
      wehcat?.fields.find((field) => field.key === 'appId')?.value,
      undefined,
    );
  });
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
