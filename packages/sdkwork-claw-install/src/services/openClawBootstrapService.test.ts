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

await runTest('openClawBootstrapService loads instances, compatible providers, channels, packs, and skills', async () => {
  const { openClawBootstrapService } = await import('./openClawBootstrapService.ts');

  const data = await openClawBootstrapService.loadBootstrapData('local-built-in');

  assert.equal(data.selectedInstanceId, 'local-built-in');
  assert.ok(data.instances.length >= 1);
  assert.ok(data.providers.length >= 1);
  assert.ok(data.providers.every((provider) => ['openai', 'anthropic', 'xai', 'deepseek', 'qwen', 'zhipu', 'baidu', 'tencent-hunyuan', 'doubao', 'moonshot', 'stepfun', 'iflytek-spark', 'minimax'].includes(provider.channelId)));
  assert.ok(data.channels.length >= 1);
  assert.ok(data.packs.length >= 1);
  assert.ok(data.skills.length >= 1);
});

await runTest('openClawBootstrapService applies provider and channel configuration to the selected instance', async () => {
  const { openClawBootstrapService } = await import('./openClawBootstrapService.ts');
  const { studioMockService } = await import('@sdkwork/claw-infrastructure');

  const data = await openClawBootstrapService.loadBootstrapData('local-built-in');
  const provider = data.providers[0];
  const channel = data.channels.find((item) => item.status === 'not_configured') || data.channels[0];

  assert.ok(provider);
  assert.ok(channel);

  const channelValues = Object.fromEntries(
    channel.fields.map((field, index) => [field.key, field.value || `wizard-value-${index + 1}`]),
  );

  const result = await openClawBootstrapService.applyConfiguration({
    instanceId: 'local-built-in',
    providerId: provider.id,
    modelSelection: {
      defaultModelId: provider.models[0]?.id || 'model-id',
      reasoningModelId: provider.models[1]?.id,
      embeddingModelId: provider.models.find((model) => /embed/i.test(`${model.id} ${model.name}`))?.id,
    },
    channels: [
      {
        channelId: channel.id,
        values: channelValues,
      },
    ],
  });

  assert.equal(result.instanceId, 'local-built-in');
  assert.deepEqual(result.configuredChannelIds, [channel.id]);

  const providers = await studioMockService.listInstanceLlmProviders('local-built-in');
  const configuredProvider = providers.find((item) => item.id === `provider-api-router-${provider.id}`);
  assert.ok(configuredProvider);
  assert.equal(configuredProvider?.defaultModelId, provider.models[0]?.id);

  const channels = await studioMockService.listChannels('local-built-in');
  const configuredChannel = channels.find((item) => item.id === channel.id);
  assert.equal(configuredChannel?.status, 'connected');
  assert.equal(configuredChannel?.enabled, true);
});

await runTest('openClawBootstrapService initializes selected packs and skills without double-counting duplicate skills', async () => {
  const { openClawBootstrapService } = await import('./openClawBootstrapService.ts');

  const data = await openClawBootstrapService.loadBootstrapData('local-built-in');
  const pack = data.packs[0];
  const duplicateSkill = pack.skills[0];

  assert.ok(pack);
  assert.ok(duplicateSkill);

  const result = await openClawBootstrapService.initializeOpenClawInstance({
    instanceId: 'local-built-in',
    packIds: [pack.id],
    skillIds: [duplicateSkill.id],
  });

  assert.deepEqual(result.installedPackIds, [pack.id]);
  assert.equal(result.installedSkillIds.includes(duplicateSkill.id), true);
  assert.equal(result.installedSkillIds.length, new Set(result.installedSkillIds).size);
});

await runTest('openClawBootstrapService builds a verification snapshot from the applied bootstrap state', async () => {
  const { openClawBootstrapService } = await import('./openClawBootstrapService.ts');

  const data = await openClawBootstrapService.loadBootstrapData('local-built-in');
  const pack = data.packs[0];
  const selectedSkillIds = pack.skills.map((skill) => skill.id);
  const selectedChannelIds = data.channels.slice(0, 1).map((channel) => channel.id);

  const snapshot = await openClawBootstrapService.loadVerificationSnapshot({
    instanceId: 'local-built-in',
    selectedChannelIds,
    packIds: [pack.id],
    skillIds: selectedSkillIds,
  });

  assert.equal(snapshot.instanceId, 'local-built-in');
  assert.equal(snapshot.installSucceeded, true);
  assert.equal(typeof snapshot.hasReadyProvider, 'boolean');
  assert.ok(snapshot.initializedSkillCount >= pack.skills.length);
  assert.ok(snapshot.configuredChannelCount >= 0);
});
