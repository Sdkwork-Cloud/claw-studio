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

await runTest('apiRouterPageViewService keeps the page shell visible when there are no channels', async () => {
  const { resolveApiRouterPageViewState } = await import('./apiRouterPageViewService.ts');

  assert.deepEqual(
    resolveApiRouterPageViewState({
      channelIds: [],
      selectedChannelId: null,
    }),
    {
      hasChannels: false,
      resolvedChannelId: null,
      showPageTabs: true,
      showRouteConfigEmptyState: true,
    },
  );
});

await runTest('apiRouterPageViewService falls back to the first available channel when the selected one is missing', async () => {
  const { resolveApiRouterPageViewState } = await import('./apiRouterPageViewService.ts');

  assert.deepEqual(
    resolveApiRouterPageViewState({
      channelIds: ['openai', 'anthropic'],
      selectedChannelId: 'google',
    }),
    {
      hasChannels: true,
      resolvedChannelId: 'openai',
      showPageTabs: true,
      showRouteConfigEmptyState: false,
    },
  );
});

await runTest('apiRouterPageViewService keeps the tab workspace available without page-level admin gating', async () => {
  const { resolveApiRouterPageViewState } = await import('./apiRouterPageViewService.ts');

  assert.deepEqual(
    resolveApiRouterPageViewState({
      channelIds: ['openai'],
      selectedChannelId: 'openai',
    }),
    {
      hasChannels: true,
      resolvedChannelId: 'openai',
      showPageTabs: true,
      showRouteConfigEmptyState: false,
    },
  );
});
