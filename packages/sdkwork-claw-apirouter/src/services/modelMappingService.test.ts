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

await runTest('modelMappingService exposes the mapping and catalog service surface', async () => {
  let module: typeof import('./modelMappingService.ts');

  try {
    module = await import('./modelMappingService.ts');
  } catch (error) {
    assert.fail(`modelMappingService module is missing: ${String(error)}`);
  }

  assert.equal(typeof module.modelMappingService.getModelMappings, 'function');
  assert.equal(typeof module.modelMappingService.createModelMapping, 'function');
  assert.equal(typeof module.modelMappingService.updateModelMapping, 'function');
  assert.equal(typeof module.modelMappingService.updateStatus, 'function');
  assert.equal(typeof module.modelMappingService.deleteModelMapping, 'function');
  assert.equal(typeof module.modelMappingService.getModelCatalog, 'function');
});

await runTest('modelMappingService lists catalog entries and filters mappings by keyword', async () => {
  const { modelMappingService } = await import('./modelMappingService.ts');

  const catalog = await modelMappingService.getModelCatalog();
  const allItems = await modelMappingService.getModelMappings();
  const filtered = await modelMappingService.getModelMappings({
    keyword: 'gemini',
  });

  assert.equal(catalog.length > 0, true);
  assert.equal(catalog.some((channel) => channel.channelId === 'openai'), true);
  assert.equal(catalog.some((channel) => channel.channelId === 'google'), true);
  assert.equal(allItems.length > 0, true);
  assert.equal(filtered.length > 0, true);
  assert.equal(
    filtered.every((item) =>
      [item.name, item.description, ...item.rules.flatMap((rule) => [
        rule.source.channelName,
        rule.source.modelName,
        rule.target.channelName,
        rule.target.modelName,
      ])]
        .join(' ')
        .toLowerCase()
        .includes('gemini'),
    ),
    true,
  );
});

await runTest('modelMappingService creates, updates, toggles, and deletes mappings', async () => {
  const { modelMappingService } = await import('./modelMappingService.ts');
  const before = await modelMappingService.getModelMappings();

  const created = await modelMappingService.createModelMapping({
    name: 'Router Mapping Test',
    description: 'Created by model mapping service test.',
    effectiveFrom: '2026-03-20T00:00:00.000Z',
    effectiveTo: '2026-10-01T23:59:59.000Z',
    rules: [
      {
        source: {
          channelId: 'openai',
          channelName: 'OpenAI',
          modelId: 'gpt-4.1',
          modelName: 'GPT-4.1',
        },
        target: {
          channelId: 'anthropic',
          channelName: 'Anthropic',
          modelId: 'claude-sonnet-4',
          modelName: 'Claude Sonnet 4',
        },
      },
    ],
  });

  assert.equal(created.name, 'Router Mapping Test');
  assert.equal(created.rules.length, 1);
  assert.equal(created.status, 'active');

  const updated = await modelMappingService.updateModelMapping(created.id, {
    description: 'Updated by model mapping service test.',
    rules: [
      {
        id: created.rules[0]?.id,
        source: {
          channelId: 'google',
          channelName: 'Google',
          modelId: 'gemini-2.5-pro',
          modelName: 'Gemini 2.5 Pro',
        },
        target: {
          channelId: 'openai',
          channelName: 'OpenAI',
          modelId: 'gpt-4.1-mini',
          modelName: 'GPT-4.1 Mini',
        },
      },
    ],
  });

  assert.equal(updated.description, 'Updated by model mapping service test.');
  assert.equal(updated.rules[0]?.source.modelId, 'gemini-2.5-pro');
  assert.equal(updated.rules[0]?.target.modelId, 'gpt-4.1-mini');

  const disabled = await modelMappingService.updateStatus(created.id, 'disabled');
  assert.equal(disabled.status, 'disabled');

  const deleted = await modelMappingService.deleteModelMapping(created.id);
  assert.equal(deleted, true);

  const after = await modelMappingService.getModelMappings();
  assert.equal(after.length, before.length);
  assert.equal(after.some((item) => item.id === created.id), false);
});
