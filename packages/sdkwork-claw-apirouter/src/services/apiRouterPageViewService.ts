export interface ResolveApiRouterPageViewStateInput {
  channelIds: string[];
  selectedChannelId: string | null;
  canManageRouter?: boolean;
}

export interface ApiRouterPageViewState {
  hasChannels: boolean;
  resolvedChannelId: string | null;
  showManagementPanels: boolean;
  showPageTabs: boolean;
  showRouteConfigEmptyState: boolean;
}

export function resolveApiRouterPageViewState({
  channelIds,
  selectedChannelId,
  canManageRouter = true,
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
    showManagementPanels: canManageRouter,
    showPageTabs: canManageRouter,
    showRouteConfigEmptyState: canManageRouter && !hasChannels,
  };
}
