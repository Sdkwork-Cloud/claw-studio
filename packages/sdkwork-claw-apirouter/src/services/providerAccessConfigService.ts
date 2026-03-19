import type { ProxyProvider } from '@sdkwork/claw-types';

export type ProviderAccessClientId =
  | 'codex'
  | 'claude-code'
  | 'opencode'
  | 'openclaw'
  | 'gemini';
export type ProviderAccessSnippetKind = 'env' | 'file' | 'command';
export type ProviderAccessSnippetLanguage = 'bash' | 'json' | 'toml';
export type ProviderAccessSnippetDisplayPlatform = 'windows' | 'macos' | 'linux';
export type ProviderAccessCompatibility = 'openai' | 'anthropic' | 'gemini' | 'unsupported';
export type ProviderAccessInstallMode = 'standard' | 'env' | 'both';
export type ProviderAccessEnvScope = 'user' | 'system';
export type ProviderAccessUnavailableReason =
  | 'requiresOpenAIResponses'
  | 'requiresAnthropicCompatible'
  | 'requiresOpenAIOrAnthropicCompatible'
  | 'requiresGeminiCompatible'
  | 'requiresGoogleIssuedGeminiKey';

export interface ProviderAccessSnippet {
  id: string;
  kind: ProviderAccessSnippetKind;
  language: ProviderAccessSnippetLanguage;
  target: string;
  displayTargets?: Partial<Record<ProviderAccessSnippetDisplayPlatform, string>>;
  content: string;
}

export interface ProviderAccessEnvironmentVariable {
  key: string;
  value: string;
}

export interface ProviderAccessInstallConfig {
  supportedModes: ProviderAccessInstallMode[];
  defaultMode: ProviderAccessInstallMode | null;
  supportedEnvScopes: ProviderAccessEnvScope[];
  defaultEnvScope: ProviderAccessEnvScope | null;
  environmentVariables: ProviderAccessEnvironmentVariable[];
}

export interface ProviderAccessClientConfig {
  id: ProviderAccessClientId;
  compatibility: ProviderAccessCompatibility;
  available: boolean;
  reason?: ProviderAccessUnavailableReason;
  install: ProviderAccessInstallConfig;
  snippets: ProviderAccessSnippet[];
}

export interface ProviderAccessRuntimeInfoLike {
  system?: {
    os?: string | null;
    family?: string | null;
  } | null;
}

const OPENAI_RESPONSES_COMPATIBLE_CHANNELS = new Set(['openai']);
const OPENAI_COMPATIBLE_CHANNELS = new Set([
  'openai',
  'xai',
  'deepseek',
  'qwen',
  'zhipu',
  'baidu',
  'tencent-hunyuan',
  'doubao',
  'moonshot',
  'stepfun',
  'iflytek-spark',
]);
const ANTHROPIC_COMPATIBLE_CHANNELS = new Set(['anthropic', 'minimax']);
const GEMINI_COMPATIBLE_CHANNELS = new Set(['google']);
const ENV_SCOPES: ProviderAccessEnvScope[] = ['user', 'system'];
const GOOGLE_GEMINI_BASE_URL_KEY = 'GOOGLE_GEMINI_BASE_URL';
const GEMINI_API_KEY_AUTH_MECHANISM_KEY = 'GEMINI_API_KEY_AUTH_MECHANISM';

function getPrimaryModel(provider: ProxyProvider) {
  return provider.models[0]?.id || 'model-id';
}

function getPrimaryModelName(provider: ProxyProvider) {
  return provider.models[0]?.name || getPrimaryModel(provider);
}

function toJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function toShellString(value: string) {
  return JSON.stringify(value);
}

function toTomlString(value: string) {
  return JSON.stringify(value);
}

function buildUnavailableInstallConfig(): ProviderAccessInstallConfig {
  return {
    supportedModes: [],
    defaultMode: null,
    supportedEnvScopes: [],
    defaultEnvScope: null,
    environmentVariables: [],
  };
}

function buildInstallConfig(options: {
  supportedModes: ProviderAccessInstallMode[];
  defaultMode: ProviderAccessInstallMode;
  environmentVariables?: ProviderAccessEnvironmentVariable[];
}): ProviderAccessInstallConfig {
  const environmentVariables = options.environmentVariables || [];
  const supportsEnvironmentInstall = options.supportedModes.includes('env') || options.supportedModes.includes('both');

  return {
    supportedModes: options.supportedModes,
    defaultMode: options.defaultMode,
    supportedEnvScopes: supportsEnvironmentInstall ? ENV_SCOPES : [],
    defaultEnvScope: supportsEnvironmentInstall ? 'user' : null,
    environmentVariables,
  };
}

function buildWindowsHomeTarget(target: string) {
  if (!target.startsWith('~/')) {
    return undefined;
  }

  return `%USERPROFILE%\\${target.slice(2).replace(/\//g, '\\')}`;
}

function buildSnippetDisplayTargets(
  target: string,
): Partial<Record<ProviderAccessSnippetDisplayPlatform, string>> | undefined {
  const windowsTarget = buildWindowsHomeTarget(target);

  if (!windowsTarget) {
    return undefined;
  }

  return {
    windows: windowsTarget,
  };
}

function buildSnippet(
  snippet: Omit<ProviderAccessSnippet, 'displayTargets'> & {
    displayTargets?: ProviderAccessSnippet['displayTargets'];
  },
): ProviderAccessSnippet {
  return {
    ...snippet,
    displayTargets: snippet.displayTargets ?? buildSnippetDisplayTargets(snippet.target),
  };
}

function resolveCompatibility(provider: ProxyProvider): ProviderAccessCompatibility {
  if (GEMINI_COMPATIBLE_CHANNELS.has(provider.channelId)) {
    return 'gemini';
  }

  if (ANTHROPIC_COMPATIBLE_CHANNELS.has(provider.channelId)) {
    return 'anthropic';
  }

  if (OPENAI_COMPATIBLE_CHANNELS.has(provider.channelId)) {
    return 'openai';
  }

  return 'unsupported';
}

function buildOpenAIEnvironmentVariables(provider: ProxyProvider): ProviderAccessEnvironmentVariable[] {
  return [
    {
      key: 'OPENAI_API_KEY',
      value: provider.apiKey,
    },
    {
      key: 'OPENAI_BASE_URL',
      value: provider.baseUrl,
    },
  ];
}

function buildAnthropicEnvironmentVariables(provider: ProxyProvider): ProviderAccessEnvironmentVariable[] {
  return [
    {
      key: 'ANTHROPIC_AUTH_TOKEN',
      value: provider.apiKey,
    },
    {
      key: 'ANTHROPIC_BASE_URL',
      value: provider.baseUrl,
    },
  ];
}

function usesGoogleHostedGeminiEndpoint(baseUrl: string) {
  return /googleapis\.com/i.test(baseUrl);
}

function resolveGeminiAuthMechanism(baseUrl: string) {
  return usesGoogleHostedGeminiEndpoint(baseUrl) ? 'x-goog-api-key' : 'bearer';
}

function buildGeminiEnvironmentVariables(provider: ProxyProvider): ProviderAccessEnvironmentVariable[] {
  return [
    {
      key: 'GEMINI_API_KEY',
      value: provider.apiKey,
    },
    {
      key: GOOGLE_GEMINI_BASE_URL_KEY,
      value: provider.baseUrl,
    },
    {
      key: GEMINI_API_KEY_AUTH_MECHANISM_KEY,
      value: resolveGeminiAuthMechanism(provider.baseUrl),
    },
  ];
}

function formatEnvironmentVariables(variables: ProviderAccessEnvironmentVariable[]) {
  return variables.map((variable) => `${variable.key}=${toShellString(variable.value)}`).join('\n');
}

function buildOpenCodeAuthSnippet(targetKey: string, apiKey: string): ProviderAccessSnippet {
  return buildSnippet({
    id: 'auth',
    kind: 'file',
    language: 'json',
    target: '~/.local/share/opencode/auth.json',
    content: toJson({
      [targetKey]: {
        type: 'api',
        key: apiKey,
      },
    }),
  });
}

function getOpenCodeProviderPackage(provider: ProxyProvider) {
  if (OPENAI_RESPONSES_COMPATIBLE_CHANNELS.has(provider.channelId)) {
    return '@ai-sdk/openai';
  }

  return '@ai-sdk/openai-compatible';
}

function buildCodexConfig(provider: ProxyProvider): ProviderAccessClientConfig {
  if (!OPENAI_RESPONSES_COMPATIBLE_CHANNELS.has(provider.channelId)) {
    return {
      id: 'codex',
      compatibility: resolveCompatibility(provider),
      available: false,
      reason: 'requiresOpenAIResponses',
      install: buildUnavailableInstallConfig(),
      snippets: [],
    };
  }

  const model = getPrimaryModel(provider);

  return {
    id: 'codex',
    compatibility: 'openai',
    available: true,
    install: buildInstallConfig({
      supportedModes: ['standard', 'env', 'both'],
      defaultMode: 'standard',
      environmentVariables: buildOpenAIEnvironmentVariables(provider),
    }),
    snippets: [
      buildSnippet({
        id: 'auth',
        kind: 'file',
        language: 'json',
        target: '~/.codex/auth.json',
        content: toJson({
          auth_mode: 'apikey',
          OPENAI_API_KEY: provider.apiKey,
        }),
      }),
      buildSnippet({
        id: 'config',
        kind: 'file',
        language: 'toml',
        target: '~/.codex/config.toml',
        content: [
          '# Shared defaults are safe when Codex does not use profiles.',
          '# If config.toml already sets `profile = "..."`, move `model` and `model_provider` into that active profile instead of overwriting shared defaults.',
          '',
          `model = ${toTomlString(model)}`,
          'model_provider = "api_router"',
          '',
          '[model_providers.api_router]',
          `name = ${toTomlString(provider.name)}`,
          `base_url = ${toTomlString(provider.baseUrl)}`,
          'wire_api = "responses"',
          'requires_openai_auth = true',
        ].join('\n'),
      }),
    ],
  };
}

function buildClaudeCodeConfig(provider: ProxyProvider): ProviderAccessClientConfig {
  if (resolveCompatibility(provider) !== 'anthropic') {
    return {
      id: 'claude-code',
      compatibility: resolveCompatibility(provider),
      available: false,
      reason: 'requiresAnthropicCompatible',
      install: buildUnavailableInstallConfig(),
      snippets: [],
    };
  }

  const model = getPrimaryModel(provider);

  return {
    id: 'claude-code',
    compatibility: 'anthropic',
    available: true,
    install: buildInstallConfig({
      supportedModes: ['standard', 'env', 'both'],
      defaultMode: 'standard',
      environmentVariables: buildAnthropicEnvironmentVariables(provider),
    }),
    snippets: [
      buildSnippet({
        id: 'settings',
        kind: 'file',
        language: 'json',
        target: '~/.claude/settings.json',
        content: toJson({
          $schema: 'https://json.schemastore.org/claude-code-settings.json',
          model,
          env: {
            ANTHROPIC_AUTH_TOKEN: provider.apiKey,
            ANTHROPIC_BASE_URL: provider.baseUrl,
          },
        }),
      }),
    ],
  };
}

function buildOpenCodeConfig(provider: ProxyProvider): ProviderAccessClientConfig {
  const compatibility = resolveCompatibility(provider);
  const model = getPrimaryModel(provider);
  const modelName = getPrimaryModelName(provider);

  if (compatibility === 'openai') {
    return {
      id: 'opencode',
      compatibility,
      available: true,
      install: buildInstallConfig({
        supportedModes: ['standard', 'env', 'both'],
        defaultMode: 'standard',
        environmentVariables: buildOpenAIEnvironmentVariables(provider),
      }),
      snippets: [
        buildSnippet({
          id: 'config',
          kind: 'file',
          language: 'json',
          target: '~/.config/opencode/opencode.json',
          content: toJson({
            $schema: 'https://opencode.ai/config.json',
            provider: {
              'api-router': {
                npm: getOpenCodeProviderPackage(provider),
                name: provider.name,
                options: {
                  baseURL: provider.baseUrl,
                },
                models: {
                  [model]: {
                    name: `${provider.name} / ${modelName}`,
                  },
                },
              },
            },
            model: `api-router/${model}`,
          }),
        }),
        buildOpenCodeAuthSnippet('api-router', provider.apiKey),
      ],
    };
  }

  if (compatibility === 'anthropic') {
    return {
      id: 'opencode',
      compatibility,
      available: true,
      install: buildInstallConfig({
        supportedModes: ['standard', 'env', 'both'],
        defaultMode: 'standard',
        environmentVariables: buildAnthropicEnvironmentVariables(provider),
      }),
      snippets: [
        buildSnippet({
          id: 'config',
          kind: 'file',
          language: 'json',
          target: '~/.config/opencode/opencode.json',
          content: toJson({
            $schema: 'https://opencode.ai/config.json',
            provider: {
              anthropic: {
                options: {
                  baseURL: provider.baseUrl,
                },
                models: {
                  [model]: {
                    name: `${provider.name} / ${modelName}`,
                  },
                },
              },
            },
            model: `anthropic/${model}`,
          }),
        }),
        buildOpenCodeAuthSnippet('anthropic', provider.apiKey),
      ],
    };
  }

  return {
    id: 'opencode',
    compatibility,
    available: false,
    reason: 'requiresOpenAIOrAnthropicCompatible',
    install: buildUnavailableInstallConfig(),
    snippets: [],
  };
}

function buildOpenClawConfig(provider: ProxyProvider): ProviderAccessClientConfig {
  const compatibility = resolveCompatibility(provider);
  const model = getPrimaryModel(provider);

  if (compatibility !== 'openai' && compatibility !== 'anthropic') {
    return {
      id: 'openclaw',
      compatibility,
      available: false,
      reason: 'requiresOpenAIOrAnthropicCompatible',
      install: buildUnavailableInstallConfig(),
      snippets: [],
    };
  }

  return {
    id: 'openclaw',
    compatibility,
    available: true,
    install: buildInstallConfig({
      supportedModes: ['standard'],
      defaultMode: 'standard',
    }),
    snippets: [
      buildSnippet({
        id: 'command',
        kind: 'command',
        language: 'bash',
        target: 'openclaw onboard',
        content: [
          'openclaw onboard',
          '--auth-choice custom-api-key',
          `--custom-base-url ${toShellString(provider.baseUrl)}`,
          `--custom-model-id ${toShellString(model)}`,
          `--custom-api-key ${toShellString(provider.apiKey)}`,
          '--custom-provider-id "api-router"',
          `--custom-compatibility ${compatibility}`,
        ].join(' '),
      }),
    ],
  };
}

function buildGeminiConfig(provider: ProxyProvider): ProviderAccessClientConfig {
  const compatibility = resolveCompatibility(provider);
  const model = getPrimaryModel(provider);

  if (compatibility !== 'gemini') {
    return {
      id: 'gemini',
      compatibility,
      available: false,
      reason: 'requiresGeminiCompatible',
      install: buildUnavailableInstallConfig(),
      snippets: [],
    };
  }

  const environmentVariables = buildGeminiEnvironmentVariables(provider);

  return {
    id: 'gemini',
    compatibility,
    available: true,
    install: buildInstallConfig({
      supportedModes: ['standard', 'env', 'both'],
      defaultMode: 'standard',
      environmentVariables,
    }),
    snippets: [
      buildSnippet({
        id: 'settings',
        kind: 'file',
        language: 'json',
        target: '~/.gemini/settings.json',
        content: toJson({
          model: {
            name: model,
          },
          security: {
            auth: {
              selectedType: 'gemini-api-key',
            },
          },
        }),
      }),
      buildSnippet({
        id: 'env-file',
        kind: 'file',
        language: 'bash',
        target: '~/.gemini/.env',
        content: formatEnvironmentVariables(environmentVariables),
      }),
    ],
  };
}

export function buildProviderAccessClientConfigById(
  clientId: ProviderAccessClientId,
  provider: ProxyProvider,
): ProviderAccessClientConfig {
  switch (clientId) {
    case 'codex':
      return buildCodexConfig(provider);
    case 'claude-code':
      return buildClaudeCodeConfig(provider);
    case 'opencode':
      return buildOpenCodeConfig(provider);
    case 'openclaw':
      return buildOpenClawConfig(provider);
    case 'gemini':
      return buildGeminiConfig(provider);
  }
}

export function buildProviderAccessClientConfigs(provider: ProxyProvider): ProviderAccessClientConfig[] {
  return [
    buildProviderAccessClientConfigById('codex', provider),
    buildProviderAccessClientConfigById('claude-code', provider),
    buildProviderAccessClientConfigById('opencode', provider),
    buildProviderAccessClientConfigById('openclaw', provider),
    buildProviderAccessClientConfigById('gemini', provider),
  ];
}

export function resolveProviderAccessSnippetDisplayPlatform(
  runtimeInfo?: ProviderAccessRuntimeInfoLike | null,
): ProviderAccessSnippetDisplayPlatform | null {
  const target = `${runtimeInfo?.system?.family || ''} ${runtimeInfo?.system?.os || ''}`.toLowerCase();

  if (target.includes('windows')) {
    return 'windows';
  }

  if (target.includes('mac') || target.includes('darwin')) {
    return 'macos';
  }

  if (target.includes('linux')) {
    return 'linux';
  }

  return null;
}

export function resolveProviderAccessSnippetTarget(
  snippet: ProviderAccessSnippet,
  displayPlatform?: ProviderAccessSnippetDisplayPlatform | null,
) {
  if (displayPlatform) {
    const resolvedTarget = snippet.displayTargets?.[displayPlatform];

    if (resolvedTarget) {
      return resolvedTarget;
    }
  }

  return snippet.target;
}

export function formatProviderAccessClientBundle(
  client: ProviderAccessClientConfig,
  displayPlatform?: ProviderAccessSnippetDisplayPlatform | null,
) {
  const sections = client.snippets
    .map((snippet) => [`# ${resolveProviderAccessSnippetTarget(snippet, displayPlatform)}`, snippet.content].join('\n'))
    .concat(
      client.install.environmentVariables.length > 0
        ? [`# persistent-environment\n${formatEnvironmentVariables(client.install.environmentVariables)}`]
        : [],
    );

  return sections.join('\n\n');
}
