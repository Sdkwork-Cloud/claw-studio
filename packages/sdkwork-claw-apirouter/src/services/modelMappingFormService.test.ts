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

await runTest('modelMappingFormService seeds empty and edit form state with rule snapshots', async () => {
  const {
    buildEditModelMappingFormState,
    createEmptyModelMappingFormState,
  } = await import('./modelMappingFormService.ts');

  const empty = createEmptyModelMappingFormState();
  assert.equal(empty.rules.length, 1);

  const edit = buildEditModelMappingFormState({
    id: 'mapping-edit-fixture',
    name: 'Primary Assistant Mapping',
    description: 'Edit fixture',
    status: 'active',
    effectiveFrom: '2026-03-20T00:00:00.000Z',
    effectiveTo: '2026-09-30T23:59:59.000Z',
    createdAt: '2026-03-19T10:00:00.000Z',
    rules: [
      {
        id: 'rule-edit-fixture',
        source: {
          channelId: 'openai',
          channelName: 'OpenAI',
          modelId: 'gpt-4.1',
          modelName: 'GPT-4.1',
        },
        target: {
          channelId: 'google',
          channelName: 'Google',
          modelId: 'gemini-2.5-pro',
          modelName: 'Gemini 2.5 Pro',
        },
      },
    ],
  });

  assert.equal(edit.name, 'Primary Assistant Mapping');
  assert.equal(edit.effectiveFrom, '2026-03-20');
  assert.equal(edit.effectiveTo, '2026-09-30');
  assert.equal(edit.rules[0]?.source?.modelId, 'gpt-4.1');
  assert.equal(edit.rules[0]?.target?.modelId, 'gemini-2.5-pro');
});

await runTest('modelMappingFormService normalizes valid form input and trims nested model references', async () => {
  const { normalizeModelMappingFormState } = await import('./modelMappingFormService.ts');

  const normalized = normalizeModelMappingFormState({
    name: '  Routing Map  ',
    description: '  Test mapping  ',
    effectiveFrom: '2026-03-20',
    effectiveTo: '2026-12-31',
    rules: [
      {
        id: 'rule-1',
        source: {
          channelId: 'openai',
          channelName: '  OpenAI  ',
          modelId: '  gpt-4.1  ',
          modelName: '  GPT-4.1  ',
        },
        target: {
          channelId: 'anthropic',
          channelName: '  Anthropic  ',
          modelId: '  claude-sonnet-4  ',
          modelName: '  Claude Sonnet 4  ',
        },
      },
      {
        id: 'rule-empty',
        source: null,
        target: null,
      },
    ],
  });

  assert.deepEqual(normalized, {
    name: 'Routing Map',
    description: 'Test mapping',
    effectiveFrom: '2026-03-20T00:00:00.000Z',
    effectiveTo: '2026-12-31T23:59:59.000Z',
    rules: [
      {
        id: 'rule-1',
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
});

await runTest('modelMappingFormService rejects invalid ranges, incomplete rules, and duplicate source models', async () => {
  const {
    appendModelMappingRule,
    createEmptyModelMappingFormState,
    normalizeModelMappingFormState,
    removeModelMappingRule,
  } = await import('./modelMappingFormService.ts');

  const empty = createEmptyModelMappingFormState();
  const appended = appendModelMappingRule(empty.rules);
  assert.equal(appended.length, 2);

  const invalidRange = normalizeModelMappingFormState({
    ...empty,
    name: 'Broken',
    description: '',
    effectiveFrom: '2026-09-01',
    effectiveTo: '2026-08-01',
    rules: [
      {
        id: 'rule-range',
        source: {
          channelId: 'openai',
          channelName: 'OpenAI',
          modelId: 'gpt-4.1',
          modelName: 'GPT-4.1',
        },
        target: {
          channelId: 'google',
          channelName: 'Google',
          modelId: 'gemini-2.5-pro',
          modelName: 'Gemini 2.5 Pro',
        },
      },
    ],
  });
  assert.equal(invalidRange, null);

  const incompleteRule = normalizeModelMappingFormState({
    ...empty,
    name: 'Broken',
    description: '',
    effectiveFrom: '2026-08-01',
    effectiveTo: '2026-09-01',
    rules: [
      {
        id: 'rule-incomplete',
        source: {
          channelId: 'openai',
          channelName: 'OpenAI',
          modelId: 'gpt-4.1',
          modelName: 'GPT-4.1',
        },
        target: null,
      },
    ],
  });
  assert.equal(incompleteRule, null);

  const duplicateSource = normalizeModelMappingFormState({
    ...empty,
    name: 'Broken',
    description: '',
    effectiveFrom: '2026-08-01',
    effectiveTo: '2026-09-01',
    rules: [
      {
        id: 'rule-1',
        source: {
          channelId: 'openai',
          channelName: 'OpenAI',
          modelId: 'gpt-4.1',
          modelName: 'GPT-4.1',
        },
        target: {
          channelId: 'google',
          channelName: 'Google',
          modelId: 'gemini-2.5-pro',
          modelName: 'Gemini 2.5 Pro',
        },
      },
      {
        id: 'rule-2',
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
  assert.equal(duplicateSource, null);

  const remaining = removeModelMappingRule([
    {
      id: 'rule-only',
      source: null,
      target: null,
    },
  ], 0);
  assert.deepEqual(remaining, [
    {
      id: '',
      source: null,
      target: null,
    },
  ]);
});
