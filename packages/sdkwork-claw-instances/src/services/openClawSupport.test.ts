import assert from 'node:assert/strict';
import { buildOpenClawAgentFileId, parseOpenClawAgentFileId } from './openClawSupport.ts';

function runTest(name: string, fn: () => void) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

runTest('buildOpenClawAgentFileId keeps same-name files unique when their paths differ', () => {
  const promptFileId = buildOpenClawAgentFileId(
    'ops',
    'AGENTS.md',
    '/workspace/ops/prompts/AGENTS.md',
  );
  const docsFileId = buildOpenClawAgentFileId(
    'ops',
    'AGENTS.md',
    '/workspace/ops/docs/AGENTS.md',
  );

  assert.notEqual(promptFileId, docsFileId);
  assert.deepEqual(parseOpenClawAgentFileId(promptFileId), {
    agentId: 'ops',
    name: 'AGENTS.md',
    path: '/workspace/ops/prompts/AGENTS.md',
  });
  assert.deepEqual(parseOpenClawAgentFileId(docsFileId), {
    agentId: 'ops',
    name: 'AGENTS.md',
    path: '/workspace/ops/docs/AGENTS.md',
  });
});

runTest('parseOpenClawAgentFileId keeps backward compatibility with legacy ids that only stored the file name', () => {
  const legacyId = buildOpenClawAgentFileId('ops', 'AGENTS.md');

  assert.deepEqual(parseOpenClawAgentFileId(legacyId), {
    agentId: 'ops',
    name: 'AGENTS.md',
    path: null,
  });
});
