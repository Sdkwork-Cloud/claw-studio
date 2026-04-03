import type {
  OpenClawAgentInput,
  OpenClawAgentParamSource,
  OpenClawAgentParamValue,
} from '@sdkwork/claw-core';
import type { InstanceWorkbenchAgent } from '../types/index.ts';

export type OpenClawAgentModelSource = 'agent' | 'defaults' | 'runtime';
export type OpenClawAgentParamDisplaySource = OpenClawAgentParamSource | 'runtime';
export type OpenClawAgentParamKey =
  | 'temperature'
  | 'topP'
  | 'maxTokens'
  | 'timeoutMs'
  | 'streaming';
export type OpenClawStreamingMode = 'inherit' | 'enabled' | 'disabled';

export interface OpenClawAgentFormState {
  id: string;
  name: string;
  avatar: string;
  workspace: string;
  agentDir: string;
  isDefault: boolean;
  primaryModel: string;
  fallbackModelsText: string;
  temperature: string;
  topP: string;
  maxTokens: string;
  timeoutMs: string;
  streamingMode: OpenClawStreamingMode;
  fieldSources: {
    model: OpenClawAgentModelSource;
    temperature: OpenClawAgentParamDisplaySource;
    topP: OpenClawAgentParamDisplaySource;
    maxTokens: OpenClawAgentParamDisplaySource;
    timeoutMs: OpenClawAgentParamDisplaySource;
    streaming: OpenClawAgentParamDisplaySource;
  };
  inherited: {
    primaryModel: string;
    fallbackModelsText: string;
    temperature: string;
    topP: string;
    maxTokens: string;
    timeoutMs: string;
    streaming: boolean | null;
  };
}

export interface OpenClawAgentParamEntry {
  key: OpenClawAgentParamKey;
  value: string;
  source: OpenClawAgentParamDisplaySource;
}

const KNOWN_AGENT_PARAM_KEYS: OpenClawAgentParamKey[] = [
  'temperature',
  'topP',
  'maxTokens',
  'timeoutMs',
  'streaming',
];

function formatAgentParamValue(
  key: OpenClawAgentParamKey,
  value: OpenClawAgentParamValue | undefined,
) {
  if (value === undefined) {
    return '';
  }

  if (key === 'streaming') {
    return value === true ? 'true' : value === false ? 'false' : String(value);
  }

  return String(value);
}

function resolveParamSource(
  agent: InstanceWorkbenchAgent | null,
  key: OpenClawAgentParamKey,
): OpenClawAgentParamDisplaySource {
  return agent?.paramSources?.[key] || 'runtime';
}

export function parseAgentFallbackModels(value: string) {
  return Array.from(
    new Set(
      value
        .split(/\r?\n/)
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  );
}

export function createOpenClawAgentFormState(
  agent: InstanceWorkbenchAgent | null,
  modelSource: OpenClawAgentModelSource = 'agent',
): OpenClawAgentFormState {
  const fallbackModelsText = agent?.model?.fallbacks.join('\n') || '';
  const paramValues = agent?.params || {};
  const temperatureSource = resolveParamSource(agent, 'temperature');
  const topPSource = resolveParamSource(agent, 'topP');
  const maxTokensSource = resolveParamSource(agent, 'maxTokens');
  const timeoutMsSource = resolveParamSource(agent, 'timeoutMs');
  const streamingSource = resolveParamSource(agent, 'streaming');
  const streamingValue =
    typeof paramValues.streaming === 'boolean' ? paramValues.streaming : null;

  return {
    id: agent?.agent.id || '',
    name: agent?.agent.name || '',
    avatar: agent?.agent.avatar || '',
    workspace: agent?.workspace || '',
    agentDir: agent?.agentDir || '',
    isDefault: Boolean(agent?.isDefault),
    primaryModel:
      modelSource === 'defaults' ? '' : agent?.model?.primary || '',
    fallbackModelsText: modelSource === 'defaults' ? '' : fallbackModelsText,
    temperature:
      temperatureSource === 'defaults'
        ? ''
        : typeof paramValues.temperature === 'number'
          ? String(paramValues.temperature)
          : '',
    topP:
      topPSource === 'defaults'
        ? ''
        : typeof paramValues.topP === 'number'
          ? String(paramValues.topP)
          : '',
    maxTokens:
      maxTokensSource === 'defaults'
        ? ''
        : typeof paramValues.maxTokens === 'number'
          ? String(paramValues.maxTokens)
          : '',
    timeoutMs:
      timeoutMsSource === 'defaults'
        ? ''
        : typeof paramValues.timeoutMs === 'number'
          ? String(paramValues.timeoutMs)
          : '',
    streamingMode:
      streamingSource === 'defaults'
        ? 'inherit'
        : streamingValue === false
          ? 'disabled'
          : streamingValue === true
            ? 'enabled'
            : 'inherit',
    fieldSources: {
      model: modelSource,
      temperature: temperatureSource,
      topP: topPSource,
      maxTokens: maxTokensSource,
      timeoutMs: timeoutMsSource,
      streaming: streamingSource,
    },
    inherited: {
      primaryModel: modelSource === 'defaults' ? agent?.model?.primary || '' : '',
      fallbackModelsText: modelSource === 'defaults' ? fallbackModelsText : '',
      temperature:
        temperatureSource === 'defaults'
          ? formatAgentParamValue('temperature', paramValues.temperature)
          : '',
      topP:
        topPSource === 'defaults'
          ? formatAgentParamValue('topP', paramValues.topP)
          : '',
      maxTokens:
        maxTokensSource === 'defaults'
          ? formatAgentParamValue('maxTokens', paramValues.maxTokens)
          : '',
      timeoutMs:
        timeoutMsSource === 'defaults'
          ? formatAgentParamValue('timeoutMs', paramValues.timeoutMs)
          : '',
      streaming: streamingSource === 'defaults' ? streamingValue : null,
    },
  };
}

export function buildOpenClawAgentInputFromForm(
  draft: OpenClawAgentFormState,
): OpenClawAgentInput {
  const params: Record<string, string | number | boolean | null | undefined> = {};
  const fallbackModels = parseAgentFallbackModels(draft.fallbackModelsText);
  const primaryModel = draft.primaryModel.trim();

  if (draft.temperature.trim()) {
    params.temperature = Number(draft.temperature);
  }
  if (draft.topP.trim()) {
    params.topP = Number(draft.topP);
  }
  if (draft.maxTokens.trim()) {
    params.maxTokens = Number(draft.maxTokens);
  }
  if (draft.timeoutMs.trim()) {
    params.timeoutMs = Number(draft.timeoutMs);
  }
  if (draft.streamingMode === 'enabled') {
    params.streaming = true;
  }
  if (draft.streamingMode === 'disabled') {
    params.streaming = false;
  }

  return {
    id: draft.id.trim(),
    name: draft.name.trim(),
    avatar: draft.avatar.trim(),
    workspace: draft.workspace.trim(),
    agentDir: draft.agentDir.trim(),
    isDefault: draft.isDefault,
    model:
      primaryModel || fallbackModels.length > 0
        ? {
            primary: primaryModel || undefined,
            fallbacks: fallbackModels,
          }
        : null,
    params,
  };
}

export function buildOpenClawAgentParamEntries(
  agent: InstanceWorkbenchAgent,
): OpenClawAgentParamEntry[] {
  return KNOWN_AGENT_PARAM_KEYS.flatMap((key) => {
    const value = agent.params?.[key];
    if (value === undefined) {
      return [];
    }

    return [
      {
        key,
        value: formatAgentParamValue(key, value),
        source: agent.paramSources?.[key] || 'runtime',
      },
    ];
  });
}
