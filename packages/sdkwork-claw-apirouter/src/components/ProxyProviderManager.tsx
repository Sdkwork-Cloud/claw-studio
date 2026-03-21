import { startTransition, useDeferredValue, useState } from 'react';
import { Plus, RefreshCw, Search } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { platform } from '@sdkwork/claw-infrastructure';
import type {
  ApiRouterChannel,
  ProxyProvider,
  ProxyProviderCreate,
  ProxyProviderGroup,
  ProxyProviderUpdate,
} from '@sdkwork/claw-types';
import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@sdkwork/claw-ui';
import type { ProxyProviderCreateSeed } from '../services';
import { apiRouterService } from '../services';
import { ProxyProviderDialogs } from './ProxyProviderDialogs';
import { ProxyProviderTable } from './ProxyProviderTable';

const channelQueryKey = ['api-router', 'channels'] as const;
const groupQueryKey = ['api-router', 'groups'] as const;

function resolveMutationErrorMessage(error: unknown, fallbackMessage: string) {
  return error instanceof Error && error.message.trim()
    ? error.message
    : fallbackMessage;
}

function matchesProviderIdentity(current: ProxyProvider | null, next: ProxyProvider) {
  if (!current) {
    return false;
  }

  if (current.id === next.id) {
    return true;
  }

  return Boolean(
    current.credentialReference
      && next.credentialReference
      && current.credentialReference === next.credentialReference,
  );
}

interface ProxyProviderManagerProps {
  channels: ApiRouterChannel[];
  groups: ProxyProviderGroup[];
  selectedChannelId: string | null;
  onSelectedChannelIdChange?: (channelId: string | null) => void;
  allowAllChannels?: boolean;
  showChannelBadge?: boolean;
  showChannelFilter?: boolean;
}

export function ProxyProviderManager({
  channels,
  groups,
  selectedChannelId,
  onSelectedChannelIdChange,
  allowAllChannels = false,
  showChannelBadge = false,
  showChannelFilter = false,
}: ProxyProviderManagerProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [groupFilter, setGroupFilter] = useState('all');
  const [usageProvider, setUsageProvider] = useState<ProxyProvider | null>(null);
  const [editingProvider, setEditingProvider] = useState<ProxyProvider | null>(null);
  const [createSeed, setCreateSeed] = useState<ProxyProviderCreateSeed | null>(null);
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const normalizedKeyword = deferredSearchQuery.trim();
  const canQueryProviders = allowAllChannels || Boolean(selectedChannelId);
  const canCreateProvider = Boolean(selectedChannelId) && groups.length > 0;

  const { data: providers = [] } = useQuery({
    queryKey: [
      'api-router',
      'providers',
      selectedChannelId || 'all',
      normalizedKeyword || '__all__',
      groupFilter,
    ],
    queryFn: () =>
      apiRouterService.getProxyProviders({
        channelId: selectedChannelId || undefined,
        keyword: normalizedKeyword || undefined,
        groupId: groupFilter !== 'all' ? groupFilter : undefined,
      }),
    enabled: canQueryProviders,
  });

  async function refreshApiRouterData() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['api-router', 'providers'] }),
      queryClient.invalidateQueries({ queryKey: channelQueryKey }),
      queryClient.invalidateQueries({ queryKey: groupQueryKey }),
      queryClient.invalidateQueries({ queryKey: ['api-router', 'model-mapping-catalog'] }),
    ]);
  }

  const createProviderMutation = useMutation({
    mutationFn: (input: ProxyProviderCreate) => apiRouterService.createProvider(input),
    onSuccess: async () => {
      toast.success(t('apiRouterPage.toast.providerCreated'));
      setCreateSeed(null);
      startTransition(() => {
        setSearchQuery('');
        setGroupFilter('all');
      });
      await refreshApiRouterData();
    },
    onError: (error) => {
      toast.error(
        resolveMutationErrorMessage(error, t('apiRouterPage.toast.providerCreateFailed')),
      );
    },
  });

  const updateGroupMutation = useMutation({
    mutationFn: ({ providerId, groupId }: { providerId: string; groupId: string }) =>
      apiRouterService.updateGroup(providerId, groupId),
    onSuccess: async (provider) => {
      toast.success(t('apiRouterPage.toast.groupUpdated'));
      setUsageProvider((current) => (matchesProviderIdentity(current, provider) ? provider : current));
      setEditingProvider((current) =>
        matchesProviderIdentity(current, provider) ? provider : current,
      );
      await refreshApiRouterData();
    },
    onError: (error) => {
      toast.error(
        resolveMutationErrorMessage(error, t('apiRouterPage.toast.groupUpdateFailed')),
      );
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ providerId, status }: { providerId: string; status: ProxyProvider['status'] }) =>
      apiRouterService.updateStatus(providerId, status),
    onSuccess: async (provider) => {
      toast.success(t('apiRouterPage.toast.statusUpdated'));
      setUsageProvider((current) => (matchesProviderIdentity(current, provider) ? provider : current));
      setEditingProvider((current) =>
        matchesProviderIdentity(current, provider) ? provider : current,
      );
      await refreshApiRouterData();
    },
    onError: (error) => {
      toast.error(
        resolveMutationErrorMessage(error, t('apiRouterPage.toast.statusUpdateFailed')),
      );
    },
  });

  const updateProviderMutation = useMutation({
    mutationFn: ({ providerId, update }: { providerId: string; update: ProxyProviderUpdate }) =>
      apiRouterService.updateProvider(providerId, update),
    onSuccess: async (provider) => {
      toast.success(t('apiRouterPage.toast.providerUpdated'));
      setEditingProvider(null);
      setUsageProvider((current) => (matchesProviderIdentity(current, provider) ? provider : current));
      await refreshApiRouterData();
    },
    onError: (error) => {
      toast.error(
        resolveMutationErrorMessage(error, t('apiRouterPage.toast.providerUpdateFailed')),
      );
    },
  });

  const deleteProviderMutation = useMutation({
    mutationFn: (provider: ProxyProvider) => apiRouterService.deleteProvider(provider.id),
    onSuccess: async (_, provider) => {
      toast.success(t('apiRouterPage.toast.providerDeleted'));
      if (matchesProviderIdentity(usageProvider, provider)) {
        setUsageProvider(null);
      }
      if (matchesProviderIdentity(editingProvider, provider)) {
        setEditingProvider(null);
      }
      await refreshApiRouterData();
    },
    onError: (error) => {
      toast.error(
        resolveMutationErrorMessage(error, t('apiRouterPage.toast.providerDeleteFailed')),
      );
    },
  });

  async function handleCopyApiKey(provider: ProxyProvider) {
    if (provider.canCopyApiKey === false || !provider.apiKey) {
      toast.error(
        provider.credentialReference
          ? t('apiRouterPage.toast.copyUnavailable')
          : t('apiRouterPage.toast.copyFailed'),
      );
      return;
    }

    try {
      await platform.copy(provider.apiKey);
      toast.success(t('apiRouterPage.toast.copySuccess'));
    } catch {
      toast.error(t('apiRouterPage.toast.copyFailed'));
    }
  }

  function handleDelete(provider: ProxyProvider) {
    if (!window.confirm(t('apiRouterPage.actions.confirmDelete', { name: provider.name }))) {
      return;
    }

    deleteProviderMutation.mutate(provider);
  }

  function handleOpenCreate() {
    if (!selectedChannelId || groups.length === 0) {
      return;
    }

    const referenceProvider = providers[0];

    setCreateSeed({
      channelId: selectedChannelId,
      groupId: referenceProvider?.groupId || groups[0]?.id || '',
      baseUrl: referenceProvider?.baseUrl || '',
      models: referenceProvider?.models || [],
    });
  }

  function handleChannelFilterChange(value: string) {
    startTransition(() => {
      onSelectedChannelIdChange?.(value === 'all' ? null : value);
      setCreateSeed(null);
    });
  }

  return (
    <div data-slot="api-router-key-manager" className="min-w-0 flex-1 space-y-4">
      <section className="rounded-[28px] border border-zinc-200/80 bg-white/92 p-4 shadow-[0_18px_48px_rgba(15,23,42,0.08)] backdrop-blur dark:border-zinc-800/80 dark:bg-zinc-950/70 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" onClick={handleOpenCreate} disabled={!canCreateProvider}>
              <Plus className="h-4 w-4" />
              {t('apiRouterPage.actions.createKey')}
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => {
                void refreshApiRouterData();
              }}
            >
              <RefreshCw className="h-4 w-4" />
              {t('apiRouterPage.actions.refresh')}
            </Button>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row lg:w-[min(100%,64rem)] lg:justify-end">
            <div className="relative flex-1 lg:max-w-[24rem]">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={t('apiRouterPage.filters.searchPlaceholder')}
                className="h-11 rounded-2xl bg-white pl-11 pr-4 dark:bg-zinc-950"
              />
            </div>

            {showChannelFilter ? (
              <div className="w-full sm:w-[14rem]">
                <Select value={selectedChannelId || 'all'} onValueChange={handleChannelFilterChange}>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder={t('apiRouterPage.filters.channelPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {allowAllChannels ? (
                      <SelectItem value="all">{t('apiRouterPage.filters.allChannels')}</SelectItem>
                    ) : null}
                    {channels.map((channel) => (
                      <SelectItem key={channel.id} value={channel.id}>
                        {channel.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            <div className="w-full sm:w-[14rem]">
              <Select value={groupFilter} onValueChange={setGroupFilter}>
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('apiRouterPage.filters.allGroups')}</SelectItem>
                  {groups.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </section>

      <ProxyProviderTable
        channels={channels}
        providers={providers}
        groups={groups}
        showChannelBadge={showChannelBadge}
        onCopyApiKey={handleCopyApiKey}
        onGroupChange={(providerId, groupId) =>
          updateGroupMutation.mutate({ providerId, groupId })
        }
        onOpenUsage={setUsageProvider}
        onOpenEdit={setEditingProvider}
        onToggleStatus={(provider) =>
          updateStatusMutation.mutate({
            providerId: provider.id,
            status: provider.status === 'disabled' ? 'active' : 'disabled',
          })
        }
        onDelete={handleDelete}
      />

      <ProxyProviderDialogs
        usageProvider={usageProvider}
        createSeed={createSeed}
        editingProvider={editingProvider}
        groups={groups}
        onCloseUsage={() => setUsageProvider(null)}
        onCloseCreate={() => setCreateSeed(null)}
        onCloseEdit={() => setEditingProvider(null)}
        onCreate={(input) => createProviderMutation.mutate(input)}
        onSave={(providerId, update) => updateProviderMutation.mutate({ providerId, update })}
        onCopyApiKey={handleCopyApiKey}
      />
    </div>
  );
}
