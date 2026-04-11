import type { OpenClawConfigSnapshot as ManagedOpenClawConfigSnapshot } from '@sdkwork/claw-core';
import type {
  InstanceManagedOpenClawConfigInsights,
  InstanceWorkbenchSnapshot,
} from '../types/index.ts';
import { getArrayValue, getBooleanValue, getStringValue, isNonEmptyString } from './openClawSupport.ts';
import { cloneManagedChannel } from './openClawChannelWorkbenchSupport.ts';

type ManagedOpenClawWebSearchConfig = ManagedOpenClawConfigSnapshot['webSearchConfig'];
type ManagedOpenClawXSearchConfig = ManagedOpenClawConfigSnapshot['xSearchConfig'];
type ManagedOpenClawWebSearchNativeCodexConfig =
  ManagedOpenClawConfigSnapshot['webSearchNativeCodexConfig'];
type ManagedOpenClawWebFetchConfig = ManagedOpenClawConfigSnapshot['webFetchConfig'];
type ManagedOpenClawAuthCooldownsConfig = ManagedOpenClawConfigSnapshot['authCooldownsConfig'];
type ManagedOpenClawDreamingConfig = ManagedOpenClawConfigSnapshot['dreamingConfig'];

export type ManagedConfigWorkbenchState = Pick<
  InstanceWorkbenchSnapshot,
  | 'managedConfigPath'
  | 'managedChannels'
  | 'managedConfigInsights'
  | 'managedWebSearchConfig'
  | 'managedXSearchConfig'
  | 'managedWebSearchNativeCodexConfig'
  | 'managedWebFetchConfig'
  | 'managedAuthCooldownsConfig'
  | 'managedDreamingConfig'
> & {
  configSectionCount: number;
};

function cloneManagedWebSearchConfig(
  config: ManagedOpenClawWebSearchConfig | null | undefined,
) {
  if (!config) {
    return null;
  }

  return {
    ...config,
    providers: config.providers.map((provider) => ({ ...provider })),
  };
}

function cloneManagedXSearchConfig(
  config: ManagedOpenClawXSearchConfig | null | undefined,
) {
  return config ? { ...config } : null;
}

function cloneManagedWebSearchNativeCodexConfig(
  config: ManagedOpenClawWebSearchNativeCodexConfig | null | undefined,
) {
  if (!config) {
    return null;
  }

  return {
    ...config,
    allowedDomains: [...config.allowedDomains],
    userLocation: {
      ...config.userLocation,
    },
  };
}

function cloneManagedWebFetchConfig(
  config: ManagedOpenClawWebFetchConfig | null | undefined,
) {
  if (!config) {
    return null;
  }

  return {
    ...config,
    fallbackProvider: {
      ...config.fallbackProvider,
    },
  };
}

function cloneManagedAuthCooldownsConfig(
  config: ManagedOpenClawAuthCooldownsConfig | null | undefined,
) {
  return config ? { ...config } : null;
}

function cloneManagedDreamingConfig(
  config: ManagedOpenClawDreamingConfig | null | undefined,
) {
  return config ? { ...config } : null;
}

function buildManagedConfigSectionCount(managedConfigPath: string | null | undefined) {
  return managedConfigPath ? 1 : 0;
}

function buildManagedConfigInsights(
  managedConfigSnapshot: ManagedOpenClawConfigSnapshot | null | undefined,
): InstanceManagedOpenClawConfigInsights | null {
  if (!managedConfigSnapshot) {
    return null;
  }

  const root = managedConfigSnapshot.root;
  const sessionsVisibility = getStringValue(root, ['tools', 'sessions', 'visibility']);

  return {
    defaultAgentId:
      managedConfigSnapshot.agentSnapshots.find((agent) => agent.isDefault)?.id || null,
    defaultModelRef: getStringValue(root, ['agents', 'defaults', 'model', 'primary']) || null,
    sessionsVisibility:
      sessionsVisibility === 'self' ||
      sessionsVisibility === 'tree' ||
      sessionsVisibility === 'agent' ||
      sessionsVisibility === 'all'
        ? sessionsVisibility
        : null,
    agentToAgentEnabled: Boolean(getBooleanValue(root, ['tools', 'agentToAgent', 'enabled'])),
    agentToAgentAllow: (getArrayValue(root, ['tools', 'agentToAgent', 'allow']) || [])
      .filter(isNonEmptyString)
      .map((value) => value.trim()),
  };
}

export function buildManagedConfigWorkbenchState(
  managedConfigPath: string | null | undefined,
  managedConfigSnapshot: ManagedOpenClawConfigSnapshot | null | undefined,
): ManagedConfigWorkbenchState {
  const normalizedManagedConfigPath = managedConfigPath || null;

  return {
    managedConfigPath: normalizedManagedConfigPath,
    managedChannels: managedConfigSnapshot?.channelSnapshots.map(cloneManagedChannel),
    managedConfigInsights: buildManagedConfigInsights(managedConfigSnapshot),
    managedWebSearchConfig: cloneManagedWebSearchConfig(managedConfigSnapshot?.webSearchConfig),
    managedXSearchConfig: cloneManagedXSearchConfig(managedConfigSnapshot?.xSearchConfig),
    managedWebSearchNativeCodexConfig: cloneManagedWebSearchNativeCodexConfig(
      managedConfigSnapshot?.webSearchNativeCodexConfig,
    ),
    managedWebFetchConfig: cloneManagedWebFetchConfig(managedConfigSnapshot?.webFetchConfig),
    managedAuthCooldownsConfig: cloneManagedAuthCooldownsConfig(
      managedConfigSnapshot?.authCooldownsConfig,
    ),
    managedDreamingConfig: cloneManagedDreamingConfig(
      managedConfigSnapshot?.dreamingConfig,
    ),
    configSectionCount: buildManagedConfigSectionCount(normalizedManagedConfigPath),
  };
}

export function createEmptyManagedOpenClawConfigSnapshot(
  configPath = '',
): ManagedOpenClawConfigSnapshot {
  return {
    configPath,
    providerSnapshots: [],
    agentSnapshots: [],
    channelSnapshots: [],
    webSearchConfig: {
      enabled: true,
      provider: '',
      maxResults: 0,
      timeoutSeconds: 0,
      cacheTtlMinutes: 0,
      providers: [],
    },
    xSearchConfig: {
      enabled: false,
      apiKeySource: '',
      model: '',
      inlineCitations: false,
      maxTurns: 2,
      timeoutSeconds: 30,
      cacheTtlMinutes: 15,
      advancedConfig: '',
    },
    webFetchConfig: {
      enabled: true,
      maxChars: 50000,
      maxCharsCap: 50000,
      maxResponseBytes: 2000000,
      timeoutSeconds: 30,
      cacheTtlMinutes: 15,
      maxRedirects: 3,
      readability: true,
      userAgent: '',
      fallbackProvider: {
        providerId: 'firecrawl',
        name: 'Firecrawl Fetch',
        description: 'Use Firecrawl as the OpenClaw web_fetch fallback provider.',
        apiKeySource: '',
        baseUrl: '',
        advancedConfig: '',
        supportsApiKey: true,
        supportsBaseUrl: true,
      },
    },
    webSearchNativeCodexConfig: {
      enabled: false,
      mode: 'cached',
      allowedDomains: [],
      contextSize: '',
      userLocation: {
        country: '',
        city: '',
        timezone: '',
      },
      advancedConfig: '',
    },
    authCooldownsConfig: {
      rateLimitedProfileRotations: null,
      overloadedProfileRotations: null,
      overloadedBackoffMs: null,
      billingBackoffHours: null,
      billingMaxHours: null,
      failureWindowHours: null,
    },
    dreamingConfig: {
      enabled: false,
      frequency: '',
    },
    root: {},
  };
}
