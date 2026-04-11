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

async function loadInstanceDetailManagedChannelMutationSupportModule() {
  const moduleUrl = new URL('./instanceDetailManagedChannelMutationSupport.ts', import.meta.url);

  assert.ok(
    existsSync(moduleUrl),
    'expected instanceDetailManagedChannelMutationSupport.ts to exist',
  );

  return import('./instanceDetailManagedChannelMutationSupport.ts');
}

await runTest(
  'createInstanceDetailManagedChannelMutationExecutors routes save and toggle through the injected instance service surface',
  async () => {
    const { createInstanceDetailManagedChannelMutationExecutors } =
      await loadInstanceDetailManagedChannelMutationSupportModule();
    const calls: string[] = [];

    const executors = createInstanceDetailManagedChannelMutationExecutors({
      instanceService: {
        saveOpenClawChannelConfig: async (instanceId, channelId, values) => {
          calls.push(`save:${instanceId}:${channelId}:${values.token}`);
        },
        setOpenClawChannelEnabled: async (instanceId, channelId, enabled) => {
          calls.push(`toggle:${instanceId}:${channelId}:${enabled}`);
        },
      },
    });

    await executors.executeSaveConfig('instance-156', 'qq', { token: 'secret-1' });
    await executors.executeToggleEnabled('instance-156', 'qq', true);

    assert.deepEqual(calls, [
      'save:instance-156:qq:secret-1',
      'toggle:instance-156:qq:true',
    ]);
  },
);
