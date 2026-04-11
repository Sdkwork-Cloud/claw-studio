import type { InstanceLLMProviderUpdate } from '../types/index.ts';
import { upsertOpenClawProviderModels } from './openClawSupport.ts';

function buildOpenClawModelRef(providerId: string, modelId: string) {
  return `${providerId.trim()}/${modelId.trim()}`;
}

function inferOpenClawModelCatalogStreaming(model: Record<string, unknown>) {
  if (typeof model.role === 'string' && model.role.trim().toLowerCase() === 'embedding') {
    return false;
  }

  const id = typeof model.id === 'string' ? model.id.toLowerCase() : '';
  const name = typeof model.name === 'string' ? model.name.toLowerCase() : '';
  const api = typeof model.api === 'string' ? model.api.toLowerCase() : '';
  return !(id.includes('embed') || name.includes('embed') || api.includes('embedding'));
}

function buildOpenClawRuntimeParamsPatch(update: InstanceLLMProviderUpdate) {
  return {
    temperature: update.config.temperature,
    topP: update.config.topP,
    maxTokens: update.config.maxTokens,
    timeoutMs: update.config.timeoutMs,
    streaming: update.config.streaming,
  };
}

function buildTlsPatch(
  tls: NonNullable<NonNullable<InstanceLLMProviderUpdate['config']['request']>['tls']> | undefined,
) {
  if (!tls) {
    return null;
  }

  const nextTlsPatch: Record<string, unknown> = {};
  const ca = tls.ca?.trim() || '';
  const cert = tls.cert?.trim() || '';
  const key = tls.key?.trim() || '';
  const passphrase = tls.passphrase?.trim() || '';
  const serverName = tls.serverName?.trim() || '';

  if (ca) {
    nextTlsPatch.ca = ca;
  }
  if (cert) {
    nextTlsPatch.cert = cert;
  }
  if (key) {
    nextTlsPatch.key = key;
  }
  if (passphrase) {
    nextTlsPatch.passphrase = passphrase;
  }
  if (serverName) {
    nextTlsPatch.serverName = serverName;
  }
  if (typeof tls.insecureSkipVerify === 'boolean') {
    nextTlsPatch.insecureSkipVerify = tls.insecureSkipVerify;
  }

  return Object.keys(nextTlsPatch).length > 0 ? nextTlsPatch : null;
}

export function buildOpenClawRequestOverridesPatch(
  request: InstanceLLMProviderUpdate['config']['request'],
) {
  if (!request) {
    return null;
  }

  const nextPatch: Record<string, unknown> = {};

  const headers = Object.fromEntries(
    Object.entries(request.headers || {}).flatMap(([key, value]) => {
      const normalizedKey = key.trim();
      const normalizedValue = value.trim();
      return normalizedKey && normalizedValue ? [[normalizedKey, normalizedValue]] : [];
    }),
  );
  if (Object.keys(headers).length > 0) {
    nextPatch.headers = headers;
  }

  if (request.auth) {
    const authPatch: Record<string, unknown> = {
      mode: request.auth.mode,
    };
    if (request.auth.mode === 'authorization-bearer') {
      const token = request.auth.token?.trim() || '';
      if (token) {
        authPatch.token = token;
      }
    }
    if (request.auth.mode === 'header') {
      const headerName = request.auth.headerName?.trim() || '';
      const value = request.auth.value?.trim() || '';
      const prefix = request.auth.prefix?.trim() || '';
      if (headerName) {
        authPatch.headerName = headerName;
      }
      if (value) {
        authPatch.value = value;
      }
      if (prefix) {
        authPatch.prefix = prefix;
      }
    }
    nextPatch.auth = authPatch;
  }

  if (request.proxy) {
    const proxyPatch: Record<string, unknown> = {
      mode: request.proxy.mode,
    };
    const url = request.proxy.url?.trim() || '';
    if (url) {
      proxyPatch.url = url;
    }
    const proxyTlsPatch = buildTlsPatch(request.proxy.tls);
    if (proxyTlsPatch) {
      proxyPatch.tls = proxyTlsPatch;
    }
    nextPatch.proxy = proxyPatch;
  }

  const tlsPatch = buildTlsPatch(request.tls);
  if (tlsPatch) {
    nextPatch.tls = tlsPatch;
  }

  return Object.keys(nextPatch).length > 0 ? nextPatch : null;
}

export function buildRemoteOpenClawProviderConfigPatch(
  providerId: string,
  update: InstanceLLMProviderUpdate,
  existingModels: unknown[],
) {
  const normalizedProviderId = providerId.trim();
  const normalizedDefaultModelId = update.defaultModelId.trim();
  const normalizedReasoningModelId = update.reasoningModelId?.trim() || undefined;
  const normalizedEmbeddingModelId = update.embeddingModelId?.trim() || undefined;
  const nextModels = upsertOpenClawProviderModels(
    existingModels,
    normalizedDefaultModelId,
    normalizedReasoningModelId,
    normalizedEmbeddingModelId,
  );
  const defaultsModelsPatch = Object.fromEntries(
    nextModels.flatMap((model) => {
      if (!model || typeof model !== 'object' || Array.isArray(model)) {
        return [];
      }

      const modelRecord = model as Record<string, unknown>;
      const modelId = typeof modelRecord.id === 'string' ? modelRecord.id.trim() : '';
      if (!modelId) {
        return [];
      }

      const entry: Record<string, unknown> = {
        alias: (typeof modelRecord.name === 'string' && modelRecord.name.trim()) || modelId,
        streaming: inferOpenClawModelCatalogStreaming(modelRecord),
      };

      if (modelId === normalizedDefaultModelId) {
        entry.params = buildOpenClawRuntimeParamsPatch(update);
      }

      return [[buildOpenClawModelRef(normalizedProviderId, modelId), entry]];
    }),
  );

  const defaultsModelPatch: Record<string, unknown> = {
    primary: buildOpenClawModelRef(normalizedProviderId, normalizedDefaultModelId),
  };
  if (normalizedReasoningModelId) {
    defaultsModelPatch.fallbacks = [
      buildOpenClawModelRef(normalizedProviderId, normalizedReasoningModelId),
    ];
  }

  return {
    models: {
      providers: {
        [normalizedProviderId]: {
          baseUrl: update.endpoint.trim(),
          apiKey: update.apiKeySource.trim() || null,
          temperature: null,
          topP: null,
          maxTokens: null,
          timeoutMs: null,
          streaming: null,
          request: buildOpenClawRequestOverridesPatch(update.config.request),
          models: nextModels,
        },
      },
    },
    agents: {
      defaults: {
        model: defaultsModelPatch,
        models: defaultsModelsPatch,
      },
    },
  };
}
