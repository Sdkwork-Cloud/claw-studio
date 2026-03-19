import assert from 'node:assert/strict';
import type { ProxyProvider } from '@sdkwork/claw-types';

async function runTest(name: string, callback: () => Promise<void> | void) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

function createProvider(overrides: Partial<ProxyProvider> = {}): ProxyProvider {
  return {
    id: 'provider-form-test',
    channelId: 'openai',
    name: 'OpenAI Direct',
    apiKey: 'sk-live-form-001',
    groupId: 'team-ops',
    usage: {
      requestCount: 100,
      tokenCount: 2000,
      spendUsd: 2.5,
      period: '30d',
    },
    expiresAt: '2026-04-01T23:59:59.000Z',
    status: 'active',
    createdAt: '2026-03-18T00:00:00.000Z',
    baseUrl: 'https://api.openai.com/v1',
    models: [
      {
        id: 'gpt-4.1',
        name: 'GPT-4.1',
      },
    ],
    notes: 'edit fixture',
    ...overrides,
  };
}

await runTest('proxyProviderFormService seeds create and edit form state with structured models', async () => {
  const {
    buildCreateProviderFormState,
    buildEditProviderFormState,
  } = await import('./proxyProviderFormService.ts');

  const createState = buildCreateProviderFormState({
    channelId: 'openai',
    groupId: 'sandbox-lab',
    baseUrl: 'https://router.example.com/v1',
    models: [
      {
        id: 'gpt-4.1-mini',
        name: 'GPT-4.1 Mini',
      },
    ],
  });

  assert.equal(createState.groupId, 'sandbox-lab');
  assert.equal(createState.baseUrl, 'https://router.example.com/v1');
  assert.deepEqual(createState.models, [
    {
      id: 'gpt-4.1-mini',
      name: 'GPT-4.1 Mini',
    },
  ]);

  const editState = buildEditProviderFormState(createProvider());
  assert.equal(editState.name, 'OpenAI Direct');
  assert.equal(editState.expiresAt, '2026-04-01');
  assert.deepEqual(editState.models, [
    {
      id: 'gpt-4.1',
      name: 'GPT-4.1',
    },
  ]);
});

await runTest('proxyProviderFormService normalizes trimmed form input and ignores fully empty draft model rows', async () => {
  const { normalizeProviderFormState } = await import('./proxyProviderFormService.ts');

  const normalized = normalizeProviderFormState({
    name: '  Burst Key  ',
    apiKey: '  sk-test-001  ',
    groupId: 'sandbox-lab',
    baseUrl: '  https://router.example.com/v1  ',
    models: [
      { id: '  gpt-4.1-mini  ', name: '  GPT-4.1 Mini  ' },
      { id: '', name: '' },
    ],
    expiresAt: '2026-08-01',
    notes: '  test notes  ',
  });

  assert.deepEqual(normalized, {
    name: 'Burst Key',
    apiKey: 'sk-test-001',
    groupId: 'sandbox-lab',
    baseUrl: 'https://router.example.com/v1',
    models: [
      {
        id: 'gpt-4.1-mini',
        name: 'GPT-4.1 Mini',
      },
    ],
    expiresAt: '2026-08-01T23:59:59.000Z',
    notes: 'test notes',
  });
});

await runTest('proxyProviderFormService rejects partial model rows and keeps at least one draft model row after removal', async () => {
  const {
    createEmptyProviderFormState,
    normalizeProviderFormState,
    removeProviderFormModel,
  } = await import('./proxyProviderFormService.ts');

  const empty = createEmptyProviderFormState();
  assert.equal(empty.models.length, 1);

  const invalid = normalizeProviderFormState({
    ...empty,
    name: 'Broken Key',
    apiKey: 'sk-broken',
    groupId: 'team-ops',
    baseUrl: 'https://router.example.com/v1',
    models: [
      {
        id: 'gpt-4.1',
        name: '',
      },
    ],
  });

  assert.equal(invalid, null);

  const remaining = removeProviderFormModel([
    { id: 'gpt-4.1', name: 'GPT-4.1' },
  ], 0);
  assert.deepEqual(remaining, [
    {
      id: '',
      name: '',
    },
  ]);
});
