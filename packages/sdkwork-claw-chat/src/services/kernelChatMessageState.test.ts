import assert from 'node:assert/strict';
import type { KernelChatMessage, StudioConversationAttachment } from '@sdkwork/claw-types';
import { resolveKernelChatMessageState } from './kernelChatMessageState.ts';

function runTest(name: string, callback: () => void | Promise<void>) {
  return Promise.resolve()
    .then(callback)
    .then(() => {
      console.log(`ok - ${name}`);
    })
    .catch((error) => {
      console.error(`not ok - ${name}`);
      throw error;
    });
}

function createKernelMessage(input: Partial<KernelChatMessage> = {}): KernelChatMessage {
  return {
    id: 'message-1',
    sessionRef: {
      kernelId: 'openclaw',
      instanceId: 'instance-1',
      sessionId: 'session-1',
    },
    role: 'assistant',
    status: 'complete',
    createdAt: 100,
    updatedAt: 120,
    text: 'Kernel text',
    parts: [],
    ...input,
  };
}

await runTest(
  'resolveKernelChatMessageState prefers kernel message parts over legacy display fields',
  () => {
    const legacyAttachment: StudioConversationAttachment = {
      id: 'legacy-attachment',
      kind: 'file',
      name: 'legacy.txt',
    };
    const kernelAttachment: StudioConversationAttachment = {
      id: 'kernel-attachment',
      kind: 'image',
      name: 'diagram.png',
      previewUrl: 'file:///diagram.png',
    };

    assert.deepEqual(
      resolveKernelChatMessageState({
        id: 'legacy-message',
        role: 'tool',
        content: 'Legacy text',
        timestamp: 50,
        senderLabel: 'Legacy Sender',
        model: 'legacy-model',
        runId: 'legacy-run',
        attachments: [legacyAttachment],
        reasoning: 'Legacy reasoning',
        toolCards: [
          {
            kind: 'call',
            name: 'LegacyTool',
            detail: 'legacy detail',
          },
        ],
        kernelMessage: createKernelMessage({
          id: 'kernel-message',
          role: 'user',
          status: 'streaming',
          createdAt: 200,
          updatedAt: 220,
          text: '',
          parts: [
            {
              kind: 'text',
              text: 'Kernel text from parts',
            },
            {
              kind: 'reasoning',
              text: 'Kernel reasoning',
            },
            {
              kind: 'attachment',
              attachment: kernelAttachment,
            },
            {
              kind: 'toolCall',
              toolName: 'Search',
              detail: 'query=release notes',
            },
            {
              kind: 'toolResult',
              toolName: 'Search',
              preview: 'Found 3 release notes',
            },
          ],
          runId: 'kernel-run',
          model: 'kernel-model',
          senderLabel: 'Kernel Sender',
        }),
      }),
      {
        id: 'kernel-message',
        role: 'user',
        content: 'Kernel text from parts',
        timestamp: 220,
        senderLabel: 'Kernel Sender',
        model: 'kernel-model',
        runId: 'kernel-run',
        attachments: [kernelAttachment],
        reasoning: 'Kernel reasoning',
        toolCards: [
          {
            kind: 'call',
            name: 'Search',
            detail: 'query=release notes',
          },
          {
            kind: 'result',
            name: 'Search',
            preview: 'Found 3 release notes',
          },
        ],
      },
    );
  },
);

await runTest(
  'resolveKernelChatMessageState falls back to legacy chat fields when no kernel message is attached',
  () => {
    const legacyAttachment: StudioConversationAttachment = {
      id: 'legacy-attachment',
      kind: 'file',
      name: 'legacy.txt',
    };

    assert.deepEqual(
      resolveKernelChatMessageState({
        id: 'legacy-message',
        role: 'assistant',
        content: 'Legacy text',
        timestamp: 50,
        senderLabel: 'Legacy Sender',
        model: 'legacy-model',
        runId: 'legacy-run',
        attachments: [legacyAttachment],
        reasoning: 'Legacy reasoning',
        toolCards: [
          {
            kind: 'call',
            name: 'LegacyTool',
            detail: 'legacy detail',
          },
        ],
      }),
      {
        id: 'legacy-message',
        role: 'assistant',
        content: 'Legacy text',
        timestamp: 50,
        senderLabel: 'Legacy Sender',
        model: 'legacy-model',
        runId: 'legacy-run',
        attachments: [legacyAttachment],
        reasoning: 'Legacy reasoning',
        toolCards: [
          {
            kind: 'call',
            name: 'LegacyTool',
            detail: 'legacy detail',
          },
        ],
      },
    );
  },
);
