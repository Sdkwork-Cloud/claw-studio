import assert from 'node:assert/strict';
import {
  shouldLoadChatDirectAgents,
  shouldLoadChatSkills,
} from './chatHydrationPolicy.ts';

async function runTest(name: string, callback: () => Promise<void> | void) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

await runTest('shouldLoadChatSkills only hydrates the skill catalog when the selector is in play', () => {
  assert.equal(
    shouldLoadChatSkills({
      isSessionContextDrawerOpen: false,
      selectedSkillId: null,
    }),
    false,
  );

  assert.equal(
    shouldLoadChatSkills({
      isSessionContextDrawerOpen: true,
      selectedSkillId: null,
    }),
    true,
  );

  assert.equal(
    shouldLoadChatSkills({
      isSessionContextDrawerOpen: false,
      selectedSkillId: 'skill-1',
    }),
    true,
  );
});

await runTest('shouldLoadChatDirectAgents skips the direct-agent catalog for openclaw gateway sessions', () => {
  assert.equal(
    shouldLoadChatDirectAgents({
      activeInstanceId: 'instance-1',
      isOpenClawGateway: true,
      isSessionContextDrawerOpen: true,
      selectedAgentId: 'agent-1',
    }),
    false,
  );
});

await runTest('shouldLoadChatDirectAgents hydrates direct agents only when the selector is opened or already selected', () => {
  assert.equal(
    shouldLoadChatDirectAgents({
      activeInstanceId: null,
      isOpenClawGateway: false,
      isSessionContextDrawerOpen: true,
      selectedAgentId: null,
    }),
    false,
  );

  assert.equal(
    shouldLoadChatDirectAgents({
      activeInstanceId: 'instance-1',
      isOpenClawGateway: false,
      isSessionContextDrawerOpen: false,
      selectedAgentId: null,
    }),
    false,
  );

  assert.equal(
    shouldLoadChatDirectAgents({
      activeInstanceId: 'instance-1',
      isOpenClawGateway: false,
      isSessionContextDrawerOpen: true,
      selectedAgentId: null,
    }),
    true,
  );

  assert.equal(
    shouldLoadChatDirectAgents({
      activeInstanceId: 'instance-1',
      isOpenClawGateway: false,
      isSessionContextDrawerOpen: false,
      selectedAgentId: 'agent-1',
    }),
    true,
  );
});
