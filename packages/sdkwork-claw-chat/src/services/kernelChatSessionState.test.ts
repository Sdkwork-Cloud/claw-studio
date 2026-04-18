import assert from 'node:assert/strict';

import { resolveKernelChatSessionState } from './kernelChatSessionState.ts';

async function runTest(name: string, callback: () => Promise<void> | void) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

await runTest('resolveKernelChatSessionState prefers kernel session bindings over legacy gateway fields', () => {
  assert.deepEqual(
    resolveKernelChatSessionState({
      model: 'legacy-model',
      defaultModel: 'legacy-default',
      runId: 'legacy-run',
      thinkingLevel: 'legacy-thinking',
      fastMode: false,
      verboseLevel: 'legacy-verbose',
      reasoningLevel: 'legacy-reasoning',
      sessionKind: 'direct',
      kernelSession: {
        ref: {
          kernelId: 'openclaw',
          instanceId: 'instance-a',
          sessionId: 'agent:research:main',
          agentId: 'research',
          routingKey: 'agent:research:main',
        },
        authority: {
          kind: 'gateway',
          source: 'kernel',
          durable: true,
          writable: true,
        },
        lifecycle: 'running',
        title: 'Research',
        createdAt: 1,
        updatedAt: 2,
        messageCount: 0,
        sessionKind: 'global',
        modelBinding: {
          model: 'kernel-model',
          defaultModel: 'kernel-default',
          thinkingLevel: 'kernel-thinking',
          fastMode: true,
          verboseLevel: 'kernel-verbose',
          reasoningLevel: 'kernel-reasoning',
        },
        activeRunId: 'kernel-run',
      },
    }),
    {
      agentId: 'research',
      routingKey: 'agent:research:main',
      sessionKind: 'global',
      activeRunId: 'kernel-run',
      model: 'kernel-model',
      defaultModel: 'kernel-default',
      thinkingLevel: 'kernel-thinking',
      fastMode: true,
      verboseLevel: 'kernel-verbose',
      reasoningLevel: 'kernel-reasoning',
    },
  );
});

await runTest('resolveKernelChatSessionState falls back to legacy chat session fields when no kernel projection exists', () => {
  assert.deepEqual(
    resolveKernelChatSessionState({
      model: 'legacy-model',
      defaultModel: 'legacy-default',
      runId: 'legacy-run',
      thinkingLevel: 'legacy-thinking',
      fastMode: false,
      verboseLevel: 'legacy-verbose',
      reasoningLevel: 'legacy-reasoning',
      sessionKind: 'direct',
      kernelSession: null,
    }),
    {
      agentId: null,
      routingKey: null,
      sessionKind: 'direct',
      activeRunId: 'legacy-run',
      model: 'legacy-model',
      defaultModel: 'legacy-default',
      thinkingLevel: 'legacy-thinking',
      fastMode: false,
      verboseLevel: 'legacy-verbose',
      reasoningLevel: 'legacy-reasoning',
    },
  );
});
