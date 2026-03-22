import { useEffect, useState, type FormEvent } from 'react';
import {
  Link2,
  Plus,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import {
  instanceDirectoryService,
  type InstanceDirectoryItem,
} from '@sdkwork/claw-core';
import { platform } from '@sdkwork/claw-infrastructure';
import type {
  ModelMapping,
  ProxyProvider,
  ProxyProviderCreate,
  ProxyProviderGroup,
  ProxyProviderUpdate,
} from '@sdkwork/claw-types';
import {
  Button,
  DateInput,
  Input,
  Label,
  Modal,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@sdkwork/claw-ui';
import type {
  ProviderAccessClientConfig,
  ProviderAccessClientId,
  ProviderAccessInstallMode,
  ProxyProviderCreateSeed,
  ProxyProviderFormState,
} from '../services';
import {
  appendProviderFormModel,
  buildCreateProviderFormState,
  buildEditProviderFormState,
  buildProviderAccessClientConfigs,
  createEmptyProviderFormState,
  normalizeProviderEditFormState,
  normalizeProviderFormState,
  providerAccessApplyService,
  removeProviderFormModel,
} from '../services';
import {
  ApiRouterAccessClientCard,
  ApiRouterInstanceSelectorPanel,
  resolveProviderAccessInstallSelection,
  ApiRouterUsageHeaderCard,
  ApiRouterUsageTabs,
  getProviderAccessClientKey,
  sortInstancesForSelection,
  type ApiRouterUsageTabId,
  type OpenClawApiKeyStrategy,
  type ProviderAccessClientInstallSelection,
} from './ApiRouterAccessMethodShared';

interface ProxyProviderDialogsProps {
  usageProvider: ProxyProvider | null;
  createSeed: ProxyProviderCreateSeed | null;
  editingProvider: ProxyProvider | null;
  groups: ProxyProviderGroup[];
  modelMappings: ModelMapping[];
  onCloseUsage: () => void;
  onCloseCreate: () => void;
  onCloseEdit: () => void;
  onCreate: (input: ProxyProviderCreate) => void;
  onSave: (providerId: string, update: ProxyProviderUpdate) => void;
  onCopyApiKey: (provider: ProxyProvider) => void;
}

function buildCurlExample(provider: ProxyProvider) {
  const model = provider.models[0]?.id || 'model-id';
  return `curl ${provider.baseUrl}/chat/completions \\
  -H "Authorization: Bearer ${provider.apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${model}",
    "messages": [
      { "role": "user", "content": "Ping API Router" }
    ]
  }'`;
}

function ProviderUsageDefaultPanel({ provider }: { provider: ProxyProvider }) {
  const { t } = useTranslation();
  const canRevealSecret = provider.canCopyApiKey !== false && Boolean(provider.apiKey);

  return (
    <div className="space-y-5">
      <div className="grid gap-5 md:grid-cols-2">
        <div className="rounded-[24px] border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            <Link2 className="h-4 w-4 text-primary-500" />
            {t('apiRouterPage.detail.baseUrl')}
          </div>
          <div className="mt-3 break-all text-sm text-zinc-600 dark:text-zinc-300">
            {provider.baseUrl}
          </div>
        </div>

        <div className="rounded-[24px] border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {t('apiRouterPage.detail.authHeader')}
          </div>
          <div className="mt-3 break-all text-sm text-zinc-600 dark:text-zinc-300">
            {canRevealSecret
              ? `Authorization: Bearer ${provider.apiKey}`
              : t('apiRouterPage.detail.secretUnavailable')}
          </div>
        </div>
      </div>

      <div className="rounded-[24px] border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {t('apiRouterPage.detail.models')}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {provider.models.map((model) => (
            <span
              key={model.id}
              className="inline-flex items-center gap-1 rounded-full border border-primary-500/20 bg-primary-500/10 px-3 py-1 text-xs font-semibold text-primary-400"
              title={model.id}
            >
              <span>{model.name}</span>
              {model.name !== model.id ? (
                <span className="font-mono text-primary-300/80">{model.id}</span>
              ) : null}
            </span>
          ))}
        </div>
      </div>

      <div className="rounded-[24px] border border-zinc-200 bg-zinc-950 p-5 dark:border-zinc-800">
        <div className="text-sm font-semibold text-zinc-100">
          {t('apiRouterPage.dialogs.exampleRequest')}
        </div>
        {canRevealSecret ? (
          <pre className="mt-4 overflow-x-auto text-sm leading-6 text-zinc-300">
            <code>{buildCurlExample(provider)}</code>
          </pre>
        ) : (
          <p className="mt-4 text-sm leading-6 text-zinc-300">
            {t('apiRouterPage.detail.secretUnavailable')}
          </p>
        )}
      </div>

      {provider.notes ? (
        <div className="rounded-[24px] border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {t('apiRouterPage.detail.notes')}
          </div>
          <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
            {provider.notes}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function ProviderModelEditor({
  formState,
  onChange,
}: {
  formState: ProxyProviderFormState;
  onChange: (updater: (previous: ProxyProviderFormState) => ProxyProviderFormState) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
            {t('apiRouterPage.fields.models')}
          </div>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {t('apiRouterPage.fields.modelsHint')}
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange((previous) => ({ ...previous, models: appendProviderFormModel(previous.models) }))}
        >
          <Plus className="h-4 w-4" />
          {t('apiRouterPage.actions.addModel')}
        </Button>
      </div>

      <div className="space-y-3">
        {formState.models.map((model, index) => (
          <div
            key={`provider-model-${index}`}
            className="rounded-[24px] border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-900/60"
          >
            <div className="mb-3 flex items-center gap-3">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                {t('apiRouterPage.values.modelIndex', { index: index + 1 })}
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
              <div className="space-y-2">
                <Label htmlFor={`provider-model-id-${index}`}>
                  {t('apiRouterPage.fields.modelId')}
                </Label>
                <Input
                  id={`provider-model-id-${index}`}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder={t('apiRouterPage.placeholders.modelId')}
                  className="font-mono"
                  value={model.id}
                  onChange={(event) =>
                    onChange((previous) => {
                      const nextModels = [...previous.models];
                      const currentModel = nextModels[index];
                      const nextId = event.target.value;
                      const currentName = currentModel?.name.trim() || '';
                      const currentId = currentModel?.id.trim() || '';
                      const shouldMirrorName = !currentName || currentName === currentId;

                      nextModels[index] = {
                        id: nextId,
                        name: shouldMirrorName ? nextId : currentModel?.name || '',
                      };

                      return {
                        ...previous,
                        models: nextModels,
                      };
                    })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor={`provider-model-name-${index}`}>
                  {t('apiRouterPage.fields.modelDisplayName')}
                </Label>
                <Input
                  id={`provider-model-name-${index}`}
                  placeholder={t('apiRouterPage.placeholders.modelDisplayName')}
                  value={model.name}
                  onChange={(event) =>
                    onChange((previous) => {
                      const nextModels = [...previous.models];
                      nextModels[index] = {
                        ...nextModels[index],
                        name: event.target.value,
                      };

                      return {
                        ...previous,
                        models: nextModels,
                      };
                    })
                  }
                />
              </div>

              <div className="flex items-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-11 w-11"
                  onClick={() =>
                    onChange((previous) => ({
                      ...previous,
                      models: removeProviderFormModel(previous.models, index),
                    }))
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProxyProviderForm({
  formState,
  groups,
  onChange,
  onSubmit,
  apiKeyHint,
  submitLabel,
}: {
  formState: ProxyProviderFormState;
  groups: ProxyProviderGroup[];
  onChange: (updater: (previous: ProxyProviderFormState) => ProxyProviderFormState) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  apiKeyHint: string;
  submitLabel: string;
}) {
  const { t } = useTranslation();

  return (
    <form className="space-y-6" onSubmit={onSubmit}>
      <section className="rounded-[28px] border border-zinc-200 bg-zinc-50/80 p-5 dark:border-zinc-800 dark:bg-zinc-900/50">
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="provider-name">{t('apiRouterPage.fields.name')}</Label>
            <Input
              id="provider-name"
              placeholder={t('apiRouterPage.placeholders.providerName')}
              value={formState.name}
              onChange={(event) =>
                onChange((previous) => ({ ...previous, name: event.target.value }))
              }
            />
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {t('apiRouterPage.fields.nameHint')}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="provider-group">{t('apiRouterPage.fields.group')}</Label>
            <Select
              value={formState.groupId}
              onValueChange={(value) =>
                onChange((previous) => ({ ...previous, groupId: value }))
              }
            >
              <SelectTrigger id="provider-group" className="h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {groups.map((group) => (
                  <SelectItem key={group.id} value={group.id}>
                    {group.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {t('apiRouterPage.fields.groupHint')}
            </p>
          </div>

          <div className="space-y-2 lg:col-span-2">
            <Label htmlFor="provider-api-key">{t('apiRouterPage.fields.apiKey')}</Label>
            <Input
              id="provider-api-key"
              autoComplete="off"
              spellCheck={false}
              placeholder={t('apiRouterPage.placeholders.apiKey')}
              className="h-11 font-mono"
              value={formState.apiKey}
              onChange={(event) =>
                onChange((previous) => ({ ...previous, apiKey: event.target.value }))
              }
            />
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {apiKeyHint}
            </p>
          </div>

          <div className="space-y-2 lg:col-span-2">
            <Label htmlFor="provider-base-url">{t('apiRouterPage.fields.baseUrl')}</Label>
            <Input
              id="provider-base-url"
              type="url"
              inputMode="url"
              placeholder={t('apiRouterPage.placeholders.baseUrl')}
              className="h-11 font-mono"
              value={formState.baseUrl}
              onChange={(event) =>
                onChange((previous) => ({ ...previous, baseUrl: event.target.value }))
              }
            />
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {t('apiRouterPage.fields.baseUrlHint')}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="provider-expiry">{t('apiRouterPage.fields.expiresAt')}</Label>
            <DateInput
              id="provider-expiry"
              calendarLabel={t('apiRouterPage.fields.expiresAt')}
              className="h-11"
              value={formState.expiresAt}
              onChange={(event) =>
                onChange((previous) => ({ ...previous, expiresAt: event.target.value }))
              }
            />
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {t('apiRouterPage.fields.expiresAtHint')}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="provider-notes">{t('apiRouterPage.fields.notes')}</Label>
            <Textarea
              id="provider-notes"
              placeholder={t('apiRouterPage.placeholders.notes')}
              className="min-h-[112px]"
              value={formState.notes}
              onChange={(event) =>
                onChange((previous) => ({ ...previous, notes: event.target.value }))
              }
            />
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <ProviderModelEditor formState={formState} onChange={onChange} />
      </section>

      <div className="flex justify-end">
        <Button type="submit" className="min-w-[10rem]">
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

export function ProxyProviderDialogs({
  usageProvider,
  createSeed,
  editingProvider,
  groups,
  modelMappings,
  onCloseUsage,
  onCloseCreate,
  onCloseEdit,
  onCreate,
  onSave,
  onCopyApiKey,
}: ProxyProviderDialogsProps) {
  const { t } = useTranslation();
  const [createFormState, setCreateFormState] = useState<ProxyProviderFormState>(
    createEmptyProviderFormState,
  );
  const [editFormState, setEditFormState] = useState<ProxyProviderFormState>(
    createEmptyProviderFormState,
  );
  const [activeUsageTab, setActiveUsageTab] = useState<ApiRouterUsageTabId>('default');
  const [applyingClientId, setApplyingClientId] = useState<ProviderAccessClientId | null>(null);
  const [clientInstallSelections, setClientInstallSelections] = useState<
    Partial<Record<ProviderAccessClientId, ProviderAccessClientInstallSelection>>
  >({});
  const [availableInstances, setAvailableInstances] = useState<InstanceDirectoryItem[]>([]);
  const [isLoadingInstances, setIsLoadingInstances] = useState(false);
  const [isInstanceSelectorOpen, setIsInstanceSelectorOpen] = useState(false);
  const [selectedInstanceIds, setSelectedInstanceIds] = useState<string[]>([]);
  const [openClawApiKeyStrategy, setOpenClawApiKeyStrategy] =
    useState<OpenClawApiKeyStrategy>('shared');
  const [selectedOpenClawModelMappingId, setSelectedOpenClawModelMappingId] = useState<
    string | null
  >(null);

  useEffect(() => {
    if (!createSeed) {
      return;
    }

    setCreateFormState(buildCreateProviderFormState(createSeed));
  }, [createSeed]);

  useEffect(() => {
    if (!editingProvider) {
      return;
    }

    setEditFormState(buildEditProviderFormState(editingProvider));
  }, [editingProvider]);

  useEffect(() => {
    setActiveUsageTab('default');
    setApplyingClientId(null);
    setClientInstallSelections({});
    setAvailableInstances([]);
    setIsLoadingInstances(false);
    setIsInstanceSelectorOpen(false);
    setSelectedInstanceIds([]);
    setOpenClawApiKeyStrategy('shared');
    setSelectedOpenClawModelMappingId(null);
  }, [usageProvider?.id]);

  useEffect(() => {
    if (
      selectedOpenClawModelMappingId &&
      !modelMappings.some((item) => item.id === selectedOpenClawModelMappingId)
    ) {
      setSelectedOpenClawModelMappingId(null);
    }
  }, [modelMappings, selectedOpenClawModelMappingId]);

  useEffect(() => {
    let cancelled = false;

    if (!usageProvider) {
      return;
    }

    async function loadInstances() {
      setIsLoadingInstances(true);

      try {
        const instances = await instanceDirectoryService.listInstances();

        if (cancelled) {
          return;
        }

        setAvailableInstances(sortInstancesForSelection(instances));
        setSelectedInstanceIds((previous) =>
          previous.filter((instanceId) => instances.some((instance) => instance.id === instanceId)),
        );
      } catch {
        if (!cancelled) {
          setAvailableInstances([]);
          toast.error(t('apiRouterPage.toast.instanceLoadFailed'));
        }
      } finally {
        if (!cancelled) {
          setIsLoadingInstances(false);
        }
      }
    }

    void loadInstances();

    return () => {
      cancelled = true;
    };
  }, [usageProvider, t]);

  const accessClients = usageProvider ? buildProviderAccessClientConfigs(usageProvider) : [];
  const activeAccessClient =
    activeUsageTab === 'default'
      ? null
      : accessClients.find((client) => client.id === activeUsageTab) || null;

  async function handleCopyText(value: string) {
    try {
      await platform.copy(value);
      toast.success(t('apiRouterPage.toast.accessConfigCopied'));
    } catch {
      toast.error(t('apiRouterPage.toast.accessConfigCopyFailed'));
    }
  }

  async function refreshAvailableInstances() {
    setIsLoadingInstances(true);

    try {
      const instances = await instanceDirectoryService.listInstances();
      setAvailableInstances(sortInstancesForSelection(instances));
      setSelectedInstanceIds((previous) =>
        previous.filter((instanceId) => instances.some((instance) => instance.id === instanceId)),
      );
    } catch {
      toast.error(t('apiRouterPage.toast.instanceLoadFailed'));
    } finally {
      setIsLoadingInstances(false);
    }
  }

  async function handleApplyClientSetup(
    client: ProviderAccessClientConfig,
    installMode: ProviderAccessInstallMode,
    selection: ProviderAccessClientInstallSelection,
  ) {
    if (!client.available) {
      return;
    }

    if (!usageProvider) {
      return;
    }

    if (client.id === 'openclaw') {
      setIsInstanceSelectorOpen(true);
      return;
    }

    const clientLabel = t(`${getProviderAccessClientKey(client.id)}.title`);
    setApplyingClientId(client.id);

    try {
      const result = await providerAccessApplyService.applyClientSetup(
        usageProvider,
        client,
        resolveProviderAccessInstallSelection(client, {
          ...selection,
          installMode,
        }),
      );

      if (result.writtenFileCount > 0 && result.updatedEnvironmentCount > 0) {
        toast.success(
          t('apiRouterPage.toast.clientSetupInstalledWithEnv', {
            client: clientLabel,
            files: result.writtenFileCount,
            envs: result.updatedEnvironmentCount,
          }),
        );
      } else if (result.writtenFileCount > 0) {
        toast.success(
          t('apiRouterPage.toast.clientSetupInstalled', {
            client: clientLabel,
            count: result.writtenFileCount,
          }),
        );
      } else if (result.updatedEnvironmentCount > 0) {
        toast.success(
          t('apiRouterPage.toast.clientSetupEnvUpdated', {
            client: clientLabel,
            count: result.updatedEnvironmentCount,
          }),
        );
      } else {
        toast.success(
          t('apiRouterPage.toast.clientSetupComplete', {
            client: clientLabel,
          }),
        );
      }
    } catch {
      toast.error(
        t('apiRouterPage.toast.clientSetupFailed', {
          client: clientLabel,
        }),
      );
    } finally {
      setApplyingClientId(null);
    }
  }

  function updateInstanceSelection(instanceId: string, isSelected: boolean) {
    setSelectedInstanceIds((previous) => {
      if (isSelected) {
        return previous.includes(instanceId) ? previous : [...previous, instanceId];
      }

      return previous.filter((currentId) => currentId !== instanceId);
    });
  }

  async function handleApplyOpenClawSetup() {
    if (!usageProvider) {
      return;
    }

    if (selectedInstanceIds.length === 0) {
      toast.error(t('apiRouterPage.toast.openClawNoInstanceSelected'));
      return;
    }

    setApplyingClientId('openclaw');

    try {
      const result = await providerAccessApplyService.applyOpenClawSetup(
        usageProvider,
        selectedInstanceIds,
        {
          apiKeyStrategy: openClawApiKeyStrategy,
          routerProviderId: usageProvider.id,
          modelMappingId: selectedOpenClawModelMappingId,
        },
      );
      toast.success(
        t('apiRouterPage.toast.openClawSetupApplied', {
          count: result.updatedInstanceIds.length,
        }),
      );
      setIsInstanceSelectorOpen(false);
    } catch {
      toast.error(t('apiRouterPage.toast.openClawSetupFailed'));
    } finally {
      setApplyingClientId(null);
    }
  }

  return (
    <>
      <Modal
        isOpen={Boolean(usageProvider)}
        onClose={onCloseUsage}
        title={t('apiRouterPage.dialogs.usageTitle')}
        className="max-w-5xl"
      >
        {usageProvider ? (
          <div className="space-y-6">
            <ApiRouterUsageHeaderCard
              title={usageProvider.name}
              subtitle={usageProvider.baseUrl}
              copyLabel={t('apiRouterPage.actions.copyKey')}
              copyDisabled={usageProvider.canCopyApiKey === false || !usageProvider.apiKey}
              onCopy={() => onCopyApiKey(usageProvider)}
            />

            <section className="space-y-4">
              <ApiRouterUsageTabs
                activeTab={activeUsageTab}
                ariaLabel={t('apiRouterPage.dialogs.usageTitle')}
                tabIdPrefix="provider-usage"
                onChange={setActiveUsageTab}
              />

              <div
                role="tabpanel"
                id={`provider-usage-panel-${activeUsageTab}`}
                aria-labelledby={`provider-usage-tab-${activeUsageTab}`}
              >
                {activeUsageTab === 'default' ? (
                  <ProviderUsageDefaultPanel provider={usageProvider} />
                ) : activeAccessClient ? (
                  <div className="space-y-4">
                    <div>
                      <div className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                        {t('apiRouterPage.quickSetup.title')}
                      </div>
                      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                        {t('apiRouterPage.quickSetup.description')}
                      </p>
                    </div>

                    <ApiRouterAccessClientCard
                      client={activeAccessClient}
                      installSelection={resolveProviderAccessInstallSelection(
                        activeAccessClient,
                        clientInstallSelections[activeAccessClient.id],
                      )}
                      onCopy={handleCopyText}
                      onApply={handleApplyClientSetup}
                      onInstallSelectionChange={(selection) =>
                        setClientInstallSelections((previous) => ({
                          ...previous,
                          [activeAccessClient.id]: selection,
                        }))
                      }
                      isApplying={applyingClientId === activeAccessClient.id}
                    />
                  </div>
                ) : null}
              </div>
            </section>
          </div>
        ) : null}
      </Modal>

      <Modal
        isOpen={Boolean(createSeed)}
        onClose={onCloseCreate}
        title={t('apiRouterPage.dialogs.createTitle')}
        className="max-w-4xl"
      >
        {createSeed ? (
          <ProxyProviderForm
            formState={createFormState}
            groups={groups}
            onChange={(updater) => setCreateFormState((previous) => updater(previous))}
            onSubmit={(event) => {
              event.preventDefault();
              const normalized = normalizeProviderFormState(createFormState);

              if (!normalized) {
                toast.error(t('apiRouterPage.toast.validationFailed'));
                return;
              }

              onCreate({
                channelId: createSeed.channelId,
                name: normalized.name,
                apiKey: normalized.apiKey,
                groupId: normalized.groupId,
                baseUrl: normalized.baseUrl,
                models: normalized.models,
                expiresAt: normalized.expiresAt,
                notes: normalized.notes || undefined,
              });
            }}
            apiKeyHint={t('apiRouterPage.fields.apiKeyHint')}
            submitLabel={t('apiRouterPage.dialogs.create')}
          />
        ) : null}
      </Modal>

      <Modal
        isOpen={Boolean(editingProvider)}
        onClose={onCloseEdit}
        title={t('apiRouterPage.dialogs.editTitle')}
        className="max-w-4xl"
      >
        {editingProvider ? (
          <ProxyProviderForm
            formState={editFormState}
            groups={groups}
            onChange={(updater) => setEditFormState((previous) => updater(previous))}
            onSubmit={(event) => {
              event.preventDefault();
              const normalized = normalizeProviderEditFormState(editFormState);

              if (!normalized) {
                toast.error(t('apiRouterPage.toast.validationFailedEdit'));
                return;
              }

              onSave(editingProvider.id, {
                name: normalized.name,
                apiKey: normalized.apiKey,
                groupId: normalized.groupId,
                baseUrl: normalized.baseUrl,
                models: normalized.models,
                expiresAt: normalized.expiresAt,
                notes: normalized.notes,
              });
            }}
            apiKeyHint={t('apiRouterPage.fields.apiKeyEditHint')}
            submitLabel={t('apiRouterPage.dialogs.save')}
          />
        ) : null}
      </Modal>

      <Modal
        isOpen={Boolean(usageProvider) && isInstanceSelectorOpen}
        onClose={() => setIsInstanceSelectorOpen(false)}
        title={t('apiRouterPage.dialogs.instanceSelectorTitle')}
        className="max-w-4xl"
      >
        {usageProvider ? (
          <ApiRouterInstanceSelectorPanel
            title={usageProvider.name}
            description={t('apiRouterPage.dialogs.instanceSelectorDescription', {
              provider: usageProvider.name,
            })}
            apiKeyStrategy={openClawApiKeyStrategy}
            modelMappings={modelMappings}
            selectedModelMappingId={selectedOpenClawModelMappingId}
            availableInstances={availableInstances}
            selectedInstanceIds={selectedInstanceIds}
            isLoading={isLoadingInstances}
            isApplying={applyingClientId === 'openclaw'}
            onApiKeyStrategyChange={setOpenClawApiKeyStrategy}
            onModelMappingChange={setSelectedOpenClawModelMappingId}
            onRefresh={() => {
              void refreshAvailableInstances();
            }}
            onCancel={() => setIsInstanceSelectorOpen(false)}
            onApply={() => {
              void handleApplyOpenClawSetup();
            }}
            onSelectAll={() =>
              setSelectedInstanceIds(availableInstances.map((instance) => instance.id))
            }
            onClearSelection={() => setSelectedInstanceIds([])}
            onToggleInstance={updateInstanceSelection}
          />
        ) : null}
      </Modal>
    </>
  );
}
