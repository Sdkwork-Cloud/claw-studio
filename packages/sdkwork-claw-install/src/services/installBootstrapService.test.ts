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

await runTest('installBootstrapService loads unified bootstrap data for model, channel, and market setup', async () => {
  const { installBootstrapService } = await import('./installBootstrapService.ts');

  const data = await installBootstrapService.loadBootstrapData('local-built-in');

  assert.equal(data.selectedInstanceId, 'local-built-in');
  assert.ok(data.instances.length >= 1);
  assert.ok(data.apiRouterChannels.some((channel) => channel.id === 'openai'));
  assert.ok(data.providers.some((provider) => provider.channelId === 'openai'));
  assert.ok(data.communicationChannels.length >= 1);
  assert.ok(data.packs.length >= 1);
  assert.ok(data.skills.length >= 1);
});

await runTest('installBootstrapService applies provider configuration and binds selected communication channels', async () => {
  const { installBootstrapService } = await import('./installBootstrapService.ts');
  const { studioMockService } = await import('@sdkwork/claw-infrastructure');

  const data = await installBootstrapService.loadBootstrapData('local-built-in');
  const channel = data.communicationChannels.find((item) => item.status === 'not_configured') || data.communicationChannels[0];

  assert.ok(channel);

  const channelValues = Object.fromEntries(
    channel.fields.map((field, index) => [field.key, field.value || `guided-value-${index + 1}`]),
  );

  const result = await installBootstrapService.applyConfiguration({
    instanceId: 'local-built-in',
    provider: {
      channelId: 'openai',
      name: 'Install Wizard OpenAI',
      apiKey: 'sk-guided-openai-123',
      baseUrl: 'https://api.openai.com/v1',
      modelId: 'gpt-4.1',
    },
    communicationChannels: [
      {
        channelId: channel.id,
        values: channelValues,
      },
    ],
  });

  assert.equal(result.instanceId, 'local-built-in');
  assert.equal(result.providerId.length > 0, true);
  assert.equal(result.instanceProviderId.length > 0, true);
  assert.deepEqual(result.configuredChannelIds, [channel.id]);

  const providers = await studioMockService.listProxyProviders('openai');
  assert.equal(providers.some((provider) => provider.id === result.providerId), true);

  const instanceProviders = await studioMockService.listInstanceLlmProviders('local-built-in');
  const configuredProvider = instanceProviders.find((provider) => provider.id === result.instanceProviderId);
  assert.ok(configuredProvider);
  assert.equal(configuredProvider?.defaultModelId, 'gpt-4.1');

  const configuredChannels = await studioMockService.listChannels('local-built-in');
  const configuredChannel = configuredChannels.find((item) => item.id === channel.id);
  assert.equal(configuredChannel?.enabled, true);
  assert.equal(configuredChannel?.status, 'connected');
});

await runTest('installBootstrapService initializes selected packs and standalone skills without duplicates', async () => {
  const { installBootstrapService } = await import('./installBootstrapService.ts');

  const data = await installBootstrapService.loadBootstrapData('local-built-in');
  const pack = data.packs[0];
  const duplicateSkill = pack.skills[0];

  assert.ok(pack);
  assert.ok(duplicateSkill);

  const result = await installBootstrapService.initializeInstance({
    instanceId: 'local-built-in',
    packIds: [pack.id],
    skillIds: [duplicateSkill.id],
  });

  assert.deepEqual(result.installedPackIds, [pack.id]);
  assert.equal(result.installedSkillIds.includes(duplicateSkill.id), true);
  assert.equal(result.installedSkillIds.length, new Set(result.installedSkillIds).size);
});
