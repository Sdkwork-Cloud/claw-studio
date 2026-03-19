import { startTransition, useDeferredValue, useState } from 'react';
import { Plus, RefreshCw, Search } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { platform } from '@sdkwork/claw-infrastructure';
import type {
  ModelMapping,
  ProxyProviderGroup,
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
import { modelMappingService, unifiedApiKeyService } from '../services';
import { UnifiedApiKeyDialogs } from './UnifiedApiKeyDialogs';
import { UnifiedApiKeyTable } from './UnifiedApiKeyTable';

interface UnifiedApiKeyManagerProps {
  groups: ProxyProviderGroup[];
}

export function UnifiedApiKeyManager({ groups }: UnifiedApiKeyManagerProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [groupFilter, setGroupFilter] = useState('all');
  const [usageKey, setUsageKey] = useState<UnifiedApiKey | null>(null);
  const [editingKey, setEditingKey] = useState<UnifiedApiKey | null>(null);
  const [associatingKey, setAssociatingKey] = useState<UnifiedApiKey | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const normalizedKeyword = deferredSearchQuery.trim();
  const defaultGroupId = groups[0]?.id || '';

  const { data: modelMappings = [] } = useQuery({
    queryKey: ['api-router', 'model-mappings', '__association__'],
    queryFn: () => modelMappingService.getModelMappings(),
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
    await queryClient.invalidateQueries({ queryKey: ['api-router', 'unified-api-keys'] });
  }

  const createMutation = useMutation({
    mutationFn: (input: UnifiedApiKeyCreate) => unifiedApiKeyService.createUnifiedApiKey(input),
    onSuccess: async () => {
      toast.success(t('apiRouterPage.unifiedApiKey.toast.keyCreated'));
      setIsCreateOpen(false);
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

  const assignModelMappingMutation = useMutation({
    mutationFn: ({ itemId, modelMappingId }: { itemId: string; modelMappingId: string | null }) =>
      unifiedApiKeyService.assignModelMapping(itemId, modelMappingId),
    onSuccess: async (item) => {
      toast.success(t('apiRouterPage.unifiedApiKey.toast.modelMappingUpdated'));
      setAssociatingKey(null);
      if (usageKey?.id === item.id) {
        setUsageKey(item);
      }
      if (editingKey?.id === item.id) {
        setEditingKey(item);
      }
      await refreshUnifiedApiKeyData();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ itemId, update }: { itemId: string; update: UnifiedApiKeyUpdate }) =>
      unifiedApiKeyService.updateUnifiedApiKey(itemId, update),
    onSuccess: async (item) => {
      toast.success(t('apiRouterPage.unifiedApiKey.toast.keyUpdated'));
      setEditingKey(null);
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
      await refreshUnifiedApiKeyData();
    },
  });

  async function handleCopyApiKey(item: UnifiedApiKey) {
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
            <Button type="button" onClick={() => setIsCreateOpen(true)} disabled={groups.length === 0}>
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
        modelMappings={modelMappings}
        groups={groups}
        onCopyApiKey={handleCopyApiKey}
        onGroupChange={(itemId, groupId) => updateGroupMutation.mutate({ itemId, groupId })}
        onOpenUsage={setUsageKey}
        onOpenEdit={setEditingKey}
        onOpenAssociateMapping={setAssociatingKey}
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
        associatingKey={associatingKey}
        groups={groups}
        modelMappings={modelMappings}
        defaultGroupId={defaultGroupId}
        onCloseUsage={() => setUsageKey(null)}
        onCloseCreate={() => setIsCreateOpen(false)}
        onCloseEdit={() => setEditingKey(null)}
        onCloseAssociation={() => setAssociatingKey(null)}
        onCreate={(input) => createMutation.mutate(input)}
        onSave={(itemId, update) => updateMutation.mutate({ itemId, update })}
        onAssignModelMapping={(itemId, modelMappingId) =>
          assignModelMappingMutation.mutate({ itemId, modelMappingId })
        }
        onCopyApiKey={handleCopyApiKey}
      />
    </div>
  );
}
