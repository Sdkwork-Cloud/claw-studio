import assert from 'node:assert/strict';
import * as services from './index.ts';

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
    assert.equal(typeof (services as any).presentChatSessionListItem, 'function');

    const presentation = (services as any).presentChatSessionListItem({
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
    assert.equal(typeof (services as any).presentChatSessionListItem, 'function');

    const presentation = (services as any).presentChatSessionListItem({
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
    assert.equal(typeof (services as any).formatChatSessionRelativeTime, 'function');

    assert.equal(
      (services as any).formatChatSessionRelativeTime({
        updatedAt: Date.UTC(2026, 3, 3, 10, 59, 40),
        now: Date.UTC(2026, 3, 3, 11, 0, 0),
      }),
      'now',
    );
    assert.equal(
      (services as any).formatChatSessionRelativeTime({
        updatedAt: Date.UTC(2026, 3, 3, 10, 55, 0),
        now: Date.UTC(2026, 3, 3, 11, 0, 0),
      }),
      '5m',
    );
    assert.equal(
      (services as any).formatChatSessionRelativeTime({
        updatedAt: Date.UTC(2026, 3, 3, 8, 0, 0),
        now: Date.UTC(2026, 3, 3, 11, 0, 0),
      }),
      '3h',
    );
    assert.equal(
      (services as any).formatChatSessionRelativeTime({
        updatedAt: Date.UTC(2026, 3, 1, 11, 0, 0),
        now: Date.UTC(2026, 3, 3, 11, 0, 0),
      }),
      '2d',
    );
  },
);
