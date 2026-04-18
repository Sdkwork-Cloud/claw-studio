import assert from 'node:assert/strict';
import type { StudioConversationAttachment } from '@sdkwork/claw-types';
import {
  buildOpenClawKernelChatMessage,
  buildOpenClawKernelChatSession,
  parseOpenClawAgentSessionRoutingKey,
} from './openClawKernelChatProjection.ts';

function runTest(name: string, fn: () => void) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

runTest('openclaw kernel chat projection parses agent-scoped routing keys', () => {
  assert.deepEqual(
    parseOpenClawAgentSessionRoutingKey('agent:research:thread-1'),
    {
      agentId: 'research',
      logicalKey: 'thread-1',
      routingKey: 'agent:research:thread-1',
    },
  );
  assert.deepEqual(
    parseOpenClawAgentSessionRoutingKey('main'),
    {
      agentId: null,
      logicalKey: 'main',
      routingKey: 'main',
    },
  );
});

runTest('openclaw kernel chat projection maps sessions and structured messages into the shared standard', () => {
  const attachment: StudioConversationAttachment = {
    id: 'file-1',
    kind: 'file',
    name: 'brief.md',
  };

  const session = buildOpenClawKernelChatSession({
    instanceId: 'instance-a',
    session: {
      id: 'agent:research:thread-1',
      title: 'Research Thread',
      createdAt: 10,
      updatedAt: 50,
      model: 'openai/gpt-4.1',
      defaultModel: 'openai/gpt-4.1',
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
              detail: 'query=multi kernel',
            },
            {
              kind: 'result',
              name: 'web.search',
              preview: 'found docs',
            },
          ],
        },
      ],
      sessionKind: 'direct',
    },
  });

  const message = buildOpenClawKernelChatMessage({
    sessionRef: session.ref,
    message: {
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
          detail: 'query=multi kernel',
        },
        {
          kind: 'result',
          name: 'web.search',
          preview: 'found docs',
        },
      ],
    },
  });

  assert.deepEqual(session.ref, {
    kernelId: 'openclaw',
    instanceId: 'instance-a',
    sessionId: 'agent:research:thread-1',
    nativeSessionId: null,
    routingKey: 'agent:research:thread-1',
    agentId: 'research',
  });
  assert.equal(session.authority.kind, 'gateway');
  assert.equal(session.sessionKind, 'direct');
  assert.equal(session.messageCount, 1);
  assert.equal(message.text, 'Result body');
  assert.deepEqual(
    message.parts.map((part) => part.kind),
    ['text', 'reasoning', 'attachment', 'toolCall', 'toolResult'],
  );
});
