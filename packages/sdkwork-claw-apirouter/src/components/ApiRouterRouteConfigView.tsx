import { startTransition } from 'react';
import type { ApiRouterChannel, ProxyProviderGroup } from '@sdkwork/claw-types';
import { ApiRouterChannelSidebar } from './ApiRouterChannelSidebar';
import { ProxyProviderManager } from './ProxyProviderManager';

interface ApiRouterRouteConfigViewProps {
  channels: ApiRouterChannel[];
  groups: ProxyProviderGroup[];
  selectedChannelId: string | null;
  onSelectChannelId: (channelId: string) => void;
}

export function ApiRouterRouteConfigView({
  channels,
  groups,
  selectedChannelId,
  onSelectChannelId,
}: ApiRouterRouteConfigViewProps) {
  return (
    <div
      data-slot="api-router-route-config-view"
      className="flex w-full flex-col gap-4 xl:flex-row xl:items-start"
    >
      <ApiRouterChannelSidebar
        channels={channels}
        selectedChannelId={selectedChannelId}
        onSelect={(channelId) =>
          startTransition(() => {
            onSelectChannelId(channelId);
          })
        }
      />

      <ProxyProviderManager
        channels={channels}
        groups={groups}
        selectedChannelId={selectedChannelId}
      />
    </div>
  );
}
