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
      canManageRouter: true,
    }),
    {
      hasChannels: false,
      resolvedChannelId: null,
      showManagementPanels: true,
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
      canManageRouter: true,
    }),
    {
      hasChannels: true,
      resolvedChannelId: 'openai',
      showManagementPanels: true,
      showPageTabs: true,
      showRouteConfigEmptyState: false,
    },
  );
});

await runTest('apiRouterPageViewService hides management panels until router admin access is available', async () => {
  const { resolveApiRouterPageViewState } = await import('./apiRouterPageViewService.ts');

  assert.deepEqual(
    resolveApiRouterPageViewState({
      channelIds: ['openai'],
      selectedChannelId: 'openai',
      canManageRouter: false,
    }),
    {
      hasChannels: true,
      resolvedChannelId: 'openai',
      showManagementPanels: false,
      showPageTabs: false,
      showRouteConfigEmptyState: false,
    },
  );
});
