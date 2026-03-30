import { useEffect, useState } from 'react';
import { Check, Database, PencilLine, Plus, Rocket, Route, Save, Search, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Textarea,
} from '@sdkwork/claw-ui';
import {
  providerConfigCenterService,
  type ProviderConfigDraft,
  type ProviderConfigRecord,
} from './services/index.ts';

interface ProviderConfigFormState {
  id?: string;
  presetId: string;
  name: string;
  providerId: string;
  baseUrl: string;
  apiKey: string;
  defaultModelId: string;
  reasoningModelId: string;
  embeddingModelId: string;
  modelsText: string;
  notes: string;
  temperature: string;
  topP: string;
  maxTokens: string;
  timeoutMs: string;
  streaming: boolean;
}

function formatModelsText(models: ProviderConfigDraft['models']) {
  return models.map((model) => `${model.id}=${model.name}`).join('\n');
}

function parseModelsText(modelsText: string) {
  return Array.from(
    new Map(
      modelsText
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const separatorIndex = line.indexOf('=');
          if (separatorIndex <= 0) {
            return { id: line, name: line };
          }
          const id = line.slice(0, separatorIndex).trim();
          const name = line.slice(separatorIndex + 1).trim();
          return { id, name: name || id };
        })
        .filter((model) => model.id)
        .map((model) => [model.id, model] as const),
    ).values(),
  );
}

function createFormState(
  input?: Partial<ProviderConfigDraft> & { id?: string; config?: Partial<ProviderConfigRecord['config']> },
): ProviderConfigFormState {
  const runtimeConfig = input?.config || {};
  return {
    id: input?.id,
    presetId: input?.presetId || '',
    name: input?.name || '',
    providerId: input?.providerId || '',
    baseUrl: input?.baseUrl || '',
    apiKey: input?.apiKey || '',
    defaultModelId: input?.defaultModelId || '',
    reasoningModelId: input?.reasoningModelId || '',
    embeddingModelId: input?.embeddingModelId || '',
    modelsText: formatModelsText(input?.models || []),
    notes: input?.notes || '',
    temperature: String(runtimeConfig.temperature ?? 0.2),
    topP: String(runtimeConfig.topP ?? 1),
    maxTokens: String(runtimeConfig.maxTokens ?? 8192),
    timeoutMs: String(runtimeConfig.timeoutMs ?? 60000),
    streaming: runtimeConfig.streaming ?? true,
  };
}

function createDraftFromForm(form: ProviderConfigFormState): ProviderConfigDraft & { id?: string } {
  return {
    id: form.id,
    presetId: form.presetId || undefined,
    name: form.name,
    providerId: form.providerId,
    baseUrl: form.baseUrl,
    apiKey: form.apiKey,
    defaultModelId: form.defaultModelId,
    reasoningModelId: form.reasoningModelId || undefined,
    embeddingModelId: form.embeddingModelId || undefined,
    models: parseModelsText(form.modelsText),
    notes: form.notes || undefined,
    config: {
      temperature: Number.parseFloat(form.temperature) || 0.2,
      topP: Number.parseFloat(form.topP) || 1,
      maxTokens: Number.parseInt(form.maxTokens, 10) || 8192,
      timeoutMs: Number.parseInt(form.timeoutMs, 10) || 60000,
      streaming: form.streaming,
    },
  };
}

function formatUpdatedAt(updatedAt: number) {
  return Number.isFinite(updatedAt) && updatedAt > 0 ? new Date(updatedAt).toLocaleString() : '--';
}

function maskApiKey(apiKey: string) {
  if (!apiKey) {
    return '--';
  }
  if (apiKey.length <= 8) {
    return `${apiKey.slice(0, 2)}***`;
  }
  return `${apiKey.slice(0, 4)}***${apiKey.slice(-4)}`;
}

export function ProviderConfigCenter() {
  const { t } = useTranslation();
  const presets = providerConfigCenterService.listPresets();
  const [records, setRecords] = useState<ProviderConfigRecord[]>([]);
  const [searchText, setSearchText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editorDraft, setEditorDraft] = useState<ProviderConfigFormState>(createFormState(presets[0]?.draft));
  const [isSaving, setIsSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ProviderConfigRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [applyTarget, setApplyTarget] = useState<ProviderConfigRecord | null>(null);
  const [applyInstances, setApplyInstances] = useState<Awaited<ReturnType<typeof providerConfigCenterService.listApplyInstances>>>([]);
  const [selectedInstanceId, setSelectedInstanceId] = useState('');
  const [instanceTarget, setInstanceTarget] = useState<Awaited<ReturnType<typeof providerConfigCenterService.getInstanceApplyTarget>> | null>(null);
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);
  const [isApplying, setIsApplying] = useState(false);
  const [isLoadingApplyTargets, setIsLoadingApplyTargets] = useState(false);

  const loadRecords = async () => {
    setIsLoading(true);
    try {
      setRecords(await providerConfigCenterService.listProviderConfigs());
    } catch (error: any) {
      toast.error(error?.message || t('providerCenter.toasts.loadFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadRecords();
  }, []);

  useEffect(() => {
    if (!applyTarget) {
      setApplyInstances([]);
      setSelectedInstanceId('');
      setInstanceTarget(null);
      setSelectedAgentIds([]);
      return;
    }

    let cancelled = false;
    const loadApplyInstances = async () => {
      setIsLoadingApplyTargets(true);
      try {
        const instances = await providerConfigCenterService.listApplyInstances();
        if (cancelled) {
          return;
        }
        setApplyInstances(instances);
        setSelectedInstanceId(
          instances.find((instance) => instance.isDefault)?.id || instances[0]?.id || '',
        );
      } catch (error: any) {
        if (!cancelled) {
          toast.error(error?.message || t('providerCenter.toasts.loadInstancesFailed'));
        }
      } finally {
        if (!cancelled) {
          setIsLoadingApplyTargets(false);
        }
      }
    };

    void loadApplyInstances();
    return () => {
      cancelled = true;
    };
  }, [applyTarget, t]);

  useEffect(() => {
    if (!applyTarget || !selectedInstanceId) {
      setInstanceTarget(null);
      setSelectedAgentIds([]);
      return;
    }

    let cancelled = false;
    const loadInstanceTarget = async () => {
      setIsLoadingApplyTargets(true);
      try {
        const nextTarget = await providerConfigCenterService.getInstanceApplyTarget(selectedInstanceId);
        if (cancelled) {
          return;
        }
        setInstanceTarget(nextTarget);
        setSelectedAgentIds(
          nextTarget.agents.filter((agent) => agent.isDefault).map((agent) => agent.id),
        );
      } catch (error: any) {
        if (!cancelled) {
          setInstanceTarget(null);
          setSelectedAgentIds([]);
          toast.error(error?.message || t('providerCenter.toasts.loadInstanceTargetFailed'));
        }
      } finally {
        if (!cancelled) {
          setIsLoadingApplyTargets(false);
        }
      }
    };

    void loadInstanceTarget();
    return () => {
      cancelled = true;
    };
  }, [applyTarget, selectedInstanceId, t]);

  const openCreateDialog = () => {
    setEditorDraft(createFormState(presets[0]?.draft));
    setIsEditorOpen(true);
  };

  const openEditDialog = (record: ProviderConfigRecord) => {
    setEditorDraft(createFormState(record));
    setIsEditorOpen(true);
  };

  const handleSelectPreset = (presetId: string) => {
    if (presetId === '__custom__') {
      setEditorDraft((current) => ({ ...current, presetId: '' }));
      return;
    }
    const preset = presets.find((item) => item.id === presetId);
    if (!preset) {
      return;
    }
    setEditorDraft((current) => ({
      ...createFormState({ ...preset.draft, apiKey: current.apiKey }),
      id: current.id,
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await providerConfigCenterService.saveProviderConfig(createDraftFromForm(editorDraft));
      toast.success(t('providerCenter.toasts.saved'));
      setIsEditorOpen(false);
      await loadRecords();
    } catch (error: any) {
      toast.error(error?.message || t('providerCenter.toasts.saveFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) {
      return;
    }
    setIsDeleting(true);
    try {
      await providerConfigCenterService.deleteProviderConfig(deleteTarget.id);
      toast.success(t('providerCenter.toasts.deleted'));
      setDeleteTarget(null);
      await loadRecords();
    } catch (error: any) {
      toast.error(error?.message || t('providerCenter.toasts.deleteFailed'));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleApply = async () => {
    if (!applyTarget || !selectedInstanceId) {
      return;
    }
    setIsApplying(true);
    try {
      await providerConfigCenterService.applyProviderConfig({
        instanceId: selectedInstanceId,
        config: applyTarget,
        agentIds: selectedAgentIds,
      });
      toast.success(t('providerCenter.toasts.applied'));
      setApplyTarget(null);
    } catch (error: any) {
      toast.error(error?.message || t('providerCenter.toasts.applyFailed'));
    } finally {
      setIsApplying(false);
    }
  };

  const setAgentSelected = (agentId: string, checked: boolean) => {
    setSelectedAgentIds((current) =>
      checked ? (current.includes(agentId) ? current : [...current, agentId]) : current.filter((value) => value !== agentId),
    );
  };

  const normalizedSearch = searchText.trim().toLowerCase();
  const filteredRecords = normalizedSearch
    ? records.filter((record) => {
        const haystack = [
          record.name,
          record.providerId,
          record.baseUrl,
          record.defaultModelId,
          record.reasoningModelId,
          record.embeddingModelId,
          record.notes,
          record.apiKey,
          ...record.models.flatMap((model) => [model.id, model.name]),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(normalizedSearch);
      })
    : records;

  return (
    <div className="h-full overflow-auto bg-zinc-50 dark:bg-zinc-950" data-slot="provider-center-page">
      <div className="mx-auto flex max-w-[1500px] flex-col gap-6 p-4 md:p-6">
        <section className="rounded-[28px] border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex flex-col gap-4 border-b border-zinc-200 p-6 dark:border-zinc-800 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200">
                <Route className="h-3.5 w-3.5" />
                {t('providerCenter.page.eyebrow')}
              </div>
              <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
                {t('providerCenter.page.title')}
              </h1>
              <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-300">
                {t('providerCenter.page.description')}
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {t('providerCenter.page.storageHint')}
              </p>
            </div>

            <div className="flex w-full flex-col gap-3 lg:w-auto lg:min-w-[520px] lg:flex-row lg:items-center lg:justify-end">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <Input
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                  placeholder={t('providerCenter.searchPlaceholder')}
                  className="h-10 pl-9"
                />
              </div>
              <div className="flex shrink-0 gap-3">
                <Button variant="outline" onClick={() => void loadRecords()} disabled={isLoading}>
                  <Database className="h-4 w-4" />
                  {t('providerCenter.actions.refresh')}
                </Button>
                <Button onClick={openCreateDialog}>
                  <Plus className="h-4 w-4" />
                  {t('providerCenter.actions.addRouteConfig')}
                </Button>
              </div>
            </div>
          </div>

          <div data-slot="provider-center-table">
            {isLoading ? (
              <div className="flex min-h-[240px] items-center justify-center p-8 text-sm text-zinc-500 dark:text-zinc-400">
                {t('providerCenter.states.loading')}
              </div>
            ) : filteredRecords.length === 0 ? (
              <div className="flex min-h-[280px] flex-col items-center justify-center gap-4 p-8 text-center">
                <Route className="h-8 w-8 text-zinc-400" />
                <div>
                  <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
                    {t('providerCenter.states.emptyTitle')}
                  </h2>
                  <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                    {normalizedSearch
                      ? t('providerCenter.states.searchEmptyDescription')
                      : t('providerCenter.states.emptyDescription')}
                  </p>
                </div>
                <Button onClick={openCreateDialog}>
                  <Plus className="h-4 w-4" />
                  {t('providerCenter.actions.addRouteConfig')}
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-zinc-50 text-left text-xs uppercase tracking-[0.18em] text-zinc-500 dark:bg-zinc-950 dark:text-zinc-400">
                    <tr>
                      <th className="px-5 py-4">{t('providerCenter.table.name')}</th>
                      <th className="px-5 py-4">{t('providerCenter.table.provider')}</th>
                      <th className="px-5 py-4">{t('providerCenter.table.endpoint')}</th>
                      <th className="px-5 py-4">{t('providerCenter.table.selection')}</th>
                      <th className="px-5 py-4">{t('providerCenter.table.apiKey')}</th>
                      <th className="px-5 py-4">{t('providerCenter.table.updatedAt')}</th>
                      <th className="px-5 py-4">{t('providerCenter.table.actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    {filteredRecords.map((record) => (
                      <tr key={record.id} className="align-top hover:bg-zinc-50/80 dark:hover:bg-zinc-950/40">
                        <td className="px-5 py-4">
                          <div className="font-semibold text-zinc-950 dark:text-zinc-50">
                            {record.name}
                          </div>
                          <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                            {record.notes || t('providerCenter.states.noNotes')}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="font-medium text-zinc-900 dark:text-zinc-100">
                            {record.providerId}
                          </div>
                          <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                            {record.models.length} {t('providerCenter.table.models')}
                          </div>
                        </td>
                        <td className="max-w-[260px] break-all px-5 py-4 text-zinc-700 dark:text-zinc-300">
                          {record.baseUrl || t('providerCenter.states.notSet')}
                        </td>
                        <td className="px-5 py-4 text-xs text-zinc-600 dark:text-zinc-300">
                          <div>
                            <span className="font-semibold">{t('providerCenter.table.llmDefault')}</span>{' '}
                            {record.defaultModelId}
                          </div>
                          <div className="mt-1">
                            <span className="font-semibold">{t('providerCenter.table.reasoning')}</span>{' '}
                            {record.reasoningModelId || t('providerCenter.states.notSet')}
                          </div>
                          <div className="mt-1">
                            <span className="font-semibold">{t('providerCenter.table.embedding')}</span>{' '}
                            {record.embeddingModelId || t('providerCenter.states.notSet')}
                          </div>
                        </td>
                        <td className="px-5 py-4 text-zinc-600 dark:text-zinc-300">
                          {maskApiKey(record.apiKey)}
                        </td>
                        <td className="px-5 py-4 text-zinc-600 dark:text-zinc-300">
                          {formatUpdatedAt(record.updatedAt)}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex min-w-[220px] flex-wrap gap-2">
                            <Button size="sm" variant="outline" onClick={() => setApplyTarget(record)}>
                              <Rocket className="h-4 w-4" />
                              {t('providerCenter.actions.quickApply')}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => openEditDialog(record)}>
                              <PencilLine className="h-4 w-4" />
                              {t('providerCenter.actions.edit')}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(record)}>
                              <Trash2 className="h-4 w-4" />
                              {t('providerCenter.actions.delete')}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>
                {editorDraft.id
                  ? t('providerCenter.dialogs.editor.editTitle')
                  : t('providerCenter.dialogs.editor.createTitle')}
              </DialogTitle>
              <DialogDescription>{t('providerCenter.dialogs.editor.description')}</DialogDescription>
            </DialogHeader>

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>{t('providerCenter.dialogs.editor.preset')}</Label>
                    <Select value={editorDraft.presetId || '__custom__'} onValueChange={handleSelectPreset}>
                      <SelectTrigger>
                        <SelectValue placeholder={t('providerCenter.dialogs.editor.presetPlaceholder')} />
                      </SelectTrigger>
                      <SelectContent>
                        {presets.map((preset) => (
                          <SelectItem key={preset.id} value={preset.id}>
                            {preset.label}
                          </SelectItem>
                        ))}
                        <SelectItem value="__custom__">
                          {t('providerCenter.dialogs.editor.customPreset')}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{t('providerCenter.dialogs.editor.name')}</Label>
                    <Input
                      value={editorDraft.name}
                      onChange={(event) =>
                        setEditorDraft((current) => ({ ...current, name: event.target.value }))
                      }
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>{t('providerCenter.dialogs.editor.providerId')}</Label>
                    <Input
                      value={editorDraft.providerId}
                      onChange={(event) =>
                        setEditorDraft((current) => ({ ...current, providerId: event.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('providerCenter.dialogs.editor.baseUrl')}</Label>
                    <Input
                      value={editorDraft.baseUrl}
                      onChange={(event) =>
                        setEditorDraft((current) => ({ ...current, baseUrl: event.target.value }))
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>{t('providerCenter.dialogs.editor.apiKey')}</Label>
                  <Input
                    type="password"
                    value={editorDraft.apiKey}
                    onChange={(event) =>
                      setEditorDraft((current) => ({ ...current, apiKey: event.target.value }))
                    }
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>{t('providerCenter.dialogs.editor.defaultModel')}</Label>
                    <Input
                      value={editorDraft.defaultModelId}
                      onChange={(event) =>
                        setEditorDraft((current) => ({ ...current, defaultModelId: event.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('providerCenter.dialogs.editor.reasoningModel')}</Label>
                    <Input
                      value={editorDraft.reasoningModelId}
                      onChange={(event) =>
                        setEditorDraft((current) => ({ ...current, reasoningModelId: event.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('providerCenter.dialogs.editor.embeddingModel')}</Label>
                    <Input
                      value={editorDraft.embeddingModelId}
                      onChange={(event) =>
                        setEditorDraft((current) => ({ ...current, embeddingModelId: event.target.value }))
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>{t('providerCenter.dialogs.editor.models')}</Label>
                  <Textarea
                    rows={8}
                    value={editorDraft.modelsText}
                    onChange={(event) =>
                      setEditorDraft((current) => ({ ...current, modelsText: event.target.value }))
                    }
                  />
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {t('providerCenter.dialogs.editor.modelsHint')}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>{t('providerCenter.dialogs.editor.notes')}</Label>
                  <Textarea
                    rows={3}
                    value={editorDraft.notes}
                    onChange={(event) =>
                      setEditorDraft((current) => ({ ...current, notes: event.target.value }))
                    }
                  />
                </div>
              </div>

              <div className="space-y-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
                <h3 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                  {t('providerCenter.dialogs.editor.runtimeTitle')}
                </h3>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-1">
                  <div className="space-y-2">
                    <Label>{t('providerCenter.dialogs.editor.temperature')}</Label>
                    <Input
                      value={editorDraft.temperature}
                      onChange={(event) =>
                        setEditorDraft((current) => ({ ...current, temperature: event.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('providerCenter.dialogs.editor.topP')}</Label>
                    <Input
                      value={editorDraft.topP}
                      onChange={(event) =>
                        setEditorDraft((current) => ({ ...current, topP: event.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('providerCenter.dialogs.editor.maxTokens')}</Label>
                    <Input
                      value={editorDraft.maxTokens}
                      onChange={(event) =>
                        setEditorDraft((current) => ({ ...current, maxTokens: event.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('providerCenter.dialogs.editor.timeoutMs')}</Label>
                    <Input
                      value={editorDraft.timeoutMs}
                      onChange={(event) =>
                        setEditorDraft((current) => ({ ...current, timeoutMs: event.target.value }))
                      }
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
                  <div>
                    <div className="text-sm font-medium text-zinc-950 dark:text-zinc-50">
                      {t('providerCenter.dialogs.editor.streaming')}
                    </div>
                    <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      {t('providerCenter.dialogs.editor.streamingHint')}
                    </div>
                  </div>
                  <Switch
                    checked={editorDraft.streaming}
                    onCheckedChange={(checked) =>
                      setEditorDraft((current) => ({ ...current, streaming: checked === true }))
                    }
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => setIsEditorOpen(false)} disabled={isSaving}>
                {t('providerCenter.actions.cancel')}
              </Button>
              <Button onClick={() => void handleSave()} disabled={isSaving}>
                <Save className="h-4 w-4" />
                {editorDraft.id
                  ? t('providerCenter.actions.saveChanges')
                  : t('providerCenter.actions.createConfig')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={Boolean(applyTarget)} onOpenChange={(open) => !open && setApplyTarget(null)}>
          <DialogContent className="max-w-5xl">
            <DialogHeader>
              <DialogTitle>{t('providerCenter.dialogs.apply.title')}</DialogTitle>
              <DialogDescription>{t('providerCenter.dialogs.apply.description')}</DialogDescription>
            </DialogHeader>

            <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
              <div className="space-y-4">
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
                  <Label>{t('providerCenter.dialogs.apply.instance')}</Label>
                  <div className="mt-2">
                    <Select
                      value={selectedInstanceId || '__none__'}
                      onValueChange={(value) => setSelectedInstanceId(value === '__none__' ? '' : value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t('providerCenter.dialogs.apply.instancePlaceholder')} />
                      </SelectTrigger>
                      <SelectContent>
                        {applyInstances.length > 0 ? (
                          applyInstances.map((instance) => (
                            <SelectItem key={instance.id} value={instance.id}>
                              {instance.name}
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="__none__">{t('providerCenter.states.noInstances')}</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  {instanceTarget ? (
                    <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900">
                      <div className="font-medium text-zinc-950 dark:text-zinc-50">
                        {instanceTarget.instance.name}
                      </div>
                      <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                        {instanceTarget.instance.deploymentMode}
                      </div>
                      <div className="mt-2 break-all text-xs text-zinc-500 dark:text-zinc-400">
                        {t('providerCenter.dialogs.apply.configPath')}: {instanceTarget.instance.configPath}
                      </div>
                    </div>
                  ) : (
                    <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
                      {applyInstances.length === 0
                        ? t('providerCenter.states.noInstances')
                        : t('providerCenter.states.selectInstance')}
                    </p>
                  )}
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm dark:border-zinc-800 dark:bg-zinc-950">
                  <div className="font-semibold text-zinc-950 dark:text-zinc-50">
                    {t('providerCenter.dialogs.apply.targetSummary')}
                  </div>
                  {applyTarget ? (
                    <div className="mt-3 space-y-2 text-zinc-600 dark:text-zinc-300">
                      <div><span className="font-medium">{t('providerCenter.table.provider')}</span> {applyTarget.providerId}</div>
                      <div><span className="font-medium">{t('providerCenter.table.llmDefault')}</span> {applyTarget.defaultModelId}</div>
                      <div><span className="font-medium">{t('providerCenter.table.reasoning')}</span> {applyTarget.reasoningModelId || t('providerCenter.states.notSet')}</div>
                      <div><span className="font-medium">{t('providerCenter.table.embedding')}</span> {applyTarget.embeddingModelId || t('providerCenter.states.notSet')}</div>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                      {t('providerCenter.dialogs.apply.agents')}
                    </h3>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      {t('providerCenter.dialogs.apply.agentHint')}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setSelectedAgentIds(instanceTarget?.agents.map((agent) => agent.id) || [])}
                      disabled={!instanceTarget || instanceTarget.agents.length === 0}
                    >
                      {t('providerCenter.actions.selectAllAgents')}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setSelectedAgentIds([])}
                      disabled={selectedAgentIds.length === 0}
                    >
                      {t('providerCenter.actions.clearAgentSelection')}
                    </Button>
                  </div>
                </div>

                {isLoadingApplyTargets ? (
                  <div className="flex min-h-[260px] items-center justify-center rounded-2xl border border-zinc-200 bg-zinc-50 p-6 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
                    {t('providerCenter.states.loading')}
                  </div>
                ) : !instanceTarget ? (
                  <div className="flex min-h-[260px] items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-6 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-400">
                    {applyInstances.length === 0
                      ? t('providerCenter.states.noInstances')
                      : t('providerCenter.states.selectInstance')}
                  </div>
                ) : instanceTarget.agents.length === 0 ? (
                  <div className="flex min-h-[260px] items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-6 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-400">
                    {t('providerCenter.states.noAgents')}
                  </div>
                ) : (
                  <div className="max-h-[380px] space-y-3 overflow-y-auto rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
                    {instanceTarget.agents.map((agent) => {
                      const isSelected = selectedAgentIds.includes(agent.id);
                      return (
                        <label key={agent.id} className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 ${isSelected ? 'border-primary-300 bg-primary-50 dark:border-primary-500/40 dark:bg-primary-500/10' : 'border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900'}`}>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) => setAgentSelected(agent.id, checked === true)}
                            className="mt-1"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="text-sm font-medium text-zinc-950 dark:text-zinc-50">
                                {agent.name}
                              </div>
                              {agent.isDefault ? (
                                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
                                  <Check className="h-3 w-3" />
                                  {t('providerCenter.dialogs.apply.defaultAgent')}
                                </span>
                              ) : null}
                            </div>
                            <div className="mt-1 break-all text-xs text-zinc-500 dark:text-zinc-400">
                              {t('providerCenter.dialogs.apply.currentModel')}: {agent.primaryModel || t('providerCenter.states.notSet')}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => setApplyTarget(null)} disabled={isApplying}>
                {t('providerCenter.actions.cancel')}
              </Button>
              <Button onClick={() => void handleApply()} disabled={!selectedInstanceId || isApplying || isLoadingApplyTargets}>
                <Rocket className="h-4 w-4" />
                {t('providerCenter.actions.applyConfig')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{t('providerCenter.dialogs.delete.title')}</DialogTitle>
              <DialogDescription>
                {t('providerCenter.dialogs.delete.description', { name: deleteTarget?.name || '' })}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>
                {t('providerCenter.actions.cancel')}
              </Button>
              <Button variant="destructive" onClick={() => void handleDelete()} disabled={isDeleting}>
                <Trash2 className="h-4 w-4" />
                {t('providerCenter.actions.delete')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
