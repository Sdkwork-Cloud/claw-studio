import type {
  ModelMapping,
  ModelMappingModelRef,
  ModelMappingRuleInput,
} from '@sdkwork/claw-types';

export interface ModelMappingFormRuleState {
  id: string;
  source: ModelMappingModelRef | null;
  target: ModelMappingModelRef | null;
}

export interface ModelMappingFormState {
  name: string;
  description: string;
  effectiveFrom: string;
  effectiveTo: string;
  rules: ModelMappingFormRuleState[];
}

export interface NormalizedModelMappingFormState {
  name: string;
  description: string;
  effectiveFrom: string;
  effectiveTo: string;
  rules: ModelMappingRuleInput[];
}

export function createEmptyModelMappingRule(): ModelMappingFormRuleState {
  return {
    id: '',
    source: null,
    target: null,
  };
}

export function createEmptyModelMappingFormState(): ModelMappingFormState {
  return {
    name: '',
    description: '',
    effectiveFrom: '',
    effectiveTo: '',
    rules: [createEmptyModelMappingRule()],
  };
}

function formatDateInput(value: string) {
  return value.slice(0, 10);
}

function normalizeStartDateInput(value: string) {
  return `${value}T00:00:00.000Z`;
}

function normalizeEndDateInput(value: string) {
  return `${value}T23:59:59.000Z`;
}

function normalizeModelRef(ref: ModelMappingModelRef): ModelMappingModelRef {
  return {
    channelId: ref.channelId,
    channelName: ref.channelName.trim(),
    modelId: ref.modelId.trim(),
    modelName: ref.modelName.trim(),
  };
}

export function buildEditModelMappingFormState(item: ModelMapping): ModelMappingFormState {
  return {
    name: item.name,
    description: item.description,
    effectiveFrom: formatDateInput(item.effectiveFrom),
    effectiveTo: formatDateInput(item.effectiveTo),
    rules: item.rules.map((rule) => ({
      id: rule.id,
      source: { ...rule.source },
      target: { ...rule.target },
    })),
  };
}

export function appendModelMappingRule(
  rules: ModelMappingFormRuleState[],
): ModelMappingFormRuleState[] {
  return [...rules, createEmptyModelMappingRule()];
}

export function removeModelMappingRule(
  rules: ModelMappingFormRuleState[],
  index: number,
): ModelMappingFormRuleState[] {
  const nextRules = rules.filter((_, ruleIndex) => ruleIndex !== index);
  return nextRules.length > 0 ? nextRules : [createEmptyModelMappingRule()];
}

export function normalizeModelMappingFormState(
  formState: ModelMappingFormState,
): NormalizedModelMappingFormState | null {
  const name = formState.name.trim();
  const description = formState.description.trim();

  if (!name || !formState.effectiveFrom || !formState.effectiveTo) {
    return null;
  }

  if (formState.effectiveFrom > formState.effectiveTo) {
    return null;
  }

  const populatedRules = formState.rules
    .map((rule) => ({
      id: rule.id.trim(),
      source: rule.source ? normalizeModelRef(rule.source) : null,
      target: rule.target ? normalizeModelRef(rule.target) : null,
    }))
    .filter((rule) => rule.source || rule.target);

  if (populatedRules.length === 0) {
    return null;
  }

  if (populatedRules.some((rule) => !rule.source || !rule.target)) {
    return null;
  }

  const completeRules = populatedRules as Array<{
    id: string;
    source: ModelMappingModelRef;
    target: ModelMappingModelRef;
  }>;

  const sourceKeys = new Set<string>();

  for (const rule of completeRules) {
    const sourceKey = `${rule.source.channelId}::${rule.source.modelId}`;
    const targetKey = `${rule.target.channelId}::${rule.target.modelId}`;

    if (sourceKey === targetKey) {
      return null;
    }

    if (sourceKeys.has(sourceKey)) {
      return null;
    }

    sourceKeys.add(sourceKey);
  }

  return {
    name,
    description,
    effectiveFrom: normalizeStartDateInput(formState.effectiveFrom),
    effectiveTo: normalizeEndDateInput(formState.effectiveTo),
    rules: completeRules.map((rule) => ({
      id: rule.id || undefined,
      source: rule.source,
      target: rule.target,
    })),
  };
}
