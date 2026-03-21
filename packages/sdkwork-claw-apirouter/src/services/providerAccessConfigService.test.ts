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
    name: 'API Router OpenAI',
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
    ],
    notes: 'Provider access config test fixture.',
    ...overrides,
  };
}

await runTest('providerAccessConfigService builds Codex, OpenCode, and OpenClaw setup for OpenAI-compatible providers', async () => {
  const { buildProviderAccessClientConfigs, formatProviderAccessClientBundle } = await import(
    './providerAccessConfigService.ts'
  );
  const provider = createProvider();
  const configs = buildProviderAccessClientConfigs(provider);

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
  assert.deepEqual(codex.install.supportedModes, ['standard', 'env', 'both']);
  assert.equal(codex.install.defaultMode, 'standard');
  assert.deepEqual(codex.install.supportedEnvScopes, ['user', 'system']);
  assert.deepEqual(
    codex.install.environmentVariables.map((variable) => variable.key),
    ['OPENAI_API_KEY', 'OPENAI_BASE_URL'],
  );
  assert.equal(codex.snippets.length, 2);
  assert.equal(codex.snippets[0]?.target, '~/.codex/auth.json');
  assert.equal(codex.snippets[1]?.target, '~/.codex/config.toml');
  assert.match(codex.snippets[0]?.content || '', /"auth_mode": "apikey"/);
  assert.match(codex.snippets[0]?.content || '', /"OPENAI_API_KEY": "sk-router-live-123"/);
  assert.match(
    codex.snippets[1]?.content || '',
    /If config\.toml already sets `profile = "\.\.\."`, move `model` and `model_provider` into that active profile instead of overwriting shared defaults\./,
  );
  assert.match(codex.snippets[1]?.content || '', /model = "gpt-5\.4"/);
  assert.match(codex.snippets[1]?.content || '', /model_provider = "api_router"/);
  assert.match(codex.snippets[1]?.content || '', /base_url = "https:\/\/router\.example\.com\/v1"/);
  assert.match(codex.snippets[1]?.content || '', /requires_openai_auth = true/);
  assert.match(codex.snippets[1]?.content || '', /wire_api = "responses"/);
  assert.doesNotMatch(codex.snippets[1]?.content || '', /env_key = "OPENAI_API_KEY"/);

  const codexBundle = formatProviderAccessClientBundle(codex);
  assert.match(codexBundle, /# ~\/\.codex\/auth\.json/);
  assert.match(codexBundle, /"OPENAI_API_KEY": "sk-router-live-123"/);
  assert.match(codexBundle, /\[model_providers\.api_router\]/);
  assert.doesNotMatch(codexBundle, /export OPENAI_API_KEY=/);

  const claudeCode = configs.find((config) => config.id === 'claude-code');
  assert.ok(claudeCode);
  assert.equal(claudeCode.available, false);
  assert.equal(claudeCode.reason, 'requiresAnthropicCompatible');

  const opencode = configs.find((config) => config.id === 'opencode');
  assert.ok(opencode);
  assert.equal(opencode.available, true);
  assert.deepEqual(opencode.install.supportedModes, ['standard', 'env', 'both']);
  assert.equal(opencode.install.defaultMode, 'standard');
  assert.deepEqual(opencode.install.supportedEnvScopes, ['user', 'system']);
  assert.deepEqual(
    opencode.install.environmentVariables.map((variable) => variable.key),
    ['OPENAI_API_KEY', 'OPENAI_BASE_URL'],
  );
  assert.equal(opencode.snippets.length, 2);
  assert.equal(opencode.snippets[0]?.target, '~/.config/opencode/opencode.json');
  assert.match(opencode.snippets[0]?.content || '', /"model": "api-router\/gpt-5\.4"/);
  assert.match(opencode.snippets[0]?.content || '', /"npm": "@ai-sdk\/openai"/);
  assert.match(opencode.snippets[0]?.content || '', /"baseURL": "https:\/\/router\.example\.com\/v1"/);
  assert.doesNotMatch(opencode.snippets[0]?.content || '', /"apiKey": "sk-router-live-123"/);
  assert.equal(opencode.snippets[1]?.target, '~/.local/share/opencode/auth.json');
  assert.match(opencode.snippets[1]?.content || '', /"api-router"/);
  assert.match(opencode.snippets[1]?.content || '', /"type": "api"/);
  assert.match(opencode.snippets[1]?.content || '', /"key": "sk-router-live-123"/);

  const openclaw = configs.find((config) => config.id === 'openclaw');
  assert.ok(openclaw);
  assert.equal(openclaw.available, true);
  assert.deepEqual(openclaw.install.supportedModes, ['standard']);
  assert.deepEqual(openclaw.install.supportedEnvScopes, []);
  assert.equal(openclaw.snippets.length, 1);
  assert.equal(openclaw.snippets[0]?.target, 'openclaw onboard');
  assert.match(openclaw.snippets[0]?.content || '', /^openclaw onboard /);
  assert.match(openclaw.snippets[0]?.content || '', /--custom-base-url "https:\/\/router\.example\.com\/v1"/);
  assert.match(openclaw.snippets[0]?.content || '', /--custom-model-id "gpt-5\.4"/);
  assert.match(openclaw.snippets[0]?.content || '', /--custom-api-key "sk-router-live-123"/);
  assert.match(openclaw.snippets[0]?.content || '', /--custom-compatibility openai/);

  const gemini = configs.find((config) => config.id === 'gemini');
  assert.ok(gemini);
  assert.equal(gemini.available, false);
  assert.equal(gemini.reason, 'requiresGeminiCompatible');
  assert.deepEqual(gemini.install.supportedModes, []);
});

await runTest('providerAccessConfigService builds Claude Code, OpenCode, and OpenClaw setup for Anthropic-compatible providers', async () => {
  const { buildProviderAccessClientConfigs } = await import('./providerAccessConfigService.ts');
  const provider = createProvider({
    channelId: 'anthropic',
    name: 'Claude Relay',
    apiKey: 'anthropic-router-live-456',
    baseUrl: 'https://claude-router.example.com/v1',
    models: [
      {
        id: 'claude-sonnet-4',
        name: 'Claude Sonnet 4',
      },
    ],
  });
  const configs = buildProviderAccessClientConfigs(provider);

  const codex = configs.find((config) => config.id === 'codex');
  assert.ok(codex);
  assert.equal(codex.available, false);
  assert.equal(codex.reason, 'requiresOpenAIResponses');

  const claudeCode = configs.find((config) => config.id === 'claude-code');
  assert.ok(claudeCode);
  assert.equal(claudeCode.available, true);
  assert.deepEqual(claudeCode.install.supportedModes, ['standard', 'env', 'both']);
  assert.equal(claudeCode.install.defaultMode, 'standard');
  assert.deepEqual(claudeCode.install.supportedEnvScopes, ['user', 'system']);
  assert.deepEqual(
    claudeCode.install.environmentVariables.map((variable) => variable.key),
    ['ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_BASE_URL'],
  );
  assert.equal(claudeCode.snippets.length, 1);
  assert.equal(claudeCode.snippets[0]?.target, '~/.claude/settings.json');
  assert.match(claudeCode.snippets[0]?.content || '', /"ANTHROPIC_AUTH_TOKEN": "anthropic-router-live-456"/);
  assert.match(claudeCode.snippets[0]?.content || '', /"ANTHROPIC_BASE_URL": "https:\/\/claude-router\.example\.com\/v1"/);
  assert.match(claudeCode.snippets[0]?.content || '', /"model": "claude-sonnet-4"/);

  const opencode = configs.find((config) => config.id === 'opencode');
  assert.ok(opencode);
  assert.equal(opencode.available, true);
  assert.match(opencode.snippets[0]?.content || '', /"model": "anthropic\/claude-sonnet-4"/);
  assert.match(opencode.snippets[0]?.content || '', /"baseURL": "https:\/\/claude-router\.example\.com\/v1"/);
  assert.equal(opencode.snippets[1]?.target, '~/.local/share/opencode/auth.json');
  assert.doesNotMatch(opencode.snippets[0]?.content || '', /"apiKey": "anthropic-router-live-456"/);
  assert.match(opencode.snippets[1]?.content || '', /"anthropic"/);
  assert.match(opencode.snippets[1]?.content || '', /"key": "anthropic-router-live-456"/);

  const openclaw = configs.find((config) => config.id === 'openclaw');
  assert.ok(openclaw);
  assert.equal(openclaw.available, true);
  assert.match(openclaw.snippets[0]?.content || '', /--custom-compatibility anthropic/);

  const gemini = configs.find((config) => config.id === 'gemini');
  assert.ok(gemini);
  assert.equal(gemini.available, false);
  assert.equal(gemini.reason, 'requiresGeminiCompatible');
});

await runTest('providerAccessConfigService enables Gemini CLI for Google-compatible routes while keeping other clients conservative', async () => {
  const { buildProviderAccessClientConfigs } = await import('./providerAccessConfigService.ts');
  const provider = createProvider({
    channelId: 'google',
    name: 'Gemini Enterprise Proxy',
    apiKey: 'google-router-live-789',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    models: [
      {
        id: 'gemini-2.5-pro',
        name: 'Gemini 2.5 Pro',
      },
    ],
  });
  const configs = buildProviderAccessClientConfigs(provider);

  const gemini = configs.find((config) => config.id === 'gemini');
  assert.ok(gemini);
  assert.equal(gemini.available, true);
  assert.equal(gemini.compatibility, 'gemini');
  assert.deepEqual(gemini.install.supportedModes, ['standard', 'env', 'both']);
  assert.equal(gemini.install.defaultMode, 'standard');
  assert.deepEqual(gemini.install.supportedEnvScopes, ['user', 'system']);
  assert.deepEqual(
    gemini.install.environmentVariables.map((variable) => variable.key),
    ['GEMINI_API_KEY', 'GOOGLE_GEMINI_BASE_URL', 'GEMINI_API_KEY_AUTH_MECHANISM'],
  );
  assert.deepEqual(
    gemini.snippets.map((snippet) => snippet.target),
    ['~/.gemini/settings.json', '~/.gemini/.env'],
  );
  assert.match(gemini.snippets[0]?.content || '', /"selectedType": "gemini-api-key"/);
  assert.match(gemini.snippets[0]?.content || '', /"name": "gemini-2\.5-pro"/);
  assert.match(gemini.snippets[1]?.content || '', /GEMINI_API_KEY="google-router-live-789"/);
  assert.match(
    gemini.snippets[1]?.content || '',
    /GOOGLE_GEMINI_BASE_URL="https:\/\/generativelanguage\.googleapis\.com\/v1beta"/,
  );
  assert.match(gemini.snippets[1]?.content || '', /GEMINI_API_KEY_AUTH_MECHANISM="x-goog-api-key"/);

  const codex = configs.find((config) => config.id === 'codex');
  assert.ok(codex);
  assert.equal(codex.available, false);
  assert.equal(codex.reason, 'requiresOpenAIResponses');

  const opencode = configs.find((config) => config.id === 'opencode');
  assert.ok(opencode);
  assert.equal(opencode.reason, 'requiresOpenAIOrAnthropicCompatible');

  const openclaw = configs.find((config) => config.id === 'openclaw');
  assert.ok(openclaw);
  assert.equal(openclaw.reason, 'requiresOpenAIOrAnthropicCompatible');

  const claudeCode = configs.find((config) => config.id === 'claude-code');
  assert.ok(claudeCode);
  assert.equal(claudeCode.reason, 'requiresAnthropicCompatible');
});

await runTest('providerAccessConfigService writes bearer-based Gemini env snippets for routed API Router gateways', async () => {
  const { buildProviderAccessClientConfigs } = await import('./providerAccessConfigService.ts');
  const provider = createProvider({
    channelId: 'google',
    name: 'Gemini Router Gateway',
    apiKey: 'gemini-router-live-222',
    baseUrl: 'https://api-router.example.com/gemini',
    models: [
      {
        id: 'gemini-2.5-pro',
        name: 'Gemini 2.5 Pro',
      },
    ],
  });
  const configs = buildProviderAccessClientConfigs(provider);
  const gemini = configs.find((config) => config.id === 'gemini');

  assert.ok(gemini);
  assert.equal(gemini.available, true);
  assert.match(gemini.snippets[1]?.content || '', /GEMINI_API_KEY="gemini-router-live-222"/);
  assert.match(
    gemini.snippets[1]?.content || '',
    /GOOGLE_GEMINI_BASE_URL="https:\/\/api-router\.example\.com\/gemini"/,
  );
  assert.match(gemini.snippets[1]?.content || '', /GEMINI_API_KEY_AUTH_MECHANISM="bearer"/);
});

await runTest('providerAccessConfigService enables OpenCode and OpenClaw for Moonshot OpenAI-compatible routes while keeping Codex conservative', async () => {
  const { buildProviderAccessClientConfigs } = await import('./providerAccessConfigService.ts');
  const provider = createProvider({
    channelId: 'moonshot',
    name: 'Kimi Global Route',
    apiKey: 'moonshot-router-live-123',
    baseUrl: 'https://api.moonshot.cn/v1',
    models: [
      {
        id: 'kimi-k2-0905-preview',
        name: 'Kimi K2 Preview',
      },
    ],
  });
  const configs = buildProviderAccessClientConfigs(provider);

  const codex = configs.find((config) => config.id === 'codex');
  assert.ok(codex);
  assert.equal(codex.available, false);
  assert.equal(codex.reason, 'requiresOpenAIResponses');

  const opencode = configs.find((config) => config.id === 'opencode');
  assert.ok(opencode);
  assert.equal(opencode.available, true);
  assert.match(opencode.snippets[0]?.content || '', /"model": "api-router\/kimi-k2-0905-preview"/);
  assert.match(opencode.snippets[0]?.content || '', /"npm": "@ai-sdk\/openai-compatible"/);
  assert.match(opencode.snippets[0]?.content || '', /"baseURL": "https:\/\/api\.moonshot\.cn\/v1"/);

  const openclaw = configs.find((config) => config.id === 'openclaw');
  assert.ok(openclaw);
  assert.equal(openclaw.available, true);
  assert.match(openclaw.snippets[0]?.content || '', /--custom-compatibility openai/);
});

await runTest('providerAccessConfigService enables Claude Code for MiniMax Anthropic-compatible routes', async () => {
  const { buildProviderAccessClientConfigs } = await import('./providerAccessConfigService.ts');
  const provider = createProvider({
    channelId: 'minimax',
    name: 'MiniMax Claude Bridge',
    apiKey: 'minimax-router-live-456',
    baseUrl: 'https://api.minimax.chat/v1',
    models: [
      {
        id: 'MiniMax-M1-80k',
        name: 'MiniMax M1 80K',
      },
    ],
  });
  const configs = buildProviderAccessClientConfigs(provider);

  const claudeCode = configs.find((config) => config.id === 'claude-code');
  assert.ok(claudeCode);
  assert.equal(claudeCode.available, true);
  assert.match(claudeCode.snippets[0]?.content || '', /"ANTHROPIC_AUTH_TOKEN": "minimax-router-live-456"/);
  assert.match(claudeCode.snippets[0]?.content || '', /"ANTHROPIC_BASE_URL": "https:\/\/api\.minimax\.chat\/v1"/);
  assert.match(claudeCode.snippets[0]?.content || '', /"model": "MiniMax-M1-80k"/);

  const openclaw = configs.find((config) => config.id === 'openclaw');
  assert.ok(openclaw);
  assert.equal(openclaw.available, true);
  assert.match(openclaw.snippets[0]?.content || '', /--custom-compatibility anthropic/);
});

await runTest('providerAccessConfigService resolves platform-specific manual targets for desktop Windows', async () => {
  const {
    buildProviderAccessClientConfigs,
    formatProviderAccessClientBundle,
    resolveProviderAccessSnippetDisplayPlatform,
    resolveProviderAccessSnippetTarget,
  } = await import('./providerAccessConfigService.ts');
  const provider = createProvider();
  const configs = buildProviderAccessClientConfigs(provider);
  const codex = configs.find((config) => config.id === 'codex');
  const opencode = configs.find((config) => config.id === 'opencode');

  assert.ok(codex);
  assert.ok(opencode);

  const displayPlatform = resolveProviderAccessSnippetDisplayPlatform({
    system: {
      family: 'Windows',
      os: 'Windows 11',
    },
  });

  assert.equal(displayPlatform, 'windows');
  assert.equal(
    resolveProviderAccessSnippetTarget(codex.snippets[0], displayPlatform),
    '%USERPROFILE%\\.codex\\auth.json',
  );
  assert.equal(
    resolveProviderAccessSnippetTarget(codex.snippets[1], displayPlatform),
    '%USERPROFILE%\\.codex\\config.toml',
  );
  assert.equal(
    resolveProviderAccessSnippetTarget(opencode.snippets[0], displayPlatform),
    '%USERPROFILE%\\.config\\opencode\\opencode.json',
  );
  assert.equal(
    resolveProviderAccessSnippetTarget(opencode.snippets[1], displayPlatform),
    '%USERPROFILE%\\.local\\share\\opencode\\auth.json',
  );

  const bundle = formatProviderAccessClientBundle(opencode, displayPlatform);
  assert.ok(bundle.includes('# %USERPROFILE%\\.config\\opencode\\opencode.json'));
  assert.ok(bundle.includes('# %USERPROFILE%\\.local\\share\\opencode\\auth.json'));
});

await runTest('providerAccessConfigService marks every client unavailable when the plaintext provider secret is no longer present', async () => {
  const { buildProviderAccessClientConfigs } = await import('./providerAccessConfigService.ts');
  const provider = createProvider({
    apiKey: '',
    canCopyApiKey: false,
    credentialReference: 'cred-router-openai',
  });
  const configs = buildProviderAccessClientConfigs(provider);

  assert.equal(configs.length, 5);

  for (const config of configs) {
    assert.equal(config.available, false);
    assert.equal(config.reason, 'requiresOneTimeKeyReveal');
    assert.deepEqual(config.install.supportedModes, []);
    assert.deepEqual(config.install.supportedEnvScopes, []);
    assert.equal(config.install.defaultMode, null);
    assert.equal(config.install.defaultEnvScope, null);
    assert.deepEqual(config.install.environmentVariables, []);
    assert.deepEqual(config.snippets, []);
  }
});
