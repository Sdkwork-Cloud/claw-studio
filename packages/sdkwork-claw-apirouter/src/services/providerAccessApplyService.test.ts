import assert from 'node:assert/strict';
import './apiRouterTestSetup.ts';

async function runTest(name: string, callback: () => Promise<void> | void) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

await runTest('providerAccessApplyService can configure OpenClaw target instances with API Router routes', async () => {
  const { apiRouterService } = await import('./apiRouterService.ts');
  const { providerAccessApplyService } = await import('./providerAccessApplyService.ts');
  const { installerService, studioMockService } = await import('@sdkwork/claw-infrastructure');

  const providers = await apiRouterService.getProxyProviders({ channelId: 'moonshot' });
  const provider = providers[0];

  assert.ok(provider);

  const installCalls: Array<{
    clientId: string;
    openClaw?: {
      instanceIds: string[];
    };
  }> = [];
  const originalInstall = installerService.installApiRouterClientSetup;
  installerService.installApiRouterClientSetup = async (request) => {
    installCalls.push({
      clientId: request.clientId,
      openClaw: request.openClaw,
    });

    return {
      clientId: request.clientId,
      writtenFiles: request.openClaw?.instanceIds.map((instanceId) => ({
        path: `/runtime/openclaw/${instanceId}/providers/provider-api-router-${provider.id}.json`,
        action: 'updated' as const,
      })) || [],
      updatedEnvironments: [],
      updatedInstanceIds: request.openClaw?.instanceIds || [],
      openClawInstances: (request.openClaw?.instanceIds || []).map((instanceId) => ({
        instanceId,
        endpoint: provider.baseUrl,
        apiKey: provider.apiKey,
        apiKeyProjectId: `project-${instanceId}`,
        apiKeyStrategy: request.openClaw?.apiKeyStrategy || 'shared',
        selectedProviderId: request.openClaw?.routerProviderId,
        modelMappingId: request.openClaw?.modelMappingId,
      })),
    };
  };

  try {
    const result = await providerAccessApplyService.applyOpenClawSetup(provider, [
      'local-built-in',
      'home-nas',
    ]);

    assert.deepEqual(result.updatedInstanceIds, ['local-built-in', 'home-nas']);
    assert.deepEqual(installCalls, [
      {
        clientId: 'openclaw',
        openClaw: {
          instanceIds: ['local-built-in', 'home-nas'],
          apiKeyStrategy: 'shared',
          routerProviderId: undefined,
          modelMappingId: undefined,
        },
      },
    ]);

    const localProviders = await studioMockService.listInstanceLlmProviders('local-built-in');
    const homeProviders = await studioMockService.listInstanceLlmProviders('home-nas');
    const localRoute = localProviders.find((item) => item.id === `provider-api-router-${provider.id}`);
    const homeRoute = homeProviders.find((item) => item.id === `provider-api-router-${provider.id}`);

    assert.ok(localRoute);
    assert.ok(homeRoute);
    assert.equal(localRoute?.provider, 'api-router');
    assert.equal(localRoute?.endpoint, provider.baseUrl);
    assert.equal(localRoute?.apiKeySource, provider.apiKey);
    assert.equal(localRoute?.routerConfig?.apiKeyStrategy, 'shared');
    assert.equal(homeRoute?.defaultModelId, provider.models[0]?.id);
  } finally {
    installerService.installApiRouterClientSetup = originalInstall;
  }
});

await runTest(
  'providerAccessApplyService persists explicit OpenClaw API key strategy and model mapping selections',
  async () => {
    const { apiRouterService } = await import('./apiRouterService.ts');
    const { providerAccessApplyService } = await import('./providerAccessApplyService.ts');
    const { installerService, studioMockService } = await import('@sdkwork/claw-infrastructure');

    const providers = await apiRouterService.getProxyProviders({ channelId: 'openai' });
    const provider = providers[0];

    assert.ok(provider);

    const installCalls: Array<{
      clientId: string;
      openClaw?: {
        instanceIds: string[];
        apiKeyStrategy?: string;
        routerProviderId?: string;
        modelMappingId?: string;
      };
    }> = [];
    const originalInstall = installerService.installApiRouterClientSetup;
    installerService.installApiRouterClientSetup = async (request) => {
      installCalls.push({
        clientId: request.clientId,
        openClaw: request.openClaw,
      });

      return {
        clientId: request.clientId,
        writtenFiles: [],
        updatedEnvironments: [],
        updatedInstanceIds: request.openClaw?.instanceIds || [],
        openClawInstances: (request.openClaw?.instanceIds || []).map((instanceId) => ({
          instanceId,
          endpoint: provider.baseUrl,
          apiKey: provider.apiKey,
          apiKeyProjectId: `project-${instanceId}`,
          apiKeyStrategy: request.openClaw?.apiKeyStrategy || 'shared',
          selectedProviderId: request.openClaw?.routerProviderId,
          modelMappingId: request.openClaw?.modelMappingId,
        })),
      };
    };

    try {
      const result = await providerAccessApplyService.applyOpenClawSetup(provider, ['edge-prod'], {
        apiKeyStrategy: 'per-instance',
        routerProviderId: provider.id,
        modelMappingId: 'mapping-edge-reasoning',
      });

      assert.deepEqual(result.updatedInstanceIds, ['edge-prod']);
      assert.deepEqual(installCalls, [
        {
          clientId: 'openclaw',
          openClaw: {
            instanceIds: ['edge-prod'],
            apiKeyStrategy: 'per-instance',
            routerProviderId: provider.id,
            modelMappingId: 'mapping-edge-reasoning',
          },
        },
      ]);

      const edgeProviders = await studioMockService.listInstanceLlmProviders('edge-prod');
      const route = edgeProviders.find((item) => item.id === `provider-api-router-${provider.id}`);

      assert.ok(route);
      assert.equal(route?.routerConfig?.apiKeyStrategy, 'per-instance');
      assert.equal(route?.routerConfig?.selectedProviderId, provider.id);
      assert.equal(route?.routerConfig?.modelMappingId, 'mapping-edge-reasoning');
    } finally {
      installerService.installApiRouterClientSetup = originalInstall;
    }
  },
);

await runTest('providerAccessApplyService performs one-click Codex setup through the installer platform instead of dialog saves', async () => {
  const { apiRouterService } = await import('./apiRouterService.ts');
  const { providerAccessApplyService } = await import('./providerAccessApplyService.ts');
  const { buildProviderAccessClientConfigs } = await import('./providerAccessConfigService.ts');
  const { installerService } = await import('@sdkwork/claw-infrastructure');

  const providers = await apiRouterService.getProxyProviders({ channelId: 'openai' });
  const provider = providers[0];

  assert.ok(provider);

  const client = buildProviderAccessClientConfigs(provider).find((item) => item.id === 'codex');

  assert.ok(client);
  assert.equal(client.available, true);

  const installCalls: Array<{
    clientId: string;
    installMode?: string;
    envScope?: string;
    provider: {
      id: string;
      channelId: string;
      compatibility: string;
      models: Array<{ id: string; name: string }>;
    };
  }> = [];
  const originalInstall = installerService.installApiRouterClientSetup;
  installerService.installApiRouterClientSetup = async (request) => {
    installCalls.push({
      clientId: request.clientId,
      installMode: request.installMode,
      envScope: request.envScope,
      provider: {
        id: request.provider.id,
        channelId: request.provider.channelId,
        compatibility: request.provider.compatibility,
        models: request.provider.models,
      },
    });

    return {
      clientId: request.clientId,
      writtenFiles: [
        {
          path: 'C:/Users/test/.codex/config.toml',
          action: 'updated' as const,
        },
        {
          path: 'C:/Users/test/.codex/auth.json',
          action: 'updated' as const,
        },
      ],
      updatedEnvironments: [
        {
          scope: 'user' as const,
          shell: 'powershell' as const,
          target: 'C:/Users/test/Documents/PowerShell/Microsoft.PowerShell_profile.ps1',
          variables: ['OPENAI_API_KEY', 'OPENAI_BASE_URL'],
        },
      ],
      updatedInstanceIds: [],
    };
  };

  try {
    const result = await providerAccessApplyService.applyClientSetup(provider, client, {
      installMode: 'both',
      envScope: 'user',
    });

    assert.deepEqual(result, {
      writtenFileCount: 2,
      updatedEnvironmentCount: 1,
      updatedInstanceIds: [],
    });
    assert.deepEqual(installCalls, [
      {
        clientId: 'codex',
        installMode: 'both',
        envScope: 'user',
        provider: {
          id: provider.id,
          channelId: provider.channelId,
          compatibility: 'openai',
          models: provider.models,
        },
      },
    ]);
  } finally {
    installerService.installApiRouterClientSetup = originalInstall;
  }
});

await runTest('providerAccessApplyService performs one-click Gemini CLI setup through the installer platform', async () => {
  const { apiRouterService } = await import('./apiRouterService.ts');
  const { providerAccessApplyService } = await import('./providerAccessApplyService.ts');
  const { buildProviderAccessClientConfigs } = await import('./providerAccessConfigService.ts');
  const { installerService } = await import('@sdkwork/claw-infrastructure');

  const providers = await apiRouterService.getProxyProviders({ channelId: 'google' });
  const provider = providers[0];

  assert.ok(provider);

  const client = buildProviderAccessClientConfigs(provider).find((item) => item.id === 'gemini');

  assert.ok(client);
  assert.equal(client.available, true);

  const installCalls: Array<{
    clientId: string;
    installMode?: string;
    envScope?: string;
    provider: {
      id: string;
      channelId: string;
      compatibility: string;
      models: Array<{ id: string; name: string }>;
    };
  }> = [];
  const originalInstall = installerService.installApiRouterClientSetup;
  installerService.installApiRouterClientSetup = async (request) => {
    installCalls.push({
      clientId: request.clientId,
      installMode: request.installMode,
      envScope: request.envScope,
      provider: {
        id: request.provider.id,
        channelId: request.provider.channelId,
        compatibility: request.provider.compatibility,
        models: request.provider.models,
      },
    });

    return {
      clientId: request.clientId,
      writtenFiles: [
        {
          path: 'C:/Users/test/.gemini/settings.json',
          action: 'updated' as const,
        },
        {
          path: 'C:/Users/test/.gemini/.env',
          action: 'updated' as const,
        },
      ],
      updatedEnvironments: [
        {
          scope: 'user' as const,
          shell: 'powershell' as const,
          target: 'C:/Users/test/Documents/PowerShell/Microsoft.PowerShell_profile.ps1',
          variables: ['GEMINI_API_KEY', 'GOOGLE_GEMINI_BASE_URL', 'GEMINI_API_KEY_AUTH_MECHANISM'],
        },
      ],
      updatedInstanceIds: [],
    };
  };

  try {
    const result = await providerAccessApplyService.applyClientSetup(provider, client, {
      installMode: 'env',
      envScope: 'system',
    });

    assert.deepEqual(result, {
      writtenFileCount: 2,
      updatedEnvironmentCount: 1,
      updatedInstanceIds: [],
    });
    assert.deepEqual(installCalls, [
      {
        clientId: 'gemini',
        installMode: 'env',
        envScope: 'system',
        provider: {
          id: provider.id,
          channelId: provider.channelId,
          compatibility: 'gemini',
          models: provider.models,
        },
      },
    ]);
  } finally {
    installerService.installApiRouterClientSetup = originalInstall;
  }
});

await runTest('providerAccessApplyService uses local file configuration by default for supported desktop clients', async () => {
  const { apiRouterService } = await import('./apiRouterService.ts');
  const { providerAccessApplyService } = await import('./providerAccessApplyService.ts');
  const { buildProviderAccessClientConfigs } = await import('./providerAccessConfigService.ts');
  const { installerService } = await import('@sdkwork/claw-infrastructure');

  const providers = await apiRouterService.getProxyProviders({ channelId: 'openai' });
  const provider = providers[0];

  assert.ok(provider);

  const client = buildProviderAccessClientConfigs(provider).find((item) => item.id === 'codex');

  assert.ok(client);
  assert.equal(client.available, true);

  const installCalls: Array<{
    clientId: string;
    installMode?: string;
    envScope?: string;
  }> = [];
  const originalInstall = installerService.installApiRouterClientSetup;
  installerService.installApiRouterClientSetup = async (request) => {
    installCalls.push({
      clientId: request.clientId,
      installMode: request.installMode,
      envScope: request.envScope,
    });

    return {
      clientId: request.clientId,
      writtenFiles: [
        {
          path: 'C:/Users/test/.codex/config.toml',
          action: 'updated' as const,
        },
        {
          path: 'C:/Users/test/.codex/auth.json',
          action: 'updated' as const,
        },
      ],
      updatedEnvironments: [],
      updatedInstanceIds: [],
    };
  };

  try {
    const result = await providerAccessApplyService.applyClientSetup(provider, client);

    assert.deepEqual(result, {
      writtenFileCount: 2,
      updatedEnvironmentCount: 0,
      updatedInstanceIds: [],
    });
    assert.deepEqual(installCalls, [
      {
        clientId: 'codex',
        installMode: 'standard',
        envScope: undefined,
      },
    ]);
  } finally {
    installerService.installApiRouterClientSetup = originalInstall;
  }
});

await runTest('providerAccessApplyService can configure only environment variables for Codex when requested', async () => {
  const { apiRouterService } = await import('./apiRouterService.ts');
  const { providerAccessApplyService } = await import('./providerAccessApplyService.ts');
  const { buildProviderAccessClientConfigs } = await import('./providerAccessConfigService.ts');
  const { installerService } = await import('@sdkwork/claw-infrastructure');

  const providers = await apiRouterService.getProxyProviders({ channelId: 'openai' });
  const provider = providers[0];

  assert.ok(provider);

  const client = buildProviderAccessClientConfigs(provider).find((item) => item.id === 'codex');

  assert.ok(client);
  assert.equal(client.available, true);

  const installCalls: Array<{
    clientId: string;
    installMode?: string;
    envScope?: string;
  }> = [];
  const originalInstall = installerService.installApiRouterClientSetup;
  installerService.installApiRouterClientSetup = async (request) => {
    installCalls.push({
      clientId: request.clientId,
      installMode: request.installMode,
      envScope: request.envScope,
    });

    return {
      clientId: request.clientId,
      writtenFiles: [],
      updatedEnvironments: [
        {
          scope: 'system' as const,
          shell: 'powershell' as const,
          target: 'C:/ProgramData/claw-studio/api-router-env.ps1',
          variables: ['OPENAI_API_KEY', 'OPENAI_BASE_URL'],
        },
      ],
      updatedInstanceIds: [],
    };
  };

  try {
    const result = await providerAccessApplyService.applyClientSetup(provider, client, {
      installMode: 'env',
      envScope: 'system',
    });

    assert.deepEqual(result, {
      writtenFileCount: 0,
      updatedEnvironmentCount: 1,
      updatedInstanceIds: [],
    });
    assert.deepEqual(installCalls, [
      {
        clientId: 'codex',
        installMode: 'env',
        envScope: 'system',
      },
    ]);
  } finally {
    installerService.installApiRouterClientSetup = originalInstall;
  }
});
