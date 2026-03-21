export interface ResolveApiRouterPageViewStateInput {
  channelIds: string[];
  selectedChannelId: string | null;
}

export interface ApiRouterPageViewState {
  hasChannels: boolean;
  resolvedChannelId: string | null;
  showPageTabs: boolean;
  showRouteConfigEmptyState: boolean;
}

export function resolveApiRouterPageViewState({
  channelIds,
  selectedChannelId,
}: ResolveApiRouterPageViewStateInput): ApiRouterPageViewState {
  const hasChannels = channelIds.length > 0;
  const resolvedChannelId = !hasChannels
    ? null
    : selectedChannelId && channelIds.includes(selectedChannelId)
      ? selectedChannelId
      : channelIds[0] || null;

  return {
    hasChannels,
    resolvedChannelId,
    showPageTabs: true,
    showRouteConfigEmptyState: !hasChannels,
  };
}
