import assert from 'node:assert/strict';
import {
  buildAgentWorkbenchTabCounts,
  filterAgentWorkbenchAgents,
} from './agentWorkbenchPresentation.ts';

function runTest(name: string, callback: () => void) {
  try {
    callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

function createAgent(overrides: Record<string, unknown> = {}) {
  return {
    agent: {
      id: 'research',
      name: 'Research Agent',
      description: 'Finds and summarizes information.',
      avatar: 'R',
      creator: 'OpenClaw',
      ...(overrides.agent as Record<string, unknown> | undefined),
    },
    focusAreas: ['Research', 'Analysis'],
    automationFitScore: 92,
    workspace: '/workspace/research',
    agentDir: '/agents/research/agent',
    isDefault: false,
    model: {
      primary: 'openai/gpt-5.4',
      fallbacks: ['openai/gpt-5.2'],
      ...(overrides.model as Record<string, unknown> | undefined),
    },
    ...(overrides as Record<string, unknown>),
  };
}

runTest('buildAgentWorkbenchTabCounts maps snapshot collections into tab counts', () => {
  const counts = buildAgentWorkbenchTabCounts({
    agent: createAgent(),
    model: {
      primary: 'openai/gpt-5.4',
      fallbacks: [],
      source: 'agent',
    },
    paths: {
      workspacePath: '/workspace/research',
      skillsDirectoryPath: '/workspace/research/skills',
      agentDirPath: '/agents/research/agent',
      authProfilesPath: '/agents/research/agent/auth-profiles.json',
      modelsRegistryPath: '/agents/research/agent/models.json',
      sessionsPath: '/agents/research/sessions',
    },
    tasks: [{ id: 'cron-1' }, { id: 'cron-2' }],
    files: [{ id: 'file-1' }],
    skills: [{ id: 'skill-1' }, { id: 'skill-2' }, { id: 'skill-3' }],
    tools: [{ id: 'tool-1' }],
    modelProviders: [{ id: 'provider-1' }],
    channels: [{ id: 'channel-1' }, { id: 'channel-2' }],
  } as any);

  assert.deepEqual(counts, {
    overview: null,
    channels: 2,
    cronTasks: 2,
    skills: 3,
    tools: 1,
    files: 1,
  });
});

runTest('filterAgentWorkbenchAgents matches name, id, focus area, and model metadata', () => {
  const agents = [
    createAgent(),
    createAgent({
      agent: {
        id: 'ops',
        name: 'Ops Agent',
        description: 'Monitors incidents.',
      },
      focusAreas: ['Operations'],
      model: {
        primary: 'anthropic/claude-opus-4-6',
        fallbacks: [],
      },
    }),
  ] as any;

  assert.equal(filterAgentWorkbenchAgents(agents, 'ops').length, 1);
  assert.equal(filterAgentWorkbenchAgents(agents, 'analysis').length, 1);
  assert.equal(filterAgentWorkbenchAgents(agents, 'claude-opus').length, 1);
  assert.equal(filterAgentWorkbenchAgents(agents, 'missing').length, 0);
});
