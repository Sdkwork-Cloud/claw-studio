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

let channelConfigServiceModule:
  | typeof import('./openClawChannelConfigService.ts')
  | undefined;

try {
  channelConfigServiceModule = await import('./openClawChannelConfigService.ts');
} catch {
  channelConfigServiceModule = undefined;
}

await runTest(
  'openClawChannelConfigService exposes channel definition, snapshot, document, and mutation helpers',
  () => {
    assert.ok(
      channelConfigServiceModule,
      'Expected openClawChannelConfigService.ts to exist',
    );
    assert.equal(
      typeof channelConfigServiceModule?.listOpenClawChannelDefinitions,
      'function',
    );
    assert.equal(
      typeof channelConfigServiceModule?.buildOpenClawChannelSnapshotsFromConfigRoot,
      'function',
    );
    assert.equal(
      typeof channelConfigServiceModule?.saveOpenClawChannelConfigurationToConfigRoot,
      'function',
    );
    assert.equal(
      typeof channelConfigServiceModule?.setOpenClawChannelEnabledInDocument,
      'function',
    );
  },
);

await runTest(
  'openClawChannelConfigService resolves canonical channel definitions with shared context-visibility controls',
  () => {
    const definitions = channelConfigServiceModule?.listOpenClawChannelDefinitions() || [];
    const telegram = definitions.find((channel) => channel.id === 'telegram');
    const whatsapp = definitions.find((channel) => channel.id === 'whatsapp');
    const sdkworkchat = definitions.find((channel) => channel.id === 'sdkworkchat');

    assert.ok(telegram);
    assert.ok(whatsapp);
    assert.ok(sdkworkchat);
    assert.equal(telegram?.fields.some((field) => field.key === 'errorPolicy'), true);
    assert.equal(
      telegram?.fields.find((field) => field.key === 'errorCooldownMs')?.inputMode,
      'numeric',
    );
    assert.equal(whatsapp?.configurationMode, 'none');
    assert.equal(whatsapp?.fields.find((field) => field.key === 'allowFrom')?.multiline, true);
    assert.equal(whatsapp?.fields.find((field) => field.key === 'groups')?.multiline, true);
    assert.equal(telegram?.fields.some((field) => field.key === 'contextVisibility'), true);
    assert.equal(whatsapp?.fields.some((field) => field.key === 'contextVisibility'), true);
    assert.equal(sdkworkchat?.fields.some((field) => field.key === 'contextVisibility'), false);
  },
);

await runTest(
  'openClawChannelConfigService writes channel config using native array and object values instead of string blobs',
  () => {
    const root = {
      channels: {},
    };

    channelConfigServiceModule?.saveOpenClawChannelConfigurationToConfigRoot(root, {
      channelId: 'whatsapp',
      enabled: true,
      values: {
        allowFrom: '+15555550123\n+15555550124',
        groups: `{
  "*": {
    "requireMention": true
  }
}`,
      },
    });

    assert.deepEqual(root, {
      channels: {
        whatsapp: {
          allowFrom: ['+15555550123', '+15555550124'],
          groups: {
            '*': {
              requireMention: true,
            },
          },
          enabled: true,
        },
      },
    });
  },
);

await runTest(
  'openClawChannelConfigService builds channel snapshots with stable status and serialized values',
  () => {
    const snapshots =
      channelConfigServiceModule?.buildOpenClawChannelSnapshotsFromConfigRoot({
        channels: {
          telegram: {
            botToken: '123456:telegram-token',
            contextVisibility: 'allowlist_quote',
            enabled: true,
          },
          whatsapp: {
            allowFrom: ['+15555550123'],
            groups: {
              '*': {
                requireMention: true,
              },
            },
          },
        },
      }) || [];

    const sdkworkchat = snapshots.find((channel) => channel.id === 'sdkworkchat');
    const telegram = snapshots.find((channel) => channel.id === 'telegram');
    const whatsapp = snapshots.find((channel) => channel.id === 'whatsapp');

    assert.equal(sdkworkchat?.status, 'connected');
    assert.equal(sdkworkchat?.enabled, true);
    assert.equal(telegram?.configuredFieldCount, 2);
    assert.equal(telegram?.status, 'connected');
    assert.equal(telegram?.values.contextVisibility, 'allowlist_quote');
    assert.equal(whatsapp?.status, 'connected');
    assert.match(whatsapp?.values.allowFrom || '', /\+15555550123/);
    assert.match(whatsapp?.values.groups || '', /requireMention/);
  },
);

await runTest(
  'openClawChannelConfigService toggles channel enabled state directly in a raw config document',
  () => {
    const nextRaw = channelConfigServiceModule?.setOpenClawChannelEnabledInDocument(
      `{
  channels: {
    telegram: {
      botToken: "123456:telegram-token"
    }
  }
}`,
      {
        channelId: 'telegram',
        enabled: false,
      },
    );

    assert.match(nextRaw || '', /"enabled": false/);
    assert.match(nextRaw || '', /botToken/);
  },
);
