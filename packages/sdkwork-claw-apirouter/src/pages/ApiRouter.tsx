import { startTransition, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@sdkwork/claw-ui';
import {
  ApiRouterAdminStatusCard,
  ApiRouterRouteConfigView,
  ApiRouterRuntimeStatusCard,
  ModelMappingManager,
  UnifiedApiKeyManager,
} from '../components';
import { ApiRouterUsageRecordsPage } from './ApiRouterUsageRecordsPage';
import {
  apiRouterAdminService,
  apiRouterRuntimeService,
  apiRouterService,
  resolveApiRouterPageViewState,
} from '../services';

const adminStatusQueryKey = ['api-router', 'admin-status'] as const;
const runtimeStatusQueryKey = ['api-router', 'runtime-status'] as const;
const channelQueryKey = ['api-router', 'channels'] as const;
const groupQueryKey = ['api-router', 'groups'] as const;

type ApiRouterPageTab =
  | 'unified-api-key'
  | 'route-config'
  | 'model-mapping'
  | 'usage-records';

function normalizeErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

export function ApiRouter() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [activePageTab, setActivePageTab] = useState<ApiRouterPageTab>('unified-api-key');
  const [routeConfigChannelId, setRouteConfigChannelId] = useState<string | null>(null);
  const runtimeStatusQuery = useQuery({
    queryKey: runtimeStatusQueryKey,
    queryFn: () => apiRouterRuntimeService.getStatus(),
  });
  const adminStatusQuery = useQuery({
    queryKey: adminStatusQueryKey,
    queryFn: () => apiRouterAdminService.getStatus(),
  });
  const showManagementPanels = Boolean(adminStatusQuery.data?.authenticated);
  const canLoadRouteConfigMetadata =
    showManagementPanels && activePageTab === 'route-config';

  const signInMutation = useMutation({
    mutationFn: (input: { email: string; password: string }) =>
      apiRouterAdminService.login(input),
    onSuccess: async (session) => {
      toast.success(
        t('apiRouterPage.admin.toast.connected', {
          email: session.user.email,
        }),
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: adminStatusQueryKey }),
        queryClient.invalidateQueries({ queryKey: channelQueryKey }),
        queryClient.invalidateQueries({ queryKey: groupQueryKey }),
      ]);
    },
    onError: (error) => {
      toast.error(
        normalizeErrorMessage(
          error,
          t('apiRouterPage.admin.toast.connectionFailed'),
        ),
      );
    },
  });

  const signOutMutation = useMutation({
    mutationFn: () => apiRouterAdminService.logout(),
    onSuccess: async () => {
      toast.success(t('apiRouterPage.admin.toast.disconnected'));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: adminStatusQueryKey }),
        queryClient.invalidateQueries({ queryKey: channelQueryKey }),
        queryClient.invalidateQueries({ queryKey: groupQueryKey }),
      ]);
    },
    onError: (error) => {
      toast.error(
        normalizeErrorMessage(
          error,
          t('apiRouterPage.admin.toast.disconnectFailed'),
        ),
      );
    },
  });

  const { data: channels = [] } = useQuery({
    queryKey: channelQueryKey,
    queryFn: () => apiRouterService.getChannels(),
    enabled: canLoadRouteConfigMetadata,
  });

  const { data: groups = [] } = useQuery({
    queryKey: groupQueryKey,
    queryFn: () => apiRouterService.getGroups(),
    enabled: canLoadRouteConfigMetadata,
  });

  const routeConfigViewState = useMemo(
    () =>
      resolveApiRouterPageViewState({
        channelIds: channels.map((channel) => channel.id),
        selectedChannelId: routeConfigChannelId,
        canManageRouter: showManagementPanels,
      }),
    [channels, routeConfigChannelId, showManagementPanels],
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

  async function handleRefresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: runtimeStatusQueryKey }),
      queryClient.invalidateQueries({ queryKey: adminStatusQueryKey }),
      queryClient.invalidateQueries({ queryKey: channelQueryKey }),
      queryClient.invalidateQueries({ queryKey: groupQueryKey }),
    ]);
  }

  return (
    <div data-slot="api-router-page" className="h-full overflow-y-auto bg-zinc-50 dark:bg-zinc-950">
      <div className="flex w-full flex-col gap-4 px-4 py-4 sm:px-4 sm:py-6 xl:px-4 xl:py-6">
        {runtimeStatusQuery.data ? (
          <ApiRouterRuntimeStatusCard status={runtimeStatusQuery.data} />
        ) : null}

        {adminStatusQuery.data ? (
          <ApiRouterAdminStatusCard
            key={`${adminStatusQuery.data.state}:${adminStatusQuery.data.authSource}:${adminStatusQuery.data.sessionUser?.email ?? 'none'}`}
            status={adminStatusQuery.data}
            isSigningIn={signInMutation.isPending}
            isSigningOut={signOutMutation.isPending}
            onRefresh={() => {
              void handleRefresh();
            }}
            onLogin={(input) => {
              signInMutation.mutate(input);
            }}
            onLogout={() => {
              signOutMutation.mutate();
            }}
          />
        ) : null}

        {routeConfigViewState.showPageTabs ? (
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
        ) : null}

        {routeConfigViewState.showManagementPanels && activePageTab === 'unified-api-key' ? (
          <div
            id="api-router-panel-unified-api-key"
            role="tabpanel"
            aria-labelledby="api-router-tab-unified-api-key"
            className="min-w-0"
          >
            <UnifiedApiKeyManager />
          </div>
        ) : routeConfigViewState.showManagementPanels && activePageTab === 'route-config' ? (
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
        ) : routeConfigViewState.showManagementPanels && activePageTab === 'model-mapping' ? (
          <div
            id="api-router-panel-model-mapping"
            role="tabpanel"
            aria-labelledby="api-router-tab-model-mapping"
            className="min-w-0"
          >
            <ModelMappingManager />
          </div>
        ) : routeConfigViewState.showManagementPanels ? (
          <div
            id="api-router-panel-usage-records"
            role="tabpanel"
            aria-labelledby="api-router-tab-usage-records"
            className="min-w-0"
          >
            <ApiRouterUsageRecordsPage />
          </div>
        ) : null}
      </div>
    </div>
  );
}
