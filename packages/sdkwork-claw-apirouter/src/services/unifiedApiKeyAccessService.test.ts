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

await runTest('unifiedApiKeyAccessService builds protocol-aware quick setup configs for unified API keys', async () => {
  const { unifiedApiKeyService } = await import('./unifiedApiKeyService.ts');
  const {
    buildUnifiedApiKeyAccessClientConfigs,
    buildUnifiedApiKeyCurlExample,
    resolveUnifiedApiAccessGateways,
  } = await import('./unifiedApiKeyAccessService.ts');
  const { getApiRouterPlatform } = await import('@sdkwork/claw-infrastructure');
  const usageKey = (await unifiedApiKeyService.getUnifiedApiKeys())[0];

  assert.ok(usageKey);

  const apiRouterPlatform = getApiRouterPlatform();
  const originalGetRuntimeStatus = apiRouterPlatform.getRuntimeStatus;
  apiRouterPlatform.getRuntimeStatus = async () => ({
    ownership: 'managed',
    routerHomeDir: 'C:/Users/test/.sdkwork/router',
    metadataDir: 'C:/Users/test/.sdkwork/router/claw-studio',
    databasePath: 'C:/Users/test/.sdkwork/router/sdkwork-api-server.db',
    extractionDir: 'C:/Users/test/AppData/Local/Claw/router/1.0.0/windows-x64',
    adminBaseUrl: 'http://127.0.0.1:18081/admin',
    gatewayBaseUrl: 'http://127.0.0.1:18080/v1',
    adminHealthy: true,
    gatewayHealthy: true,
    authSessionReady: true,
    adminAuthReady: true,
    adminPid: 18081,
    gatewayPid: 18080,
  });

  try {
    const gateways = await resolveUnifiedApiAccessGateways();
    const configs = buildUnifiedApiKeyAccessClientConfigs(usageKey, gateways);
    assert.deepEqual(configs.map((config) => config.id), [
      'codex',
      'claude-code',
      'opencode',
      'openclaw',
      'gemini',
    ]);

    const codex = configs.find((config) => config.id === 'codex');
    assert.ok(codex);
    assert.equal(codex.available, true);
    assert.match(codex.snippets[1]?.content || '', /base_url = "http:\/\/127\.0\.0\.1:18080\/v1"/);
    assert.match(codex.snippets[1]?.content || '', /model = "gpt-5\.4"/);

    const claudeCode = configs.find((config) => config.id === 'claude-code');
    assert.ok(claudeCode);
    assert.equal(claudeCode.available, true);
    assert.match(
      claudeCode.snippets[0]?.content || '',
      /"ANTHROPIC_BASE_URL": "http:\/\/127\.0\.0\.1:18080\/anthropic"/,
    );
    assert.match(claudeCode.snippets[0]?.content || '', /"model": "claude-sonnet-4"/);

    const opencode = configs.find((config) => config.id === 'opencode');
    assert.ok(opencode);
    assert.equal(opencode.available, true);
    assert.match(opencode.snippets[0]?.content || '', /"baseURL": "http:\/\/127\.0\.0\.1:18080\/v1"/);
    assert.match(opencode.snippets[1]?.content || '', new RegExp(usageKey.apiKey));

    const openclaw = configs.find((config) => config.id === 'openclaw');
    assert.ok(openclaw);
    assert.equal(openclaw.available, true);
    assert.match(openclaw.snippets[0]?.content || '', /--custom-base-url "http:\/\/127\.0\.0\.1:18080\/v1"/);
    assert.match(openclaw.snippets[0]?.content || '', /--custom-model-id "gpt-5\.4"/);

    const gemini = configs.find((config) => config.id === 'gemini');
    assert.ok(gemini);
    assert.equal(gemini.available, true);
    assert.equal(gemini.compatibility, 'gemini');
    assert.deepEqual(gemini.install.supportedModes, ['standard', 'env', 'both']);
    assert.match(
      gemini.snippets[1]?.content || '',
      /GOOGLE_GEMINI_BASE_URL="http:\/\/127\.0\.0\.1:18080\/gemini"/,
    );
    assert.match(
      gemini.snippets[1]?.content || '',
      /GEMINI_API_KEY_AUTH_MECHANISM="bearer"/,
    );

    const curlExample = buildUnifiedApiKeyCurlExample(usageKey, gateways);
    assert.match(curlExample, /http:\/\/127\.0\.0\.1:18080\/v1\/chat\/completions/);
    assert.match(curlExample, new RegExp(usageKey.apiKey));
  } finally {
    apiRouterPlatform.getRuntimeStatus = originalGetRuntimeStatus;
  }
});

await runTest('unifiedApiKeyAccessService performs one-click Gemini setup through the installer platform', async () => {
  const { unifiedApiKeyService } = await import('./unifiedApiKeyService.ts');
  const {
    buildUnifiedApiKeyAccessClientConfigs,
    unifiedApiKeyAccessService,
  } = await import('./unifiedApiKeyAccessService.ts');
  const { getApiRouterPlatform, installerService } = await import('@sdkwork/claw-infrastructure');
  const usageKey = (await unifiedApiKeyService.getUnifiedApiKeys())[0];

  assert.ok(usageKey);

  const client = buildUnifiedApiKeyAccessClientConfigs(usageKey).find((item) => item.id === 'gemini');

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
      baseUrl: string;
      models: Array<{ id: string; name: string }>;
    };
  }> = [];
  const originalInstall = installerService.installApiRouterClientSetup;
  const apiRouterPlatform = getApiRouterPlatform();
  const originalGetRuntimeStatus = apiRouterPlatform.getRuntimeStatus;
  apiRouterPlatform.getRuntimeStatus = async () => ({
    ownership: 'managed',
    routerHomeDir: 'C:/Users/test/.sdkwork/router',
    metadataDir: 'C:/Users/test/.sdkwork/router/claw-studio',
    databasePath: 'C:/Users/test/.sdkwork/router/sdkwork-api-server.db',
    extractionDir: 'C:/Users/test/AppData/Local/Claw/router/1.0.0/windows-x64',
    adminBaseUrl: 'http://127.0.0.1:18081/admin',
    gatewayBaseUrl: 'http://127.0.0.1:18080/v1',
    adminHealthy: true,
    gatewayHealthy: true,
    authSessionReady: true,
    adminAuthReady: true,
    adminPid: 18081,
    gatewayPid: 18080,
  });
  installerService.installApiRouterClientSetup = async (request) => {
    installCalls.push({
      clientId: request.clientId,
      installMode: request.installMode,
      envScope: request.envScope,
      provider: {
        id: request.provider.id,
        channelId: request.provider.channelId,
        compatibility: request.provider.compatibility,
        baseUrl: request.provider.baseUrl,
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
          variables: ['GEMINI_API_KEY', 'GOOGLE_GEMINI_BASE_URL'],
        },
      ],
      updatedInstanceIds: [],
    };
  };

  try {
    const result = await unifiedApiKeyAccessService.applyClientSetup(usageKey, client, {
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
        clientId: 'gemini',
        installMode: 'both',
        envScope: 'user',
        provider: {
          id: `unified-api-key-${usageKey.id}-gemini`,
          channelId: 'google',
          compatibility: 'gemini',
          baseUrl: 'http://127.0.0.1:18080/gemini',
          models: [
            {
              id: 'gemini-2.5-pro',
              name: 'Gemini 2.5 Pro',
            },
          ],
        },
      },
    ]);
  } finally {
    installerService.installApiRouterClientSetup = originalInstall;
    apiRouterPlatform.getRuntimeStatus = originalGetRuntimeStatus;
  }
});

await runTest('unifiedApiKeyAccessService performs one-click Codex setup through the installer platform', async () => {
  const { unifiedApiKeyService } = await import('./unifiedApiKeyService.ts');
  const {
    buildUnifiedApiKeyAccessClientConfigs,
    unifiedApiKeyAccessService,
  } = await import('./unifiedApiKeyAccessService.ts');
  const { getApiRouterPlatform, installerService } = await import('@sdkwork/claw-infrastructure');
  const usageKey = (await unifiedApiKeyService.getUnifiedApiKeys())[0];

  assert.ok(usageKey);

  const client = buildUnifiedApiKeyAccessClientConfigs(usageKey).find((item) => item.id === 'codex');

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
      baseUrl: string;
      models: Array<{ id: string; name: string }>;
    };
  }> = [];
  const originalInstall = installerService.installApiRouterClientSetup;
  const apiRouterPlatform = getApiRouterPlatform();
  const originalGetRuntimeStatus = apiRouterPlatform.getRuntimeStatus;
  apiRouterPlatform.getRuntimeStatus = async () => ({
    ownership: 'managed',
    routerHomeDir: 'C:/Users/test/.sdkwork/router',
    metadataDir: 'C:/Users/test/.sdkwork/router/claw-studio',
    databasePath: 'C:/Users/test/.sdkwork/router/sdkwork-api-server.db',
    extractionDir: 'C:/Users/test/AppData/Local/Claw/router/1.0.0/windows-x64',
    adminBaseUrl: 'http://127.0.0.1:18081/admin',
    gatewayBaseUrl: 'http://127.0.0.1:18080/v1',
    adminHealthy: true,
    gatewayHealthy: true,
    authSessionReady: true,
    adminAuthReady: true,
    adminPid: 18081,
    gatewayPid: 18080,
  });
  installerService.installApiRouterClientSetup = async (request) => {
    installCalls.push({
      clientId: request.clientId,
      installMode: request.installMode,
      envScope: request.envScope,
      provider: {
        id: request.provider.id,
        channelId: request.provider.channelId,
        compatibility: request.provider.compatibility,
        baseUrl: request.provider.baseUrl,
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
      updatedEnvironments: [],
      updatedInstanceIds: [],
    };
  };

  try {
    const result = await unifiedApiKeyAccessService.applyClientSetup(usageKey, client);

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
        provider: {
          id: `unified-api-key-${usageKey.id}-codex`,
          channelId: 'openai',
          compatibility: 'openai',
          baseUrl: 'http://127.0.0.1:18080/v1',
          models: [
            {
              id: 'gpt-5.4',
              name: 'GPT-5.4',
            },
          ],
        },
      },
    ]);
  } finally {
    installerService.installApiRouterClientSetup = originalInstall;
    apiRouterPlatform.getRuntimeStatus = originalGetRuntimeStatus;
  }
});

await runTest('unifiedApiKeyAccessService can project a unified API key into selected OpenClaw instances', async () => {
  const { unifiedApiKeyService } = await import('./unifiedApiKeyService.ts');
  const { unifiedApiKeyAccessService } = await import('./unifiedApiKeyAccessService.ts');
  const {
    getApiRouterPlatform,
    installerService,
    studioMockService,
  } = await import('@sdkwork/claw-infrastructure');
  const usageKey = (await unifiedApiKeyService.getUnifiedApiKeys())[0];

  assert.ok(usageKey);

  const installCalls: Array<{
    clientId: string;
    openClaw?: {
      instanceIds: string[];
    };
  }> = [];
  const originalInstall = installerService.installApiRouterClientSetup;
  const apiRouterPlatform = getApiRouterPlatform();
  const originalGetRuntimeStatus = apiRouterPlatform.getRuntimeStatus;
  apiRouterPlatform.getRuntimeStatus = async () => ({
    ownership: 'managed',
    routerHomeDir: 'C:/Users/test/.sdkwork/router',
    metadataDir: 'C:/Users/test/.sdkwork/router/claw-studio',
    databasePath: 'C:/Users/test/.sdkwork/router/sdkwork-api-server.db',
    extractionDir: 'C:/Users/test/AppData/Local/Claw/router/1.0.0/windows-x64',
    adminBaseUrl: 'http://127.0.0.1:18081/admin',
    gatewayBaseUrl: 'http://127.0.0.1:18080/v1',
    adminHealthy: true,
    gatewayHealthy: true,
    authSessionReady: true,
    adminAuthReady: true,
    adminPid: 18081,
    gatewayPid: 18080,
  });
  installerService.installApiRouterClientSetup = async (request) => {
    installCalls.push({
      clientId: request.clientId,
      openClaw: request.openClaw,
    });

    return {
      clientId: request.clientId,
      writtenFiles: request.openClaw?.instanceIds.map((instanceId) => ({
        path: `/runtime/openclaw/${instanceId}/providers/provider-api-router-unified.json`,
        action: 'updated' as const,
      })) || [],
      updatedEnvironments: [],
      updatedInstanceIds: request.openClaw?.instanceIds || [],
      openClawInstances: (request.openClaw?.instanceIds || []).map((instanceId) => ({
        instanceId,
        endpoint: 'http://127.0.0.1:18080/v1',
        apiKey: usageKey.apiKey,
        apiKeyProjectId: `project-${instanceId}`,
        apiKeyStrategy: request.openClaw?.apiKeyStrategy || 'shared',
        modelMappingId: request.openClaw?.modelMappingId,
      })),
    };
  };

  try {
    const result = await unifiedApiKeyAccessService.applyOpenClawSetup(usageKey, ['local-built-in']);

    assert.deepEqual(result.updatedInstanceIds, ['local-built-in']);
    assert.deepEqual(installCalls, [
      {
        clientId: 'openclaw',
        openClaw: {
          instanceIds: ['local-built-in'],
          apiKeyStrategy: 'shared',
          routerProviderId: undefined,
          modelMappingId: usageKey.modelMappingId,
        },
      },
    ]);

    const localProviders = await studioMockService.listInstanceLlmProviders('local-built-in');
    const route = localProviders.find(
      (item) => item.id === `provider-api-router-unified-api-key-${usageKey.id}-openclaw`,
    );

    assert.ok(route);
    assert.equal(route?.endpoint, 'http://127.0.0.1:18080/v1');
    assert.equal(route?.apiKeySource, usageKey.apiKey);
    assert.equal(route?.defaultModelId, 'gpt-5.4');
    assert.equal(route?.routerConfig?.gatewayBaseUrl, 'http://127.0.0.1:18080/v1');
  } finally {
    installerService.installApiRouterClientSetup = originalInstall;
    apiRouterPlatform.getRuntimeStatus = originalGetRuntimeStatus;
  }
});

await runTest(
  'unifiedApiKeyAccessService lets OpenClaw final setup override or clear the inherited model mapping',
  async () => {
    const { unifiedApiKeyService } = await import('./unifiedApiKeyService.ts');
    const { modelMappingService } = await import('./modelMappingService.ts');
    const { unifiedApiKeyAccessService } = await import('./unifiedApiKeyAccessService.ts');
    const { getApiRouterPlatform, installerService } = await import('@sdkwork/claw-infrastructure');
    const usageKey = (await unifiedApiKeyService.getUnifiedApiKeys())[0];

    assert.ok(usageKey);
    assert.ok(usageKey.modelMappingId);

    const modelMappings = await modelMappingService.getModelMappings();
    const overrideModelMappingId =
      modelMappings.find((item) => item.id !== usageKey.modelMappingId)?.id || usageKey.modelMappingId;

    const installCalls: Array<{
      clientId: string;
      openClaw?: {
        instanceIds: string[];
        apiKeyStrategy?: string;
        modelMappingId?: string;
      };
    }> = [];
    const originalInstall = installerService.installApiRouterClientSetup;
    const apiRouterPlatform = getApiRouterPlatform();
    const originalGetRuntimeStatus = apiRouterPlatform.getRuntimeStatus;
    apiRouterPlatform.getRuntimeStatus = async () => ({
      ownership: 'managed',
      routerHomeDir: 'C:/Users/test/.sdkwork/router',
      metadataDir: 'C:/Users/test/.sdkwork/router/claw-studio',
      databasePath: 'C:/Users/test/.sdkwork/router/sdkwork-api-server.db',
      extractionDir: 'C:/Users/test/AppData/Local/Claw/router/1.0.0/windows-x64',
      adminBaseUrl: 'http://127.0.0.1:18081/admin',
      gatewayBaseUrl: 'http://127.0.0.1:18080/v1',
      adminHealthy: true,
      gatewayHealthy: true,
      authSessionReady: true,
      adminAuthReady: true,
      adminPid: 18081,
      gatewayPid: 18080,
    });
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
          endpoint: 'http://127.0.0.1:18080/v1',
          apiKey: usageKey.apiKey,
          apiKeyProjectId: `project-${instanceId}`,
          apiKeyStrategy: request.openClaw?.apiKeyStrategy || 'shared',
          modelMappingId: request.openClaw?.modelMappingId,
        })),
      };
    };

    try {
      await unifiedApiKeyAccessService.applyOpenClawSetup(usageKey, ['local-built-in'], {
        apiKeyStrategy: 'per-instance',
        modelMappingId: overrideModelMappingId,
      });

      await unifiedApiKeyAccessService.applyOpenClawSetup(usageKey, ['home-nas'], {
        apiKeyStrategy: 'shared',
        modelMappingId: null,
      });

      assert.deepEqual(installCalls, [
        {
          clientId: 'openclaw',
          openClaw: {
            instanceIds: ['local-built-in'],
            apiKeyStrategy: 'per-instance',
            routerProviderId: undefined,
            modelMappingId: overrideModelMappingId,
          },
        },
        {
          clientId: 'openclaw',
          openClaw: {
            instanceIds: ['home-nas'],
            apiKeyStrategy: 'shared',
            routerProviderId: undefined,
            modelMappingId: undefined,
          },
        },
      ]);
    } finally {
      installerService.installApiRouterClientSetup = originalInstall;
      apiRouterPlatform.getRuntimeStatus = originalGetRuntimeStatus;
    }
  },
);
