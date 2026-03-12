import assert from 'node:assert/strict';
import { createAgentService } from './agentService.ts';

async function runTest(name: string, callback: () => Promise<void> | void) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

await runTest('agentService exposes the seeded v3 agent roster', async () => {
  const service = createAgentService({ delayMs: 0 });

  const agents = await service.getAgents();

  assert.equal(agents.length, 3);
  assert.equal(agents[0]?.name, 'Code Master');
  assert.equal(agents[0]?.creator, 'OpenClaw');
});

await runTest('agentService getList filters by keyword', async () => {
  const service = createAgentService({ delayMs: 0 });

  const result = await service.getList({ keyword: 'creative', page: 1, pageSize: 10 });

  assert.equal(result.total, 1);
  assert.equal(result.items[0]?.name, 'Creative Writer');
  assert.equal(result.hasMore, false);
});

await runTest('agentService create and getById keep the new agent data', async () => {
  const service = createAgentService({ delayMs: 0 });

  const created = await service.create({
    name: 'Ops Expert',
    description: 'Handles deployment playbooks.',
    avatar: 'OE',
    systemPrompt: 'Focus on operational excellence.',
    creator: 'Workspace',
  });
  const fetched = await service.getById(created.id);

  assert.ok(fetched);
  assert.equal(fetched?.name, 'Ops Expert');
  assert.equal(fetched?.creator, 'Workspace');
});
