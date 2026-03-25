import { startTransition, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Button } from '@sdkwork/claw-ui';
import {
  ApiRouterRouteConfigView,
  ModelMappingManager,
  UnifiedApiKeyManager,
} from '../components';
import { ApiRouterUsageRecordsPage } from './ApiRouterUsageRecordsPage';
import {
  apiRouterService,
  resolveApiRouterPageViewState,
} from '../services';

const channelQueryKey = ['api-router', 'channels'] as const;
const groupQueryKey = ['api-router', 'groups'] as const;

type ApiRouterPageTab =
  | 'unified-api-key'
  | 'route-config'
  | 'model-mapping'
  | 'usage-records';

export function ApiRouter() {
  const { t } = useTranslation();
  const [activePageTab, setActivePageTab] = useState<ApiRouterPageTab>('unified-api-key');
  const [routeConfigChannelId, setRouteConfigChannelId] = useState<string | null>(null);

  const { data: channels = [] } = useQuery({
    queryKey: channelQueryKey,
    queryFn: () => apiRouterService.getChannels(),
  });

  const { data: groups = [] } = useQuery({
    queryKey: groupQueryKey,
    queryFn: () => apiRouterService.getGroups(),
  });

  const routeConfigViewState = useMemo(
    () =>
      resolveApiRouterPageViewState({
        channelIds: channels.map((channel) => channel.id),
        selectedChannelId: routeConfigChannelId,
      }),
    [channels, routeConfigChannelId],
  );

  const pageTabs: Array<{ id: ApiRouterPageTab; label: string }> = [
    {
      id: 'unified-api-key',
      label: t('apiRouterPage.pageTabs.unifiedApiKey'),
    },
    {
      id: 'route-config',
      label: t('apiRouterPage.pageTabs.routeConfig'),
    },
    {
      id: 'model-mapping',
      label: t('apiRouterPage.pageTabs.modelMapping'),
    },
    {
      id: 'usage-records',
      label: t('apiRouterPage.pageTabs.usageRecords'),
    },
  ];

  return (
    <div data-slot="api-router-page" className="h-full overflow-y-auto bg-zinc-50 dark:bg-zinc-950">
      <div className="flex w-full flex-col gap-4 px-4 py-4 sm:px-4 sm:py-6 xl:px-4 xl:py-6">
        <section className="rounded-[28px] border border-zinc-200/80 bg-white/92 p-2 shadow-[0_18px_48px_rgba(15,23,42,0.08)] backdrop-blur dark:border-zinc-800/80 dark:bg-zinc-950/70">
          <div
            data-slot="api-router-page-tabs"
            role="tablist"
            aria-label={t('apiRouterPage.page.title')}
            className="flex flex-wrap gap-2"
          >
            {pageTabs.map((tab) => {
              const isActive = tab.id === activePageTab;

              return (
                <Button
                  key={tab.id}
                  type="button"
                  variant="ghost"
                  role="tab"
                  id={`api-router-tab-${tab.id}`}
                  aria-selected={isActive}
                  aria-controls={`api-router-panel-${tab.id}`}
                  className={`rounded-[20px] px-4 text-sm font-semibold ${
                    isActive
                      ? 'bg-zinc-950 text-white hover:bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-200'
                      : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-50'
                  }`}
                  onClick={() =>
                    startTransition(() => {
                      setActivePageTab(tab.id);
                    })
                  }
                >
                  {tab.label}
                </Button>
              );
            })}
          </div>
        </section>

        {activePageTab === 'unified-api-key' ? (
          <div
            id="api-router-panel-unified-api-key"
            role="tabpanel"
            aria-labelledby="api-router-tab-unified-api-key"
            className="min-w-0"
          >
            <UnifiedApiKeyManager />
          </div>
        ) : activePageTab === 'route-config' ? (
          <div
            id="api-router-panel-route-config"
            role="tabpanel"
            aria-labelledby="api-router-tab-route-config"
            className="min-w-0"
          >
            <ApiRouterRouteConfigView
              channels={channels}
              groups={groups}
              selectedChannelId={routeConfigViewState.resolvedChannelId}
              onSelectChannelId={setRouteConfigChannelId}
            />
          </div>
        ) : activePageTab === 'model-mapping' ? (
          <div
            id="api-router-panel-model-mapping"
            role="tabpanel"
            aria-labelledby="api-router-tab-model-mapping"
            className="min-w-0"
          >
            <ModelMappingManager />
          </div>
        ) : (
          <div
            id="api-router-panel-usage-records"
            role="tabpanel"
            aria-labelledby="api-router-tab-usage-records"
            className="min-w-0"
          >
            <ApiRouterUsageRecordsPage />
          </div>
        )}
      </div>
    </div>
  );
}
