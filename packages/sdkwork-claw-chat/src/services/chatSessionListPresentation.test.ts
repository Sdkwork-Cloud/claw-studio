import assert from 'node:assert/strict';
import {
  formatChatSessionRelativeTime,
  presentChatSessionListItem,
} from './chatSessionListPresentation.ts';

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
  'presentChatSessionListItem derives sidebar metadata for a running gateway main session',
  () => {
    assert.equal(typeof presentChatSessionListItem, 'function');

    const presentation = presentChatSessionListItem({
      session: {
        id: 'agent:research:main',
        title: 'main',
        updatedAt: Date.UTC(2026, 3, 3, 10, 58, 0),
        lastMessagePreview: 'Drafting the final parity report',
        runId: 'run-1',
        messages: [
          {
            role: 'user',
            content: 'Drafting the final parity report',
            timestamp: Date.UTC(2026, 3, 3, 10, 55, 0),
          },
          {
            role: 'assistant',
            content: 'Streaming assistant reply in progress',
            timestamp: Date.UTC(2026, 3, 3, 10, 58, 0),
          },
        ],
      },
      now: Date.UTC(2026, 3, 3, 11, 0, 0),
      isGatewayMainSession: true,
    });

    assert.deepEqual(presentation, {
      displayTitle: 'Drafting the final parity report',
      preview: 'Streaming assistant reply in progress',
      relativeTimeLabel: '2m',
      isRunning: true,
      isPinned: true,
      showDeleteAction: false,
    });
  },
);

await runTest(
  'presentChatSessionListItem suppresses duplicate preview text when it only repeats the title',
  () => {
    assert.equal(typeof presentChatSessionListItem, 'function');

    const presentation = presentChatSessionListItem({
      session: {
        id: 'thread:session-1',
        title: 'Release checklist for the desktop build',
        updatedAt: Date.UTC(2026, 3, 3, 10, 30, 0),
        lastMessagePreview: 'Release checklist for the desktop build',
        messages: [
          {
            role: 'user',
            content: 'Release checklist for the desktop build',
            timestamp: Date.UTC(2026, 3, 3, 10, 30, 0),
          },
        ],
      },
      now: Date.UTC(2026, 3, 3, 11, 0, 0),
      isGatewayMainSession: false,
    });

    assert.equal(presentation.displayTitle, 'Release checklist for the desktop build');
    assert.equal(presentation.preview, null);
    assert.equal(presentation.relativeTimeLabel, '30m');
    assert.equal(presentation.isRunning, false);
    assert.equal(presentation.isPinned, false);
    assert.equal(presentation.showDeleteAction, true);
  },
);

await runTest(
  'formatChatSessionRelativeTime uses compact recency labels',
  () => {
    assert.equal(typeof formatChatSessionRelativeTime, 'function');

    assert.equal(
      formatChatSessionRelativeTime({
        updatedAt: Date.UTC(2026, 3, 3, 10, 59, 40),
        now: Date.UTC(2026, 3, 3, 11, 0, 0),
      }),
      'now',
    );
    assert.equal(
      formatChatSessionRelativeTime({
        updatedAt: Date.UTC(2026, 3, 3, 10, 55, 0),
        now: Date.UTC(2026, 3, 3, 11, 0, 0),
      }),
      '5m',
    );
    assert.equal(
      formatChatSessionRelativeTime({
        updatedAt: Date.UTC(2026, 3, 3, 8, 0, 0),
        now: Date.UTC(2026, 3, 3, 11, 0, 0),
      }),
      '3h',
    );
    assert.equal(
      formatChatSessionRelativeTime({
        updatedAt: Date.UTC(2026, 3, 1, 11, 0, 0),
        now: Date.UTC(2026, 3, 3, 11, 0, 0),
      }),
      '2d',
    );
  },
);

await runTest(
  'presentChatSessionListItem prefers kernel session and message authority for running state and preview text',
  () => {
    assert.equal(typeof presentChatSessionListItem, 'function');

    const presentation = presentChatSessionListItem({
      session: {
        id: 'agent:research:main',
        title: 'main',
        updatedAt: Date.UTC(2026, 3, 3, 10, 58, 0),
        lastMessagePreview: 'Legacy preview',
        runId: null,
        kernelSession: {
          ref: {
            kernelId: 'openclaw',
            instanceId: 'instance-1',
            sessionId: 'agent:research:main',
          },
          authority: {
            kind: 'gateway',
            source: 'kernel',
            durable: true,
            writable: true,
          },
          lifecycle: 'running',
          title: 'main',
          createdAt: Date.UTC(2026, 3, 3, 10, 40, 0),
          updatedAt: Date.UTC(2026, 3, 3, 10, 58, 0),
          messageCount: 2,
          activeRunId: 'kernel-run-1',
        },
        messages: [
          {
            role: 'user',
            content: 'Legacy title',
            kernelMessage: {
              id: 'message-1',
              sessionRef: {
                kernelId: 'openclaw',
                instanceId: 'instance-1',
                sessionId: 'agent:research:main',
              },
              role: 'user',
              status: 'complete',
              createdAt: Date.UTC(2026, 3, 3, 10, 55, 0),
              updatedAt: Date.UTC(2026, 3, 3, 10, 55, 0),
              text: 'Kernel title',
              parts: [
                {
                  kind: 'text',
                  text: 'Kernel title',
                },
              ],
            },
          },
          {
            role: 'assistant',
            content: 'Legacy preview',
            kernelMessage: {
              id: 'message-2',
              sessionRef: {
                kernelId: 'openclaw',
                instanceId: 'instance-1',
                sessionId: 'agent:research:main',
              },
              role: 'assistant',
              status: 'streaming',
              createdAt: Date.UTC(2026, 3, 3, 10, 58, 0),
              updatedAt: Date.UTC(2026, 3, 3, 10, 58, 0),
              text: 'Kernel preview',
              parts: [
                {
                  kind: 'text',
                  text: 'Kernel preview',
                },
              ],
            },
          },
        ],
      },
      now: Date.UTC(2026, 3, 3, 11, 0, 0),
      isGatewayMainSession: true,
    });

    assert.deepEqual(presentation, {
      displayTitle: 'Kernel title',
      preview: 'Kernel preview',
      relativeTimeLabel: '2m',
      isRunning: true,
      isPinned: true,
      showDeleteAction: false,
    });
  },
);
