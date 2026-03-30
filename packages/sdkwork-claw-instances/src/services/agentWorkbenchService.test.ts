import assert from 'node:assert/strict';
import type { Skill } from '@sdkwork/claw-types';
import type { InstanceWorkbenchSnapshot } from '../types/index.ts';
import { createAgentWorkbenchService } from './agentWorkbenchService.ts';
import { buildOpenClawAgentFileId } from './openClawSupport.ts';

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

function createSkill(id: string, name: string): Skill {
  return {
    id,
    name,
    description: `${name} description`,
    author: 'OpenClaw',
    rating: 5,
    downloads: 12,
    category: 'Automation',
  };
}

function createWorkbench(): InstanceWorkbenchSnapshot {
  return {
    instance: {
      id: 'instance-openclaw',
      name: 'OpenClaw',
      type: 'OpenClaw Gateway',
      iconType: 'server',
      status: 'online',
      version: '2026.3.28',
      uptime: '8h',
      ip: '127.0.0.1',
      cpu: 12,
      memory: 24,
      totalMemory: '32 GB',
    },
    config: {
      port: '18789',
      sandbox: true,
      autoUpdate: true,
      logLevel: 'info',
      corsOrigins: '*',
    },
    token: 'token',
    logs: '',
    detail: {
      instance: {
        id: 'instance-openclaw',
        name: 'OpenClaw',
        runtimeKind: 'openclaw',
        deploymentMode: 'local-managed',
        transportKind: 'openclawGatewayWs',
        status: 'online',
        isBuiltIn: true,
        isDefault: true,
        iconType: 'server',
        version: '2026.3.28',
        typeLabel: 'OpenClaw Gateway',
        host: '127.0.0.1',
        port: 18789,
        baseUrl: 'http://127.0.0.1:18789',
        websocketUrl: 'ws://127.0.0.1:18789',
        cpu: 12,
        memory: 24,
        totalMemory: '32 GB',
        uptime: '8h',
        capabilities: ['chat', 'models', 'tasks', 'files', 'tools'],
        storage: {
          provider: 'localFile',
          namespace: 'instance-openclaw',
        },
        config: {
          port: '18789',
          sandbox: true,
          autoUpdate: true,
          logLevel: 'info',
          corsOrigins: '*',
          baseUrl: 'http://127.0.0.1:18789',
          websocketUrl: 'ws://127.0.0.1:18789',
          authToken: 'token',
        },
        createdAt: 1,
        updatedAt: 1,
        lastSeenAt: 1,
      },
      config: {
        port: '18789',
        sandbox: true,
        autoUpdate: true,
        logLevel: 'info',
        corsOrigins: '*',
        baseUrl: 'http://127.0.0.1:18789',
        websocketUrl: 'ws://127.0.0.1:18789',
        authToken: 'token',
      },
      logs: '',
      health: {
        score: 92,
        status: 'healthy',
        checks: [],
        evaluatedAt: 1,
      },
      lifecycle: {
        owner: 'localProcess',
        startStopSupported: true,
        configWritable: true,
        notes: [],
      },
      storage: {
        status: 'ready',
        provider: 'localFile',
        namespace: 'instance-openclaw',
        durable: true,
        queryable: false,
        transactional: false,
        remote: false,
      },
      connectivity: {
        primaryTransport: 'openclawGatewayWs',
        endpoints: [],
      },
      observability: {
        status: 'ready',
        logAvailable: true,
        logPreview: [],
        metricsSource: 'runtime',
        lastSeenAt: 1,
      },
      dataAccess: {
        routes: [],
      },
      artifacts: [],
      capabilities: [],
      officialRuntimeNotes: [],
      workbench: null,
    } as any,
    managedConfigPath: 'C:/OpenClaw/.openclaw/openclaw.json',
    managedChannels: [],
    healthScore: 92,
    runtimeStatus: 'healthy',
    connectedChannelCount: 2,
    activeTaskCount: 2,
    installedSkillCount: 2,
    readyToolCount: 2,
    sectionCounts: {
      overview: 1,
      channels: 3,
      cronTasks: 2,
      llmProviders: 2,
      agents: 2,
      skills: 2,
      files: 2,
      memory: 0,
      tools: 2,
    },
    sectionAvailability: {
      overview: {
        status: 'ready',
        detail: 'ready',
      },
      channels: {
        status: 'ready',
        detail: 'ready',
      },
      cronTasks: {
        status: 'ready',
        detail: 'ready',
      },
      llmProviders: {
        status: 'ready',
        detail: 'ready',
      },
      agents: {
        status: 'ready',
        detail: 'ready',
      },
      skills: {
        status: 'ready',
        detail: 'ready',
      },
      files: {
        status: 'ready',
        detail: 'ready',
      },
      memory: {
        status: 'planned',
        detail: 'planned',
      },
      tools: {
        status: 'ready',
        detail: 'ready',
      },
    },
    channels: [
      {
        id: 'telegram',
        name: 'Telegram',
        description: 'Telegram bot',
        status: 'connected',
        enabled: true,
        configurationMode: 'required',
        fieldCount: 2,
        configuredFieldCount: 2,
        setupSteps: [],
      },
      {
        id: 'slack',
        name: 'Slack',
        description: 'Slack workspace',
        status: 'disconnected',
        enabled: false,
        configurationMode: 'required',
        fieldCount: 2,
        configuredFieldCount: 2,
        setupSteps: [],
      },
      {
        id: 'discord',
        name: 'Discord',
        description: 'Discord bot',
        status: 'disconnected',
        enabled: false,
        configurationMode: 'required',
        fieldCount: 1,
        configuredFieldCount: 1,
        setupSteps: [],
      },
    ],
    tasks: [
      {
        id: 'task-main',
        name: 'Main Summary',
        prompt: 'Summarize',
        schedule: '0 * * * *',
        scheduleMode: 'cron',
        scheduleConfig: {
          cronExpression: '0 * * * *',
        },
        actionType: 'skill',
        status: 'active',
        sessionMode: 'main',
        wakeUpMode: 'immediate',
        executionContent: 'runAssistantTask',
        deliveryMode: 'publishSummary',
        agentId: 'main',
      },
      {
        id: 'task-research',
        name: 'Research Digest',
        prompt: 'Digest',
        schedule: '0 9 * * *',
        scheduleMode: 'cron',
        scheduleConfig: {
          cronExpression: '0 9 * * *',
        },
        actionType: 'skill',
        status: 'active',
        sessionMode: 'isolated',
        wakeUpMode: 'immediate',
        executionContent: 'runAssistantTask',
        deliveryMode: 'publishSummary',
        agentId: 'research',
      },
    ],
    agents: [
      {
        agent: {
          id: 'main',
          name: 'Main',
          description: 'Default agent',
          avatar: 'M',
          systemPrompt: 'Main',
          creator: 'OpenClaw',
        },
        focusAreas: ['Operations'],
        automationFitScore: 60,
        workspace: 'C:/OpenClaw/.openclaw/workspace',
        agentDir: 'C:/OpenClaw/.openclaw/agents/main/agent',
        isDefault: true,
        model: {
          primary: 'openai/gpt-4.1',
          fallbacks: ['openai/o4-mini'],
        },
      },
      {
        agent: {
          id: 'research',
          name: 'Research',
          description: 'Research agent',
          avatar: 'R',
          systemPrompt: 'Research',
          creator: 'OpenClaw',
        },
        focusAreas: ['Analytics'],
        automationFitScore: 88,
        workspace: 'C:/OpenClaw/.openclaw/workspace-research',
        agentDir: 'C:/OpenClaw/.openclaw/agents/research/agent',
        isDefault: false,
        model: {
          primary: 'anthropic/claude-3-7-sonnet',
          fallbacks: ['openai/gpt-4.1'],
        },
      },
    ],
    skills: [createSkill('shared-skill', 'Shared Skill')],
    files: [
      {
        id: buildOpenClawAgentFileId(
          'main',
          'AGENTS.md',
          'C:/OpenClaw/.openclaw/workspace/AGENTS.md',
        ),
        name: 'AGENTS.md',
        path: 'C:/OpenClaw/.openclaw/workspace/AGENTS.md',
        category: 'prompt',
        language: 'markdown',
        size: '1 KB',
        updatedAt: '2026-03-23T00:00:00.000Z',
        status: 'synced',
        description: 'Main agent prompt',
        content: '# Main agent',
        isReadonly: false,
      },
      {
        id: buildOpenClawAgentFileId(
          'research',
          'AGENTS.md',
          'C:/OpenClaw/.openclaw/workspace-research/AGENTS.md',
        ),
        name: 'AGENTS.md',
        path: 'C:/OpenClaw/.openclaw/workspace-research/AGENTS.md',
        category: 'prompt',
        language: 'markdown',
        size: '1 KB',
        updatedAt: '2026-03-23T00:00:00.000Z',
        status: 'synced',
        description: 'Research agent prompt',
        content: '# Research agent',
        isReadonly: false,
      },
    ],
    llmProviders: [
      {
        id: 'openai',
        name: 'OpenAI',
        provider: 'openai',
        endpoint: 'http://127.0.0.1:13003/api/v1',
        apiKeySource: 'env:OPENAI_API_KEY',
        status: 'ready',
        defaultModelId: 'gpt-4.1',
        description: 'OpenAI router',
        icon: 'OA',
        lastCheckedAt: '2026-03-23T00:00:00.000Z',
        capabilities: ['chat'],
        models: [
          {
            id: 'gpt-4.1',
            name: 'GPT-4.1',
            role: 'primary',
            contextWindow: 'Unknown',
          },
          {
            id: 'o4-mini',
            name: 'o4-mini',
            role: 'fallback',
            contextWindow: 'Unknown',
          },
        ],
        config: {
          temperature: 0.2,
          topP: 1,
          maxTokens: 8192,
          timeoutMs: 60000,
          streaming: true,
        },
      },
      {
        id: 'anthropic',
        name: 'Anthropic',
        provider: 'anthropic',
        endpoint: 'http://127.0.0.1:13003/api/v1',
        apiKeySource: 'env:ANTHROPIC_API_KEY',
        status: 'ready',
        defaultModelId: 'claude-3-7-sonnet',
        description: 'Anthropic router',
        icon: 'AT',
        lastCheckedAt: '2026-03-23T00:00:00.000Z',
        capabilities: ['chat'],
        models: [
          {
            id: 'claude-3-7-sonnet',
            name: 'Claude 3.7 Sonnet',
            role: 'primary',
            contextWindow: 'Unknown',
          },
        ],
        config: {
          temperature: 0.2,
          topP: 1,
          maxTokens: 8192,
          timeoutMs: 60000,
          streaming: true,
        },
      },
    ],
    memories: [],
    tools: [
      {
        id: 'shared-tool',
        name: 'Shared Tool',
        description: 'Shared fallback tool',
        category: 'integration',
        status: 'ready',
        access: 'execute',
        command: 'shared-tool',
      },
    ],
  };
}

await runTest(
  'agentWorkbenchService builds an agent-scoped workbench with filtered tasks/files plus per-agent skills, tools, and channel bindings',
  async () => {
    const service = createAgentWorkbenchService({
      openClawGatewayClient: {
        getSkillsStatus: async (_instanceId, args = {}) => {
          if (args.agentId === 'research') {
            return {
              agentId: 'research',
              workspace: 'C:/OpenClaw/.openclaw/workspace-research',
              skills: [
                {
                  id: 'research-skill',
                  name: 'Research Skill',
                  description: 'Research workflows',
                  author: 'OpenClaw',
                  readme: '# Research Skill',
                  bundled: false,
                  skillKey: 'research-skill',
                  source: 'workspace',
                  filePath: 'C:/OpenClaw/.openclaw/workspace-research/skills/research-skill/SKILL.md',
                  baseDir: 'C:/OpenClaw/.openclaw/workspace-research/skills/research-skill',
                  primaryEnv: 'RESEARCH_API_KEY',
                  homepage: 'https://clawhub.com/skills/research-skill',
                  emoji: '🔎',
                  eligible: false,
                  disabled: false,
                  blockedByAllowlist: false,
                  missing: {
                    env: ['RESEARCH_API_KEY'],
                    bins: ['uv'],
                    os: ['darwin'],
                  },
                  configChecks: [
                    {
                      path: 'channels.telegram.accounts.research.botToken',
                      satisfied: false,
                    },
                  ],
                  install: [
                    {
                      id: 'uv',
                      kind: 'uv',
                      label: 'Install research-skill (uv)',
                      bins: ['uv'],
                    },
                  ],
                },
              ],
            };
          }

          return {
            agentId: 'main',
            workspace: 'C:/OpenClaw/.openclaw/workspace',
            skills: [],
          };
        },
        getToolsCatalog: async (_instanceId, args = {}) => {
          if (args.agentId === 'research') {
            return {
              agentId: 'research',
              profiles: [],
              groups: [
                {
                  id: 'group:reasoning',
                  label: 'Reasoning',
                  tools: [
                    {
                      id: 'web.search',
                      label: 'Web Search',
                      description: 'Search the web',
                    },
                  ],
                },
              ],
            };
          }

          return {
            agentId: 'main',
            profiles: [],
            groups: [],
          };
        },
      },
      readOpenClawConfigSnapshot: async () =>
        ({
          root: {
            channels: {
              telegram: {
                accounts: {
                  default: {
                    botToken: 'telegram-default',
                  },
                  research: {
                    botToken: 'telegram-research',
                  },
                },
              },
              discord: {
                accounts: {
                  default: {
                    token: 'discord-default',
                  },
                  research: {
                    token: 'discord-research',
                  },
                },
              },
              slack: {
                botToken: 'xoxb-research',
                appToken: 'xapp-research',
                enabled: false,
              },
            },
            bindings: [
              {
                agentId: 'research',
                match: {
                  channel: 'telegram',
                  accountId: 'research',
                },
              },
              {
                agentId: 'research',
                match: {
                  channel: 'discord',
                  accountId: 'research',
                },
              },
            ],
            skills: {
              entries: {
                'research-skill': {
                  apiKey: 'research-secret',
                  env: {
                    RESEARCH_API_KEY: 'token-value',
                    RESEARCH_REGION: 'cn-hz',
                  },
                },
              },
            },
            agents: {
              defaults: {
                model: {
                  primary: 'openai/gpt-4.1',
                },
              },
              list: [
                {
                  id: 'main',
                  default: true,
                },
                {
                  id: 'research',
                  model: {
                    primary: 'anthropic/claude-3-7-sonnet',
                    fallbacks: ['openai/gpt-4.1'],
                  },
                },
              ],
            },
          },
        }) as any,
    });

    const snapshot = await service.getAgentWorkbench({
      instanceId: 'instance-openclaw',
      workbench: createWorkbench(),
      agentId: 'research',
    });

    assert.equal(snapshot.agent.agent.id, 'research');
    assert.equal(
      snapshot.paths.authProfilesPath,
      'C:/OpenClaw/.openclaw/agents/research/agent/auth-profiles.json',
    );
    assert.equal(
      snapshot.paths.modelsRegistryPath,
      'C:/OpenClaw/.openclaw/agents/research/agent/models.json',
    );
    assert.equal(
      snapshot.paths.sessionsPath,
      'C:/OpenClaw/.openclaw/agents/research/sessions',
    );
    assert.deepEqual(
      snapshot.tasks.map((task) => task.id),
      ['task-research'],
    );
    assert.deepEqual(
      snapshot.files.map((file) => file.id),
      [
        buildOpenClawAgentFileId(
          'research',
          'AGENTS.md',
          'C:/OpenClaw/.openclaw/workspace-research/AGENTS.md',
        ),
      ],
    );
    assert.deepEqual(
      snapshot.skills.map((skill) => skill.id),
      ['research-skill'],
    );
    assert.equal(snapshot.skills[0]?.skillKey, 'research-skill');
    assert.equal(snapshot.skills[0]?.scope, 'workspace');
    assert.equal(snapshot.skills[0]?.eligible, false);
    assert.equal(snapshot.skills[0]?.disabled, false);
    assert.equal(snapshot.skills[0]?.primaryEnv, 'RESEARCH_API_KEY');
    assert.equal(snapshot.skills[0]?.homepage, 'https://clawhub.com/skills/research-skill');
    assert.equal(snapshot.skills[0]?.emoji, '🔎');
    assert.equal(snapshot.skills[0]?.configEntry.apiKey, 'research-secret');
    assert.deepEqual(snapshot.skills[0]?.configEntry.env, {
      RESEARCH_API_KEY: 'token-value',
      RESEARCH_REGION: 'cn-hz',
    });
    assert.equal(snapshot.skills[0]?.configEntry.hasEntry, true);
    assert.deepEqual(snapshot.skills[0]?.missing.env, ['RESEARCH_API_KEY']);
    assert.deepEqual(snapshot.skills[0]?.missing.os, ['darwin']);
    assert.deepEqual(snapshot.skills[0]?.configChecks, [
      {
        path: 'channels.telegram.accounts.research.botToken',
        satisfied: false,
      },
    ]);
    assert.deepEqual(
      snapshot.skills[0]?.installOptions,
      [
        {
          id: 'uv',
          kind: 'uv',
          label: 'Install research-skill (uv)',
          bins: ['uv'],
        },
      ],
    );
    assert.deepEqual(
      snapshot.tools.map((tool) => tool.id),
      ['web.search'],
    );
    assert.deepEqual(
      snapshot.modelProviders.map((provider) => provider.id),
      ['anthropic', 'openai'],
    );
    assert.equal(snapshot.channels.find((channel) => channel.id === 'telegram')?.routeStatus, 'bound');
    assert.deepEqual(
      snapshot.channels.find((channel) => channel.id === 'telegram')?.accountIds,
      ['research'],
    );
    assert.equal(snapshot.channels.find((channel) => channel.id === 'discord')?.routeStatus, 'bound');
    assert.equal(snapshot.channels.find((channel) => channel.id === 'slack')?.routeStatus, 'available');
  },
);

await runTest(
  'agentWorkbenchService falls back to gateway agent file APIs when the aggregated workbench file list does not include the selected workspace files',
  async () => {
    const service = createAgentWorkbenchService({
      openClawGatewayClient: {
        getSkillsStatus: async () => ({
          agentId: 'research',
          workspace: 'C:/OpenClaw/.openclaw/workspace-research',
          skills: [],
        }),
        getToolsCatalog: async () => ({
          agentId: 'research',
          profiles: [],
          groups: [],
        }),
        listAgentFiles: async () => ({
          agentId: 'research',
          workspace: 'C:/OpenClaw/.openclaw/workspace-research',
          files: [
            {
              name: 'AGENTS.md',
              path: 'C:/OpenClaw/.openclaw/workspace-research/AGENTS.md',
              size: 128,
              updatedAtMs: 1742353200000,
            },
          ],
        }),
        getAgentFile: async () => ({
          agentId: 'research',
          workspace: 'C:/OpenClaw/.openclaw/workspace-research',
          file: {
            name: 'AGENTS.md',
            path: 'C:/OpenClaw/.openclaw/workspace-research/AGENTS.md',
            content: '# Research agent',
            size: 128,
            updatedAtMs: 1742353200000,
          },
        }),
      } as any,
      readOpenClawConfigSnapshot: async () =>
        ({
          root: {},
        }) as any,
    });

    const snapshot = await service.getAgentWorkbench({
      instanceId: 'instance-openclaw',
      workbench: {
        ...createWorkbench(),
        files: [],
      },
      agentId: 'research',
    });

    assert.equal(snapshot.files.length, 1);
    assert.equal(
      snapshot.files[0]?.id,
      buildOpenClawAgentFileId(
        'research',
        'AGENTS.md',
        'C:/OpenClaw/.openclaw/workspace-research/AGENTS.md',
      ),
    );
    assert.equal(
      snapshot.files[0]?.path,
      'C:/OpenClaw/.openclaw/workspace-research/AGENTS.md',
    );
    assert.equal(snapshot.files[0]?.content, '# Research agent');
  },
);

await runTest(
  'agentWorkbenchService keeps default-agent legacy workspace files when gateway file APIs are unavailable',
  async () => {
    const gatewayFileReads: string[] = [];
    const service = createAgentWorkbenchService({
      openClawGatewayClient: {
        getSkillsStatus: async () => ({
          agentId: 'main',
          workspace: 'C:/OpenClaw/.openclaw/workspace',
          skills: [],
        }),
        getToolsCatalog: async () => ({
          agentId: 'main',
          profiles: [],
          groups: [],
        }),
        listAgentFiles: async () => {
          gatewayFileReads.push('list');
          throw new Error('gateway unavailable');
        },
        getAgentFile: async () => {
          gatewayFileReads.push('get');
          throw new Error('gateway unavailable');
        },
      } as any,
      readOpenClawConfigSnapshot: async () =>
        ({
          root: {
            agents: {
              list: [
                {
                  id: 'main',
                  default: true,
                },
              ],
            },
          },
        }) as any,
    });

    const snapshot = await service.getAgentWorkbench({
      instanceId: 'instance-openclaw',
      workbench: {
        ...createWorkbench(),
        files: [
          {
            id: '/workspace/main/AGENTS.md',
            name: 'AGENTS.md',
            path: '/workspace/main/AGENTS.md',
            category: 'prompt',
            language: 'markdown',
            size: '1 KB',
            updatedAt: '2026-03-23T00:00:00.000Z',
            status: 'synced',
            description: 'Legacy main agent prompt',
            content: '# Main legacy agent',
            isReadonly: false,
          },
        ],
      },
      agentId: 'main',
    });

    assert.equal(gatewayFileReads.length, 1);
    assert.equal(snapshot.files.length, 1);
    assert.equal(snapshot.files[0]?.id, '/workspace/main/AGENTS.md');
    assert.equal(snapshot.files[0]?.content, '# Main legacy agent');
  },
);

await runTest(
  'agentWorkbenchService keeps workspace files available when unrelated skill or tool requests fail and aligns workspace-derived skill scope with the live workspace',
  async () => {
    const service = createAgentWorkbenchService({
      openClawGatewayClient: {
        getSkillsStatus: async () => {
          throw new Error('skills status unavailable');
        },
        getToolsCatalog: async () => {
          throw new Error('tools catalog unavailable');
        },
        listAgentFiles: async () => ({
          agentId: 'research',
          workspace: 'C:/OpenClaw/.openclaw/workspace-research-live',
          files: [
            {
              name: 'AGENTS.md',
              path: 'C:/OpenClaw/.openclaw/workspace-research-live/AGENTS.md',
              size: 128,
              updatedAtMs: 1742353200000,
            },
          ],
        }),
        getAgentFile: async () => ({
          agentId: 'research',
          workspace: 'C:/OpenClaw/.openclaw/workspace-research-live',
          file: {
            name: 'AGENTS.md',
            path: 'C:/OpenClaw/.openclaw/workspace-research-live/AGENTS.md',
            content: '# Research agent',
            size: 128,
            updatedAtMs: 1742353200000,
          },
        }),
      } as any,
      readOpenClawConfigSnapshot: async () =>
        ({
          root: {},
        }) as any,
    });

    const workbench = createWorkbench();
    workbench.agents = workbench.agents.map((agent) =>
      agent.agent.id === 'research'
        ? {
            ...agent,
            workspace: 'C:/OpenClaw/.openclaw/workspace-research-stale',
          }
        : agent,
    );

    const snapshot = await service.getAgentWorkbench({
      instanceId: 'instance-openclaw',
      workbench: {
        ...workbench,
        files: [],
      },
      agentId: 'research',
    });

    assert.equal(snapshot.files.length, 1);
    assert.equal(
      snapshot.paths.workspacePath,
      'C:/OpenClaw/.openclaw/workspace-research-live',
    );
    assert.equal(
      snapshot.agent.workspace,
      'C:/OpenClaw/.openclaw/workspace-research-live',
    );
    assert.deepEqual(snapshot.skills, []);
    assert.deepEqual(snapshot.tools, []);
  },
);

await runTest(
  'agentWorkbenchService resolves workspace-scoped skill metadata against the live workspace instead of a stale agent snapshot workspace',
  async () => {
    const service = createAgentWorkbenchService({
      openClawGatewayClient: {
        getSkillsStatus: async () => ({
          agentId: 'research',
          workspace: 'C:/OpenClaw/.openclaw/workspace-research-live',
          skills: [
            {
              id: 'workspace-skill',
              name: 'Workspace Skill',
              description: 'Workspace-only skill',
              skillKey: 'workspace-skill',
              source: 'workspace',
              filePath:
                'C:/OpenClaw/.openclaw/workspace-research-live/skills/workspace-skill/SKILL.md',
              baseDir:
                'C:/OpenClaw/.openclaw/workspace-research-live/skills/workspace-skill',
            },
          ],
        }),
        getToolsCatalog: async () => ({
          agentId: 'research',
          profiles: [],
          groups: [],
        }),
        listAgentFiles: async () => ({
          agentId: 'research',
          workspace: 'C:/OpenClaw/.openclaw/workspace-research-live',
          files: [
            {
              name: 'AGENTS.md',
              path: 'C:/OpenClaw/.openclaw/workspace-research-live/AGENTS.md',
              size: 128,
              updatedAtMs: 1742353200000,
            },
          ],
        }),
        getAgentFile: async () => ({
          agentId: 'research',
          workspace: 'C:/OpenClaw/.openclaw/workspace-research-live',
          file: {
            name: 'AGENTS.md',
            path: 'C:/OpenClaw/.openclaw/workspace-research-live/AGENTS.md',
            content: '# Research agent',
            size: 128,
            updatedAtMs: 1742353200000,
          },
        }),
      } as any,
      readOpenClawConfigSnapshot: async () =>
        ({
          root: {},
        }) as any,
    });

    const workbench = createWorkbench();
    workbench.agents = workbench.agents.map((agent) =>
      agent.agent.id === 'research'
        ? {
            ...agent,
            workspace: 'C:/OpenClaw/.openclaw/workspace-research-stale',
          }
        : agent,
    );

    const snapshot = await service.getAgentWorkbench({
      instanceId: 'instance-openclaw',
      workbench: {
        ...workbench,
        files: [],
      },
      agentId: 'research',
    });

    assert.equal(snapshot.skills.length, 1);
    assert.equal(snapshot.skills[0]?.scope, 'workspace');
    assert.equal(
      snapshot.skills[0]?.filePath,
      'C:/OpenClaw/.openclaw/workspace-research-live/skills/workspace-skill/SKILL.md',
    );
    assert.equal(
      snapshot.paths.skillsDirectoryPath,
      'C:/OpenClaw/.openclaw/workspace-research-live/skills',
    );
  },
);

await runTest(
  'agentWorkbenchService exposes per-agent skill allowlists separately from shared skill configuration and keeps bundled skills visible',
  async () => {
    const service = createAgentWorkbenchService({
      openClawGatewayClient: {
        getSkillsStatus: async () => ({
          agentId: 'research',
          workspace: 'C:/OpenClaw/.openclaw/workspace-research',
          skills: [
            {
              id: 'bundled-browser',
              name: 'Browser',
              description: 'Bundled browser automation',
              bundled: true,
              skillKey: 'browser',
              source: 'bundled',
              blockedByAllowlist: false,
            },
            {
              id: 'workspace-research',
              name: 'Research',
              description: 'Workspace research workflows',
              bundled: false,
              skillKey: 'research',
              source: 'workspace',
              blockedByAllowlist: true,
            },
          ],
        }),
        getToolsCatalog: async () => ({
          agentId: 'research',
          profiles: [],
          groups: [],
        }),
      } as any,
      readOpenClawConfigSnapshot: async () =>
        ({
          root: {
            agents: {
              list: [
                {
                  id: 'main',
                  default: true,
                },
                {
                  id: 'research',
                  skills: ['Browser'],
                },
              ],
            },
          },
        }) as any,
    });

    const snapshot = await service.getAgentWorkbench({
      instanceId: 'instance-openclaw',
      workbench: createWorkbench(),
      agentId: 'research',
    });

    assert.equal(snapshot.skillSelection.usesAllowlist, true);
    assert.deepEqual(snapshot.skillSelection.configuredSkillNames, ['Browser']);
    assert.equal(snapshot.skills.find((skill) => skill.name === 'Browser')?.scope, 'bundled');
    assert.equal(snapshot.skills.find((skill) => skill.name === 'Research')?.blockedByAllowlist, true);
  },
);
