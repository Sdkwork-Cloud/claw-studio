import { useEffect, useState, type FormEvent } from 'react';
import {
  ArrowRight,
  ChevronRight,
  ListTree,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import type {
  ModelMapping,
  ModelMappingCatalogChannel,
  ModelMappingCreate,
  ModelMappingModelRef,
  ModelMappingUpdate,
} from '@sdkwork/claw-types';
import {
  Button,
  DateInput,
  Input,
  Label,
  Modal,
  Textarea,
  cn,
} from '@sdkwork/claw-ui';
import {
  appendModelMappingRule,
  buildEditModelMappingFormState,
  createEmptyModelMappingFormState,
  normalizeModelMappingFormState,
  removeModelMappingRule,
  type ModelMappingFormRuleState,
  type ModelMappingFormState,
} from '../services';
import { ProxyProviderStatusBadge } from './ProxyProviderStatusBadge';

type ModelMappingEndpoint = 'source' | 'target';

interface SelectorState {
  scope: 'create' | 'edit';
  ruleIndex: number;
  endpoint: ModelMappingEndpoint;
}

interface ModelMappingDialogsProps {
  detailItem: ModelMapping | null;
  isCreateOpen: boolean;
  editingItem: ModelMapping | null;
  modelCatalog: ModelMappingCatalogChannel[];
  onCloseDetail: () => void;
  onCloseCreate: () => void;
  onCloseEdit: () => void;
  onCreate: (input: ModelMappingCreate) => void;
  onSave: (id: string, update: ModelMappingUpdate) => void;
}

function formatDate(value: string, language: string) {
  return new Intl.DateTimeFormat(language, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(value));
}

function MappingSelectorButton({
  label,
  placeholder,
  value,
  onClick,
}: {
  label: string;
  placeholder: string;
  value: ModelMappingModelRef | null;
  onClick: () => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center justify-between rounded-[22px] border border-zinc-200 bg-white px-4 py-3 text-left transition hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700 dark:hover:bg-zinc-900"
      >
        {value ? (
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-zinc-950 dark:text-zinc-50">
              {value.modelName}
            </div>
            <div className="mt-1 truncate text-xs text-zinc-500 dark:text-zinc-400">
              {`${value.channelName} / ${value.modelId}`}
            </div>
          </div>
        ) : (
          <div className="text-sm text-zinc-500 dark:text-zinc-400">{placeholder}</div>
        )}
        <ChevronRight className="h-4 w-4 shrink-0 text-zinc-400" />
      </button>
    </div>
  );
}

function MappingRuleEditor({
  rule,
  index,
  onOpenSelector,
  onRemove,
}: {
  rule: ModelMappingFormRuleState;
  index: number;
  onOpenSelector: (ruleIndex: number, endpoint: ModelMappingEndpoint) => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="rounded-[24px] border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
          <ListTree className="h-4 w-4" />
          {t('apiRouterPage.modelMapping.values.ruleIndex', { index: index + 1 })}
        </div>
        <Button type="button" variant="ghost" size="icon" className="h-10 w-10" onClick={onRemove}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-end">
        <MappingSelectorButton
          label={t('apiRouterPage.modelMapping.fields.sourceModel')}
          placeholder={t('apiRouterPage.modelMapping.actions.selectSourceModel')}
          value={rule.source}
          onClick={() => onOpenSelector(index, 'source')}
        />

        <div className="flex justify-center pb-3">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-primary-500/20 bg-primary-500/10 text-primary-500">
            <ArrowRight className="h-4 w-4" />
          </span>
        </div>

        <MappingSelectorButton
          label={t('apiRouterPage.modelMapping.fields.targetModel')}
          placeholder={t('apiRouterPage.modelMapping.actions.selectTargetModel')}
          value={rule.target}
          onClick={() => onOpenSelector(index, 'target')}
        />
      </div>
    </div>
  );
}

function ModelMappingForm({
  formState,
  onChange,
  onOpenSelector,
  onSubmit,
  submitLabel,
}: {
  formState: ModelMappingFormState;
  onChange: (updater: (previous: ModelMappingFormState) => ModelMappingFormState) => void;
  onOpenSelector: (ruleIndex: number, endpoint: ModelMappingEndpoint) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  submitLabel: string;
}) {
  const { t } = useTranslation();

  return (
    <form className="space-y-6" onSubmit={onSubmit}>
      <section className="rounded-[28px] border border-zinc-200 bg-zinc-50/80 p-5 dark:border-zinc-800 dark:bg-zinc-900/50">
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="model-mapping-name">{t('apiRouterPage.modelMapping.fields.name')}</Label>
            <Input
              id="model-mapping-name"
              placeholder={t('apiRouterPage.modelMapping.placeholders.name')}
              value={formState.name}
              onChange={(event) =>
                onChange((previous) => ({ ...previous, name: event.target.value }))
              }
            />
          </div>

          <div className="space-y-2 lg:col-span-2">
            <Label htmlFor="model-mapping-description">
              {t('apiRouterPage.modelMapping.fields.description')}
            </Label>
            <Textarea
              id="model-mapping-description"
              rows={4}
              placeholder={t('apiRouterPage.modelMapping.placeholders.description')}
              value={formState.description}
              onChange={(event) =>
                onChange((previous) => ({ ...previous, description: event.target.value }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="model-mapping-effective-from">
              {t('apiRouterPage.modelMapping.fields.effectiveFrom')}
            </Label>
            <DateInput
              id="model-mapping-effective-from"
              calendarLabel={t('apiRouterPage.modelMapping.fields.effectiveFrom')}
              className="h-11"
              value={formState.effectiveFrom}
              onChange={(event) =>
                onChange((previous) => ({ ...previous, effectiveFrom: event.target.value }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="model-mapping-effective-to">
              {t('apiRouterPage.modelMapping.fields.effectiveTo')}
            </Label>
            <DateInput
              id="model-mapping-effective-to"
              calendarLabel={t('apiRouterPage.modelMapping.fields.effectiveTo')}
              className="h-11"
              value={formState.effectiveTo}
              onChange={(event) =>
                onChange((previous) => ({ ...previous, effectiveTo: event.target.value }))
              }
            />
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-zinc-200 bg-zinc-50/60 p-5 dark:border-zinc-800 dark:bg-zinc-900/40">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
              {t('apiRouterPage.modelMapping.fields.rules')}
            </div>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              {t('apiRouterPage.modelMapping.fields.rulesHint')}
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              onChange((previous) => ({
                ...previous,
                rules: appendModelMappingRule(previous.rules),
              }))
            }
          >
            <Plus className="h-4 w-4" />
            {t('apiRouterPage.modelMapping.actions.addRule')}
          </Button>
        </div>

        <div className="space-y-4">
          {formState.rules.map((rule, index) => (
            <MappingRuleEditor
              key={`model-mapping-rule-${index}`}
              rule={rule}
              index={index}
              onOpenSelector={onOpenSelector}
              onRemove={() =>
                onChange((previous) => ({
                  ...previous,
                  rules: removeModelMappingRule(previous.rules, index),
                }))
              }
            />
          ))}
        </div>
      </section>

      <div className="flex justify-end">
        <Button type="submit" className="min-w-[10rem]">
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

export function ModelMappingDialogs({
  detailItem,
  isCreateOpen,
  editingItem,
  modelCatalog,
  onCloseDetail,
  onCloseCreate,
  onCloseEdit,
  onCreate,
  onSave,
}: ModelMappingDialogsProps) {
  const { t, i18n } = useTranslation();
  const [createFormState, setCreateFormState] = useState<ModelMappingFormState>(
    createEmptyModelMappingFormState,
  );
  const [editFormState, setEditFormState] = useState<ModelMappingFormState>(
    createEmptyModelMappingFormState,
  );
  const [selectorState, setSelectorState] = useState<SelectorState | null>(null);
  const [selectorChannelId, setSelectorChannelId] = useState('');
  const [selectorSearchQuery, setSelectorSearchQuery] = useState('');

  useEffect(() => {
    if (isCreateOpen) {
      setCreateFormState(createEmptyModelMappingFormState());
    }
  }, [isCreateOpen]);

  useEffect(() => {
    if (editingItem) {
      setEditFormState(buildEditModelMappingFormState(editingItem));
    }
  }, [editingItem]);

  function openSelector(scope: 'create' | 'edit', ruleIndex: number, endpoint: ModelMappingEndpoint) {
    const currentState = scope === 'create' ? createFormState : editFormState;
    const currentRef = currentState.rules[ruleIndex]?.[endpoint];

    setSelectorState({ scope, ruleIndex, endpoint });
    setSelectorSearchQuery('');
    setSelectorChannelId(currentRef?.channelId || modelCatalog[0]?.channelId || '');
  }

  function updateRuleSelection(
    previous: ModelMappingFormState,
    ruleIndex: number,
    endpoint: ModelMappingEndpoint,
    value: ModelMappingModelRef,
  ): ModelMappingFormState {
    const nextRules = [...previous.rules];
    const currentRule = nextRules[ruleIndex] || { id: '', source: null, target: null };

    nextRules[ruleIndex] = {
      ...currentRule,
      [endpoint]: value,
    };

    return {
      ...previous,
      rules: nextRules,
    };
  }

  function handleSelectModel(value: ModelMappingModelRef) {
    if (!selectorState) {
      return;
    }

    if (selectorState.scope === 'create') {
      setCreateFormState((previous) =>
        updateRuleSelection(previous, selectorState.ruleIndex, selectorState.endpoint, value),
      );
    } else {
      setEditFormState((previous) =>
        updateRuleSelection(previous, selectorState.ruleIndex, selectorState.endpoint, value),
      );
    }

    setSelectorState(null);
  }

  const selectedCatalogChannel =
    modelCatalog.find((channel) => channel.channelId === selectorChannelId) || modelCatalog[0] || null;
  const filteredCatalogModels = selectedCatalogChannel
    ? selectedCatalogChannel.models.filter((model) =>
        [model.modelName, model.modelId]
          .join(' ')
          .toLowerCase()
          .includes(selectorSearchQuery.trim().toLowerCase()),
      )
    : [];

  return (
    <div data-slot="api-router-model-mapping-dialogs">
      <Modal
        isOpen={Boolean(detailItem)}
        onClose={onCloseDetail}
        title={t('apiRouterPage.modelMapping.dialogs.detailTitle')}
        className="max-w-5xl"
      >
        {detailItem ? (
          <div className="space-y-6">
            <section className="rounded-[28px] border border-zinc-200 bg-zinc-50/80 p-5 dark:border-zinc-800 dark:bg-zinc-900/50">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="text-xl font-semibold text-zinc-950 dark:text-zinc-50">
                    {detailItem.name}
                  </div>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                    {detailItem.description ||
                      t('apiRouterPage.modelMapping.values.noDescription')}
                  </p>
                </div>
                <ProxyProviderStatusBadge status={detailItem.status} />
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-3">
                <div className="rounded-[22px] border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                    {t('apiRouterPage.modelMapping.table.effectiveTime')}
                  </div>
                  <div className="mt-2 text-sm font-medium text-zinc-950 dark:text-zinc-50">
                    {formatDate(detailItem.effectiveFrom, i18n.language)}
                  </div>
                  <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    {t('apiRouterPage.modelMapping.values.until')}{' '}
                    {formatDate(detailItem.effectiveTo, i18n.language)}
                  </div>
                </div>
                <div className="rounded-[22px] border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                    {t('apiRouterPage.modelMapping.table.createdAt')}
                  </div>
                  <div className="mt-2 text-sm font-medium text-zinc-950 dark:text-zinc-50">
                    {formatDate(detailItem.createdAt, i18n.language)}
                  </div>
                </div>
                <div className="rounded-[22px] border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                    {t('apiRouterPage.modelMapping.fields.rules')}
                  </div>
                  <div className="mt-2 text-sm font-medium text-zinc-950 dark:text-zinc-50">
                    {t('apiRouterPage.modelMapping.values.ruleCount', {
                      count: detailItem.rules.length,
                    })}
                  </div>
                </div>
              </div>
            </section>

            <section className="space-y-4">
              {detailItem.rules.map((rule, index) => (
                <div
                  key={rule.id}
                  className="rounded-[24px] border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950"
                >
                  <div className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                    {t('apiRouterPage.modelMapping.values.ruleIndex', { index: index + 1 })}
                  </div>
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-center">
                    <div className="rounded-[20px] border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
                      <div className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                        {rule.source.modelName}
                      </div>
                      <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                        {`${rule.source.channelName} / ${rule.source.modelId}`}
                      </div>
                    </div>

                    <div className="flex justify-center">
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-primary-500/20 bg-primary-500/10 text-primary-500">
                        <ArrowRight className="h-4 w-4" />
                      </span>
                    </div>

                    <div className="rounded-[20px] border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
                      <div className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                        {rule.target.modelName}
                      </div>
                      <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                        {`${rule.target.channelName} / ${rule.target.modelId}`}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </section>
          </div>
        ) : null}
      </Modal>

      <Modal
        isOpen={isCreateOpen}
        onClose={onCloseCreate}
        title={t('apiRouterPage.modelMapping.dialogs.createTitle')}
        className="max-w-6xl"
      >
        {isCreateOpen ? (
          <ModelMappingForm
            formState={createFormState}
            onChange={(updater) => setCreateFormState((previous) => updater(previous))}
            onOpenSelector={(ruleIndex, endpoint) => openSelector('create', ruleIndex, endpoint)}
            onSubmit={(event) => {
              event.preventDefault();
              const normalized = normalizeModelMappingFormState(createFormState);

              if (!normalized) {
                toast.error(t('apiRouterPage.modelMapping.toast.validationFailed'));
                return;
              }

              onCreate(normalized);
            }}
            submitLabel={t('apiRouterPage.modelMapping.dialogs.create')}
          />
        ) : null}
      </Modal>

      <Modal
        isOpen={Boolean(editingItem)}
        onClose={onCloseEdit}
        title={t('apiRouterPage.modelMapping.dialogs.editTitle')}
        className="max-w-6xl"
      >
        {editingItem ? (
          <ModelMappingForm
            formState={editFormState}
            onChange={(updater) => setEditFormState((previous) => updater(previous))}
            onOpenSelector={(ruleIndex, endpoint) => openSelector('edit', ruleIndex, endpoint)}
            onSubmit={(event) => {
              event.preventDefault();
              const normalized = normalizeModelMappingFormState(editFormState);

              if (!normalized) {
                toast.error(t('apiRouterPage.modelMapping.toast.validationFailed'));
                return;
              }

              onSave(editingItem.id, normalized);
            }}
            submitLabel={t('apiRouterPage.modelMapping.dialogs.save')}
          />
        ) : null}
      </Modal>

      <Modal
        isOpen={Boolean(selectorState)}
        onClose={() => setSelectorState(null)}
        title={t('apiRouterPage.modelMapping.dialogs.modelSelectorTitle')}
        className="max-w-5xl"
      >
        {modelCatalog.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-zinc-300 bg-zinc-50/70 p-8 text-center text-sm leading-6 text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-400">
            {t('apiRouterPage.modelMapping.values.modelCatalogEmpty')}
          </div>
        ) : (
          <div className="flex flex-col gap-4 lg:flex-row">
            <aside className="w-full shrink-0 lg:w-[13rem]">
              <div className="rounded-[24px] border border-zinc-200 bg-zinc-50/70 p-2 dark:border-zinc-800 dark:bg-zinc-900/50">
                <div className="max-h-[28rem] space-y-1 overflow-y-auto">
                  {modelCatalog.map((channel) => {
                    const isActive = channel.channelId === selectedCatalogChannel?.channelId;

                    return (
                      <button
                        key={channel.channelId}
                        type="button"
                        onClick={() => setSelectorChannelId(channel.channelId)}
                        className={cn(
                          'flex w-full items-center justify-between rounded-2xl px-3 py-2.5 text-left text-sm font-medium transition',
                          isActive
                            ? 'bg-zinc-950 text-white dark:bg-zinc-100 dark:text-zinc-950'
                            : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-50',
                        )}
                      >
                        <span className="truncate">{channel.channelName}</span>
                        <span className="text-xs opacity-80">{channel.models.length}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </aside>

            <div className="min-w-0 flex-1">
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <Input
                  value={selectorSearchQuery}
                  onChange={(event) => setSelectorSearchQuery(event.target.value)}
                  placeholder={t('apiRouterPage.modelMapping.placeholders.searchModel')}
                  className="h-11 rounded-2xl bg-white pl-11 dark:bg-zinc-950"
                />
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {filteredCatalogModels.map((model) => {
                  const value: ModelMappingModelRef = {
                    channelId: selectedCatalogChannel?.channelId || '',
                    channelName: selectedCatalogChannel?.channelName || '',
                    modelId: model.modelId,
                    modelName: model.modelName,
                  };

                  return (
                    <button
                      key={`${value.channelId}-${value.modelId}`}
                      type="button"
                      onClick={() => handleSelectModel(value)}
                      className="rounded-[22px] border border-zinc-200 bg-white p-4 text-left transition hover:border-primary-500/30 hover:bg-primary-500/5 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-primary-500/30 dark:hover:bg-primary-500/10"
                    >
                      <div className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                        {value.modelName}
                      </div>
                      <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                        {value.modelId}
                      </div>
                    </button>
                  );
                })}
              </div>

              {selectedCatalogChannel && filteredCatalogModels.length === 0 ? (
                <div className="mt-4 rounded-[24px] border border-dashed border-zinc-300 bg-zinc-50/70 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-400">
                  {t('apiRouterPage.modelMapping.values.modelSelectionEmpty')}
                </div>
              ) : null}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
