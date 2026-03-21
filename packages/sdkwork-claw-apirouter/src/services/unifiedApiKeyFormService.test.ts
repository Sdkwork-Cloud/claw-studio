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

await runTest('unifiedApiKeyFormService seeds empty form state for first-key creation', async () => {
  const { createEmptyUnifiedApiKeyFormState } = await import('./unifiedApiKeyFormService.ts');

  assert.deepEqual(createEmptyUnifiedApiKeyFormState(), {
    name: '',
    keyMode: 'system-generated',
    apiKey: '',
    groupId: '',
    groupName: '',
    expiresAt: '',
    notes: '',
  });
});

await runTest('unifiedApiKeyFormService normalizes a first-key form by promoting the freeform group name', async () => {
  const { normalizeUnifiedApiKeyFormState } = await import('./unifiedApiKeyFormService.ts');

  assert.deepEqual(
    normalizeUnifiedApiKeyFormState({
      name: '  First Global Key  ',
      keyMode: 'system-generated',
      apiKey: '',
      groupId: '',
      groupName: '  Acme Workspace  ',
      expiresAt: '',
      notes: '  bootstraps the first tenant  ',
    }),
    {
      name: 'First Global Key',
      source: 'system-generated',
      apiKey: undefined,
      groupId: '',
      groupName: 'Acme Workspace',
      expiresAt: null,
      notes: 'bootstraps the first tenant',
    },
  );
});

await runTest('unifiedApiKeyFormService still requires either a selected group or a freeform group name', async () => {
  const { normalizeUnifiedApiKeyFormState } = await import('./unifiedApiKeyFormService.ts');

  assert.equal(
    normalizeUnifiedApiKeyFormState({
      name: 'Missing Group',
      keyMode: 'system-generated',
      apiKey: '',
      groupId: '',
      groupName: '   ',
      expiresAt: '',
      notes: '',
    }),
    null,
  );
});
