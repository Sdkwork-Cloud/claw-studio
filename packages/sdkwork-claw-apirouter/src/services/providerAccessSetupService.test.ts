import assert from 'node:assert/strict';
import type { ProxyProvider } from '@sdkwork/claw-types';

async function runTest(name: string, callback: () => Promise<void> | void) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

function createProvider(overrides: Partial<ProxyProvider> = {}): ProxyProvider {
  return {
    id: 'provider-test',
    channelId: 'openai',
    name: 'OpenAI Router',
    apiKey: 'sk-router-live-123',
    groupId: 'team-ops',
    usage: {
      requestCount: 1200,
      tokenCount: 480000,
      spendUsd: 12.5,
      period: '30d',
    },
    expiresAt: null,
    status: 'active',
    createdAt: '2026-03-18T08:00:00.000Z',
    baseUrl: 'https://router.example.com/v1',
    models: [
      {
        id: 'gpt-5.4',
        name: 'GPT-5.4',
      },
      {
        id: 'o4-mini',
        name: 'o4-mini',
      },
    ],
    notes: 'Provider access setup test fixture.',
    ...overrides,
  };
}

await runTest('providerAccessSetupService derives one-click setup artifacts for Codex', async () => {
  const { buildProviderAccessClientConfigs } = await import('./providerAccessConfigService.ts');
  const { buildProviderAccessSetupArtifacts } = await import('./providerAccessSetupService.ts');
  const provider = createProvider();
  const client = buildProviderAccessClientConfigs(provider).find((item) => item.id === 'codex');

  assert.ok(client);

  const artifacts = buildProviderAccessSetupArtifacts(client);
  assert.deepEqual(artifacts.map((artifact) => artifact.filename), [
    'codex-api-router.config.toml',
    'codex-api-router.auth.json',
  ]);
  assert.match(artifacts[0]?.content || '', /model_provider = "api_router"/);
  assert.match(artifacts[0]?.content || '', /wire_api = "responses"/);
  assert.match(artifacts[1]?.content || '', /"OPENAI_API_KEY": "sk-router-live-123"/);
});

await runTest('providerAccessSetupService derives one-click setup artifacts for Claude Code and OpenCode', async () => {
  const { buildProviderAccessClientConfigs } = await import('./providerAccessConfigService.ts');
  const { buildProviderAccessSetupArtifacts } = await import('./providerAccessSetupService.ts');
  const anthropicProvider = createProvider({
    channelId: 'anthropic',
    name: 'Claude Router',
    apiKey: 'anthropic-router-live-456',
    baseUrl: 'https://claude-router.example.com/v1',
    models: [
      {
        id: 'claude-sonnet-4',
        name: 'Claude Sonnet 4',
      },
    ],
  });
  const claudeClient = buildProviderAccessClientConfigs(anthropicProvider).find(
    (item) => item.id === 'claude-code',
  );
  assert.ok(claudeClient);

  const claudeArtifacts = buildProviderAccessSetupArtifacts(claudeClient);
  assert.deepEqual(claudeArtifacts.map((artifact) => artifact.filename), [
    'claude-code-api-router.settings.json',
  ]);
  assert.match(claudeArtifacts[0]?.content || '', /"model": "claude-sonnet-4"/);
  assert.match(
    claudeArtifacts[0]?.content || '',
    /"ANTHROPIC_AUTH_TOKEN": "anthropic-router-live-456"/,
  );

  const opencodeClient = buildProviderAccessClientConfigs(createProvider()).find(
    (item) => item.id === 'opencode',
  );
  assert.ok(opencodeClient);

  const opencodeArtifacts = buildProviderAccessSetupArtifacts(opencodeClient);
  assert.deepEqual(opencodeArtifacts.map((artifact) => artifact.filename), [
    'opencode-api-router.config.json',
    'opencode-api-router.auth.json',
  ]);
  assert.match(opencodeArtifacts[0]?.content || '', /"model": "api-router\/gpt-5\.4"/);
  assert.match(opencodeArtifacts[1]?.content || '', /"key": "sk-router-live-123"/);
});

await runTest('providerAccessSetupService derives Gemini CLI settings and env artifacts for Google-compatible routes', async () => {
  const { buildProviderAccessClientConfigs } = await import('./providerAccessConfigService.ts');
  const { buildProviderAccessSetupArtifacts } = await import('./providerAccessSetupService.ts');
  const provider = createProvider({
    channelId: 'google',
    name: 'Gemini Router',
    apiKey: 'google-router-live-789',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    models: [
      {
        id: 'gemini-3.1-pro-preview',
        name: 'Gemini 3.1 Pro',
      },
    ],
  });
  const geminiClient = buildProviderAccessClientConfigs(provider).find((item) => item.id === 'gemini');
  assert.ok(geminiClient);

  const artifacts = buildProviderAccessSetupArtifacts(geminiClient);
  assert.deepEqual(artifacts.map((artifact) => artifact.filename), [
    'gemini-cli.settings.json',
    'gemini-cli.env',
  ]);
  assert.match(artifacts[0]?.content || '', /"selectedType": "gemini-api-key"/);
  assert.match(artifacts[1]?.content || '', /GEMINI_API_KEY="google-router-live-789"/);
});

await runTest('providerAccessSetupService builds an instance-ready OpenClaw provider payload with inferred model roles', async () => {
  const { buildOpenClawInstanceProviderDraft } = await import('./providerAccessSetupService.ts');
  const provider = createProvider({
    channelId: 'moonshot',
    name: 'Kimi Router',
    apiKey: 'moonshot-router-live-123',
    baseUrl: 'https://api.moonshot.cn/v1',
    models: [
      {
        id: 'kimi-k2-0905-preview',
        name: 'Kimi K2 Preview',
      },
      {
        id: 'kimi-thinking',
        name: 'Kimi Thinking',
      },
      {
        id: 'text-embedding-3-small',
        name: 'Text Embedding 3 Small',
      },
    ],
  });

  const draft = buildOpenClawInstanceProviderDraft(provider, {
    instanceId: 'local-built-in',
    endpoint: 'https://api.moonshot.cn/v1',
    apiKey: 'moonshot-router-live-123',
    apiKeyProjectId: 'project-api-router-local-built-in',
    apiKeyStrategy: 'shared',
  });

  assert.equal(draft.instanceId, 'local-built-in');
  assert.equal(draft.provider, 'api-router');
  assert.equal(draft.endpoint, 'https://api.moonshot.cn/v1');
  assert.equal(draft.apiKeySource, 'moonshot-router-live-123');
  assert.equal(draft.defaultModelId, 'kimi-k2-0905-preview');
  assert.equal(draft.reasoningModelId, 'kimi-thinking');
  assert.equal(draft.embeddingModelId, 'text-embedding-3-small');
  assert.deepEqual(
    draft.models.map((model) => [model.id, model.role]),
    [
      ['kimi-k2-0905-preview', 'primary'],
      ['kimi-thinking', 'reasoning'],
      ['text-embedding-3-small', 'embedding'],
    ],
  );
});
