import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

function runTest(name: string, fn: () => void | Promise<void>) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      console.log(`ok - ${name}`);
    })
    .catch((error) => {
      console.error(`not ok - ${name}`);
      throw error;
    });
}

async function loadInstanceDetailNavigationSupportModule() {
  const moduleUrl = new URL('./instanceDetailNavigationSupport.ts', import.meta.url);

  assert.ok(
    existsSync(moduleUrl),
    'expected instanceDetailNavigationSupport.ts to exist',
  );

  return import('./instanceDetailNavigationSupport.ts');
}

await runTest(
  'createSharedStatusLabelGetter maps instance shared status keys through the injected translator',
  async () => {
    const { createSharedStatusLabelGetter } = await loadInstanceDetailNavigationSupportModule();

    const getSharedStatusLabel = createSharedStatusLabelGetter(
      (key: string) => `translated:${key}`,
    );

    assert.equal(
      getSharedStatusLabel('online'),
      'translated:instances.shared.status.online',
    );
    assert.equal(
      getSharedStatusLabel('offline'),
      'translated:instances.shared.status.offline',
    );
  },
);

await runTest(
  'buildInstanceDetailNavigationHandlers routes back, provider-center, agent-market, and set-active actions through injected page-owned callbacks',
  async () => {
    const { buildInstanceDetailNavigationHandlers } =
      await loadInstanceDetailNavigationSupportModule();
    const callLog: string[] = [];

    const handlers = buildInstanceDetailNavigationHandlers({
      instance: { id: 'instance-01' },
      instanceId: 'instance-01',
      navigate: (href) => {
        callLog.push(`navigate:${href}`);
      },
      setActiveInstanceId: (instanceId) => {
        callLog.push(`active:${instanceId}`);
      },
    });

    handlers.onBackToInstances();
    handlers.onOpenProviderCenter();
    handlers.onOpenAgentMarket();
    handlers.onSetActive();

    assert.deepEqual(callLog, [
      'navigate:/instances',
      'navigate:/settings?tab=api',
      'navigate:/agents?instanceId=instance-01',
      'active:instance-01',
    ]);
  },
);

await runTest(
  'buildInstanceDetailNavigationHandlers falls back to the generic agent market route and skips set-active when no instance is loaded',
  async () => {
    const { buildInstanceDetailNavigationHandlers } =
      await loadInstanceDetailNavigationSupportModule();
    const callLog: string[] = [];

    const handlers = buildInstanceDetailNavigationHandlers({
      instance: null,
      instanceId: null,
      navigate: (href) => {
        callLog.push(`navigate:${href}`);
      },
      setActiveInstanceId: (instanceId) => {
        callLog.push(`active:${instanceId}`);
      },
    });

    handlers.onOpenAgentMarket();
    handlers.onSetActive();

    assert.deepEqual(callLog, ['navigate:/agents']);
  },
);
