import { startTransition, useDeferredValue, useState } from 'react';
import { Plus, RefreshCw, Search } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { platform } from '@sdkwork/claw-infrastructure';
import type {
  ApiRouterChannel,
  ModelMapping,
  ProxyProvider,
  UnifiedApiKey,
  UnifiedApiKeyCreate,
  UnifiedApiKeyUpdate,
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
import { apiRouterService, modelMappingService, unifiedApiKeyService } from '../services';
import { UnifiedApiKeyDialogs } from './UnifiedApiKeyDialogs';
import { UnifiedApiKeyTable } from './UnifiedApiKeyTable';

export function UnifiedApiKeyManager() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [groupFilter, setGroupFilter] = useState('all');
  const [usageKey, setUsageKey] = useState<UnifiedApiKey | null>(null);
  const [editingKey, setEditingKey] = useState<UnifiedApiKey | null>(null);
  const [routeConfigKey, setRouteConfigKey] = useState<UnifiedApiKey | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const normalizedKeyword = deferredSearchQuery.trim();

  const { data: groups = [] } = useQuery({
    queryKey: ['api-router', 'unified-api-key-groups'],
    queryFn: () => unifiedApiKeyService.getGroups(),
  });
  const defaultGroupId = groups[0]?.id || '';

  const { data: modelMappings = [] } = useQuery({
    queryKey: ['api-router', 'model-mappings', '__association__'],
    queryFn: () => modelMappingService.getModelMappings(),
  });

  const { data: channels = [] } = useQuery<ApiRouterChannel[]>({
    queryKey: ['api-router', 'channels', '__unified-key-route-config__'],
    queryFn: () => apiRouterService.getChannels(),
  });

  const { data: routeConfigProviders = [] } = useQuery<ProxyProvider[]>({
    queryKey: ['api-router', 'providers', '__unified-key-route-config__'],
    queryFn: () => apiRouterService.getProxyProviders(),
  });

  const { data: items = [] } = useQuery({
    queryKey: [
      'api-router',
      'unified-api-keys',
      normalizedKeyword || '__all__',
      groupFilter,
    ],
    queryFn: () =>
      unifiedApiKeyService.getUnifiedApiKeys({
        keyword: normalizedKeyword || undefined,
        groupId: groupFilter !== 'all' ? groupFilter : undefined,
      }),
  });

  async function refreshUnifiedApiKeyData() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['api-router', 'unified-api-keys'] }),
      queryClient.invalidateQueries({ queryKey: ['api-router', 'unified-api-key-groups'] }),
      queryClient.invalidateQueries({ queryKey: ['api-router', 'channels'] }),
      queryClient.invalidateQueries({ queryKey: ['api-router', 'providers'] }),
      queryClient.invalidateQueries({ queryKey: ['api-router', 'model-mappings'] }),
    ]);
  }

  const createMutation = useMutation({
    mutationFn: (input: UnifiedApiKeyCreate) => unifiedApiKeyService.createUnifiedApiKey(input),
    onSuccess: async (item) => {
      toast.success(t('apiRouterPage.unifiedApiKey.toast.keyCreated'));
      setIsCreateOpen(false);
      setUsageKey(item);
      startTransition(() => {
        setSearchQuery('');
        setGroupFilter('all');
      });
      await refreshUnifiedApiKeyData();
    },
  });

  const updateGroupMutation = useMutation({
    mutationFn: ({ itemId, groupId }: { itemId: string; groupId: string }) =>
      unifiedApiKeyService.updateGroup(itemId, groupId),
    onSuccess: async () => {
      toast.success(t('apiRouterPage.unifiedApiKey.toast.groupUpdated'));
      await refreshUnifiedApiKeyData();
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ itemId, status }: { itemId: string; status: UnifiedApiKey['status'] }) =>
      unifiedApiKeyService.updateStatus(itemId, status),
    onSuccess: async (item) => {
      toast.success(t('apiRouterPage.unifiedApiKey.toast.statusUpdated'));
      if (usageKey?.id === item.id) {
        setUsageKey(item);
      }
      await refreshUnifiedApiKeyData();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ itemId, update }: { itemId: string; update: UnifiedApiKeyUpdate }) =>
      unifiedApiKeyService.updateUnifiedApiKey(itemId, update),
    onSuccess: async (item) => {
      const routeConfigChanged = routeConfigKey?.id === item.id;

      toast.success(
        t(
          routeConfigChanged
            ? 'apiRouterPage.unifiedApiKey.toast.routeConfigUpdated'
            : 'apiRouterPage.unifiedApiKey.toast.keyUpdated',
        ),
      );
      setEditingKey(null);
      setRouteConfigKey((current) => (current?.id === item.id ? null : current));
      if (usageKey?.id === item.id) {
        setUsageKey(item);
      }
      await refreshUnifiedApiKeyData();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (item: UnifiedApiKey) => unifiedApiKeyService.deleteUnifiedApiKey(item.id),
    onSuccess: async (_, item) => {
      toast.success(t('apiRouterPage.unifiedApiKey.toast.keyDeleted'));
      if (usageKey?.id === item.id) {
        setUsageKey(null);
      }
      if (editingKey?.id === item.id) {
        setEditingKey(null);
      }
      if (routeConfigKey?.id === item.id) {
        setRouteConfigKey(null);
      }
      await refreshUnifiedApiKeyData();
    },
  });

  async function handleCopyApiKey(item: UnifiedApiKey) {
    if (item.canCopyApiKey === false || !item.apiKey) {
      toast.error(t('apiRouterPage.unifiedApiKey.toast.copyUnavailable'));
      return;
    }

    try {
      await platform.copy(item.apiKey);
      toast.success(t('apiRouterPage.unifiedApiKey.toast.copySuccess'));
    } catch {
      toast.error(t('apiRouterPage.unifiedApiKey.toast.copyFailed'));
    }
  }

  function handleDelete(item: UnifiedApiKey) {
    if (
      !window.confirm(t('apiRouterPage.unifiedApiKey.actions.confirmDelete', { name: item.name }))
    ) {
      return;
    }

    deleteMutation.mutate(item);
  }

  return (
    <div data-slot="api-router-unified-key-manager" className="min-w-0 flex-1 space-y-4">
      <section className="rounded-[28px] border border-zinc-200/80 bg-white/92 p-4 shadow-[0_18px_48px_rgba(15,23,42,0.08)] backdrop-blur dark:border-zinc-800/80 dark:bg-zinc-950/70 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" onClick={() => setIsCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              {t('apiRouterPage.unifiedApiKey.actions.createKey')}
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => {
                void refreshUnifiedApiKeyData();
              }}
            >
              <RefreshCw className="h-4 w-4" />
              {t('apiRouterPage.unifiedApiKey.actions.refresh')}
            </Button>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row lg:w-[min(100%,52rem)] lg:justify-end">
            <div className="relative flex-1 lg:max-w-[24rem]">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={t('apiRouterPage.unifiedApiKey.filters.searchPlaceholder')}
                className="h-11 rounded-2xl bg-white pl-11 pr-4 dark:bg-zinc-950"
              />
            </div>

            <div className="w-full sm:w-[14rem]">
              <Select value={groupFilter} onValueChange={setGroupFilter}>
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {t('apiRouterPage.unifiedApiKey.filters.allGroups')}
                  </SelectItem>
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

      <UnifiedApiKeyTable
        items={items}
        channels={channels}
        providers={routeConfigProviders}
        modelMappings={modelMappings}
        groups={groups}
        onCopyApiKey={handleCopyApiKey}
        onGroupChange={(itemId, groupId) => updateGroupMutation.mutate({ itemId, groupId })}
        onOpenUsage={setUsageKey}
        onOpenEdit={setEditingKey}
        onOpenRouteConfig={setRouteConfigKey}
        onToggleStatus={(item) =>
          updateStatusMutation.mutate({
            itemId: item.id,
            status: item.status === 'disabled' ? 'active' : 'disabled',
          })
        }
        onDelete={handleDelete}
      />

      <UnifiedApiKeyDialogs
        usageKey={usageKey}
        isCreateOpen={isCreateOpen}
        editingKey={editingKey}
        routeConfigKey={routeConfigKey}
        channels={channels}
        routeConfigProviders={routeConfigProviders}
        groups={groups}
        modelMappings={modelMappings}
        defaultGroupId={defaultGroupId}
        onCloseUsage={() => setUsageKey(null)}
        onCloseCreate={() => setIsCreateOpen(false)}
        onCloseEdit={() => setEditingKey(null)}
        onCloseRouteConfig={() => setRouteConfigKey(null)}
        onCreate={(input) => createMutation.mutate(input)}
        onSave={(itemId, update) => updateMutation.mutate({ itemId, update })}
        onSaveRouteConfig={(itemId, update) => updateMutation.mutate({ itemId, update })}
        onCopyApiKey={handleCopyApiKey}
      />
    </div>
  );
}
