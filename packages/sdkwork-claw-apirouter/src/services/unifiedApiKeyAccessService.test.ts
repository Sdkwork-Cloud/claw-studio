import assert from 'node:assert/strict';
import {
  configurePlatformBridge,
  type RuntimeApiRouterRuntimeStatus,
} from '@sdkwork/claw-infrastructure';
import type { UnifiedApiKey } from '@sdkwork/claw-types';

async function runTest(name: string, callback: () => Promise<void> | void) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

function createRuntimeStatus(
  overrides: Partial<RuntimeApiRouterRuntimeStatus> = {},
): RuntimeApiRouterRuntimeStatus {
  return {
    mode: 'attachedExternal',
    recommendedManagedMode: null,
    sharedRootDir: 'C:/Users/admin/.sdkwork/router',
    configDir: 'C:/Users/admin/.sdkwork/router',
    configSource: 'file',
    resolvedConfigFile: 'C:/Users/admin/.sdkwork/router/config.yml',
    admin: {
      bindAddr: '127.0.0.1:8081',
      healthUrl: 'http://127.0.0.1:8081/admin/health',
      enabled: true,
      publicBaseUrl: 'http://127.0.0.1:13003/api/admin',
      healthy: true,
      portAvailable: false,
    },
    portal: {
      bindAddr: '127.0.0.1:8082',
      healthUrl: 'http://127.0.0.1:8082/portal/health',
      enabled: true,
      publicBaseUrl: 'http://127.0.0.1:13003/api/portal',
      healthy: true,
      portAvailable: false,
    },
    gateway: {
      bindAddr: '127.0.0.1:8080',
      healthUrl: 'http://127.0.0.1:8080/health',
      enabled: true,
      publicBaseUrl: 'http://127.0.0.1:13003/api',
      healthy: true,
      portAvailable: false,
    },
    adminSiteBaseUrl: 'http://127.0.0.1:13003/admin',
    portalSiteBaseUrl: 'http://127.0.0.1:13003/portal',
    reason: 'Detected a healthy independently started sdkwork-api-router runtime.',
    ...overrides,
  };
}

function createUnifiedApiKey(overrides: Partial<UnifiedApiKey> = {}): UnifiedApiKey {
  return {
    id: 'hash-acme-primary-key',
    name: 'Acme Production',
    apiKey: 'sk-ar-v1-acmeprimarykey0000000000000000',
    source: 'system-generated',
    groupId: 'tenant-acme',
    usage: {
      requestCount: 12,
      tokenCount: 2048,
      spendUsd: 3.14,
      period: '30d',
    },
    expiresAt: null,
    status: 'active',
    createdAt: new Date(1_710_000_000_000).toISOString(),
    notes: 'Primary operator-issued key',
    canCopyApiKey: true,
    hashedKey: 'hash-acme-primary-key',
    tenantId: 'tenant-acme',
    projectId: 'project-acme-unified-key',
    environment: 'live',
    ...overrides,
  };
}

await runTest('unifiedApiKeyAccessService resolves client gateway URLs from the active router runtime', async () => {
  configurePlatformBridge({
    runtime: {
      getRuntimeInfo: async () => ({ platform: 'desktop' }),
      getApiRouterRuntimeStatus: async () => createRuntimeStatus(),
      setAppLanguage: async () => {},
      submitProcessJob: async () => 'job-unified-key-access',
      getJob: async () => ({
        id: 'job-unified-key-access',
        kind: 'process',
        state: 'queued',
        stage: 'queued',
      }),
      listJobs: async () => [],
      cancelJob: async () => ({
        id: 'job-unified-key-access',
        kind: 'process',
        state: 'cancelled',
        stage: 'cancelled',
      }),
      subscribeJobUpdates: async () => () => {},
      subscribeProcessOutput: async () => () => {},
    },
  });

  const { resolveUnifiedApiAccessGateways } = await import('./unifiedApiKeyAccessService.ts');

  const gateways = await resolveUnifiedApiAccessGateways();

  assert.equal(gateways.openai.baseUrl, 'http://127.0.0.1:13003/api/v1');
  assert.equal(gateways.anthropic.baseUrl, 'http://127.0.0.1:13003/api/v1');
  assert.equal(gateways.gemini.baseUrl, 'http://127.0.0.1:13003/api/v1');
});

await runTest('unifiedApiKeyAccessService only exposes working quick setup clients for the current router surface', async () => {
  const { buildUnifiedApiKeyAccessClientConfigs } = await import('./unifiedApiKeyAccessService.ts');

  const configs = buildUnifiedApiKeyAccessClientConfigs(createUnifiedApiKey());
  const codex = configs.find((config) => config.id === 'codex');
  const opencode = configs.find((config) => config.id === 'opencode');
  const openclaw = configs.find((config) => config.id === 'openclaw');
  const claudeCode = configs.find((config) => config.id === 'claude-code');
  const gemini = configs.find((config) => config.id === 'gemini');

  assert.deepEqual(configs.map((config) => config.id), [
    'codex',
    'claude-code',
    'opencode',
    'openclaw',
    'gemini',
  ]);
  assert.equal(configs.length, 5);
  assert.equal(codex?.available, true);
  assert.equal(opencode?.available, true);
  assert.equal(openclaw?.available, true);
  assert.equal(claudeCode?.available, false);
  assert.equal(claudeCode?.reason, 'requiresAnthropicCompatible');
  assert.equal(gemini?.available, false);
  assert.equal(gemini?.reason, 'requiresGeminiCompatible');
});

await runTest('unifiedApiKeyAccessService makes quick setup unavailable when the local plaintext copy is missing', async () => {
  const { buildUnifiedApiKeyAccessClientConfigs } = await import('./unifiedApiKeyAccessService.ts');

  const configs = buildUnifiedApiKeyAccessClientConfigs(
    createUnifiedApiKey({
      apiKey: '',
      canCopyApiKey: false,
    }),
  );

  assert.equal(configs.length, 5);
  assert.equal(configs.every((config) => config.available === false), true);
  assert.equal(configs.every((config) => config.reason === 'requiresOneTimeKeyReveal'), true);
});
