import type { ProxyProvider, ProxyProviderModel } from '@sdkwork/claw-types';

export interface ProxyProviderCreateSeed {
  channelId: string;
  groupId: string;
  baseUrl: string;
  models: ProxyProviderModel[];
}

export interface ProxyProviderFormModelState {
  id: string;
  name: string;
}

export interface ProxyProviderFormState {
  name: string;
  apiKey: string;
  groupId: string;
  baseUrl: string;
  models: ProxyProviderFormModelState[];
  expiresAt: string;
  notes: string;
}

export interface NormalizedProxyProviderFormState {
  name: string;
  apiKey: string;
  groupId: string;
  baseUrl: string;
  models: ProxyProviderModel[];
  expiresAt: string | null;
  notes: string;
}

export interface NormalizedProxyProviderEditFormState
  extends Omit<NormalizedProxyProviderFormState, 'apiKey'> {
  apiKey?: string;
}

export function createEmptyProviderFormModel(): ProxyProviderFormModelState {
  return {
    id: '',
    name: '',
  };
}

export function createEmptyProviderFormState(): ProxyProviderFormState {
  return {
    name: '',
    apiKey: '',
    groupId: '',
    baseUrl: '',
    models: [createEmptyProviderFormModel()],
    expiresAt: '',
    notes: '',
  };
}

function formatDateInput(value: string | null) {
  if (!value) {
    return '';
  }

  return value.slice(0, 10);
}

function normalizeDateInput(value: string) {
  if (!value) {
    return null;
  }

  return `${value}T23:59:59.000Z`;
}

function cloneModels(models: ProxyProviderModel[]) {
  if (models.length === 0) {
    return [createEmptyProviderFormModel()];
  }

  return models.map((model) => ({
    id: model.id,
    name: model.name,
  }));
}

export function buildCreateProviderFormState(seed: ProxyProviderCreateSeed): ProxyProviderFormState {
  return {
    ...createEmptyProviderFormState(),
    groupId: seed.groupId,
    baseUrl: seed.baseUrl,
    models: cloneModels(seed.models),
  };
}

export function buildEditProviderFormState(provider: ProxyProvider): ProxyProviderFormState {
  return {
    name: provider.name,
    apiKey: provider.apiKey,
    groupId: provider.groupId,
    baseUrl: provider.baseUrl,
    models: cloneModels(provider.models),
    expiresAt: formatDateInput(provider.expiresAt),
    notes: provider.notes || '',
  };
}

export function appendProviderFormModel(
  models: ProxyProviderFormModelState[],
): ProxyProviderFormModelState[] {
  return [...models, createEmptyProviderFormModel()];
}

export function removeProviderFormModel(
  models: ProxyProviderFormModelState[],
  index: number,
): ProxyProviderFormModelState[] {
  const nextModels = models.filter((_, modelIndex) => modelIndex !== index);
  return nextModels.length > 0 ? nextModels : [createEmptyProviderFormModel()];
}

export function normalizeProviderFormState(
  formState: ProxyProviderFormState,
): NormalizedProxyProviderFormState | null {
  const normalizedSharedState = normalizeSharedProviderFormState(formState);
  if (!normalizedSharedState) {
    return null;
  }

  const apiKey = formState.apiKey.trim();
  if (!apiKey) {
    return null;
  }

  return {
    ...normalizedSharedState,
    apiKey,
  };
}

function normalizeSharedProviderFormState(
  formState: ProxyProviderFormState,
): Omit<NormalizedProxyProviderFormState, 'apiKey'> | null {
  const name = formState.name.trim();
  const groupId = formState.groupId;
  const baseUrl = formState.baseUrl.trim();
  const notes = formState.notes.trim();

  const normalizedModels = formState.models
    .map((model) => ({
      id: model.id.trim(),
      name: model.name.trim(),
    }))
    .filter((model) => model.id || model.name);

  const hasIncompleteModel = normalizedModels.some((model) => !model.id || !model.name);

  if (!name || !groupId || !baseUrl || normalizedModels.length === 0 || hasIncompleteModel) {
    return null;
  }

  return {
    name,
    groupId,
    baseUrl,
    models: normalizedModels,
    expiresAt: normalizeDateInput(formState.expiresAt),
    notes,
  };
}

export function normalizeProviderEditFormState(
  formState: ProxyProviderFormState,
): NormalizedProxyProviderEditFormState | null {
  const normalizedSharedState = normalizeSharedProviderFormState(formState);
  if (!normalizedSharedState) {
    return null;
  }

  const apiKey = formState.apiKey.trim();

  return {
    ...normalizedSharedState,
    apiKey: apiKey || undefined,
  };
}
