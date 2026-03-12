import assert from 'node:assert/strict';
import { useChatStore } from './useChatStore.ts';

async function runTest(name: string, callback: () => Promise<void> | void) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

function resetStore() {
  useChatStore.setState(useChatStore.getInitialState(), true);
}

await runTest('useChatStore createSession keeps the instance id on the session', () => {
  resetStore();

  const sessionId = useChatStore.getState().createSession('Gemini 3 Flash', 'instance-a');
  const session = useChatStore.getState().sessions.find((item) => item.id === sessionId);

  assert.ok(session);
  assert.equal(session?.instanceId, 'instance-a');
});

await runTest('useChatStore can keep sessions separated by instance id', () => {
  resetStore();

  const firstId = useChatStore.getState().createSession('Gemini 3 Flash', 'instance-a');
  const secondId = useChatStore.getState().createSession('Qwen Plus', 'instance-b');

  const sessions = useChatStore.getState().sessions;
  const instanceASessions = sessions.filter((session) => session.instanceId === 'instance-a');
  const instanceBSessions = sessions.filter((session) => session.instanceId === 'instance-b');

  assert.deepEqual(instanceASessions.map((session) => session.id), [firstId]);
  assert.deepEqual(instanceBSessions.map((session) => session.id), [secondId]);
});
