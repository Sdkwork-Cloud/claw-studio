import assert from 'node:assert/strict';
import { presentChatHeader } from './chatHeaderPresentation.ts';

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

await runTest(
  'presentChatHeader prefers the first user turn as the visible title and marks streaming gateway sessions as responding',
  () => {
    assert.equal(typeof presentChatHeader, 'function');

    assert.deepEqual(
      presentChatHeader({
        isOpenClawGateway: true,
        gatewayConnectionStatus: 'connected',
        syncState: 'idle',
        activeAgentName: 'Research Agent',
        activeSession: {
          id: 'agent:research:main',
          title: 'main',
          model: 'openai/gpt-5.1',
          updatedAt: Date.UTC(2026, 3, 3, 11, 0, 0),
          runId: 'run-1',
          lastMessagePreview: 'Draft the parity report',
          messages: [
            {
              role: 'user',
              content: 'Draft the parity report',
            },
            {
              role: 'assistant',
              content: 'Streaming the first section now',
            },
          ],
        },
        isActiveSessionGenerating: true,
      }),
      {
        title: 'Draft the parity report',
        status: 'responding',
        detailItems: ['Research Agent', 'openai/gpt-5.1'],
      },
    );
  },
);

await runTest(
  'presentChatHeader reports reconnecting while the gateway is still hydrating',
  () => {
    assert.equal(typeof presentChatHeader, 'function');

    assert.deepEqual(
      presentChatHeader({
        isOpenClawGateway: true,
        gatewayConnectionStatus: 'disconnected',
        syncState: 'loading',
        activeAgentName: 'Default Agent',
        activeModelName: 'claude-sonnet-4',
        activeSession: null,
        isActiveSessionGenerating: false,
      }),
      {
        title: 'New Conversation',
        status: 'reconnecting',
        detailItems: ['Default Agent', 'claude-sonnet-4'],
      },
    );
  },
);

await runTest(
  'presentChatHeader keeps direct chat headers in a ready state and uses the selected model as supporting detail',
  () => {
    assert.equal(typeof presentChatHeader, 'function');

    assert.deepEqual(
      presentChatHeader({
        isOpenClawGateway: false,
        gatewayConnectionStatus: null,
        syncState: 'idle',
        activeAgentName: null,
        activeModelName: 'GPT-4.1 Mini',
        activeSession: {
          id: 'session-1',
          title: 'Summarize the release checklist',
          updatedAt: Date.UTC(2026, 3, 3, 11, 0, 0),
          runId: null,
          messages: [
            {
              role: 'user',
              content: 'Summarize the release checklist',
            },
          ],
        },
        isActiveSessionGenerating: false,
      }),
      {
        title: 'Summarize the release checklist',
        status: 'ready',
        detailItems: ['GPT-4.1 Mini'],
      },
    );
  },
);

await runTest(
  'presentChatHeader marks unsupported chat routes as unavailable instead of ready',
  () => {
    assert.equal(typeof presentChatHeader, 'function');

    assert.deepEqual(
      presentChatHeader({
        isChatSupported: false,
        isOpenClawGateway: false,
        gatewayConnectionStatus: null,
        syncState: 'idle',
        activeAgentName: null,
        activeModelName: null,
        activeSession: null,
        isActiveSessionGenerating: false,
      }),
      {
        title: 'New Conversation',
        status: 'unavailable',
        detailItems: [],
      },
    );
  },
);
