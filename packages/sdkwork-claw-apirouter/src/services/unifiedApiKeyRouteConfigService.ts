import type {
  ApiRouterChannel,
  ProxyProvider,
  ProxyProviderGroup,
  UnifiedApiKey,
  UnifiedApiKeyRouteMode,
} from '@sdkwork/claw-types';

export interface UnifiedApiKeyRouteConfigOption {
  providerId: string;
  providerName: string;
  channelId: string;
  channelName: string;
  groupId: string;
  groupName: string;
  status: ProxyProvider['status'];
  modelNames: string[];
}

export interface UnifiedApiKeyRouteConfigMeta {
  routeMode: UnifiedApiKeyRouteMode;
  routeProvider: ProxyProvider | null;
  baseUrl: string | null;
}

export const SDKWORK_REMOTE_ROUTE_BASE_URL = 'https://ai.sdkwork.com/v1';

function normalizeKeyword(value?: string) {
  return value?.trim().toLowerCase() || '';
}

export function buildUnifiedApiKeyRouteConfigOptions({
  providers,
  channels,
  groups,
  keyword,
}: {
  providers: ProxyProvider[];
  channels: ApiRouterChannel[];
  groups: ProxyProviderGroup[];
  keyword?: string;
}): UnifiedApiKeyRouteConfigOption[] {
  const normalizedKeyword = normalizeKeyword(keyword);
  const channelsById = new Map(channels.map((channel) => [channel.id, channel]));
  const groupsById = new Map(groups.map((group) => [group.id, group]));

  return providers
    .map((provider) => {
      const channel = channelsById.get(provider.channelId);
      const group = groupsById.get(provider.groupId);
      const modelNames = provider.models.map((model) => model.name).sort();

      return {
        providerId: provider.id,
        providerName: provider.name,
        channelId: provider.channelId,
        channelName: channel?.name || provider.channelId,
        groupId: provider.groupId,
        groupName: group?.name || provider.groupId,
        status: provider.status,
        modelNames,
      };
    })
    .filter((item) => {
      if (!normalizedKeyword) {
        return true;
      }

      return [
        item.providerName,
        item.channelName,
        item.groupName,
        ...item.modelNames,
      ]
        .join(' ')
        .toLowerCase()
        .includes(normalizedKeyword);
    })
    .sort((left, right) => left.providerName.localeCompare(right.providerName));
}

export function resolveUnifiedApiKeyRouteConfigMeta(
  item: UnifiedApiKey,
  providers: ProxyProvider[],
): UnifiedApiKeyRouteConfigMeta {
  const routeMode = item.routeMode || 'sdkwork-remote';
  const routeProvider =
    routeMode === 'custom'
      ? providers.find((provider) => provider.id === item.routeProviderId) || null
      : null;
  const baseUrl =
    routeMode === 'custom' ? routeProvider?.baseUrl || null : SDKWORK_REMOTE_ROUTE_BASE_URL;

  return {
    routeMode,
    routeProvider,
    baseUrl,
  };
}
