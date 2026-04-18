import assert from 'node:assert/strict';
import type { StudioConversationAttachment } from '@sdkwork/claw-types';
import { hydrateLocalChatKernelProjection } from './localChatKernelProjection.ts';

function runTest(name: string, fn: () => void) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

runTest(
  'local chat kernel projection maps direct sessions into the shared kernel standard',
  () => {
    const attachment: StudioConversationAttachment = {
      id: 'file-1',
      kind: 'file',
      name: 'brief.md',
    };

    const projected = hydrateLocalChatKernelProjection({
      session: {
        id: 'session-1',
        title: 'Direct Session',
        createdAt: 10,
        updatedAt: 50,
        instanceId: 'instance-http',
        model: 'openai/gpt-4.1',
        defaultModel: 'openai/gpt-4.1',
        thinkingLevel: 'medium',
        fastMode: false,
        verboseLevel: 'standard',
        reasoningLevel: 'balanced',
        runId: 'run-1',
        sessionKind: 'direct',
        messages: [
          {
            id: 'message-1',
            role: 'assistant',
            content: 'Result body',
            timestamp: 50,
            reasoning: 'hidden chain',
            attachments: [attachment],
            toolCards: [
              {
                kind: 'call',
                name: 'web.search',
                detail: 'query=kernel standard',
              },
              {
                kind: 'result',
                name: 'web.search',
                preview: 'found docs',
              },
            ],
            runId: 'run-1',
          },
        ],
      },
    });

    assert.deepEqual(projected.kernelSession.ref, {
      kernelId: 'studio-direct',
      instanceId: 'instance-http',
      sessionId: 'session-1',
      nativeSessionId: null,
      routingKey: null,
      agentId: null,
    });
    assert.equal(projected.kernelSession.authority.kind, 'localProjection');
    assert.equal(projected.kernelSession.authority.source, 'studioProjection');
    assert.equal(projected.kernelSession.authority.durable, false);
    assert.equal(projected.kernelSession.authority.writable, false);
    assert.equal(projected.kernelSession.lifecycle, 'running');
    assert.equal(projected.kernelSession.sessionKind, 'direct');
    assert.equal(projected.kernelSession.activeRunId, 'run-1');
    assert.equal(projected.messages[0]?.kernelMessage.status, 'streaming');
    assert.deepEqual(
      projected.messages[0]?.kernelMessage.parts.map((part) => part.kind),
      ['text', 'reasoning', 'attachment', 'toolCall', 'toolResult'],
    );
  },
);

runTest(
  'local chat kernel projection keeps local built-in identity for direct draft sessions',
  () => {
    const projected = hydrateLocalChatKernelProjection({
      session: {
        id: 'session-draft',
        title: 'New Conversation',
        createdAt: 1,
        updatedAt: 1,
        model: 'gpt-4.1',
        messages: [],
      },
    });

    assert.equal(projected.kernelSession.ref.kernelId, 'studio-direct');
    assert.equal(projected.kernelSession.ref.instanceId, 'local-built-in');
    assert.equal(projected.kernelSession.authority.durable, false);
    assert.equal(projected.kernelSession.lifecycle, 'draft');
    assert.equal(projected.kernelSession.sessionKind, 'direct');
    assert.deepEqual(projected.messages, []);
  },
);
