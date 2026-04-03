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
      showSkillDropdown: false,
      selectedSkillId: null,
    }),
    false,
  );

  assert.equal(
    shouldLoadChatSkills({
      showSkillDropdown: true,
      selectedSkillId: null,
    }),
    true,
  );

  assert.equal(
    shouldLoadChatSkills({
      showSkillDropdown: false,
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
      showAgentDropdown: true,
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
      showAgentDropdown: true,
      selectedAgentId: null,
    }),
    false,
  );

  assert.equal(
    shouldLoadChatDirectAgents({
      activeInstanceId: 'instance-1',
      isOpenClawGateway: false,
      showAgentDropdown: false,
      selectedAgentId: null,
    }),
    false,
  );

  assert.equal(
    shouldLoadChatDirectAgents({
      activeInstanceId: 'instance-1',
      isOpenClawGateway: false,
      showAgentDropdown: true,
      selectedAgentId: null,
    }),
    true,
  );

  assert.equal(
    shouldLoadChatDirectAgents({
      activeInstanceId: 'instance-1',
      isOpenClawGateway: false,
      showAgentDropdown: false,
      selectedAgentId: 'agent-1',
    }),
    true,
  );
});
