import assert from 'node:assert/strict';
import { deriveChatComposerModelState } from './chatComposerState.ts';

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

const geminiFlash = {
  id: 'gemini-3-flash-preview',
  name: 'Gemini 3 Flash',
  provider: 'google',
  icon: '✨',
};

const gpt4o = {
  id: 'gpt-4o',
  name: 'GPT-4o',
  provider: 'openai',
  icon: '🧠',
};

await runTest('idle composer reflects the selected model directly', () => {
  const state = deriveChatComposerModelState({
    activeModel: geminiFlash,
    inFlightModelName: null,
    isLoading: false,
  });

  assert.deepEqual(state, {
    selectedModelName: 'Gemini 3 Flash',
    inFlightModelName: null,
    nextModelName: null,
    status: 'idle',
  });
});

await runTest('generating composer keeps the in-flight model stable when selection is unchanged', () => {
  const state = deriveChatComposerModelState({
    activeModel: gpt4o,
    inFlightModelName: 'GPT-4o',
    isLoading: true,
  });

  assert.deepEqual(state, {
    selectedModelName: 'GPT-4o',
    inFlightModelName: 'GPT-4o',
    nextModelName: null,
    status: 'streaming-current-model',
  });
});

await runTest('generating composer marks a changed selection as applying to the next message', () => {
  const state = deriveChatComposerModelState({
    activeModel: geminiFlash,
    inFlightModelName: 'GPT-4o',
    isLoading: true,
  });

  assert.deepEqual(state, {
    selectedModelName: 'Gemini 3 Flash',
    inFlightModelName: 'GPT-4o',
    nextModelName: 'Gemini 3 Flash',
    status: 'streaming-next-model-selected',
  });
});
