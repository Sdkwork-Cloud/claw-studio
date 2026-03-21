import { startTransition } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();

  if (channels.length === 0) {
    return (
      <div
        data-slot="api-router-route-config-view"
        className="rounded-[32px] border border-dashed border-zinc-300 bg-white/80 p-10 text-center shadow-[0_18px_48px_rgba(15,23,42,0.06)] dark:border-zinc-800 dark:bg-zinc-950/50"
      >
        <div className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
          {t('apiRouterPage.routeConfig.emptyTitle')}
        </div>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          {t('apiRouterPage.routeConfig.emptyDescription')}
        </p>
      </div>
    );
  }

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
