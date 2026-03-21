import { startTransition, useDeferredValue, useState } from 'react';
import { Plus, RefreshCw, Search } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import type { ModelMapping } from '@sdkwork/claw-types';
import { Button, Input } from '@sdkwork/claw-ui';
import { modelMappingService } from '../services';
import { ModelMappingDialogs } from './ModelMappingDialogs';
import { ModelMappingTable } from './ModelMappingTable';

export function ModelMappingManager() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [detailItem, setDetailItem] = useState<ModelMapping | null>(null);
  const [editingItem, setEditingItem] = useState<ModelMapping | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const normalizedKeyword = deferredSearchQuery.trim();

  function resolveMutationErrorMessage(error: unknown, fallbackMessage: string) {
    return error instanceof Error && error.message.trim()
      ? error.message
      : fallbackMessage;
  }

  const { data: modelCatalog = [] } = useQuery({
    queryKey: ['api-router', 'model-mapping-catalog'],
    queryFn: () => modelMappingService.getModelCatalog(),
  });

  const { data: items = [] } = useQuery({
    queryKey: ['api-router', 'model-mappings', normalizedKeyword || '__all__'],
    queryFn: () =>
      modelMappingService.getModelMappings({
        keyword: normalizedKeyword || undefined,
      }),
  });

  async function refreshModelMappingData() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['api-router', 'model-mappings'] }),
      queryClient.invalidateQueries({ queryKey: ['api-router', 'model-mapping-catalog'] }),
      queryClient.invalidateQueries({ queryKey: ['api-router', 'unified-api-keys'] }),
    ]);
  }

  const createMutation = useMutation({
    mutationFn: modelMappingService.createModelMapping,
    onSuccess: async () => {
      toast.success(t('apiRouterPage.modelMapping.toast.created'));
      setIsCreateOpen(false);
      startTransition(() => {
        setSearchQuery('');
      });
      await refreshModelMappingData();
    },
    onError: (error) => {
      toast.error(
        resolveMutationErrorMessage(error, t('apiRouterPage.modelMapping.toast.validationFailed')),
      );
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, update }: { id: string; update: Parameters<typeof modelMappingService.updateModelMapping>[1] }) =>
      modelMappingService.updateModelMapping(id, update),
    onSuccess: async () => {
      toast.success(t('apiRouterPage.modelMapping.toast.updated'));
      setEditingItem(null);
      await refreshModelMappingData();
    },
    onError: (error) => {
      toast.error(
        resolveMutationErrorMessage(error, t('apiRouterPage.modelMapping.toast.validationFailed')),
      );
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ModelMapping['status'] }) =>
      modelMappingService.updateStatus(id, status),
    onSuccess: async () => {
      toast.success(t('apiRouterPage.modelMapping.toast.statusUpdated'));
      await refreshModelMappingData();
    },
    onError: (error) => {
      toast.error(
        resolveMutationErrorMessage(error, t('apiRouterPage.modelMapping.toast.validationFailed')),
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (item: ModelMapping) => modelMappingService.deleteModelMapping(item.id),
    onSuccess: async (_, item) => {
      toast.success(t('apiRouterPage.modelMapping.toast.deleted'));
      if (detailItem?.id === item.id) {
        setDetailItem(null);
      }
      if (editingItem?.id === item.id) {
        setEditingItem(null);
      }
      await refreshModelMappingData();
    },
    onError: (error) => {
      toast.error(
        resolveMutationErrorMessage(error, t('apiRouterPage.modelMapping.toast.validationFailed')),
      );
    },
  });

  function handleDelete(item: ModelMapping) {
    if (
      !window.confirm(
        t('apiRouterPage.modelMapping.actions.confirmDelete', {
          name: item.name,
        }),
      )
    ) {
      return;
    }

    deleteMutation.mutate(item);
  }

  return (
    <div data-slot="api-router-model-mapping-manager" className="min-w-0 flex-1 space-y-4">
      <section className="rounded-[28px] border border-zinc-200/80 bg-white/92 p-4 shadow-[0_18px_48px_rgba(15,23,42,0.08)] backdrop-blur dark:border-zinc-800/80 dark:bg-zinc-950/70 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" onClick={() => setIsCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              {t('apiRouterPage.modelMapping.actions.create')}
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => {
                void refreshModelMappingData();
              }}
            >
              <RefreshCw className="h-4 w-4" />
              {t('apiRouterPage.modelMapping.actions.refresh')}
            </Button>
          </div>

          <div className="relative flex-1 lg:max-w-[24rem]">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={t('apiRouterPage.modelMapping.filters.searchPlaceholder')}
              className="h-11 rounded-2xl bg-white pl-11 pr-4 dark:bg-zinc-950"
            />
          </div>
        </div>
      </section>

      <ModelMappingTable
        items={items}
        onOpenDetail={setDetailItem}
        onOpenEdit={setEditingItem}
        onToggleStatus={(item) =>
          updateStatusMutation.mutate({
            id: item.id,
            status: item.status === 'disabled' ? 'active' : 'disabled',
          })
        }
        onDelete={handleDelete}
      />

      <ModelMappingDialogs
        detailItem={detailItem}
        isCreateOpen={isCreateOpen}
        editingItem={editingItem}
        modelCatalog={modelCatalog}
        onCloseDetail={() => setDetailItem(null)}
        onCloseCreate={() => setIsCreateOpen(false)}
        onCloseEdit={() => setEditingItem(null)}
        onCreate={(input) => createMutation.mutate(input)}
        onSave={(id, update) => updateMutation.mutate({ id, update })}
      />
    </div>
  );
}
