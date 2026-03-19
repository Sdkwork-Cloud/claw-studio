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

await runTest('unifiedApiKeyService exposes an independent global API key service surface', async () => {
  let module: typeof import('./unifiedApiKeyService.ts');

  try {
    module = await import('./unifiedApiKeyService.ts');
  } catch (error) {
    assert.fail(`unifiedApiKeyService module is missing: ${String(error)}`);
  }

  assert.equal(typeof module.unifiedApiKeyService.getUnifiedApiKeys, 'function');
  assert.equal(typeof module.unifiedApiKeyService.createUnifiedApiKey, 'function');
  assert.equal(typeof module.unifiedApiKeyService.updateUnifiedApiKey, 'function');
  assert.equal(typeof module.unifiedApiKeyService.updateGroup, 'function');
  assert.equal(typeof module.unifiedApiKeyService.updateStatus, 'function');
  assert.equal(typeof module.unifiedApiKeyService.deleteUnifiedApiKey, 'function');
  assert.equal(typeof module.unifiedApiKeyService.assignModelMapping, 'function');
});

await runTest('unifiedApiKeyService creates system-generated keys by default without route-config fields', async () => {
  const { unifiedApiKeyService } = await import('./unifiedApiKeyService.ts');
  const before = await unifiedApiKeyService.getUnifiedApiKeys();

  const created = await unifiedApiKeyService.createUnifiedApiKey({
    name: 'Global Router Default Key',
    groupId: 'team-ops',
    expiresAt: '2026-12-31T23:59:59.000Z',
    notes: 'Generated from unified API key create flow test.',
  });

  assert.equal(created.name, 'Global Router Default Key');
  assert.equal(created.groupId, 'team-ops');
  assert.equal(created.source, 'system-generated');
  assert.match(created.apiKey, /^sk-ar-v1-[a-z0-9]{32}$/);
  assert.equal(created.status, 'active');
  assert.equal(typeof (created as { channelId?: string }).channelId, 'undefined');
  assert.equal(typeof (created as { baseUrl?: string }).baseUrl, 'undefined');
  assert.equal(Array.isArray((created as { models?: unknown[] }).models), false);

  const after = await unifiedApiKeyService.getUnifiedApiKeys();
  assert.equal(after.length, before.length + 1);
  assert.equal(after.some((item) => item.id === created.id), true);
});

await runTest('unifiedApiKeyService supports custom keys and keeps them isolated from proxy providers', async () => {
  const { unifiedApiKeyService } = await import('./unifiedApiKeyService.ts');
  const { apiRouterService } = await import('./apiRouterService.ts');
  const beforeProviders = await apiRouterService.getProxyProviders({ channelId: 'openai' });

  const created = await unifiedApiKeyService.createUnifiedApiKey({
    name: 'Partner Custom Key',
    groupId: 'client-vip',
    apiKey: 'sk-ar-v1-partnercustomkey000000000001',
    source: 'custom',
    notes: 'Manually supplied by customer success.',
  });

  assert.equal(created.source, 'custom');
  assert.equal(created.apiKey, 'sk-ar-v1-partnercustomkey000000000001');

  const updated = await unifiedApiKeyService.updateUnifiedApiKey(created.id, {
    name: 'Partner Custom Key Updated',
    groupId: 'shared-core',
  });

  assert.equal(updated.name, 'Partner Custom Key Updated');
  assert.equal(updated.groupId, 'shared-core');

  const afterProviders = await apiRouterService.getProxyProviders({ channelId: 'openai' });
  assert.deepEqual(afterProviders, beforeProviders);

  const disabled = await unifiedApiKeyService.updateStatus(created.id, 'disabled');
  assert.equal(disabled.status, 'disabled');

  const deleted = await unifiedApiKeyService.deleteUnifiedApiKey(created.id);
  assert.equal(deleted, true);
});

await runTest('unifiedApiKeyService can associate exactly one model mapping with a key and clear it later', async () => {
  const { unifiedApiKeyService } = await import('./unifiedApiKeyService.ts');
  const { modelMappingService } = await import('./modelMappingService.ts');

  const keys = await unifiedApiKeyService.getUnifiedApiKeys();
  const mappings = await modelMappingService.getModelMappings();
  const key = keys[0];
  const mapping = mappings[0];

  assert.ok(key);
  assert.ok(mapping);

  const associated = await unifiedApiKeyService.assignModelMapping(key.id, mapping.id);
  assert.equal(associated.modelMappingId, mapping.id);

  const cleared = await unifiedApiKeyService.assignModelMapping(key.id, null);
  assert.equal(cleared.modelMappingId ?? null, null);
});
