import { useEffect, useState, type FormEvent } from 'react';
import {
  Check,
  KeyRound,
  Link2,
  Search,
  Shield,
  Sparkles,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  instanceDirectoryService,
  type InstanceDirectoryItem,
} from '@sdkwork/claw-core';
import { platform } from '@sdkwork/claw-infrastructure';
import type {
  ModelMapping,
  ProxyProviderGroup,
  UnifiedApiKey,
  UnifiedApiKeyCreate,
  UnifiedApiKeySource,
  UnifiedApiKeyUpdate,
} from '@sdkwork/claw-types';
import {
  Button,
  cn,
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
import {
  buildEditUnifiedApiKeyFormState,
  buildUnifiedApiKeyAccessClientConfigs,
  buildUnifiedApiKeyCurlExample,
  createEmptyUnifiedApiKeyFormState,
  normalizeUnifiedApiKeyFormState,
  resolveUnifiedApiAccessGateways,
  type ProviderAccessClientConfig,
  type ProviderAccessClientId,
  type ProviderAccessInstallMode,
  type UnifiedApiAccessGatewayCatalog,
  type UnifiedApiKeyFormState,
  unifiedApiKeyAccessService,
  UNIFIED_API_ACCESS_GATEWAYS,
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
import { ProxyProviderStatusBadge } from './ProxyProviderStatusBadge';

interface UnifiedApiKeyDialogsProps {
  usageKey: UnifiedApiKey | null;
  isCreateOpen: boolean;
  editingKey: UnifiedApiKey | null;
  associatingKey: UnifiedApiKey | null;
  groups: ProxyProviderGroup[];
  modelMappings: ModelMapping[];
  defaultGroupId: string;
  onCloseUsage: () => void;
  onCloseCreate: () => void;
  onCloseEdit: () => void;
  onCloseAssociation: () => void;
  onCreate: (input: UnifiedApiKeyCreate) => void;
  onSave: (itemId: string, update: UnifiedApiKeyUpdate) => void;
  onAssignModelMapping: (itemId: string, modelMappingId: string | null) => void;
  onCopyApiKey: (item: UnifiedApiKey) => void;
}

function UnifiedApiKeyUsageDefaultPanel({
  item,
  gateways,
}: {
  item: UnifiedApiKey;
  gateways: UnifiedApiAccessGatewayCatalog;
}) {
  const { t } = useTranslation();
  const routedClientModels = [
    {
      id: 'codex',
      model: UNIFIED_API_ACCESS_GATEWAYS.openai.defaultModel.name,
    },
    {
      id: 'claude-code',
      model: UNIFIED_API_ACCESS_GATEWAYS.anthropic.defaultModel.name,
    },
    {
      id: 'opencode',
      model: UNIFIED_API_ACCESS_GATEWAYS.openai.defaultModel.name,
    },
    {
      id: 'openclaw',
      model: UNIFIED_API_ACCESS_GATEWAYS.openai.defaultModel.name,
    },
    {
      id: 'gemini',
      model: UNIFIED_API_ACCESS_GATEWAYS.gemini.defaultModel.name,
    },
  ] as const;

  return (
    <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-3">
        <div className="rounded-[24px] border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            <Link2 className="h-4 w-4 text-primary-500" />
            {t('apiRouterPage.unifiedApiKey.detail.openaiBaseUrl')}
          </div>
          <div className="mt-3 break-all text-sm text-zinc-600 dark:text-zinc-300">
            {gateways.openai.baseUrl}
          </div>
        </div>

        <div className="rounded-[24px] border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            <Link2 className="h-4 w-4 text-primary-500" />
            {t('apiRouterPage.unifiedApiKey.detail.anthropicBaseUrl')}
          </div>
          <div className="mt-3 break-all text-sm text-zinc-600 dark:text-zinc-300">
            {gateways.anthropic.baseUrl}
          </div>
        </div>

        <div className="rounded-[24px] border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {t('apiRouterPage.detail.authHeader')}
          </div>
          <div className="mt-3 break-all text-sm text-zinc-600 dark:text-zinc-300">
            {`Authorization: Bearer ${item.apiKey}`}
          </div>
        </div>
      </div>

      <div className="rounded-[24px] border border-primary-500/15 bg-primary-500/5 px-4 py-3 text-sm leading-6 text-zinc-600 dark:border-primary-500/20 dark:bg-primary-500/10 dark:text-zinc-300">
        {t('apiRouterPage.unifiedApiKey.detail.gatewayHint')}
      </div>

      <div className="rounded-[24px] border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {t('apiRouterPage.detail.models')}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {routedClientModels.map((item) => (
            <span
              key={item.id}
              className="inline-flex items-center gap-1 rounded-full border border-primary-500/20 bg-primary-500/10 px-3 py-1 text-xs font-semibold text-primary-400"
            >
              <span>{t(`apiRouterPage.quickSetup.tabs.${item.id}`)}</span>
              <span className="text-primary-300/80">{item.model}</span>
            </span>
          ))}
        </div>
        <div className="mt-4 rounded-[20px] border border-primary-500/15 bg-primary-500/5 px-4 py-3 text-sm leading-6 text-zinc-600 dark:border-primary-500/20 dark:bg-primary-500/10 dark:text-zinc-300">
          {t('apiRouterPage.unifiedApiKey.detail.geminiGatewayHint')}
        </div>
      </div>

      <div className="rounded-[24px] border border-zinc-200 bg-zinc-950 p-5 dark:border-zinc-800">
        <div className="text-sm font-semibold text-zinc-100">
          {t('apiRouterPage.dialogs.exampleRequest')}
        </div>
        <pre className="mt-4 overflow-x-auto text-sm leading-6 text-zinc-300">
          <code>{buildUnifiedApiKeyCurlExample(item, gateways)}</code>
        </pre>
      </div>

      {item.notes ? (
        <div className="rounded-[24px] border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {t('apiRouterPage.detail.notes')}
          </div>
          <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
            {item.notes}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function UnifiedApiKeyModeSelector({
  value,
  onChange,
}: {
  value: UnifiedApiKeySource;
  onChange: (value: UnifiedApiKeySource) => void;
}) {
  const { t } = useTranslation();

  const options: Array<{
    id: UnifiedApiKeySource;
    title: string;
    description: string;
    icon: typeof Sparkles;
  }> = [
    {
      id: 'system-generated',
      title: t('apiRouterPage.unifiedApiKey.fields.generateKey'),
      description: t('apiRouterPage.unifiedApiKey.fields.generateKeyHint'),
      icon: Sparkles,
    },
    {
      id: 'custom',
      title: t('apiRouterPage.unifiedApiKey.fields.customKey'),
      description: t('apiRouterPage.unifiedApiKey.fields.customKeyHint'),
      icon: KeyRound,
    },
  ];

  return (
    <div className="space-y-2">
      <Label>{t('apiRouterPage.unifiedApiKey.fields.keyMode')}</Label>
      <div className="grid gap-3 md:grid-cols-2">
        {options.map((option) => {
          const isActive = option.id === value;
          const Icon = option.icon;

          return (
            <button
              key={option.id}
              type="button"
              className={cn(
                'rounded-[24px] border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-zinc-950',
                isActive
                  ? 'border-primary-500/35 bg-primary-500/8 shadow-[0_12px_30px_rgba(59,130,246,0.10)]'
                  : 'border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700',
              )}
              onClick={() => onChange(option.id)}
            >
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl',
                    isActive
                      ? 'bg-primary-500 text-white'
                      : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300',
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                    {option.title}
                  </div>
                  <p className="mt-1 text-xs leading-6 text-zinc-500 dark:text-zinc-400">
                    {option.description}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function UnifiedApiKeyForm({
  formState,
  groups,
  onChange,
  onSubmit,
  submitLabel,
}: {
  formState: UnifiedApiKeyFormState;
  groups: ProxyProviderGroup[];
  onChange: (updater: (previous: UnifiedApiKeyFormState) => UnifiedApiKeyFormState) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  submitLabel: string;
}) {
  const { t } = useTranslation();
  const isSystemGenerated = formState.keyMode === 'system-generated';

  return (
    <form className="space-y-6" onSubmit={onSubmit}>
      <section className="rounded-[28px] border border-zinc-200 bg-zinc-50/80 p-5 dark:border-zinc-800 dark:bg-zinc-900/50">
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="unified-api-key-name">
              {t('apiRouterPage.unifiedApiKey.fields.name')}
            </Label>
            <Input
              id="unified-api-key-name"
              placeholder={t('apiRouterPage.unifiedApiKey.placeholders.name')}
              value={formState.name}
              onChange={(event) =>
                onChange((previous) => ({ ...previous, name: event.target.value }))
              }
            />
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {t('apiRouterPage.unifiedApiKey.fields.nameHint')}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="unified-api-key-group">
              {t('apiRouterPage.unifiedApiKey.fields.group')}
            </Label>
            <Select
              value={formState.groupId}
              onValueChange={(value) =>
                onChange((previous) => ({ ...previous, groupId: value }))
              }
            >
              <SelectTrigger id="unified-api-key-group" className="h-11">
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
              {t('apiRouterPage.unifiedApiKey.fields.groupHint')}
            </p>
          </div>

          <div className="lg:col-span-2">
            <UnifiedApiKeyModeSelector
              value={formState.keyMode}
              onChange={(value) =>
                onChange((previous) => ({
                  ...previous,
                  keyMode: value,
                  apiKey: value === previous.keyMode ? previous.apiKey : '',
                }))
              }
            />
          </div>

          {isSystemGenerated ? (
            <div className="lg:col-span-2 rounded-[24px] border border-primary-500/15 bg-primary-500/8 p-4 dark:border-primary-500/20 dark:bg-primary-500/10">
              <div className="flex items-start gap-3">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary-500 text-white">
                  <Shield className="h-4 w-4" />
                </span>
                <div>
                  <div className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                    {t('apiRouterPage.unifiedApiKey.fields.systemGeneratedTitle')}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                    {formState.apiKey
                      ? t('apiRouterPage.unifiedApiKey.fields.systemGeneratedExistingHint')
                      : t('apiRouterPage.unifiedApiKey.fields.systemGeneratedCreateHint')}
                  </p>
                  {formState.apiKey ? (
                    <div className="mt-3 rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
                      {formState.apiKey.slice(0, 10)}********{formState.apiKey.slice(-4)}
                    </div>
                  ) : (
                    <div className="mt-3 rounded-2xl border border-dashed border-primary-500/25 bg-white/70 px-3 py-3 text-sm text-zinc-600 dark:border-primary-500/20 dark:bg-zinc-950/50 dark:text-zinc-300">
                      {t('apiRouterPage.unifiedApiKey.fields.systemGeneratedPreview')}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2 lg:col-span-2">
              <Label htmlFor="unified-api-key-value">
                {t('apiRouterPage.unifiedApiKey.fields.apiKey')}
              </Label>
              <Input
                id="unified-api-key-value"
                autoComplete="off"
                spellCheck={false}
                placeholder={t('apiRouterPage.unifiedApiKey.placeholders.apiKey')}
                className="h-11 font-mono"
                value={formState.apiKey}
                onChange={(event) =>
                  onChange((previous) => ({ ...previous, apiKey: event.target.value }))
                }
              />
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {t('apiRouterPage.unifiedApiKey.fields.apiKeyHint')}
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="unified-api-key-expiry">
              {t('apiRouterPage.unifiedApiKey.fields.expiresAt')}
            </Label>
            <DateInput
              id="unified-api-key-expiry"
              calendarLabel={t('apiRouterPage.unifiedApiKey.fields.expiresAt')}
              className="h-11"
              value={formState.expiresAt}
              onChange={(event) =>
                onChange((previous) => ({ ...previous, expiresAt: event.target.value }))
              }
            />
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {t('apiRouterPage.unifiedApiKey.fields.expiresAtHint')}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="unified-api-key-notes">
              {t('apiRouterPage.unifiedApiKey.fields.notes')}
            </Label>
            <Textarea
              id="unified-api-key-notes"
              rows={5}
              placeholder={t('apiRouterPage.unifiedApiKey.placeholders.notes')}
              value={formState.notes}
              onChange={(event) =>
                onChange((previous) => ({ ...previous, notes: event.target.value }))
              }
            />
          </div>
        </div>
      </section>

      <div className="flex flex-wrap justify-end gap-3">
        <Button type="submit">{submitLabel}</Button>
      </div>
    </form>
  );
}

export function UnifiedApiKeyDialogs({
  usageKey,
  isCreateOpen,
  editingKey,
  associatingKey,
  groups,
  modelMappings,
  defaultGroupId,
  onCloseUsage,
  onCloseCreate,
  onCloseEdit,
  onCloseAssociation,
  onCreate,
  onSave,
  onAssignModelMapping,
  onCopyApiKey,
}: UnifiedApiKeyDialogsProps) {
  const { t } = useTranslation();
  const [createFormState, setCreateFormState] = useState<UnifiedApiKeyFormState>(
    createEmptyUnifiedApiKeyFormState,
  );
  const [editFormState, setEditFormState] = useState<UnifiedApiKeyFormState>(
    createEmptyUnifiedApiKeyFormState,
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
  const [gatewayCatalog, setGatewayCatalog] = useState<UnifiedApiAccessGatewayCatalog>(
    UNIFIED_API_ACCESS_GATEWAYS,
  );
  const [modelMappingSearchQuery, setModelMappingSearchQuery] = useState('');
  const [selectedModelMappingId, setSelectedModelMappingId] = useState<string | null>(null);

  useEffect(() => {
    if (!isCreateOpen) {
      return;
    }

    setCreateFormState({
      ...createEmptyUnifiedApiKeyFormState(),
      groupId: defaultGroupId,
    });
  }, [defaultGroupId, isCreateOpen]);

  useEffect(() => {
    if (!editingKey) {
      return;
    }

    setEditFormState(buildEditUnifiedApiKeyFormState(editingKey));
  }, [editingKey]);

  useEffect(() => {
    if (!associatingKey) {
      setModelMappingSearchQuery('');
      setSelectedModelMappingId(null);
      return;
    }

    setModelMappingSearchQuery('');
    setSelectedModelMappingId(associatingKey.modelMappingId || null);
  }, [associatingKey]);

  useEffect(() => {
    setActiveUsageTab('default');
    setApplyingClientId(null);
    setClientInstallSelections({});
    setAvailableInstances([]);
    setIsLoadingInstances(false);
    setIsInstanceSelectorOpen(false);
    setSelectedInstanceIds([]);
    setOpenClawApiKeyStrategy('shared');
  }, [usageKey?.id]);

  useEffect(() => {
    setSelectedOpenClawModelMappingId(usageKey?.modelMappingId || null);
  }, [usageKey?.id, usageKey?.modelMappingId]);

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
    setGatewayCatalog(UNIFIED_API_ACCESS_GATEWAYS);

    if (!usageKey) {
      return;
    }

    void resolveUnifiedApiAccessGateways().then((nextGateways) => {
      if (!cancelled) {
        setGatewayCatalog(nextGateways);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [usageKey?.id]);

  useEffect(() => {
    let cancelled = false;

    if (!usageKey) {
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
  }, [usageKey, t]);

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

  const accessClients = usageKey
    ? buildUnifiedApiKeyAccessClientConfigs(usageKey, gatewayCatalog)
    : [];
  const activeAccessClient =
    activeUsageTab === 'default'
      ? null
      : accessClients.find((client) => client.id === activeUsageTab) || null;

  async function handleApplyClientSetup(
    client: ProviderAccessClientConfig,
    installMode: ProviderAccessInstallMode,
    selection: ProviderAccessClientInstallSelection,
  ) {
    if (!client.available || !usageKey) {
      return;
    }

    if (client.id === 'openclaw') {
      setIsInstanceSelectorOpen(true);
      return;
    }

    const clientLabel = t(`${getProviderAccessClientKey(client.id)}.title`);
    setApplyingClientId(client.id);

    try {
      const result = await unifiedApiKeyAccessService.applyClientSetup(
        usageKey,
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
    if (!usageKey) {
      return;
    }

    if (selectedInstanceIds.length === 0) {
      toast.error(t('apiRouterPage.toast.openClawNoInstanceSelected'));
      return;
    }

    setApplyingClientId('openclaw');

    try {
      const result = await unifiedApiKeyAccessService.applyOpenClawSetup(
        usageKey,
        selectedInstanceIds,
        {
          apiKeyStrategy: openClawApiKeyStrategy,
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

  const filteredModelMappings = modelMappings.filter((item) =>
    [
      item.name,
      item.description,
      ...item.rules.flatMap((rule) => [
        rule.source.channelName,
        rule.source.modelId,
        rule.source.modelName,
        rule.target.channelName,
        rule.target.modelId,
        rule.target.modelName,
      ]),
    ]
      .join(' ')
      .toLowerCase()
      .includes(modelMappingSearchQuery.trim().toLowerCase()),
  );

  return (
    <div data-slot="api-router-unified-key-dialogs">
      <Modal
        isOpen={Boolean(usageKey)}
        onClose={onCloseUsage}
        title={t('apiRouterPage.unifiedApiKey.dialogs.usageTitle')}
        className="max-w-5xl"
      >
        {usageKey ? (
          <div className="space-y-6">
            <ApiRouterUsageHeaderCard
              title={usageKey.name}
              subtitle={t(`apiRouterPage.unifiedApiKey.sources.${usageKey.source}`)}
              copyLabel={t('apiRouterPage.unifiedApiKey.actions.copyKey')}
              onCopy={() => onCopyApiKey(usageKey)}
            />

            <section className="space-y-4">
              <ApiRouterUsageTabs
                activeTab={activeUsageTab}
                ariaLabel={t('apiRouterPage.unifiedApiKey.dialogs.usageTitle')}
                tabIdPrefix="unified-api-key-usage"
                onChange={setActiveUsageTab}
              />

              <div
                role="tabpanel"
                id={`unified-api-key-usage-panel-${activeUsageTab}`}
                aria-labelledby={`unified-api-key-usage-tab-${activeUsageTab}`}
              >
                {activeUsageTab === 'default' ? (
                  <UnifiedApiKeyUsageDefaultPanel item={usageKey} gateways={gatewayCatalog} />
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
        isOpen={isCreateOpen}
        onClose={onCloseCreate}
        title={t('apiRouterPage.unifiedApiKey.dialogs.createTitle')}
        className="max-w-4xl"
      >
        {isCreateOpen ? (
          <UnifiedApiKeyForm
            formState={createFormState}
            groups={groups}
            onChange={(updater) => setCreateFormState((previous) => updater(previous))}
            onSubmit={(event) => {
              event.preventDefault();
              const normalized = normalizeUnifiedApiKeyFormState(createFormState);

              if (!normalized) {
                toast.error(t('apiRouterPage.unifiedApiKey.toast.validationFailed'));
                return;
              }

              onCreate({
                name: normalized.name,
                groupId: normalized.groupId,
                apiKey: normalized.apiKey,
                source: normalized.source,
                expiresAt: normalized.expiresAt,
                notes: normalized.notes || undefined,
              });
            }}
            submitLabel={t('apiRouterPage.unifiedApiKey.dialogs.create')}
          />
        ) : null}
      </Modal>

      <Modal
        isOpen={Boolean(editingKey)}
        onClose={onCloseEdit}
        title={t('apiRouterPage.unifiedApiKey.dialogs.editTitle')}
        className="max-w-4xl"
      >
        {editingKey ? (
          <UnifiedApiKeyForm
            formState={editFormState}
            groups={groups}
            onChange={(updater) => setEditFormState((previous) => updater(previous))}
            onSubmit={(event) => {
              event.preventDefault();
              const normalized = normalizeUnifiedApiKeyFormState(editFormState);

              if (!normalized) {
                toast.error(t('apiRouterPage.unifiedApiKey.toast.validationFailed'));
                return;
              }

              onSave(editingKey.id, {
                name: normalized.name,
                groupId: normalized.groupId,
                apiKey: normalized.apiKey,
                source: normalized.source,
                expiresAt: normalized.expiresAt,
                notes: normalized.notes || undefined,
              });
            }}
            submitLabel={t('apiRouterPage.unifiedApiKey.dialogs.save')}
          />
        ) : null}
      </Modal>

      <Modal
        isOpen={Boolean(associatingKey)}
        onClose={onCloseAssociation}
        title={t('apiRouterPage.unifiedApiKey.dialogs.associateModelMappingTitle')}
        className="max-w-5xl"
      >
        {associatingKey ? (
          <div className="space-y-5">
            <div className="rounded-[24px] border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
              <div className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                {associatingKey.name}
              </div>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                {t('apiRouterPage.unifiedApiKey.values.associationHint')}
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <Input
                  value={modelMappingSearchQuery}
                  onChange={(event) => setModelMappingSearchQuery(event.target.value)}
                  placeholder={t('apiRouterPage.unifiedApiKey.filters.modelMappingSearchPlaceholder')}
                  className="h-11 rounded-2xl bg-white pl-11 dark:bg-zinc-950"
                />
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={() => setSelectedModelMappingId(null)}
              >
                {t('apiRouterPage.unifiedApiKey.actions.clearModelMapping')}
              </Button>
            </div>

            {filteredModelMappings.length > 0 ? (
              <div className="grid gap-3">
                {filteredModelMappings.map((item) => {
                  const isSelected = selectedModelMappingId === item.id;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedModelMappingId(item.id)}
                      className={cn(
                        'rounded-[24px] border p-4 text-left transition',
                        isSelected
                          ? 'border-primary-500/35 bg-primary-500/8 shadow-[0_12px_30px_rgba(59,130,246,0.10)]'
                          : 'border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700',
                      )}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                            {item.name}
                          </div>
                          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                            {item.description ||
                              t('apiRouterPage.modelMapping.values.noDescription')}
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <span className="inline-flex items-center rounded-full border border-primary-500/20 bg-primary-500/10 px-3 py-1 text-xs font-semibold text-primary-500">
                              {t('apiRouterPage.modelMapping.values.ruleCount', {
                                count: item.rules.length,
                              })}
                            </span>
                            {item.rules.slice(0, 2).map((rule) => (
                              <span
                                key={rule.id}
                                className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
                              >
                                {`${rule.source.modelName} -> ${rule.target.modelName}`}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <ProxyProviderStatusBadge status={item.status} />
                          {isSelected ? (
                            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary-500 text-white">
                              <Check className="h-4 w-4" />
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-[24px] border border-dashed border-zinc-300 bg-zinc-50/70 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-400">
                {t('apiRouterPage.unifiedApiKey.values.noModelMappings')}
              </div>
            )}

            <div className="flex flex-wrap justify-end gap-3">
              <Button type="button" variant="outline" onClick={onCloseAssociation}>
                {t('common.cancel')}
              </Button>
              <Button
                type="button"
                onClick={() => onAssignModelMapping(associatingKey.id, selectedModelMappingId)}
              >
                {t('common.save')}
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        isOpen={Boolean(usageKey) && isInstanceSelectorOpen}
        onClose={() => setIsInstanceSelectorOpen(false)}
        title={t('apiRouterPage.dialogs.instanceSelectorTitle')}
        className="max-w-4xl"
      >
        {usageKey ? (
          <ApiRouterInstanceSelectorPanel
            title={usageKey.name}
            description={t('apiRouterPage.dialogs.instanceSelectorDescription', {
              provider: usageKey.name,
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
    </div>
  );
}
