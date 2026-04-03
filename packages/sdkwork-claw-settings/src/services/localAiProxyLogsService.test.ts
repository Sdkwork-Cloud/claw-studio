import assert from 'node:assert/strict';
import type { PaginatedResult } from '@sdkwork/claw-types';

async function runTest(name: string, callback: () => Promise<void> | void) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

await runTest('localAiProxyLogsService normalizes request and message log queries before delegating to the kernel bridge', async () => {
  const { createLocalAiProxyLogsService } = await import('./localAiProxyLogsService.ts');

  const calls: Array<{ kind: string; query: Record<string, unknown> }> = [];
  const emptyPage: PaginatedResult<any> = {
    items: [],
    total: 0,
    page: 1,
    pageSize: 20,
    hasMore: false,
  };

  const service = createLocalAiProxyLogsService({
    kernelPlatformService: {
      listLocalAiProxyRequestLogs: async (query) => {
        calls.push({ kind: 'requests', query });
        return emptyPage;
      },
      listLocalAiProxyMessageLogs: async (query) => {
        calls.push({ kind: 'messages', query });
        return emptyPage;
      },
      updateLocalAiProxyMessageCapture: async (enabled) => ({
        enabled,
        updatedAt: 1743512000000,
      }),
      getInfo: async () =>
        ({
          localAiProxy: {
            messageCaptureEnabled: false,
          },
        }) as any,
    } as any,
  });

  await service.listRequestLogs({
    page: 0,
    pageSize: 999,
    search: '  openai  ',
    providerId: ' openai ',
    status: 'all',
  });
  await service.listMessageLogs({
    page: -1,
    pageSize: 0,
    search: '  summarize  ',
    providerId: ' openai ',
  });
  const settings = await service.getMessageCaptureSettings();
  const updated = await service.updateMessageCaptureSettings(true);

  assert.deepEqual(calls, [
    {
      kind: 'requests',
      query: {
        page: 1,
        pageSize: 100,
        search: 'openai',
        providerId: 'openai',
      },
    },
    {
      kind: 'messages',
      query: {
        page: 1,
        pageSize: 20,
        search: 'summarize',
        providerId: 'openai',
      },
    },
  ]);
  assert.deepEqual(settings, {
    enabled: false,
    updatedAt: null,
  });
  assert.deepEqual(updated, {
    enabled: true,
    updatedAt: 1743512000000,
  });
});
