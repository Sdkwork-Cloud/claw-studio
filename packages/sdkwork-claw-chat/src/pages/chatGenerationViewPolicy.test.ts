import assert from 'node:assert/strict';
import { resolveChatGenerationViewState } from './chatGenerationViewPolicy.ts';

async function runTest(name: string, callback: () => Promise<void> | void) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

await runTest(
  'resolveChatGenerationViewState keeps the composer locked while a background session is still streaming',
  () => {
    assert.deepEqual(
      resolveChatGenerationViewState({
        effectiveActiveSessionId: 'session-b',
        pendingSendSessionId: 'session-a',
        activeSessionRunId: null,
        runningSessionId: null,
      }),
      {
        isComposerLocked: true,
        isActiveSessionGenerating: false,
        stopSessionId: 'session-a',
      },
    );
  },
);

await runTest(
  'resolveChatGenerationViewState marks the active session as generating for local pending sends',
  () => {
    assert.deepEqual(
      resolveChatGenerationViewState({
        effectiveActiveSessionId: 'session-a',
        pendingSendSessionId: 'session-a',
        activeSessionRunId: null,
        runningSessionId: null,
      }),
      {
        isComposerLocked: true,
        isActiveSessionGenerating: true,
        stopSessionId: 'session-a',
      },
    );
  },
);

await runTest(
  'resolveChatGenerationViewState marks the active session as generating for gateway run ids',
  () => {
    assert.deepEqual(
      resolveChatGenerationViewState({
        effectiveActiveSessionId: 'session-a',
        pendingSendSessionId: null,
        activeSessionRunId: 'run-1',
        runningSessionId: 'session-a',
      }),
      {
        isComposerLocked: true,
        isActiveSessionGenerating: true,
        stopSessionId: 'session-a',
      },
    );
  },
);

await runTest(
  'resolveChatGenerationViewState stays idle when no send is in flight',
  () => {
    assert.deepEqual(
      resolveChatGenerationViewState({
        effectiveActiveSessionId: 'session-a',
        pendingSendSessionId: null,
        activeSessionRunId: null,
        runningSessionId: null,
      }),
      {
        isComposerLocked: false,
        isActiveSessionGenerating: false,
        stopSessionId: null,
      },
    );
  },
);

await runTest(
  'resolveChatGenerationViewState keeps the composer locked for a background gateway run while only the visible session controls typing state',
  () => {
    assert.deepEqual(
      resolveChatGenerationViewState({
        effectiveActiveSessionId: 'session-b',
        pendingSendSessionId: null,
        activeSessionRunId: null,
        runningSessionId: 'session-a',
      }),
      {
        isComposerLocked: true,
        isActiveSessionGenerating: false,
        stopSessionId: 'session-a',
      },
    );
  },
);

await runTest(
  'resolveChatGenerationViewState prefers stopping the visible active session when it is generating',
  () => {
    assert.deepEqual(
      resolveChatGenerationViewState({
        effectiveActiveSessionId: 'session-b',
        pendingSendSessionId: null,
        activeSessionRunId: 'run-visible',
        runningSessionId: 'session-a',
      }),
      {
        isComposerLocked: true,
        isActiveSessionGenerating: true,
        stopSessionId: 'session-b',
      },
    );
  },
);
