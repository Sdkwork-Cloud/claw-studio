import assert from 'node:assert/strict';

function runTest(name: string, fn: () => void | Promise<void>) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      console.log(`ok - ${name}`);
    })
    .catch((error) => {
      console.error(`not ok - ${name}`);
      throw error;
    });
}

let agentWorkbenchSupportModule:
  | typeof import('./openClawAgentWorkbenchSupport.ts')
  | undefined;

try {
  agentWorkbenchSupportModule = await import('./openClawAgentWorkbenchSupport.ts');
} catch {
  agentWorkbenchSupportModule = undefined;
}

await runTest(
  'openClawAgentWorkbenchSupport exposes shared agent mapping and merge helpers',
  () => {
    assert.ok(agentWorkbenchSupportModule, 'Expected openClawAgentWorkbenchSupport.ts to exist');
    assert.equal(typeof agentWorkbenchSupportModule?.mapAgent, 'function');
    assert.equal(typeof agentWorkbenchSupportModule?.cloneWorkbenchAgent, 'function');
    assert.equal(typeof agentWorkbenchSupportModule?.normalizeWorkbenchAgent, 'function');
    assert.equal(typeof agentWorkbenchSupportModule?.mergeWorkbenchAgents, 'function');
    assert.equal(typeof agentWorkbenchSupportModule?.mergeOpenClawAgentCollections, 'function');
    assert.equal(typeof agentWorkbenchSupportModule?.buildManagedOpenClawAgents, 'function');
  },
);

await runTest(
  'mapAgent derives focus areas and automation fit from agent profile and active tasks',
  () => {
    const mapped = agentWorkbenchSupportModule?.mapAgent(
      {
        id: 'ops',
        name: 'Ops Code Analyst',
        description: 'Debug software incidents and workflow automation.',
        systemPrompt: 'Handle code analysis and workflow incidents.',
        creator: 'OpenClaw',
        avatar: 'O',
      } as any,
      [
        { status: 'active' },
        { status: 'active' },
        { status: 'paused' },
      ] as any,
      [{ category: 'Security' }] as any,
    );

    assert.equal(mapped?.configSource, 'runtime');
    assert.equal(mapped?.focusAreas.includes('Code'), true);
    assert.equal(mapped?.focusAreas.includes('Operations'), true);
    assert.equal(mapped?.focusAreas.includes('Security'), true);
    assert.equal(typeof mapped?.automationFitScore, 'number');
    assert.equal((mapped?.automationFitScore || 0) > 0, true);
  },
);

await runTest(
  'normalizeWorkbenchAgent normalizes ids and deep-clones nested model and params',
  () => {
    const normalized = agentWorkbenchSupportModule?.normalizeWorkbenchAgent({
      agent: {
        id: 'Ops Lead',
        name: 'Ops Lead',
        description: 'Operations',
        avatar: 'O',
        systemPrompt: 'Handle incidents',
        creator: 'OpenClaw',
      },
      focusAreas: ['Operations'],
      automationFitScore: 75,
      model: {
        primary: 'openai/gpt-5.4',
        fallbacks: ['openai/gpt-5.4-mini'],
      },
      params: {
        temperature: 0.2,
      },
      paramSources: {
        temperature: 'agent',
      },
      configSource: 'runtime',
    } as any);

    assert.equal(normalized?.agent.id, 'ops-lead');
    assert.deepEqual(normalized?.model, {
      primary: 'openai/gpt-5.4',
      fallbacks: ['openai/gpt-5.4-mini'],
    });
    assert.deepEqual(normalized?.params, { temperature: 0.2 });
    assert.deepEqual(normalized?.paramSources, { temperature: 'agent' });
  },
);

await runTest(
  'mergeOpenClawAgentCollections normalizes ids, prefers override ordering, and deep-clones merged records',
  () => {
    const merged = agentWorkbenchSupportModule?.mergeOpenClawAgentCollections(
      [
        {
          agent: {
            id: 'Ops Lead',
            name: 'Ops Lead',
            description: 'Managed profile',
            avatar: 'O',
            systemPrompt: 'Base prompt',
            creator: 'OpenClaw',
          },
          focusAreas: ['Operations'],
          automationFitScore: 70,
          model: {
            primary: 'openai/gpt-5.4',
            fallbacks: [],
          },
          params: {
            temperature: 0.2,
          },
          paramSources: {
            temperature: 'defaults',
          },
          configSource: 'managedConfig',
        },
      ] as any,
      [
        {
          agent: {
            id: 'ops-lead',
            name: 'Ops Lead Runtime',
            description: 'Runtime profile',
            avatar: 'R',
            systemPrompt: 'Runtime prompt',
            creator: 'Runtime',
          },
          focusAreas: ['Operations', 'Code'],
          automationFitScore: 91,
          model: {
            primary: 'openai/gpt-5.4-mini',
            fallbacks: ['openai/gpt-4.1'],
          },
          params: {
            temperature: 0.4,
          },
          paramSources: {
            temperature: 'agent',
          },
          configSource: 'runtime',
        },
        {
          agent: {
            id: 'scribe',
            name: 'Scribe',
            description: 'Docs',
            avatar: 'S',
            systemPrompt: 'Write docs',
            creator: 'Runtime',
          },
          focusAreas: ['Content'],
          automationFitScore: 55,
          configSource: 'runtime',
        },
      ] as any,
    );

    assert.deepEqual(
      merged?.map((agent) => agent.agent.id),
      ['ops-lead', 'scribe'],
    );
    assert.equal(merged?.[0]?.agent.name, 'Ops Lead Runtime');
    assert.equal(merged?.[0]?.agent.creator, 'Runtime');
    assert.deepEqual(merged?.[0]?.focusAreas, ['Operations', 'Code']);
    assert.deepEqual(merged?.[0]?.model, {
      primary: 'openai/gpt-5.4-mini',
      fallbacks: ['openai/gpt-4.1'],
    });
    assert.deepEqual(merged?.[0]?.params, { temperature: 0.4 });
    assert.deepEqual(merged?.[0]?.paramSources, { temperature: 'agent' });
  },
);

await runTest(
  'buildManagedOpenClawAgents overlays runtime metadata onto managed defaults and appends runtime-only agents',
  () => {
    const managedAgents = agentWorkbenchSupportModule?.buildManagedOpenClawAgents(
      [
        {
          id: 'Ops Lead',
          name: 'Ops Lead',
          description: 'Managed ops agent',
          avatar: 'O',
          workspace: 'D:/OpenClaw/workspace',
          agentDir: 'D:/OpenClaw/agents/ops/agent',
          isDefault: true,
          model: {
            primary: 'openai/gpt-5.4',
            fallbacks: ['openai/gpt-5.4-mini'],
          },
          params: {
            temperature: 0.3,
          },
          paramSources: {
            temperature: 'defaults',
          },
        },
      ] as any,
      [
        {
          agent: {
            id: 'ops-lead',
            name: 'Ops Lead Runtime',
            description: 'Runtime description',
            avatar: 'R',
            systemPrompt: 'Handle incidents',
            creator: 'Runtime',
          },
          focusAreas: ['Operations'],
          automationFitScore: 88,
          configSource: 'runtime',
        },
        {
          agent: {
            id: 'scribe',
            name: 'Scribe',
            description: 'Runtime only',
            avatar: 'S',
            systemPrompt: 'Write docs',
            creator: 'Runtime',
          },
          focusAreas: ['Content'],
          automationFitScore: 52,
          configSource: 'runtime',
        },
      ] as any,
      [{ status: 'active' }] as any,
      [] as any,
    );

    assert.deepEqual(
      managedAgents?.map((agent) => agent.agent.id),
      ['ops-lead', 'scribe'],
    );
    assert.equal(managedAgents?.[0]?.agent.systemPrompt, 'Handle incidents');
    assert.equal(managedAgents?.[0]?.agent.creator, 'Runtime');
    assert.deepEqual(managedAgents?.[0]?.focusAreas, ['Operations']);
    assert.equal(managedAgents?.[0]?.automationFitScore, 88);
    assert.equal(managedAgents?.[0]?.isDefault, true);
    assert.deepEqual(managedAgents?.[0]?.params, { temperature: 0.3 });
    assert.deepEqual(managedAgents?.[0]?.paramSources, { temperature: 'defaults' });
    assert.equal(managedAgents?.[1]?.agent.id, 'scribe');
  },
);
