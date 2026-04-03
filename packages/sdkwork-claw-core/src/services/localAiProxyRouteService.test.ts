import assert from 'node:assert/strict';
import {
  LOCAL_AI_PROXY_DEFAULT_UPSTREAM_BASE_URL,
  LOCAL_AI_PROXY_SYSTEM_DEFAULT_OPENAI_ROUTE_ID,
  createSystemDefaultLocalAiProxyRoute,
  inferLocalAiProxyClientProtocol,
  normalizeLocalAiProxyRouteRecord,
  normalizeLocalAiProxyRouteRecords,
} from './localAiProxyRouteService.ts';

async function runTest(name: string, callback: () => Promise<void> | void) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

await runTest('migrates legacy provider-center records into local AI proxy routes', () => {
  const routes = normalizeLocalAiProxyRouteRecords([
    {
      id: 'provider-config-anthropic',
      name: 'Anthropic Production',
      providerId: 'anthropic',
      baseUrl: 'https://api.anthropic.com/v1',
      apiKey: 'sk-anthropic',
      defaultModelId: 'claude-sonnet-4-20250514',
      reasoningModelId: 'claude-opus-4-20250514',
      models: [
        {
          id: 'claude-sonnet-4-20250514',
          name: 'Claude Sonnet 4',
        },
        {
          id: 'claude-opus-4-20250514',
          name: 'Claude Opus 4',
        },
      ],
    },
  ]);

  assert.equal(routes.length, 3);
  assert.deepEqual(
    routes.map((route) => route.clientProtocol).sort(),
    ['anthropic', 'gemini', 'openai-compatible'],
  );
  assert.deepEqual(
    routes.find((route) => route.id === 'provider-config-anthropic'),
    {
      id: 'provider-config-anthropic',
      schemaVersion: 1,
      name: 'Anthropic Production',
      enabled: true,
      isDefault: true,
      managedBy: 'user',
      clientProtocol: 'anthropic',
      upstreamProtocol: 'anthropic',
      providerId: 'anthropic',
      upstreamBaseUrl: 'https://api.anthropic.com/v1',
      apiKey: 'sk-anthropic',
      defaultModelId: 'claude-sonnet-4-20250514',
      reasoningModelId: 'claude-opus-4-20250514',
      embeddingModelId: undefined,
      models: [
        {
          id: 'claude-sonnet-4-20250514',
          name: 'Claude Sonnet 4',
        },
        {
          id: 'claude-opus-4-20250514',
          name: 'Claude Opus 4',
        },
      ],
      notes: undefined,
      exposeTo: ['openclaw'],
    },
  );
  assert.equal(
    routes.some(
      (route) =>
        route.clientProtocol === 'openai-compatible' && route.managedBy === 'system-default',
    ),
    true,
  );
  assert.equal(
    routes.some(
      (route) => route.clientProtocol === 'gemini' && route.managedBy === 'system-default',
    ),
    true,
  );
  assert.equal(
    routes.some(
      (route) =>
        route.clientProtocol === 'anthropic' && route.managedBy === 'system-default',
    ),
    false,
  );
});

await runTest('resolves blank upstream base URLs to the SDKWork fallback endpoint', () => {
  const route = normalizeLocalAiProxyRouteRecord({
    id: 'route-openai-blank-base',
    schemaVersion: 1,
    name: 'OpenAI Blank Base',
    enabled: true,
    isDefault: false,
    managedBy: 'user',
    clientProtocol: 'openai-compatible',
    upstreamProtocol: 'openai-compatible',
    providerId: 'openai',
    upstreamBaseUrl: '   ',
    apiKey: 'sk-openai',
    defaultModelId: 'gpt-5.4',
    models: [{ id: 'gpt-5.4', name: 'GPT-5.4' }],
    exposeTo: ['openclaw'],
  });

  assert.equal(route?.upstreamBaseUrl, LOCAL_AI_PROXY_DEFAULT_UPSTREAM_BASE_URL);
});

await runTest('infers native local proxy client protocols for anthropic and gemini providers', () => {
  assert.equal(inferLocalAiProxyClientProtocol('anthropic'), 'anthropic');
  assert.equal(inferLocalAiProxyClientProtocol('google'), 'gemini');
  assert.equal(inferLocalAiProxyClientProtocol('gemini'), 'gemini');
  assert.equal(inferLocalAiProxyClientProtocol('openai'), 'openai-compatible');
  assert.equal(inferLocalAiProxyClientProtocol('openrouter'), 'openai-compatible');
});

await runTest('rejects upstream-only protocols as local proxy client protocols during normalization', () => {
  const route = normalizeLocalAiProxyRouteRecord({
    id: 'route-sdkwork-invalid-client',
    schemaVersion: 1,
    name: 'Invalid Client Protocol',
    enabled: true,
    isDefault: true,
    managedBy: 'user',
    clientProtocol: 'sdkwork',
    upstreamProtocol: 'sdkwork',
    providerId: 'openai',
    upstreamBaseUrl: 'https://ai.sdkwork.com',
    apiKey: 'sk-openai',
    defaultModelId: 'gpt-5.4',
    models: [{ id: 'gpt-5.4', name: 'GPT-5.4' }],
    exposeTo: ['openclaw'],
  });

  assert.equal(route?.clientProtocol, 'openai-compatible');
  assert.equal(route?.upstreamProtocol, 'sdkwork');
});

await runTest('enforces a single default route per client protocol', () => {
  const routes = normalizeLocalAiProxyRouteRecords([
    {
      id: 'route-openai-primary',
      schemaVersion: 1,
      name: 'OpenAI Primary',
      enabled: true,
      isDefault: true,
      managedBy: 'user',
      clientProtocol: 'openai-compatible',
      upstreamProtocol: 'openai-compatible',
      providerId: 'openai',
      upstreamBaseUrl: 'https://api.openai.com/v1',
      apiKey: 'sk-openai',
      defaultModelId: 'gpt-5.4',
      models: [{ id: 'gpt-5.4', name: 'GPT-5.4' }],
      exposeTo: ['openclaw'],
    },
    {
      id: 'route-openai-backup',
      schemaVersion: 1,
      name: 'OpenAI Backup',
      enabled: true,
      isDefault: true,
      managedBy: 'user',
      clientProtocol: 'openai-compatible',
      upstreamProtocol: 'openai-compatible',
      providerId: 'deepseek',
      upstreamBaseUrl: 'https://api.deepseek.com/v1',
      apiKey: 'sk-deepseek',
      defaultModelId: 'deepseek-chat',
      models: [{ id: 'deepseek-chat', name: 'DeepSeek Chat' }],
      exposeTo: ['openclaw'],
    },
    {
      id: 'route-gemini-native',
      schemaVersion: 1,
      name: 'Gemini Native',
      enabled: true,
      isDefault: true,
      managedBy: 'user',
      clientProtocol: 'gemini',
      upstreamProtocol: 'gemini',
      providerId: 'gemini',
      upstreamBaseUrl: 'https://generativelanguage.googleapis.com',
      apiKey: 'sk-gemini',
      defaultModelId: 'gemini-2.5-pro',
      models: [{ id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' }],
      exposeTo: ['desktop-clients'],
    },
  ]);

  const openAiCompatibleRoutes = routes.filter((route) => route.clientProtocol === 'openai-compatible');
  assert.equal(openAiCompatibleRoutes.filter((route) => route.isDefault).length, 1);
  assert.equal(openAiCompatibleRoutes[0]?.id, 'route-openai-primary');
  assert.equal(openAiCompatibleRoutes[0]?.isDefault, true);
  assert.equal(openAiCompatibleRoutes[1]?.id, 'route-openai-backup');
  assert.equal(openAiCompatibleRoutes[1]?.isDefault, false);

  const geminiRoute = routes.find((route) => route.clientProtocol === 'gemini');
  assert.equal(geminiRoute?.isDefault, true);
});

await runTest('synthesizes a system default route when none exist', () => {
  const routes = normalizeLocalAiProxyRouteRecords([]);
  const defaultRoute = createSystemDefaultLocalAiProxyRoute();
  const anthropicDefaultRoute = createSystemDefaultLocalAiProxyRoute('anthropic');
  const geminiDefaultRoute = createSystemDefaultLocalAiProxyRoute('gemini');

  assert.equal(routes.length, 3);
  assert.deepEqual(
    routes.map((route) => route.clientProtocol).sort(),
    ['anthropic', 'gemini', 'openai-compatible'],
  );
  assert.deepEqual(
    routes.find((route) => route.clientProtocol === 'openai-compatible'),
    defaultRoute,
  );
  assert.deepEqual(
    routes.find((route) => route.clientProtocol === 'anthropic'),
    anthropicDefaultRoute,
  );
  assert.deepEqual(
    routes.find((route) => route.clientProtocol === 'gemini'),
    geminiDefaultRoute,
  );
  assert.equal(
    routes.find((route) => route.clientProtocol === 'openai-compatible')?.id,
    LOCAL_AI_PROXY_SYSTEM_DEFAULT_OPENAI_ROUTE_ID,
  );
  assert.equal(
    routes.every((route) => route.managedBy === 'system-default'),
    true,
  );
  assert.equal(
    routes.every((route) => route.upstreamBaseUrl === LOCAL_AI_PROXY_DEFAULT_UPSTREAM_BASE_URL),
    true,
  );
  assert.equal(
    routes.every((route) => route.apiKey === 'sk_sdkwork_api_key'),
    true,
  );
});
