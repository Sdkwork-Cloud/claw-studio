import { startTransition, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Button } from '@sdkwork/claw-ui';
import {
  ApiRouterRuntimeStatusCard,
  ApiRouterRouteConfigView,
  ModelMappingManager,
  UnifiedApiKeyManager,
} from '../components';
import { ApiRouterUsageRecordsPage } from './ApiRouterUsageRecordsPage';
import { apiRouterService } from '../services';

const runtimeStatusQueryKey = ['api-router', 'runtime-status'] as const;
const channelQueryKey = ['api-router', 'channels'] as const;
const groupQueryKey = ['api-router', 'groups'] as const;

type ApiRouterPageTab =
  | 'unified-api-key'
  | 'route-config'
  | 'model-mapping'
  | 'usage-records';

function getQueryErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return 'Failed to load live API Router data.';
}

export function ApiRouter() {
  const { t } = useTranslation();
  const [activePageTab, setActivePageTab] = useState<ApiRouterPageTab>('unified-api-key');
  const [routeConfigChannelId, setRouteConfigChannelId] = useState<string | null>(null);

  const {
    data: runtimeStatus,
    error: runtimeStatusError,
    isLoading: isRuntimeStatusLoading,
    isFetching: isRuntimeStatusFetching,
    refetch: refetchRuntimeStatus,
  } = useQuery({
    queryKey: runtimeStatusQueryKey,
    queryFn: () => apiRouterService.getRuntimeStatus(),
    refetchInterval: 15000,
  });

  const {
    data: channels = [],
    error: channelsError,
    isLoading: isChannelsLoading,
  } = useQuery({
    queryKey: channelQueryKey,
    queryFn: () => apiRouterService.getChannels(),
  });

  const {
    data: groups = [],
    error: groupsError,
  } = useQuery({
    queryKey: groupQueryKey,
    queryFn: () => apiRouterService.getGroups(),
  });

  const catalogError = channelsError ?? groupsError;
  const showCatalogEmptyState = !catalogError && !isChannelsLoading && channels.length === 0;

  useEffect(() => {
    if (channels.length === 0) {
      return;
    }

    if (!routeConfigChannelId || !channels.some((channel) => channel.id === routeConfigChannelId)) {
      setRouteConfigChannelId(channels[0].id);
    }
  }, [channels, routeConfigChannelId]);

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
        {runtimeStatus ? (
          <ApiRouterRuntimeStatusCard
            runtimeStatus={runtimeStatus}
            isRefreshing={isRuntimeStatusFetching}
            onRefresh={() => {
              void refetchRuntimeStatus();
            }}
          />
        ) : runtimeStatusError ? (
          <section className="rounded-[28px] border border-rose-200/80 bg-rose-50/90 p-5 text-rose-950 shadow-[0_18px_48px_rgba(15,23,42,0.08)] dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-100">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-500 dark:text-rose-300">
                  {t('apiRouterPage.runtime.title')}
                </div>
                <div className="mt-3 text-lg font-semibold">
                  {t('apiRouterPage.runtime.emptyStateTitle')}
                </div>
                <p className="mt-2 text-sm leading-6 text-rose-700 dark:text-rose-200">
                  {getQueryErrorMessage(runtimeStatusError)}
                </p>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  void refetchRuntimeStatus();
                }}
                disabled={isRuntimeStatusFetching}
              >
                Refresh
              </Button>
            </div>
          </section>
        ) : isRuntimeStatusLoading ? (
          <section className="rounded-[28px] border border-zinc-200/80 bg-white/92 p-5 text-sm text-zinc-500 shadow-[0_18px_48px_rgba(15,23,42,0.08)] dark:border-zinc-800/80 dark:bg-zinc-950/70 dark:text-zinc-400">
            {t('common.loading')}...
          </section>
        ) : null}

        {catalogError ? (
          <section className="rounded-[28px] border border-rose-200/80 bg-rose-50/90 p-5 text-rose-950 shadow-[0_18px_48px_rgba(15,23,42,0.08)] dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-100">
            <div className="text-lg font-semibold">{t('apiRouterPage.runtime.emptyStateTitle')}</div>
            <p className="mt-2 text-sm leading-6 text-rose-700 dark:text-rose-200">
              {getQueryErrorMessage(catalogError)}
            </p>
          </section>
        ) : showCatalogEmptyState ? (
          <section className="rounded-[28px] border border-dashed border-zinc-300 bg-white/80 p-10 text-center shadow-[0_18px_48px_rgba(15,23,42,0.06)] dark:border-zinc-800 dark:bg-zinc-950/50">
            <div className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
              {t('apiRouterPage.runtime.emptyStateTitle')}
            </div>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              {t('apiRouterPage.runtime.emptyStateDescription')}
            </p>
          </section>
        ) : (
          <>
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
              >
                <UnifiedApiKeyManager groups={groups} />
              </div>
            ) : activePageTab === 'route-config' ? (
              <div
                id="api-router-panel-route-config"
                role="tabpanel"
                aria-labelledby="api-router-tab-route-config"
              >
                <ApiRouterRouteConfigView
                  channels={channels}
                  groups={groups}
                  selectedChannelId={routeConfigChannelId}
                  onSelectChannelId={setRouteConfigChannelId}
                />
              </div>
            ) : activePageTab === 'model-mapping' ? (
              <div
                id="api-router-panel-model-mapping"
                role="tabpanel"
                aria-labelledby="api-router-tab-model-mapping"
              >
                <ModelMappingManager />
              </div>
            ) : (
              <div
                id="api-router-panel-usage-records"
                role="tabpanel"
                aria-labelledby="api-router-tab-usage-records"
              >
                <ApiRouterUsageRecordsPage />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
