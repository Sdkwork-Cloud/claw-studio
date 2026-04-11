import assert from 'node:assert/strict';
import { buildInstanceDetailDerivedState } from './instanceDetailDerivedState.ts';

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

function createWorkbench() {
  return {
    instance: {
      id: 'instance-1',
      name: 'OpenClaw Studio',
      type: 'OpenClaw',
      iconType: 'server',
      status: 'online',
      version: '2026.4.8',
      uptime: '2h',
      ip: '127.0.0.1',
      cpu: 12,
      memory: 8,
      totalMemory: '16 GB',
    },
    config: {
      port: 3456,
      sandbox: true,
      autoUpdate: false,
      corsOrigins: '*',
    },
    detail: {
      instance: {
        id: 'instance-1',
        name: 'OpenClaw Studio',
        runtimeKind: 'openclaw',
        deploymentMode: 'local-managed',
        status: 'online',
        isBuiltIn: true,
      },
      lifecycle: {
        owner: 'appManaged',
        startStopSupported: true,
        configWritable: true,
        lifecycleControllable: true,
        workbenchManaged: true,
        endpointObserved: true,
        notes: ['Managed by Claw Studio.'],
      },
      storage: {
        namespace: 'openclaw-workspace',
      },
      health: {
        status: 'healthy',
      },
      dataAccess: {
        routes: [
          {
            id: 'config-managed',
            scope: 'config',
            mode: 'managedDirectory',
            readonly: false,
            target: 'D:/OpenClaw/.openclaw',
          },
        ],
      },
      artifacts: [
        {
          id: 'workspace-root',
          kind: 'workspaceDirectory',
          location: 'D:/OpenClaw/.openclaw/workspace',
        },
      ],
      consoleAccess: {
        available: true,
        url: 'http://127.0.0.1:3456/ui',
        autoLoginUrl: 'http://127.0.0.1:3456/ui/autologin',
        installMethod: 'pnpm',
      },
      officialRuntimeNotes: [],
    },
    managedConfigPath: 'D:/OpenClaw/.openclaw/openclaw.json',
    managedChannels: [
      {
        id: 'slack',
        name: 'Slack',
        description: 'Managed Slack channel',
        status: 'connected',
        enabled: true,
        configurationMode: 'managed',
        fieldCount: 1,
        setupSteps: ['Authorize Slack'],
        fields: [{ key: 'token', label: 'Token', required: true }],
        values: {
          token: 'managed-token',
        },
      },
    ],
    managedWebSearchConfig: {
      enabled: true,
      provider: 'serpapi',
      maxResults: 5,
      timeoutSeconds: 20,
      cacheTtlMinutes: 30,
      providers: [
        {
          id: 'serpapi',
          label: 'SerpAPI',
          apiKeySource: 'SERPAPI_KEY',
          baseUrl: 'https://serpapi.example.com',
          model: 'serpapi-default',
          advancedConfig: '{"safe":true}',
        },
      ],
    },
    managedXSearchConfig: {
      enabled: true,
    },
    managedWebSearchNativeCodexConfig: {
      enabled: true,
    },
    managedWebFetchConfig: {
      enabled: true,
    },
    managedAuthCooldownsConfig: {
      rateLimitedProfileRotations: 1,
    },
    managedDreamingConfig: {
      enabled: true,
    },
    sectionAvailability: {},
    sectionCounts: {
      overview: 1,
      channels: 1,
      cronTasks: 0,
      llmProviders: 1,
      agents: 1,
      skills: 0,
      files: 0,
      memory: 0,
      tools: 0,
      config: 1,
    },
    channels: [
      {
        id: 'slack',
        name: 'Slack',
        description: 'Runtime Slack channel',
        status: 'connected',
        enabled: true,
        configurationMode: 'managed',
        fieldCount: 1,
        setupSteps: ['Use runtime setup'],
        fields: [{ key: 'token', label: 'Token', required: true }],
        values: {},
      },
      {
        id: 'discord',
        name: 'Discord',
        description: 'Read only Discord',
        status: 'disconnected',
        enabled: false,
        configurationMode: 'managed',
        fieldCount: 1,
        setupSteps: ['Connect Discord'],
        fields: [{ key: 'token', label: 'Token', required: true }],
        values: { token: '' },
      },
    ],
    tasks: [],
    agents: [
      {
        agent: {
          id: 'agent-main',
          name: 'Main',
          creator: 'SDKWork',
        },
        workspace: 'D:/OpenClaw/.openclaw/workspace',
      },
    ],
    skills: [],
    files: [],
    llmProviders: [
      {
        id: 'openai',
        name: 'OpenAI',
        endpoint: 'https://api.openai.com/v1',
        apiKeySource: 'OPENAI_API_KEY',
        defaultModelId: 'gpt-5.4',
        reasoningModelId: 'o4-mini',
        embeddingModelId: 'text-embedding-3-large',
        config: {
          request: {
            timeoutMs: 30000,
          },
        },
        models: [
          {
            id: 'model-gpt-5-4',
            name: 'GPT-5.4',
          },
          {
            id: 'model-o4-mini',
            name: 'o4-mini',
          },
        ],
      },
    ],
    memories: [],
    tools: [],
    connectedChannelCount: 1,
    activeTaskCount: 0,
    installedSkillCount: 0,
    readyToolCount: 0,
    runtimeStatus: 'healthy',
    healthScore: 98,
  } as any;
}

await runTest(
  'buildInstanceDetailDerivedState composes page-facing provider, channel, and management presentation state',
  () => {
    const workbench = createWorkbench();
    const derivedState = buildInstanceDetailDerivedState({
      id: 'instance-1',
      workbench,
      selectedProviderId: 'openai',
      providerDeleteId: 'openai',
      providerModelDeleteId: 'model-gpt-5-4',
      providerDrafts: {},
      providerRequestDrafts: {},
      selectedManagedChannelId: 'slack',
      managedChannelDrafts: {
        slack: {
          token: 'draft-token',
        },
      },
      selectedWebSearchProviderId: 'serpapi',
      webSearchProviderDrafts: {},
      providerDialogDraft: {
        id: '',
        name: 'OpenAI',
        endpoint: 'https://api.openai.com/v1',
        apiKeySource: 'OPENAI_API_KEY',
        defaultModelId: 'gpt-5.4',
        reasoningModelId: 'o4-mini',
        embeddingModelId: 'text-embedding-3-large',
        modelsText: 'gpt-5.4|GPT-5.4',
        requestOverridesText: '{ timeoutMs: 30000 }',
      },
      t: (key: string) => key,
    });

    assert.equal(derivedState.instance?.id, 'instance-1');
    assert.equal(derivedState.detail?.instance.runtimeKind, 'openclaw');
    assert.equal(derivedState.isOpenClawConfigWritable, true);
    assert.equal(derivedState.canControlLifecycle, true);
    assert.equal(derivedState.canRestartLifecycle, true);
    assert.equal(derivedState.canEditManagedChannels, true);
    assert.equal(derivedState.canEditManagedWebSearch, true);
    assert.equal(derivedState.canEditManagedWebFetch, true);
    assert.equal(derivedState.canEditManagedDreaming, true);
    assert.equal(derivedState.isProviderConfigReadonly, true);
    assert.equal(derivedState.canManageOpenClawProviders, false);
    assert.equal(derivedState.canOpenOpenClawConsole, true);
    assert.equal(derivedState.managementSummary?.entries.length, 5);
    assert.equal(derivedState.providerSelectionState.selectedProvider?.id, 'openai');
    assert.equal(derivedState.providerSelectionState.deletingProvider?.id, 'openai');
    assert.equal(derivedState.providerSelectionState.deletingProviderModel?.id, 'model-gpt-5-4');
    assert.equal(derivedState.managedChannelSelectionState.selectedManagedChannel?.id, 'slack');
    assert.equal(
      derivedState.managedChannelSelectionState.selectedManagedChannelDraft?.token,
      'draft-token',
    );
    assert.equal(
      derivedState.webSearchProviderSelectionState.selectedProvider?.id,
      'serpapi',
    );
    assert.equal(
      derivedState.webSearchProviderSelectionState.selectedProviderDraft?.apiKeySource,
      'SERPAPI_KEY',
    );
    assert.equal(derivedState.providerDialogPresentation.requestParseError, null);
    assert.equal(derivedState.availableAgentModelOptions.length, 2);
    assert.equal(derivedState.readonlyChannelWorkspaceItems.length, 2);
    assert.equal(derivedState.managedChannelWorkspaceItems.length, 1);
    assert.equal(derivedState.managedChannelWorkspaceItems[0]?.description, 'Runtime Slack channel');
    assert.equal(derivedState.managedChannelWorkspaceItems[0]?.values.token, 'draft-token');
  },
);
