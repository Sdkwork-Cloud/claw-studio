import assert from 'node:assert/strict';
import test from 'node:test';

test('WebApiRouterPlatform refuses to serve mock channel data when no live API access is configured', async () => {
  const { WebApiRouterPlatform } = await import('./webApiRouter.ts');
  const platform = new WebApiRouterPlatform();

  await assert.rejects(() => platform.getChannels(), /api router/i);
});
