import assert from 'node:assert/strict';
import {
  buildOpenClawAgentInputFromForm,
  buildOpenClawAgentParamEntries,
  createOpenClawAgentFormState,
} from './openClawAgentPresentation.ts';
import type { InstanceWorkbenchAgent } from '../types/index.ts';

async function runTest(name: string, callback: () => void | Promise<void>) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

function createWorkbenchAgent(
  overrides: Partial<InstanceWorkbenchAgent> = {},
): InstanceWorkbenchAgent {
  return {
    agent: {
      id: 'ops',
      name: 'Ops',
      description: 'Operations agent.',
      avatar: 'O',
      systemPrompt: 'Handle incidents.',
      creator: 'OpenClaw',
    },
    focusAreas: ['Operations'],
    automationFitScore: 82,
    workspace: 'D:/OpenClaw/.openclaw/workspace',
    agentDir: 'D:/OpenClaw/.openclaw/agents/ops/agent',
    isDefault: true,
    model: {
      primary: 'openai/gpt-5.4',
      fallbacks: ['openai/gpt-4.1'],
    },
    params: {
      temperature: 0.4,
      topP: 0.9,
      timeoutMs: 90000,
      streaming: false,
    },
    paramSources: {
      temperature: 'defaults',
      topP: 'agent',
      timeoutMs: 'defaults',
      streaming: 'defaults',
    },
    configSource: 'managedConfig',
    ...overrides,
  };
}

await runTest(
  'createOpenClawAgentFormState keeps defaults-sourced agent fields inherited instead of copying them into explicit edits',
  () => {
    const draft = createOpenClawAgentFormState(createWorkbenchAgent(), 'defaults');

    assert.equal(draft.primaryModel, '');
    assert.equal(draft.fallbackModelsText, '');
    assert.equal(draft.fieldSources.model, 'defaults');
    assert.equal(draft.inherited.primaryModel, 'openai/gpt-5.4');
    assert.equal(draft.inherited.fallbackModelsText, 'openai/gpt-4.1');

    assert.equal(draft.temperature, '');
    assert.equal(draft.inherited.temperature, '0.4');
    assert.equal(draft.topP, '0.9');
    assert.equal(draft.inherited.topP, '');
    assert.equal(draft.timeoutMs, '');
    assert.equal(draft.inherited.timeoutMs, '90000');
    assert.equal(draft.streamingMode, 'inherit');
    assert.equal(draft.inherited.streaming, false);
  },
);

await runTest(
  'buildOpenClawAgentInputFromForm omits inherited defaults while preserving explicit per-agent overrides',
  () => {
    const draft = createOpenClawAgentFormState(createWorkbenchAgent(), 'defaults');
    const input = buildOpenClawAgentInputFromForm(draft);

    assert.equal(input.id, 'ops');
    assert.equal(input.model, null);
    assert.deepEqual(input.params, {
      topP: 0.9,
    });
  },
);

await runTest(
  'buildOpenClawAgentInputFromForm writes explicit streaming and fallback-only model overrides when the user chooses them',
  () => {
    const draft = createOpenClawAgentFormState(null);
    draft.id = 'research';
    draft.primaryModel = '';
    draft.fallbackModelsText = 'openai/gpt-4.1\nopenai/gpt-4.1\nanthropic/claude-3-7-sonnet';
    draft.streamingMode = 'enabled';
    draft.timeoutMs = '120000';

    const input = buildOpenClawAgentInputFromForm(draft);

    assert.deepEqual(input.model, {
      primary: undefined,
      fallbacks: ['openai/gpt-4.1', 'anthropic/claude-3-7-sonnet'],
    });
    assert.deepEqual(input.params, {
      timeoutMs: 120000,
      streaming: true,
    });
  },
);

await runTest(
  'buildOpenClawAgentParamEntries keeps stable param ordering and source metadata for the workbench UI',
  () => {
    const entries = buildOpenClawAgentParamEntries(createWorkbenchAgent());

    assert.deepEqual(entries, [
      {
        key: 'temperature',
        value: '0.4',
        source: 'defaults',
      },
      {
        key: 'topP',
        value: '0.9',
        source: 'agent',
      },
      {
        key: 'timeoutMs',
        value: '90000',
        source: 'defaults',
      },
      {
        key: 'streaming',
        value: 'false',
        source: 'defaults',
      },
    ]);
  },
);
