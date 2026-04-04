import assert from 'node:assert/strict';
import { detectChatCronActivityNotification } from './chatCronActivityNotifications.ts';

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
  'detectChatCronActivityNotification emits a start notification when a cron run begins',
  () => {
    assert.deepEqual(
      detectChatCronActivityNotification({
        previousSession: {
          id: 'agent:main:cron:nightly-sync',
          title: 'Nightly Sync',
          lastMessagePreview: 'Waiting to run',
          runId: null,
        },
        nextSession: {
          id: 'agent:main:cron:nightly-sync',
          title: 'Nightly Sync',
          lastMessagePreview: 'Preparing execution',
          runId: 'run-1',
        },
      }),
      {
        kind: 'started',
        title: 'Cron: Nightly Sync',
        body: 'Preparing execution',
        sessionId: 'agent:main:cron:nightly-sync',
      },
    );
  },
);

await runTest(
  'detectChatCronActivityNotification emits a completion notification when a cron run finishes',
  () => {
    assert.deepEqual(
      detectChatCronActivityNotification({
        previousSession: {
          id: 'agent:main:cron:daily-briefing',
          title: 'Daily Briefing',
          lastMessagePreview: 'Running',
          runId: 'run-1',
        },
        nextSession: {
          id: 'agent:main:cron:daily-briefing',
          title: 'Daily Briefing',
          lastMessagePreview: 'Sent the morning briefing to Slack.',
          runId: null,
        },
      }),
      {
        kind: 'completed',
        title: 'Cron: Daily Briefing',
        body: 'Sent the morning briefing to Slack.',
        sessionId: 'agent:main:cron:daily-briefing',
      },
    );
  },
);

await runTest(
  'detectChatCronActivityNotification ignores non-cron sessions and unchanged cron runs',
  () => {
    assert.equal(
      detectChatCronActivityNotification({
        previousSession: {
          id: 'agent:main:main',
          title: 'Main Session',
          lastMessagePreview: 'hello',
          runId: null,
        },
        nextSession: {
          id: 'agent:main:main',
          title: 'Main Session',
          lastMessagePreview: 'hello again',
          runId: 'run-1',
        },
      }),
      null,
    );

    assert.equal(
      detectChatCronActivityNotification({
        previousSession: {
          id: 'agent:main:cron:daily-briefing',
          title: 'Daily Briefing',
          lastMessagePreview: 'Still running',
          runId: 'run-1',
        },
        nextSession: {
          id: 'agent:main:cron:daily-briefing',
          title: 'Daily Briefing',
          lastMessagePreview: 'Still running',
          runId: 'run-1',
        },
      }),
      null,
    );
  },
);
