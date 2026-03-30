import type {
  MockInstanceLLMProvider,
  MockInstanceLLMProviderModel,
  ProviderClientSetupOpenClawInstance,
} from '@sdkwork/claw-infrastructure';
import type { ProxyProvider } from '@sdkwork/claw-types';
import type { ProviderAccessClientConfig } from './providerAccessConfigService';

export interface ProviderAccessSetupArtifact {
  id: string;
  filename: string;
  target: string;
  content: string;
  mimeType: string;
  copyToClipboard?: boolean;
  saveToFile?: boolean;
}

export interface OpenClawInstanceProviderDraft extends Omit<MockInstanceLLMProvider, 'instanceId'> {
  instanceId: string;
}

function getArtifactMimeType(filename: string) {
  if (filename.endsWith('.json')) {
    return 'application/json;charset=utf-8';
  }

  return 'text/plain;charset=utf-8';
}

function getArtifactFilename(clientId: ProviderAccessClientConfig['id'], target: string) {
  if (clientId === 'codex') {
    if (target === '~/.codex/auth.json') {
      return 'codex-api-router.auth.json';
    }

    return 'codex-api-router.config.toml';
  }

  if (clientId === 'claude-code') {
    return 'claude-code-api-router.settings.json';
  }

  if (clientId === 'opencode') {
    if (target === '~/.local/share/opencode/auth.json') {
      return 'opencode-api-router.auth.json';
    }

    return 'opencode-api-router.config.json';
  }

  if (clientId === 'gemini') {
    if (target === '~/.gemini/settings.json') {
      return 'gemini-cli.settings.json';
    }

    if (target === '~/.gemini/.env') {
      return 'gemini-cli.env';
    }
  }

  return 'api-router-setup.txt';
}

function buildArtifact(client: ProviderAccessClientConfig, snippetIndex: number): ProviderAccessSetupArtifact | null {
  const snippet = client.snippets[snippetIndex];
  if (!snippet) {
    return null;
  }

  if (snippet.kind === 'command') {
    return null;
  }

  const filename = getArtifactFilename(client.id, snippet.target);

  return {
    id: `${client.id}-${snippet.id}`,
    filename,
    target: snippet.target,
    content: snippet.content,
    mimeType: getArtifactMimeType(filename),
    copyToClipboard: snippet.kind === 'env',
    saveToFile: snippet.kind === 'file',
  };
}

export function buildProviderAccessSetupArtifacts(client: ProviderAccessClientConfig) {
  if (!client.available) {
    return [];
  }

  return client.snippets
    .map((_, index) => buildArtifact(client, index))
    .filter((artifact): artifact is ProviderAccessSetupArtifact => Boolean(artifact));
}

function inferReasoningModelId(provider: ProxyProvider) {
  const hintedModel = provider.models.find((model) =>
    /(reason|reasoner|thinking|r1|o1|o3|o4|t1|k1|opus)/i.test(`${model.id} ${model.name}`),
  );

  if (hintedModel) {
    return hintedModel.id;
  }

  const fallbackModel = provider.models[1];
  return fallbackModel?.id;
}

function inferEmbeddingModelId(provider: ProxyProvider) {
  return provider.models.find((model) =>
    /(embed|embedding|bge|vector)/i.test(`${model.id} ${model.name}`),
  )?.id;
}

function inferModelRole(
  model: ProxyProvider['models'][number],
  primaryModelId: string,
  reasoningModelId?: string,
  embeddingModelId?: string,
): MockInstanceLLMProviderModel['role'] {
  if (model.id === primaryModelId) {
    return 'primary';
  }

  if (embeddingModelId && model.id === embeddingModelId) {
    return 'embedding';
  }

  if (reasoningModelId && model.id === reasoningModelId) {
    return 'reasoning';
  }

  return 'fallback';
}

function inferModelContextWindow(role: MockInstanceLLMProviderModel['role']) {
  if (role === 'embedding') {
    return '8K';
  }

  if (role === 'reasoning') {
    return '200K';
  }

  return '128K';
}

function getOpenClawDraftIcon(channelId: string) {
  const iconMap: Record<string, string> = {
    openai: 'OA',
    anthropic: 'AT',
    google: 'GG',
    xai: 'XI',
    deepseek: 'DS',
    qwen: 'QW',
    zhipu: 'ZP',
    moonshot: 'KI',
    minimax: 'MM',
  };

  return iconMap[channelId] || 'AR';
}

export function buildOpenClawInstanceProviderDraft(
  provider: ProxyProvider,
  openClawInstance: ProviderClientSetupOpenClawInstance,
): OpenClawInstanceProviderDraft {
  const primaryModelId = provider.models[0]?.id || 'model-id';
  const reasoningModelId = inferReasoningModelId(provider);
  const embeddingModelId = inferEmbeddingModelId(provider);
  const models = provider.models.map((model) => {
    const role = inferModelRole(model, primaryModelId, reasoningModelId, embeddingModelId);

    return {
      id: model.id,
      name: model.name,
      role,
      contextWindow: inferModelContextWindow(role),
    };
  });

  return {
    id: `provider-api-router-${provider.id}`,
    instanceId: openClawInstance.instanceId,
    name: provider.name,
    provider: 'api-router',
    endpoint: openClawInstance.endpoint,
    apiKeySource: openClawInstance.apiKey,
    status: 'ready',
    defaultModelId: primaryModelId,
    reasoningModelId,
    embeddingModelId,
    description: `Managed from API Router using ${provider.name}.`,
    icon: getOpenClawDraftIcon(provider.channelId),
    lastCheckedAt: 'just now',
    capabilities: ['API Router', 'Managed Route', 'OpenClaw'],
    models,
    config: {
      temperature: 0.2,
      topP: 1,
      maxTokens: 8192,
      timeoutMs: 60000,
      streaming: true,
    },
    routerConfig: {
      gatewayBaseUrl: openClawInstance.endpoint,
      apiKeyProjectId: openClawInstance.apiKeyProjectId,
      apiKeyStrategy: openClawInstance.apiKeyStrategy,
      selectedProviderId: openClawInstance.selectedProviderId || undefined,
      modelMappingId: openClawInstance.modelMappingId || undefined,
    },
  };
}
