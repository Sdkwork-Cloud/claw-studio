import type { UnifiedApiKey, UnifiedApiKeySource } from '@sdkwork/claw-types';

export interface UnifiedApiKeyFormState {
  name: string;
  keyMode: UnifiedApiKeySource;
  apiKey: string;
  groupId: string;
  groupName: string;
  expiresAt: string;
  notes: string;
}

export interface NormalizedUnifiedApiKeyFormState {
  name: string;
  source: UnifiedApiKeySource;
  apiKey?: string;
  groupId: string;
  groupName?: string;
  expiresAt: string | null;
  notes: string;
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

export function createEmptyUnifiedApiKeyFormState(): UnifiedApiKeyFormState {
  return {
    name: '',
    keyMode: 'system-generated',
    apiKey: '',
    groupId: '',
    groupName: '',
    expiresAt: '',
    notes: '',
  };
}

export function buildEditUnifiedApiKeyFormState(item: UnifiedApiKey): UnifiedApiKeyFormState {
  return {
    name: item.name,
    keyMode: item.source,
    apiKey: item.apiKey,
    groupId: item.groupId,
    groupName: '',
    expiresAt: formatDateInput(item.expiresAt),
    notes: item.notes || '',
  };
}

export function normalizeUnifiedApiKeyFormState(
  formState: UnifiedApiKeyFormState,
): NormalizedUnifiedApiKeyFormState | null {
  const name = formState.name.trim();
  const groupId = formState.groupId.trim();
  const groupName = formState.groupName.trim();
  const notes = formState.notes.trim();
  const apiKey = formState.apiKey.trim();

  if (!name || (!groupId && !groupName)) {
    return null;
  }

  if (formState.keyMode === 'custom' && !apiKey) {
    return null;
  }

  return {
    name,
    source: formState.keyMode,
    apiKey: apiKey || undefined,
    groupId,
    groupName: groupName || undefined,
    expiresAt: normalizeDateInput(formState.expiresAt),
    notes,
  };
}
