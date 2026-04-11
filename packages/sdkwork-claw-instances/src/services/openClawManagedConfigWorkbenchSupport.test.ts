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

let managedConfigWorkbenchSupportModule:
  | typeof import('./openClawManagedConfigWorkbenchSupport.ts')
  | undefined;

try {
  managedConfigWorkbenchSupportModule = await import('./openClawManagedConfigWorkbenchSupport.ts');
} catch {
  managedConfigWorkbenchSupportModule = undefined;
}

await runTest(
  'openClawManagedConfigWorkbenchSupport exposes shared managed config workbench helpers',
  () => {
    assert.ok(
      managedConfigWorkbenchSupportModule,
      'Expected openClawManagedConfigWorkbenchSupport.ts to exist',
    );
    assert.equal(
      typeof managedConfigWorkbenchSupportModule?.buildManagedConfigWorkbenchState,
      'function',
    );
    assert.equal(
      typeof managedConfigWorkbenchSupportModule?.createEmptyManagedOpenClawConfigSnapshot,
      'function',
    );
  },
);

await runTest(
  'buildManagedConfigWorkbenchState clones managed config surfaces and derives insights',
  () => {
    const managedConfigSnapshot = {
      configPath: 'D:/OpenClaw/.openclaw/openclaw.json',
      providerSnapshots: [],
      agentSnapshots: [
        {
          id: 'Ops Lead',
          name: 'Ops Lead',
          description: 'Managed ops agent',
          avatar: 'O',
          workspace: 'D:/OpenClaw/workspace',
          agentDir: 'D:/OpenClaw/agents/ops',
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
      ],
      channelSnapshots: [
        {
          id: 'slack',
          name: 'Slack',
          description: 'Managed Slack channel',
          status: 'connected',
          enabled: true,
          configurationMode: 'required',
          fieldCount: 1,
          configuredFieldCount: 1,
          setupSteps: ['Configure token'],
          values: {
            token: 'env:SLACK_TOKEN',
          },
          fields: [
            {
              id: 'token',
              label: 'Token',
            },
          ],
        },
      ],
      webSearchConfig: {
        enabled: true,
        provider: 'searxng',
        maxResults: 10,
        timeoutSeconds: 45,
        cacheTtlMinutes: 20,
        providers: [
          {
            id: 'searxng',
            name: 'SearXNG',
            description: 'Self-hosted search',
            apiKeySource: '',
            baseUrl: 'http://127.0.0.1:8080',
            model: '',
            advancedConfig: '{\n  "language": "zh-CN"\n}',
            supportsApiKey: false,
            supportsBaseUrl: true,
            supportsModel: false,
          },
        ],
      },
      xSearchConfig: {
        enabled: true,
        apiKeySource: 'xai-live',
        model: 'grok-4.1',
        inlineCitations: true,
        maxTurns: 3,
        timeoutSeconds: 30,
        cacheTtlMinutes: 15,
        advancedConfig: '{\n  "userTag": "internal-research"\n}',
      },
      webSearchNativeCodexConfig: {
        enabled: true,
        mode: 'cached',
        allowedDomains: ['example.com', 'openai.com'],
        contextSize: 'high',
        userLocation: {
          country: 'US',
          city: 'New York',
          timezone: 'America/New_York',
        },
        advancedConfig: '{\n  "reasoningEffort": "medium"\n}',
      },
      webFetchConfig: {
        enabled: true,
        maxChars: 42000,
        maxCharsCap: 64000,
        maxResponseBytes: 2500000,
        timeoutSeconds: 28,
        cacheTtlMinutes: 9,
        maxRedirects: 4,
        readability: false,
        userAgent: 'SDKWork Fetch Bot/1.0',
        fallbackProvider: {
          providerId: 'firecrawl',
          name: 'Firecrawl Fetch',
          description: 'Use Firecrawl as the OpenClaw web_fetch fallback provider.',
          apiKeySource: 'fc-live',
          baseUrl: 'https://api.firecrawl.dev',
          advancedConfig: '{\n  "onlyMainContent": true\n}',
          supportsApiKey: true,
          supportsBaseUrl: true,
        },
      },
      authCooldownsConfig: {
        rateLimitedProfileRotations: 2,
        overloadedProfileRotations: 1,
        overloadedBackoffMs: 45000,
        billingBackoffHours: 5,
        billingMaxHours: 24,
        failureWindowHours: 24,
      },
      dreamingConfig: {
        enabled: true,
        frequency: '0 3 * * *',
      },
      root: {
        agents: {
          defaults: {
            model: {
              primary: 'openai/gpt-5.4',
            },
          },
        },
        tools: {
          sessions: {
            visibility: 'tree',
          },
          agentToAgent: {
            enabled: true,
            allow: ['ops-lead', ' reviewer ', '', null],
          },
        },
      },
    } as any;

    const managedConfigWorkbenchState =
      managedConfigWorkbenchSupportModule?.buildManagedConfigWorkbenchState(
        'D:/OpenClaw/.openclaw/openclaw.json',
        managedConfigSnapshot,
      );

    assert.equal(managedConfigWorkbenchState?.managedConfigPath, 'D:/OpenClaw/.openclaw/openclaw.json');
    assert.equal(managedConfigWorkbenchState?.configSectionCount, 1);
    assert.equal(managedConfigWorkbenchState?.managedConfigInsights?.defaultAgentId, 'Ops Lead');
    assert.equal(
      managedConfigWorkbenchState?.managedConfigInsights?.defaultModelRef,
      'openai/gpt-5.4',
    );
    assert.equal(managedConfigWorkbenchState?.managedConfigInsights?.sessionsVisibility, 'tree');
    assert.equal(managedConfigWorkbenchState?.managedConfigInsights?.agentToAgentEnabled, true);
    assert.deepEqual(
      managedConfigWorkbenchState?.managedConfigInsights?.agentToAgentAllow,
      ['ops-lead', 'reviewer'],
    );

    managedConfigWorkbenchState?.managedChannels?.[0]?.setupSteps.push('Invite bot');
    if (managedConfigWorkbenchState?.managedWebSearchConfig) {
      managedConfigWorkbenchState.managedWebSearchConfig.providers[0]!.name = 'Changed';
    }
    managedConfigWorkbenchState?.managedWebSearchNativeCodexConfig?.allowedDomains.push(
      'sdkwork.dev',
    );
    if (managedConfigWorkbenchState?.managedWebFetchConfig) {
      managedConfigWorkbenchState.managedWebFetchConfig.fallbackProvider.name = 'Changed';
    }
    if (managedConfigWorkbenchState?.managedAuthCooldownsConfig) {
      managedConfigWorkbenchState.managedAuthCooldownsConfig.failureWindowHours = 12;
    }
    if (managedConfigWorkbenchState?.managedDreamingConfig) {
      managedConfigWorkbenchState.managedDreamingConfig.frequency = '0 1 * * *';
    }

    assert.deepEqual(managedConfigSnapshot.channelSnapshots[0]?.setupSteps, ['Configure token']);
    assert.equal(managedConfigSnapshot.webSearchConfig.providers[0]?.name, 'SearXNG');
    assert.deepEqual(managedConfigSnapshot.webSearchNativeCodexConfig.allowedDomains, [
      'example.com',
      'openai.com',
    ]);
    assert.equal(managedConfigSnapshot.webFetchConfig.fallbackProvider.name, 'Firecrawl Fetch');
    assert.equal(managedConfigSnapshot.authCooldownsConfig.failureWindowHours, 24);
    assert.equal(managedConfigSnapshot.dreamingConfig.frequency, '0 3 * * *');
  },
);

await runTest(
  'createEmptyManagedOpenClawConfigSnapshot returns isolated defaults for missing managed config state',
  () => {
    const first =
      managedConfigWorkbenchSupportModule?.createEmptyManagedOpenClawConfigSnapshot(
        'D:/OpenClaw/.openclaw/openclaw.json',
      );
    const second =
      managedConfigWorkbenchSupportModule?.createEmptyManagedOpenClawConfigSnapshot(
        'D:/OpenClaw/.openclaw/openclaw.json',
      );

    assert.equal(first?.configPath, 'D:/OpenClaw/.openclaw/openclaw.json');
    assert.deepEqual(first?.providerSnapshots, []);
    assert.deepEqual(first?.agentSnapshots, []);
    assert.deepEqual(first?.channelSnapshots, []);
    assert.equal(first?.webFetchConfig.fallbackProvider.name, 'Firecrawl Fetch');

    if (first) {
      first.webFetchConfig.fallbackProvider.name = 'Mutated';
      first.webSearchConfig.providers.push({
        id: 'searxng',
        name: 'SearXNG',
        description: 'Mutated',
        apiKeySource: '',
        baseUrl: '',
        model: '',
        advancedConfig: '',
        supportsApiKey: false,
        supportsBaseUrl: true,
        supportsModel: false,
      });
    }

    assert.equal(second?.webFetchConfig.fallbackProvider.name, 'Firecrawl Fetch');
    assert.deepEqual(second?.webSearchConfig.providers, []);
  },
);
