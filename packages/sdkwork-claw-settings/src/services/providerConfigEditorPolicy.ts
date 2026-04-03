import {
  inferLocalAiProxyClientProtocol,
  inferLocalAiProxyUpstreamProtocol,
  listKnownProviderRoutingChannels,
  normalizeLegacyProviderId,
} from '@sdkwork/claw-core';
import type {
  LocalAiProxyClientProtocol,
  LocalAiProxyUpstreamProtocol,
} from '@sdkwork/claw-types';
import type {
  ProviderConfigDraft,
  ProviderConfigPreset,
  ProviderConfigRecord,
} from './providerConfigCenterService.ts';

type ProviderConfigFieldMode = 'auto' | 'manual';

const PRIORITIZED_PROVIDER_ORDER = [
  'sdkwork',
  'openai',
  'anthropic',
  'google',
  'gemini',
  'xai',
  'azure-openai',
  'openrouter',
  'deepseek',
  'minimax',
  'moonshot',
  'qwen',
  'meta',
  'mistral',
  'cohere',
] as const;

const providerPriorityIndex: ReadonlyMap<string, number> = new Map(
  PRIORITIZED_PROVIDER_ORDER.map((providerId, index) => [providerId, index] as const),
);

export const providerConfigClientProtocolOptions: LocalAiProxyClientProtocol[] = [
  'openai-compatible',
  'anthropic',
  'gemini',
];

export const providerConfigUpstreamProtocolOptions: LocalAiProxyUpstreamProtocol[] = [
  'openai-compatible',
  'anthropic',
  'gemini',
  'azure-openai',
  'openrouter',
  'sdkwork',
];

export interface ProviderConfigKnownProviderOption {
  id: string;
  label: string;
  providerId: string;
  vendor: string;
  modelFamily: string;
  description: string;
  clientProtocol: LocalAiProxyClientProtocol;
  upstreamProtocol: LocalAiProxyUpstreamProtocol;
  baseUrl: string;
  hasExampleModels: boolean;
}

export interface ProviderConfigModelRow {
  id: string;
  name: string;
}

export interface ProviderConfigFormState {
  id?: string;
  presetId: string;
  name: string;
  providerId: string;
  clientProtocol: string;
  upstreamProtocol: string;
  baseUrl: string;
  apiKey: string;
  enabled: boolean;
  isDefault: boolean;
  managedBy: 'system-default' | 'user';
  defaultModelId: string;
  reasoningModelId: string;
  embeddingModelId: string;
  modelRows: ProviderConfigModelRow[];
  modelsText: string;
  notes: string;
  temperature: string;
  topP: string;
  maxTokens: string;
  timeoutMs: string;
  streaming: boolean;
  clientProtocolMode: ProviderConfigFieldMode;
  upstreamProtocolMode: ProviderConfigFieldMode;
  baseUrlMode: ProviderConfigFieldMode;
}

function createProviderConfigModelRow(input?: Partial<ProviderConfigModelRow>): ProviderConfigModelRow {
  return {
    id: input?.id || '',
    name: input?.name || '',
  };
}

function formatModelsText(models: readonly ProviderConfigModelRow[]) {
  return models
    .map((model) => {
      const id = model.id.trim();
      const name = model.name.trim();
      if (!id) {
        return '';
      }
      if (!name || name === id) {
        return id;
      }
      return `${id}=${name}`;
    })
    .filter(Boolean)
    .join('\n');
}

function parseModelsText(modelsText: string): ProviderConfigModelRow[] {
  return Array.from(
    new Map(
      modelsText
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const separatorIndex = line.indexOf('=');
          if (separatorIndex <= 0) {
            return { id: line, name: line };
          }
          const id = line.slice(0, separatorIndex).trim();
          const name = line.slice(separatorIndex + 1).trim();
          return createProviderConfigModelRow({ id, name: name || id });
        })
        .filter((model) => model.id)
        .map((model) => [model.id, model] as const),
    ).values(),
  );
}

function appendReferencedModelIds(
  models: ProviderConfigDraft['models'],
  modelIds: Array<string | undefined>,
) {
  const merged = new Map(models.map((model) => [model.id, model] as const));

  for (const modelId of modelIds) {
    const normalizedModelId = modelId?.trim();
    if (!normalizedModelId || merged.has(normalizedModelId)) {
      continue;
    }

    merged.set(normalizedModelId, {
      id: normalizedModelId,
      name: normalizedModelId,
    });
  }

  return [...merged.values()];
}

function normalizeProviderId(providerId: string) {
  return normalizeLegacyProviderId(providerId).trim().toLowerCase();
}

function buildKnownProviderChannelDefinitionMap() {
  return new Map(
    listKnownProviderRoutingChannels().map((channel) => [normalizeProviderId(channel.id), channel] as const),
  );
}

export function listProviderConfigKnownProviderOptions(
  presets: readonly ProviderConfigPreset[],
): ProviderConfigKnownProviderOption[] {
  const channelDefinitions = buildKnownProviderChannelDefinitionMap();

  return presets
    .map((preset) => {
      const providerId = preset.draft.providerId || preset.id;
      const normalizedProviderId = normalizeProviderId(providerId);
      const definition =
        channelDefinitions.get(normalizedProviderId) ||
        channelDefinitions.get(normalizeProviderId(preset.id));

      return {
        id: preset.id,
        label: preset.label,
        providerId,
        vendor: definition?.vendor || preset.label,
        modelFamily: definition?.modelFamily || 'Custom',
        description: definition?.description || preset.description,
        clientProtocol: resolveSuggestedClientProtocol(providerId, preset),
        upstreamProtocol: resolveSuggestedUpstreamProtocol(providerId, preset),
        baseUrl: resolveSuggestedBaseUrl(providerId, preset),
        hasExampleModels:
          preset.draft.models.some((model) => Boolean(model.id.trim())) ||
          Boolean(preset.draft.defaultModelId?.trim()),
      };
    })
    .sort((left, right) => {
      const leftPriority = providerPriorityIndex.get(normalizeProviderId(left.providerId)) ?? Number.MAX_SAFE_INTEGER;
      const rightPriority = providerPriorityIndex.get(normalizeProviderId(right.providerId)) ?? Number.MAX_SAFE_INTEGER;

      if (leftPriority !== rightPriority) {
        return leftPriority - rightPriority;
      }

      return left.label.localeCompare(right.label);
    });
}

export function findProviderConfigKnownProviderOption(
  providerId: string,
  presets: readonly ProviderConfigPreset[],
): ProviderConfigKnownProviderOption | null {
  const normalizedProviderId = normalizeProviderId(providerId);
  if (!normalizedProviderId) {
    return null;
  }

  return (
    listProviderConfigKnownProviderOptions(presets).find(
      (option) =>
        normalizeProviderId(option.providerId) === normalizedProviderId ||
        normalizeProviderId(option.id) === normalizedProviderId,
    ) || null
  );
}

function findPresetForProviderId(
  providerId: string,
  presets: readonly ProviderConfigPreset[],
): ProviderConfigPreset | null {
  const normalizedProviderId = normalizeProviderId(providerId);
  if (!normalizedProviderId) {
    return null;
  }

  return (
    presets.find((preset) => normalizeProviderId(preset.draft.providerId) === normalizedProviderId) ||
    presets.find((preset) => normalizeProviderId(preset.id) === normalizedProviderId) ||
    null
  );
}

function resolveSuggestedClientProtocol(
  providerId: string,
  preset?: ProviderConfigPreset | null,
): LocalAiProxyClientProtocol {
  return preset?.draft.clientProtocol || inferLocalAiProxyClientProtocol(providerId);
}

function resolveSuggestedUpstreamProtocol(
  providerId: string,
  preset?: ProviderConfigPreset | null,
): LocalAiProxyUpstreamProtocol {
  return preset?.draft.upstreamProtocol || inferLocalAiProxyUpstreamProtocol(providerId);
}

function normalizeClientProtocolInput(
  providerId: string,
  clientProtocol: string,
): LocalAiProxyClientProtocol {
  switch (clientProtocol.trim()) {
    case 'anthropic':
      return 'anthropic';
    case 'gemini':
      return 'gemini';
    case 'openai-compatible':
      return 'openai-compatible';
    default:
      return inferLocalAiProxyClientProtocol(providerId);
  }
}

function normalizeUpstreamProtocolInput(
  providerId: string,
  upstreamProtocol: string,
): LocalAiProxyUpstreamProtocol {
  switch (upstreamProtocol.trim()) {
    case 'anthropic':
      return 'anthropic';
    case 'gemini':
      return 'gemini';
    case 'azure-openai':
      return 'azure-openai';
    case 'openrouter':
      return 'openrouter';
    case 'sdkwork':
      return 'sdkwork';
    case 'openai-compatible':
      return 'openai-compatible';
    default:
      return inferLocalAiProxyUpstreamProtocol(providerId);
  }
}

function resolveSuggestedBaseUrl(
  providerId: string,
  preset?: ProviderConfigPreset | null,
): string {
  return preset?.draft.upstreamBaseUrl || preset?.draft.baseUrl || '';
}

function createProviderConfigModelRows(
  models?: ProviderConfigDraft['models'],
): ProviderConfigModelRow[] {
  return (models || []).map((model) =>
    createProviderConfigModelRow({
      id: model.id,
      name: model.name || model.id,
    }),
  );
}

function withModelRows(
  current: ProviderConfigFormState,
  modelRows: readonly ProviderConfigModelRow[],
): ProviderConfigFormState {
  const nextRows = modelRows.map((model) => createProviderConfigModelRow(model));
  return {
    ...current,
    modelRows: nextRows,
    modelsText: formatModelsText(nextRows),
  };
}

function syncReferencedModelId(currentValue: string, previousId: string, nextId: string) {
  const normalizedCurrent = currentValue.trim();
  const normalizedPrevious = previousId.trim();
  if (!normalizedCurrent || normalizedCurrent !== normalizedPrevious) {
    return currentValue;
  }
  return nextId.trim();
}

function clearReferencedModelId(currentValue: string, removedId: string) {
  const normalizedCurrent = currentValue.trim();
  const normalizedRemoved = removedId.trim();
  if (!normalizedCurrent || normalizedCurrent !== normalizedRemoved) {
    return currentValue;
  }
  return '';
}

export function createProviderConfigFormState(
  input?: Partial<ProviderConfigDraft> & {
    id?: string;
    config?: Partial<ProviderConfigRecord['config']>;
  },
): ProviderConfigFormState {
  const runtimeConfig = input?.config || {};
  const providerId = input?.providerId || '';
  const modelRows = createProviderConfigModelRows(input?.models);
  return {
    id: input?.id,
    presetId: input?.presetId || '',
    name: input?.name || '',
    providerId,
    clientProtocol: normalizeClientProtocolInput(
      providerId,
      input?.clientProtocol || inferLocalAiProxyClientProtocol(providerId),
    ),
    upstreamProtocol: normalizeUpstreamProtocolInput(
      providerId,
      input?.upstreamProtocol || inferLocalAiProxyUpstreamProtocol(providerId),
    ),
    baseUrl: input?.baseUrl || input?.upstreamBaseUrl || '',
    apiKey: input?.apiKey || '',
    enabled: input?.enabled ?? true,
    isDefault: input?.isDefault ?? false,
    managedBy: input?.managedBy || 'user',
    defaultModelId: input?.defaultModelId || '',
    reasoningModelId: input?.reasoningModelId || '',
    embeddingModelId: input?.embeddingModelId || '',
    modelRows,
    modelsText: formatModelsText(modelRows),
    notes: input?.notes || '',
    temperature: String(runtimeConfig.temperature ?? 0.2),
    topP: String(runtimeConfig.topP ?? 1),
    maxTokens: String(runtimeConfig.maxTokens ?? 8192),
    timeoutMs: String(runtimeConfig.timeoutMs ?? 60000),
    streaming: runtimeConfig.streaming ?? true,
    clientProtocolMode: input?.id ? 'manual' : 'auto',
    upstreamProtocolMode: input?.id ? 'manual' : 'auto',
    baseUrlMode: input?.id ? 'manual' : 'auto',
  };
}

export function createProviderConfigDraftFromForm(
  form: ProviderConfigFormState,
): ProviderConfigDraft & { id?: string } {
  const defaultModelId = form.defaultModelId.trim();
  const reasoningModelId = form.reasoningModelId.trim() || undefined;
  const embeddingModelId = form.embeddingModelId.trim() || undefined;
  const sourceRows =
    form.modelRows.length > 0 ? form.modelRows : parseModelsText(form.modelsText);
  const models = appendReferencedModelIds(
    sourceRows
      .map((model) => ({
        id: model.id.trim(),
        name: model.name.trim() || model.id.trim(),
      }))
      .filter((model) => model.id),
    [
    defaultModelId,
    reasoningModelId,
    embeddingModelId,
    ],
  );

  return {
    id: form.id,
    presetId: form.presetId || undefined,
    name: form.name,
    providerId: form.providerId,
    clientProtocol: normalizeClientProtocolInput(form.providerId, form.clientProtocol),
    upstreamProtocol: normalizeUpstreamProtocolInput(form.providerId, form.upstreamProtocol),
    upstreamBaseUrl: form.baseUrl,
    baseUrl: form.baseUrl,
    apiKey: form.apiKey,
    enabled: form.enabled,
    isDefault: form.isDefault,
    managedBy: form.managedBy,
    defaultModelId,
    reasoningModelId,
    embeddingModelId,
    models,
    notes: form.notes || undefined,
    exposeTo: ['openclaw'],
    config: {
      temperature: Number.parseFloat(form.temperature) || 0.2,
      topP: Number.parseFloat(form.topP) || 1,
      maxTokens: Number.parseInt(form.maxTokens, 10) || 8192,
      timeoutMs: Number.parseInt(form.timeoutMs, 10) || 60000,
      streaming: form.streaming,
    },
  };
}

export function applyProviderConfigFormProviderIdInput(
  current: ProviderConfigFormState,
  providerId: string,
  presets: readonly ProviderConfigPreset[],
): ProviderConfigFormState {
  const preset = findPresetForProviderId(providerId, presets);
  return {
    ...current,
    presetId: '',
    providerId,
    clientProtocol:
      current.clientProtocolMode === 'auto'
        ? resolveSuggestedClientProtocol(providerId, preset)
        : current.clientProtocol,
    upstreamProtocol:
      current.upstreamProtocolMode === 'auto'
        ? resolveSuggestedUpstreamProtocol(providerId, preset)
        : current.upstreamProtocol,
    baseUrl:
      current.baseUrlMode === 'auto' ? resolveSuggestedBaseUrl(providerId, preset) : current.baseUrl,
  };
}

export function applyProviderConfigKnownProviderSelection(
  current: ProviderConfigFormState,
  providerSelectionId: string,
  presets: readonly ProviderConfigPreset[],
): ProviderConfigFormState {
  const selectedOption = findProviderConfigKnownProviderOption(providerSelectionId, presets);
  return applyProviderConfigFormProviderIdInput(
    current,
    selectedOption?.providerId || providerSelectionId,
    presets,
  );
}

export function applyProviderConfigFormClientProtocolInput(
  current: ProviderConfigFormState,
  clientProtocol: string,
): ProviderConfigFormState {
  return {
    ...current,
    presetId: '',
    clientProtocol: normalizeClientProtocolInput(current.providerId, clientProtocol),
    clientProtocolMode: 'manual',
  };
}

export function applyProviderConfigFormUpstreamProtocolInput(
  current: ProviderConfigFormState,
  upstreamProtocol: string,
): ProviderConfigFormState {
  return {
    ...current,
    presetId: '',
    upstreamProtocol: normalizeUpstreamProtocolInput(current.providerId, upstreamProtocol),
    upstreamProtocolMode: 'manual',
  };
}

export function applyProviderConfigFormBaseUrlInput(
  current: ProviderConfigFormState,
  baseUrl: string,
): ProviderConfigFormState {
  return {
    ...current,
    presetId: '',
    baseUrl,
    baseUrlMode: 'manual',
  };
}

export function listProviderConfigModelRows(form: ProviderConfigFormState): ProviderConfigModelRow[] {
  return form.modelRows.map((model) => createProviderConfigModelRow(model));
}

export function appendProviderConfigModelRow(
  current: ProviderConfigFormState,
): ProviderConfigFormState {
  return withModelRows(current, [...current.modelRows, createProviderConfigModelRow()]);
}

export function updateProviderConfigModelRow(
  current: ProviderConfigFormState,
  index: number,
  nextModel: Partial<ProviderConfigModelRow>,
): ProviderConfigFormState {
  if (index < 0 || index >= current.modelRows.length) {
    return current;
  }

  const previousModel = current.modelRows[index];
  const updatedModel = createProviderConfigModelRow({
    ...previousModel,
    ...nextModel,
  });
  const nextRows = current.modelRows.map((model, modelIndex) =>
    modelIndex === index ? updatedModel : createProviderConfigModelRow(model),
  );

  return withModelRows(
    {
      ...current,
      defaultModelId: syncReferencedModelId(
        current.defaultModelId,
        previousModel.id,
        updatedModel.id,
      ),
      reasoningModelId: syncReferencedModelId(
        current.reasoningModelId,
        previousModel.id,
        updatedModel.id,
      ),
      embeddingModelId: syncReferencedModelId(
        current.embeddingModelId,
        previousModel.id,
        updatedModel.id,
      ),
    },
    nextRows,
  );
}

export function removeProviderConfigModelRow(
  current: ProviderConfigFormState,
  index: number,
): ProviderConfigFormState {
  if (index < 0 || index >= current.modelRows.length) {
    return current;
  }

  const removedModel = current.modelRows[index];
  const nextRows = current.modelRows.filter((_, modelIndex) => modelIndex !== index);

  return withModelRows(
    {
      ...current,
      defaultModelId: clearReferencedModelId(current.defaultModelId, removedModel.id),
      reasoningModelId: clearReferencedModelId(current.reasoningModelId, removedModel.id),
      embeddingModelId: clearReferencedModelId(current.embeddingModelId, removedModel.id),
    },
    nextRows,
  );
}

export function moveProviderConfigModelRow(
  current: ProviderConfigFormState,
  index: number,
  direction: 'up' | 'down',
): ProviderConfigFormState {
  const targetIndex = direction === 'up' ? index - 1 : index + 1;
  if (
    index < 0 ||
    index >= current.modelRows.length ||
    targetIndex < 0 ||
    targetIndex >= current.modelRows.length
  ) {
    return current;
  }

  const nextRows = current.modelRows.map((model) => createProviderConfigModelRow(model));
  [nextRows[index], nextRows[targetIndex]] = [nextRows[targetIndex], nextRows[index]];
  return withModelRows(current, nextRows);
}
