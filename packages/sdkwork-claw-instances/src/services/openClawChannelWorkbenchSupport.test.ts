import assert from 'node:assert/strict';

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

let channelWorkbenchSupportModule:
  | typeof import('./openClawChannelWorkbenchSupport.ts')
  | undefined;

try {
  channelWorkbenchSupportModule = await import('./openClawChannelWorkbenchSupport.ts');
} catch {
  channelWorkbenchSupportModule = undefined;
}

await runTest(
  'openClawChannelWorkbenchSupport exposes shared channel mapping and merge helpers',
  () => {
    assert.ok(channelWorkbenchSupportModule, 'Expected openClawChannelWorkbenchSupport.ts to exist');
    assert.equal(typeof channelWorkbenchSupportModule?.mapManagedChannel, 'function');
    assert.equal(typeof channelWorkbenchSupportModule?.cloneManagedChannel, 'function');
    assert.equal(typeof channelWorkbenchSupportModule?.cloneWorkbenchChannel, 'function');
    assert.equal(typeof channelWorkbenchSupportModule?.mapOpenClawChannelDefinition, 'function');
    assert.equal(typeof channelWorkbenchSupportModule?.mergeOpenClawChannelCollections, 'function');
    assert.equal(typeof channelWorkbenchSupportModule?.buildOpenClawChannels, 'function');
  },
);

await runTest(
  'mapOpenClawChannelDefinition defaults required channels to disconnected setup and enables built-in none mode channels',
  () => {
    const requiredChannel = channelWorkbenchSupportModule?.mapOpenClawChannelDefinition({
      id: 'slack',
      name: 'Slack',
      description: 'Slack bot',
      configurationMode: 'required',
      fields: [{ id: 'token' }],
      setupSteps: ['Create app', 'Install bot'],
    } as any);
    const builtInChannel = channelWorkbenchSupportModule?.mapOpenClawChannelDefinition({
      id: 'clipboard',
      name: 'Clipboard',
      description: 'Built in',
      configurationMode: 'none',
      fields: [],
      setupSteps: [],
    } as any);

    assert.deepEqual(requiredChannel, {
      id: 'slack',
      name: 'Slack',
      description: 'Slack bot',
      status: 'not_configured',
      enabled: false,
      configurationMode: 'required',
      fieldCount: 1,
      configuredFieldCount: 0,
      setupSteps: ['Create app', 'Install bot'],
    });
    assert.equal(builtInChannel?.status, 'connected');
    assert.equal(builtInChannel?.enabled, true);
    assert.equal(builtInChannel?.configurationMode, 'none');
  },
);

await runTest(
  'mergeOpenClawChannelCollections preserves base ordering, overlays runtime status, and deep-clones accounts',
  () => {
    const merged = channelWorkbenchSupportModule?.mergeOpenClawChannelCollections(
      [
        {
          id: 'slack',
          name: 'Slack',
          description: 'Managed channel',
          status: 'not_configured',
          enabled: false,
          configurationMode: 'required',
          fieldCount: 1,
          configuredFieldCount: 0,
          setupSteps: ['Configure token'],
          accounts: [
            {
              id: 'primary',
              label: 'Primary',
              configured: false,
              enabled: false,
              status: 'disconnected',
              detail: 'Missing token',
            },
          ],
        },
        {
          id: 'qq',
          name: 'QQ',
          description: 'Managed QQ',
          status: 'connected',
          enabled: true,
          configurationMode: 'optional',
          fieldCount: 2,
          configuredFieldCount: 2,
          setupSteps: ['Scan QR'],
        },
      ] as any,
      [
        {
          id: 'slack',
          name: '',
          description: 'Runtime says connected',
          status: 'connected',
          enabled: true,
          configurationMode: '',
          fieldCount: 1,
          configuredFieldCount: 1,
          setupSteps: [],
          accounts: [
            {
              id: 'primary',
              label: 'Primary',
              configured: true,
              enabled: true,
              status: 'connected',
              detail: 'Bound',
            },
          ],
        },
        {
          id: 'discord',
          name: 'Discord',
          description: 'Runtime only',
          status: 'connected',
          enabled: true,
          configurationMode: 'required',
          fieldCount: 1,
          configuredFieldCount: 1,
          setupSteps: ['Invite bot'],
        },
      ] as any,
    );

    assert.deepEqual(
      merged?.map((channel) => channel.id),
      ['slack', 'qq', 'discord'],
    );
    assert.equal(merged?.[0]?.name, 'Slack');
    assert.equal(merged?.[0]?.description, 'Runtime says connected');
    assert.equal(merged?.[0]?.status, 'connected');
    assert.equal(merged?.[0]?.enabled, true);
    assert.equal(merged?.[0]?.configurationMode, 'required');
    assert.equal(merged?.[0]?.configuredFieldCount, 1);
    assert.deepEqual(merged?.[0]?.setupSteps, ['Configure token']);
    assert.deepEqual(merged?.[0]?.accounts?.[0], {
      id: 'primary',
      label: 'Primary',
      configured: true,
      enabled: true,
      status: 'connected',
      detail: 'Bound',
    });

    const clonedAccount = merged?.[0]?.accounts?.[0];
    if (clonedAccount) {
      clonedAccount.detail = 'mutated';
    }
    assert.equal(
      (merged?.[0]?.accounts?.[0] as { detail?: string } | undefined)?.detail,
      'mutated',
    );
  },
);

await runTest(
  'cloneManagedChannel deep-clones values and field entries',
  () => {
    const cloned = channelWorkbenchSupportModule?.cloneManagedChannel({
      id: 'slack',
      name: 'Slack',
      description: 'Managed channel',
      status: 'connected',
      enabled: true,
      configurationMode: 'required',
      fieldCount: 1,
      configuredFieldCount: 1,
      setupSteps: ['Configure token'],
      values: {
        token: 'env:SLACK_TOKEN',
      },
      fields: [
        {
          id: 'token',
          label: 'Token',
        },
      ],
    } as any);

    assert.ok(cloned);
    assert.notEqual(cloned?.setupSteps, undefined);
    assert.notEqual(cloned?.values, undefined);
    assert.notEqual(cloned?.fields, undefined);

    cloned?.setupSteps.push('Invite bot');
    (cloned?.values as Record<string, string>).token = 'mutated';
    (cloned?.fields?.[0] as { label?: string }).label = 'Changed';

    assert.deepEqual(cloned?.setupSteps, ['Configure token', 'Invite bot']);
    assert.equal((cloned?.values as Record<string, string>).token, 'mutated');
    assert.equal((cloned?.fields?.[0] as { label?: string }).label, 'Changed');
  },
);

await runTest(
  'buildOpenClawChannels keeps channel order, account detail, and sdkworkchat runtime semantics aligned',
  () => {
    const channels = channelWorkbenchSupportModule?.buildOpenClawChannels({
      channelOrder: ['slack', 'sdkworkchat'],
      channelLabels: {
        slack: 'Slack',
        sdkworkchat: 'Sdkwork Chat',
      },
      channelDetailLabels: {
        slack: 'Slack runtime detail',
      },
      channelAccounts: {
        slack: {
          primary: {
            configured: true,
            enabled: true,
            status: 'connected',
            detail: 'Bound to the primary workspace',
          },
        },
      },
      channels: {
        slack: {
          enabled: true,
          configured: true,
          fields: {
            token: 'env:SLACK_TOKEN',
          },
          accounts: {
            primary: {
              name: 'Primary Workspace',
              configured: true,
              enabled: true,
            },
          },
        },
        sdkworkchat: {
          enabled: false,
          configured: false,
          fields: {},
        },
      },
    } as any);

    assert.deepEqual(
      channels?.map((channel) => channel.id),
      ['slack', 'sdkworkchat'],
    );
    assert.equal(channels?.[0]?.description, 'Slack runtime detail');
    assert.equal(channels?.[0]?.status, 'connected');
    assert.equal(channels?.[0]?.enabled, true);
    assert.equal(channels?.[0]?.accounts?.[0]?.id, 'primary');
    assert.equal(channels?.[0]?.accounts?.[0]?.name, 'Primary Workspace');
    assert.equal(channels?.[0]?.accounts?.[0]?.detail, 'Bound to the primary workspace');
    assert.equal(channels?.[1]?.configurationMode, 'none');
    assert.equal(channels?.[1]?.status, 'disconnected');
    assert.equal(channels?.[1]?.fieldCount, 0);
    assert.match(channels?.[1]?.setupSteps?.[0] || '', /Sdkwork Chat/);
  },
);
