import {
  installerService,
  studioMockService,
  type ProviderClientSetupCompatibility,
  type ProviderClientSetupOpenClawApiKeyStrategy,
  type ProviderClientSetupOpenClawInstance,
} from '@sdkwork/claw-infrastructure';
import type { ProxyProvider } from '@sdkwork/claw-types';
import {
  buildProviderAccessClientConfigs,
  type ProviderAccessEnvScope,
  type ProviderAccessClientConfig,
  type ProviderAccessInstallMode,
} from './providerAccessConfigService.ts';
import { buildOpenClawInstanceProviderDraft } from './providerAccessSetupService.ts';

export interface ApplyClientSetupResult {
  writtenFileCount: number;
  updatedEnvironmentCount: number;
  updatedInstanceIds: string[];
}

export interface ApplyOpenClawSetupResult {
  updatedInstanceIds: string[];
  openClawInstances: ProviderClientSetupOpenClawInstance[];
}

export interface ApplyClientSetupOptions {
  installMode?: ProviderAccessInstallMode;
  envScope?: ProviderAccessEnvScope;
}

export interface ApplyOpenClawSetupOptions {
  apiKeyStrategy: ProviderClientSetupOpenClawApiKeyStrategy;
  routerProviderId?: string | null;
  modelMappingId?: string | null;
}

function resolveInstallerCompatibility(
  client: ProviderAccessClientConfig,
): ProviderClientSetupCompatibility {
  if (client.compatibility === 'unsupported') {
    throw new Error('Client setup is unavailable for this provider.');
  }

  return client.compatibility;
}

function buildInstallerRequestWithOptions(
  provider: ProxyProvider,
  client: ProviderAccessClientConfig,
  options: ApplyClientSetupOptions,
) {
  const installMode = options.installMode ?? client.install.defaultMode ?? 'standard';
  const request = {
    clientId: client.id,
    installMode,
    envScope:
      installMode === 'env' || installMode === 'both'
        ? options.envScope ?? client.install.defaultEnvScope ?? 'user'
        : undefined,
    provider: {
      id: provider.id,
      channelId: provider.channelId,
      name: provider.name,
      baseUrl: provider.baseUrl,
      apiKey: provider.apiKey,
      compatibility: resolveInstallerCompatibility(client),
      models: provider.models.map((model) => ({
        id: model.id,
        name: model.name,
      })),
    },
  } as const;

  if (!client.install.supportedModes.includes(installMode)) {
    throw new Error('Requested install mode is unavailable for this client.');
  }

  if (
    request.envScope &&
    !client.install.supportedEnvScopes.includes(request.envScope)
  ) {
    throw new Error('Requested environment scope is unavailable for this client.');
  }

  return request;
}

function buildStandardInstallerRequest(provider: ProxyProvider, client: ProviderAccessClientConfig) {
  return buildInstallerRequestWithOptions(provider, client, {
    installMode: client.install.defaultMode ?? 'standard',
  });
}

class ProviderAccessApplyService {
  async applyClientSetup(
    provider: ProxyProvider,
    client: ProviderAccessClientConfig,
    options: ApplyClientSetupOptions = {},
  ): Promise<ApplyClientSetupResult> {
    if (!client.available) {
      throw new Error('Client setup is unavailable for this provider.');
    }

    if (client.id === 'openclaw') {
      throw new Error('OpenClaw setup requires instance selection.');
    }

    const result = await installerService.applyProviderClientSetup(
      buildInstallerRequestWithOptions(provider, client, options),
    );

    return {
      writtenFileCount: result.writtenFiles.length,
      updatedEnvironmentCount: (result.updatedEnvironments || []).length,
      updatedInstanceIds: result.updatedInstanceIds,
    };
  }

  async applyOpenClawSetup(
    provider: ProxyProvider,
    instanceIds: string[],
    options: ApplyOpenClawSetupOptions = {
      apiKeyStrategy: 'shared',
    },
  ): Promise<ApplyOpenClawSetupResult> {
    if (instanceIds.length === 0) {
      throw new Error('At least one instance must be selected.');
    }

    const client = buildProviderAccessClientConfigs(provider).find((item) => item.id === 'openclaw');

    if (!client?.available) {
      throw new Error('OpenClaw setup is unavailable for this provider.');
    }

    const result = await installerService.applyProviderClientSetup({
      ...buildStandardInstallerRequest(provider, client),
      openClaw: {
        instanceIds,
        apiKeyStrategy: options.apiKeyStrategy,
        routeProviderId: options.routerProviderId ?? undefined,
        modelMappingId: options.modelMappingId ?? undefined,
      },
    });

    for (const openClawInstance of result.openClawInstances || []) {
      const draft = buildOpenClawInstanceProviderDraft(provider, openClawInstance);
      await studioMockService.upsertInstanceLlmProvider(openClawInstance.instanceId, {
        id: draft.id,
        name: draft.name,
        provider: draft.provider,
        endpoint: draft.endpoint,
        apiKeySource: draft.apiKeySource,
        status: draft.status,
        defaultModelId: draft.defaultModelId,
        reasoningModelId: draft.reasoningModelId,
        embeddingModelId: draft.embeddingModelId,
        description: draft.description,
        icon: draft.icon,
        lastCheckedAt: draft.lastCheckedAt,
        capabilities: draft.capabilities,
        models: draft.models,
        config: draft.config,
        routerConfig: draft.routerConfig,
      });
    }

    return {
      updatedInstanceIds: result.updatedInstanceIds,
      openClawInstances: result.openClawInstances || [],
    };
  }
}

export const providerAccessApplyService = new ProviderAccessApplyService();
