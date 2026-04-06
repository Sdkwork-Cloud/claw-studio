import assert from 'node:assert/strict';
import { createProviderConfigCenterService } from './providerConfigCenterService.ts';
import {
  appendProviderConfigModelRow,
  applyProviderConfigKnownProviderSelection,
  applyProviderConfigFormBaseUrlInput,
  applyProviderConfigFormClientProtocolInput,
  applyProviderConfigFormProviderIdInput,
  applyProviderConfigFormUpstreamProtocolInput,
  createProviderConfigDraftFromForm,
  createProviderConfigFormState,
  findProviderConfigKnownProviderOption,
  listProviderConfigModelRows,
  listProviderConfigKnownProviderOptions,
  moveProviderConfigModelRow,
  removeProviderConfigModelRow,
  updateProviderConfigModelRow,
} from './providerConfigEditorPolicy.ts';

async function runTest(name: string, callback: () => Promise<void> | void) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

await runTest('provider config editor policy initializes native anthropic and gemini presets', () => {
  const service = createProviderConfigCenterService();
  const presets = service.listPresets();
  const anthropicPreset = presets.find((preset) => preset.id === 'anthropic');
  const geminiPreset = presets.find((preset) => preset.id === 'gemini');

  const anthropicState = createProviderConfigFormState(anthropicPreset?.draft);
  const geminiState = createProviderConfigFormState(geminiPreset?.draft);

  assert.equal(anthropicState.clientProtocol, 'anthropic');
  assert.equal(anthropicState.upstreamProtocol, 'anthropic');
  assert.equal(anthropicState.baseUrl, 'https://api.anthropic.com/v1');

  assert.equal(geminiState.clientProtocol, 'gemini');
  assert.equal(geminiState.upstreamProtocol, 'gemini');
  assert.equal(geminiState.baseUrl, 'https://generativelanguage.googleapis.com');
});

await runTest(
  'provider config editor policy auto-updates inferred protocols and base URL when provider id changes',
  () => {
    const service = createProviderConfigCenterService();
    const presets = service.listPresets();
    const openaiPreset = presets.find((preset) => preset.id === 'openai');

    const nextState = applyProviderConfigFormProviderIdInput(
      createProviderConfigFormState(openaiPreset?.draft),
      'anthropic',
      presets,
    );

    assert.equal(nextState.presetId, '');
    assert.equal(nextState.providerId, 'anthropic');
    assert.equal(nextState.clientProtocol, 'anthropic');
    assert.equal(nextState.upstreamProtocol, 'anthropic');
    assert.equal(nextState.baseUrl, 'https://api.anthropic.com/v1');
  },
);

await runTest(
  'provider config editor policy preserves manually overridden protocols and base URL during provider id changes',
  () => {
    const service = createProviderConfigCenterService();
    const presets = service.listPresets();
    const openaiPreset = presets.find((preset) => preset.id === 'openai');

    let state = createProviderConfigFormState(openaiPreset?.draft);
    state = applyProviderConfigFormClientProtocolInput(state, 'openai-compatible');
    state = applyProviderConfigFormUpstreamProtocolInput(state, 'anthropic');
    state = applyProviderConfigFormBaseUrlInput(state, 'https://proxy.example.com/v1');
    state = applyProviderConfigFormProviderIdInput(state, 'google', presets);

    assert.equal(state.providerId, 'google');
    assert.equal(state.clientProtocol, 'openai-compatible');
    assert.equal(state.upstreamProtocol, 'anthropic');
    assert.equal(state.baseUrl, 'https://proxy.example.com/v1');
  },
);

await runTest(
  'provider config editor policy applies generated local proxy template presets for broader provider families',
  () => {
    const service = createProviderConfigCenterService();
    const presets = service.listPresets();

    const state = applyProviderConfigFormProviderIdInput(
      createProviderConfigFormState(),
      'baichuan',
      presets,
    );

    assert.equal(state.providerId, 'baichuan');
    assert.equal(state.clientProtocol, 'openai-compatible');
    assert.equal(state.upstreamProtocol, 'openai-compatible');
    assert.equal(state.baseUrl, 'https://ai.sdkwork.com');
  },
);

await runTest(
  'provider config editor policy synthesizes models from default, reasoning, and embedding ids when models text is empty',
  () => {
    const draft = createProviderConfigDraftFromForm({
      ...createProviderConfigFormState(),
      name: 'Meta Llama Route',
      providerId: 'meta',
      baseUrl: 'https://ai.sdkwork.com',
      defaultModelId: 'llama-4-maverick',
      reasoningModelId: 'llama-4-scout',
      embeddingModelId: 'text-embedding-3-large',
      modelsText: '',
    });

    assert.deepEqual(draft.models, [
      { id: 'llama-4-maverick', name: 'llama-4-maverick' },
      { id: 'llama-4-scout', name: 'llama-4-scout' },
      { id: 'text-embedding-3-large', name: 'text-embedding-3-large' },
    ]);
  },
);

await runTest(
  'provider config editor policy preserves named models and appends referenced model ids that are missing from models text',
  () => {
    const draft = createProviderConfigDraftFromForm({
      ...createProviderConfigFormState(),
      name: 'Qwen Route',
      providerId: 'qwen',
      baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      defaultModelId: 'qwen-max',
      reasoningModelId: 'qwq-plus',
      embeddingModelId: 'text-embedding-v4',
      modelsText: 'qwen-max=Qwen Max',
    });

    assert.deepEqual(draft.models, [
      { id: 'qwen-max', name: 'Qwen Max' },
      { id: 'qwq-plus', name: 'qwq-plus' },
      { id: 'text-embedding-v4', name: 'text-embedding-v4' },
    ]);
  },
);

await runTest(
  'provider config editor policy exposes known provider catalog options with unified metadata for editor selection',
  () => {
    const service = createProviderConfigCenterService();
    const presets = service.listPresets();

    const options = listProviderConfigKnownProviderOptions(presets);
    const sdkworkOption = options.find((option) => option.id === 'sdkwork');
    const geminiOption = options.find((option) => option.id === 'gemini');
    const metaOption = options.find((option) => option.id === 'meta');

    assert.ok(sdkworkOption);
    assert.equal(sdkworkOption.label, 'SDKWork');
    assert.equal(sdkworkOption.providerId, 'sdkwork');
    assert.equal(sdkworkOption.vendor, 'SDKWork');
    assert.equal(sdkworkOption.modelFamily, 'GPT / Claude / Gemini / DeepSeek');
    assert.equal(sdkworkOption.clientProtocol, 'openai-compatible');
    assert.equal(sdkworkOption.upstreamProtocol, 'sdkwork');
    assert.equal(sdkworkOption.baseUrl, 'https://ai.sdkwork.com');

    assert.ok(geminiOption);
    assert.equal(geminiOption.label, 'Gemini');
    assert.equal(geminiOption.providerId, 'google');
    assert.equal(geminiOption.vendor, 'Google DeepMind');
    assert.equal(geminiOption.modelFamily, 'Gemini 2.x');
    assert.equal(geminiOption.clientProtocol, 'gemini');
    assert.equal(geminiOption.upstreamProtocol, 'gemini');
    assert.equal(geminiOption.baseUrl, 'https://generativelanguage.googleapis.com');

    assert.ok(metaOption);
    assert.equal(metaOption.providerId, 'meta');
    assert.equal(metaOption.vendor, 'Meta AI');
    assert.equal(metaOption.modelFamily, 'Llama 4 / Llama 3');
    assert.equal(metaOption.clientProtocol, 'openai-compatible');
    assert.equal(metaOption.upstreamProtocol, 'openai-compatible');
    assert.equal(metaOption.baseUrl, 'https://ai.sdkwork.com');
  },
);

await runTest(
  'provider config editor policy prioritizes SDKWork first and keeps MiniMax and Moonshot ahead of Qwen',
  () => {
    const service = createProviderConfigCenterService();
    const presets = service.listPresets();

    const leadingProviderIds = listProviderConfigKnownProviderOptions(presets)
      .slice(0, 10)
      .map((option) => option.providerId);

    assert.deepEqual(leadingProviderIds, [
      'sdkwork',
      'openai',
      'anthropic',
      'google',
      'xai',
      'azure-openai',
      'openrouter',
      'deepseek',
      'minimax',
      'moonshot',
    ]);
  },
);

await runTest(
  'provider config editor policy resolves known provider metadata for canonical and preset ids',
  () => {
    const service = createProviderConfigCenterService();
    const presets = service.listPresets();

    const geminiByCanonicalProviderId = findProviderConfigKnownProviderOption('google', presets);
    const geminiByPresetId = findProviderConfigKnownProviderOption('gemini', presets);

    assert.equal(geminiByCanonicalProviderId?.id, 'gemini');
    assert.equal(geminiByPresetId?.id, 'gemini');
    assert.equal(geminiByCanonicalProviderId?.providerId, 'google');
  },
);

await runTest(
  'provider config editor policy applies known provider selections using canonical provider ids',
  () => {
    const service = createProviderConfigCenterService();
    const presets = service.listPresets();

    const state = applyProviderConfigKnownProviderSelection(
      createProviderConfigFormState(),
      'gemini',
      presets,
    );

    assert.equal(state.providerId, 'google');
    assert.equal(state.clientProtocol, 'gemini');
    assert.equal(state.upstreamProtocol, 'gemini');
    assert.equal(state.baseUrl, 'https://generativelanguage.googleapis.com');
  },
);

await runTest(
  'provider config editor policy coerces upstream-only client protocol inputs back to a supported local proxy protocol',
  () => {
    const service = createProviderConfigCenterService();
    const presets = service.listPresets();
    const openaiPreset = presets.find((preset) => preset.id === 'openai');

    const state = applyProviderConfigFormClientProtocolInput(
      createProviderConfigFormState(openaiPreset?.draft),
      'sdkwork',
    );

    assert.equal(state.clientProtocol, 'openai-compatible');
    assert.equal(state.clientProtocolMode, 'manual');
  },
);

await runTest(
  'provider config editor policy manages models as appendable, editable, and reorderable rows',
  () => {
    let state = createProviderConfigFormState({
      models: [{ id: 'gpt-5.4', name: 'GPT-5.4' }],
    });

    state = appendProviderConfigModelRow(state);
    state = updateProviderConfigModelRow(state, 1, {
      id: 'gpt-5.4-mini',
      name: 'GPT-5.4 mini',
    });
    state = moveProviderConfigModelRow(state, 1, 'up');

    assert.deepEqual(listProviderConfigModelRows(state), [
      { id: 'gpt-5.4-mini', name: 'GPT-5.4 mini' },
      { id: 'gpt-5.4', name: 'GPT-5.4' },
    ]);
  },
);

await runTest(
  'provider config editor policy keeps default, reasoning, and embedding selections in sync with model row edits',
  () => {
    let state = createProviderConfigFormState({
      defaultModelId: 'gpt-5.4',
      reasoningModelId: 'o4-mini',
      embeddingModelId: 'text-embedding-3-large',
      models: [
        { id: 'gpt-5.4', name: 'GPT-5.4' },
        { id: 'o4-mini', name: 'o4-mini' },
        { id: 'text-embedding-3-large', name: 'text-embedding-3-large' },
      ],
    });

    state = updateProviderConfigModelRow(state, 0, {
      id: 'gpt-5.4-extended',
      name: 'GPT-5.4 extended',
    });
    state = removeProviderConfigModelRow(state, 1);
    state = removeProviderConfigModelRow(state, 1);

    assert.equal(state.defaultModelId, 'gpt-5.4-extended');
    assert.equal(state.reasoningModelId, '');
    assert.equal(state.embeddingModelId, '');
    assert.deepEqual(listProviderConfigModelRows(state), [
      { id: 'gpt-5.4-extended', name: 'GPT-5.4 extended' },
    ]);
  },
);
