import { useEffect, useState } from 'react';
import {
  Bot,
  CheckCircle2,
  Code2,
  Copy,
  RefreshCw,
  Rocket,
  Sparkles,
  TriangleAlert,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { InstanceDirectoryItem } from '@sdkwork/claw-core';
import {
  getRuntimePlatform,
  type ApiRouterInstallerOpenClawApiKeyStrategy,
} from '@sdkwork/claw-infrastructure';
import type { ModelMapping } from '@sdkwork/claw-types';
import {
  Button,
  Checkbox,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  cn,
} from '@sdkwork/claw-ui';
import type {
  ProviderAccessClientConfig,
  ProviderAccessClientId,
  ProviderAccessEnvScope,
  ProviderAccessInstallMode,
  ProviderAccessSnippetDisplayPlatform,
  ProviderAccessUnavailableReason,
} from '../services';
import {
  formatProviderAccessClientBundle,
  resolveProviderAccessSnippetDisplayPlatform,
  resolveProviderAccessSnippetTarget,
} from '../services';

export type ApiRouterUsageTabId = 'default' | ProviderAccessClientId;

export interface ProviderAccessClientInstallSelection {
  installMode: ProviderAccessInstallMode;
  envScope: ProviderAccessEnvScope;
}

export type OpenClawApiKeyStrategy = ApiRouterInstallerOpenClawApiKeyStrategy;

const OPENCLAW_MODEL_MAPPING_NONE_VALUE = '__none__';

const API_ROUTER_USAGE_TAB_IDS: ApiRouterUsageTabId[] = [
  'default',
  'codex',
  'claude-code',
  'opencode',
  'openclaw',
  'gemini',
];

function getProviderAccessClientIcon(clientId: ProviderAccessClientId) {
  switch (clientId) {
    case 'codex':
      return Bot;
    case 'claude-code':
      return Sparkles;
    case 'opencode':
      return Code2;
    case 'openclaw':
      return Rocket;
    case 'gemini':
      return Sparkles;
    default:
      return Bot;
  }
}

export function getProviderAccessClientKey(clientId: ProviderAccessClientId) {
  return `apiRouterPage.quickSetup.clients.${clientId}`;
}

function getProviderAccessReasonKey(reason: ProviderAccessUnavailableReason) {
  return `apiRouterPage.quickSetup.reasons.${reason}`;
}

function getEnvScopeLabelKey(scope: ProviderAccessEnvScope) {
  return `apiRouterPage.quickSetup.envScope.options.${scope}`;
}

function getOpenClawApiKeyStrategyLabelKey(strategy: OpenClawApiKeyStrategy) {
  return `apiRouterPage.quickSetup.openclawApiKeyStrategy.options.${strategy}`;
}

function getInstanceStatusClassName(status: InstanceDirectoryItem['status']) {
  switch (status) {
    case 'online':
      return 'bg-emerald-500';
    case 'starting':
      return 'bg-amber-500';
    case 'offline':
      return 'bg-zinc-400';
    case 'error':
      return 'bg-red-500';
  }
}

function getInstanceInitials(name: string) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  return initials.slice(0, 2) || 'OC';
}

export function sortInstancesForSelection(items: InstanceDirectoryItem[]) {
  const statusOrder: Record<InstanceDirectoryItem['status'], number> = {
    online: 0,
    starting: 1,
    offline: 2,
    error: 3,
  };

  return [...items].sort((left, right) => {
    const statusDelta = statusOrder[left.status] - statusOrder[right.status];

    if (statusDelta !== 0) {
      return statusDelta;
    }

    return left.name.localeCompare(right.name);
  });
}

export function resolveProviderAccessInstallSelection(
  client: ProviderAccessClientConfig,
  selection?: Partial<ProviderAccessClientInstallSelection> | null,
): ProviderAccessClientInstallSelection {
  const installMode =
    selection?.installMode && client.install.supportedModes.includes(selection.installMode)
      ? selection.installMode
      : client.install.defaultMode || 'standard';
  const envScope =
    selection?.envScope && client.install.supportedEnvScopes.includes(selection.envScope)
      ? selection.envScope
      : client.install.defaultEnvScope || 'user';

  return {
    installMode,
    envScope,
  };
}

export function ApiRouterUsageTabs({
  activeTab,
  ariaLabel,
  tabIdPrefix,
  onChange,
}: {
  activeTab: ApiRouterUsageTabId;
  ariaLabel: string;
  tabIdPrefix: string;
  onChange: (tabId: ApiRouterUsageTabId) => void;
}) {
  const { t } = useTranslation();

  return (
    <div
      className="rounded-[28px] border border-zinc-200 bg-zinc-50/80 p-2 dark:border-zinc-800 dark:bg-zinc-900/70"
      role="tablist"
      aria-label={ariaLabel}
    >
      <div className="flex flex-wrap gap-2">
        {API_ROUTER_USAGE_TAB_IDS.map((tabId) => {
          const isActive = tabId === activeTab;

          return (
            <Button
              key={tabId}
              type="button"
              variant="ghost"
              size="sm"
              role="tab"
              id={`${tabIdPrefix}-tab-${tabId}`}
              aria-selected={isActive}
              aria-controls={`${tabIdPrefix}-panel-${tabId}`}
              className={cn(
                'rounded-[20px] px-4 text-sm font-semibold',
                isActive
                  ? 'bg-white text-zinc-950 shadow-sm hover:bg-white dark:bg-zinc-950 dark:text-zinc-50 dark:hover:bg-zinc-950'
                  : 'text-zinc-500 hover:bg-white/80 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-950/60 dark:hover:text-zinc-50',
              )}
              onClick={() => onChange(tabId)}
            >
              {t(`apiRouterPage.quickSetup.tabs.${tabId}`)}
            </Button>
          );
        })}
      </div>
    </div>
  );
}

export function ApiRouterUsageHeaderCard({
  title,
  subtitle,
  copyLabel,
  copyDisabled = false,
  onCopy,
}: {
  title: string;
  subtitle: string;
  copyLabel: string;
  copyDisabled?: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="rounded-[24px] border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">{title}</h3>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{subtitle}</p>
        </div>
        <Button type="button" variant="outline" size="sm" disabled={copyDisabled} onClick={onCopy}>
          <Copy className="h-4 w-4" />
          {copyLabel}
        </Button>
      </div>
    </div>
  );
}

export function ApiRouterAccessClientCard({
  client,
  installSelection,
  onCopy,
  onApply,
  onInstallSelectionChange,
  isApplying,
}: {
  client: ProviderAccessClientConfig;
  installSelection: ProviderAccessClientInstallSelection;
  onCopy: (value: string) => void;
  onApply: (
    client: ProviderAccessClientConfig,
    installMode: ProviderAccessInstallMode,
    selection: ProviderAccessClientInstallSelection,
  ) => void;
  onInstallSelectionChange: (selection: ProviderAccessClientInstallSelection) => void;
  isApplying: boolean;
}) {
  const { t } = useTranslation();
  const [snippetDisplayPlatform, setSnippetDisplayPlatform] =
    useState<ProviderAccessSnippetDisplayPlatform | null>(null);
  const Icon = getProviderAccessClientIcon(client.id);
  const titleKey = getProviderAccessClientKey(client.id);
  const showEnvScopeSelector = client.install.supportedEnvScopes.length > 0;
  const hasEnvironmentVariables = client.install.environmentVariables.length > 0;
  const supportsStandardInstall = client.install.supportedModes.includes('standard');
  const supportsEnvironmentInstall =
    client.install.supportedModes.includes('env') || client.install.supportedModes.includes('both');

  useEffect(() => {
    let cancelled = false;

    async function loadSnippetDisplayPlatform() {
      try {
        const runtimeInfo = await getRuntimePlatform().getRuntimeInfo();

        if (!cancelled) {
          setSnippetDisplayPlatform(resolveProviderAccessSnippetDisplayPlatform(runtimeInfo));
        }
      } catch {
        if (!cancelled) {
          setSnippetDisplayPlatform(null);
        }
      }
    }

    void loadSnippetDisplayPlatform();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="rounded-[24px] border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary-500/10 text-primary-500">
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <div className="text-base font-semibold text-zinc-950 dark:text-zinc-50">
                {t(`${titleKey}.title`)}
              </div>
              <div className="mt-1 flex items-center gap-2 text-xs font-semibold">
                {client.available ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    <span className="text-emerald-600 dark:text-emerald-400">
                      {t('apiRouterPage.quickSetup.available')}
                    </span>
                  </>
                ) : (
                  <>
                    <TriangleAlert className="h-4 w-4 text-amber-500" />
                    <span className="text-amber-600 dark:text-amber-400">
                      {t('apiRouterPage.quickSetup.unavailable')}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-500 dark:text-zinc-400">
            {t(`${titleKey}.description`)}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {supportsStandardInstall ? (
            <Button
              type="button"
              size="sm"
              disabled={!client.available || isApplying}
              onClick={() => onApply(client, 'standard', installSelection)}
            >
              {isApplying ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Rocket className="h-4 w-4" />
              )}
              {isApplying
                ? t('apiRouterPage.quickSetup.processing')
                : client.id === 'openclaw'
                  ? t('apiRouterPage.quickSetup.selectInstances')
                  : t('apiRouterPage.quickSetup.configureLocalFiles')}
            </Button>
          ) : null}

          {client.id !== 'openclaw' && supportsEnvironmentInstall && hasEnvironmentVariables ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!client.available || isApplying}
              onClick={() => onApply(client, 'env', installSelection)}
            >
              {isApplying ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {isApplying
                ? t('apiRouterPage.quickSetup.processing')
                : t('apiRouterPage.quickSetup.configureEnvironment')}
            </Button>
          ) : null}

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!client.available}
            onClick={() => onCopy(formatProviderAccessClientBundle(client, snippetDisplayPlatform))}
          >
            <Copy className="h-4 w-4" />
            {t('apiRouterPage.quickSetup.copyAll')}
          </Button>
        </div>
      </div>

      {client.available ? (
        <div className="mt-5 space-y-4">
          {client.id !== 'openclaw' && (showEnvScopeSelector || hasEnvironmentVariables) ? (
            <div className="rounded-[20px] border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-900/70">
              {showEnvScopeSelector ? (
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                    {t('apiRouterPage.quickSetup.envScope.title')}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {client.install.supportedEnvScopes.map((scope) => {
                      const isActive = installSelection.envScope === scope;

                      return (
                        <Button
                          key={`${client.id}-${scope}`}
                          type="button"
                          size="sm"
                          variant={isActive ? 'default' : 'outline'}
                          onClick={() =>
                            onInstallSelectionChange(
                              resolveProviderAccessInstallSelection(client, {
                                installMode: 'env',
                                envScope: scope,
                              }),
                            )
                          }
                        >
                          {t(getEnvScopeLabelKey(scope))}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {hasEnvironmentVariables ? (
                <div className={cn(showEnvScopeSelector && 'mt-4')}>
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                    {t('apiRouterPage.quickSetup.environmentPreview.title')}
                  </div>
                  <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                    {t('apiRouterPage.quickSetup.environmentPreview.description')}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {client.install.environmentVariables.map((variable) => (
                      <span
                        key={`${client.id}-${variable.key}`}
                        className="inline-flex items-center rounded-full border border-primary-500/15 bg-primary-500/10 px-3 py-1 text-xs font-semibold text-primary-600 dark:border-primary-500/20 dark:text-primary-300"
                      >
                        {variable.key}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {client.id === 'openclaw' ? (
            <div className="rounded-[20px] border border-primary-500/15 bg-primary-500/5 px-4 py-3 text-sm leading-6 text-zinc-600 dark:border-primary-500/20 dark:bg-primary-500/10 dark:text-zinc-300">
              {t('apiRouterPage.quickSetup.openclawSummary')}
            </div>
          ) : null}

          {client.snippets.map((snippet) => (
            <div
              key={`${client.id}-${snippet.id}`}
              className="rounded-[20px] border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-900/70"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                    {t(`apiRouterPage.quickSetup.kinds.${snippet.kind}`)}
                  </div>
                  <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    {resolveProviderAccessSnippetTarget(snippet, snippetDisplayPlatform)}
                  </div>
                </div>

                <Button type="button" variant="outline" size="sm" onClick={() => onCopy(snippet.content)}>
                  <Copy className="h-4 w-4" />
                  {t('apiRouterPage.quickSetup.copySnippet')}
                </Button>
              </div>

              <pre className="mt-4 overflow-x-auto rounded-[18px] bg-zinc-950 p-4 text-xs leading-6 text-zinc-200">
                <code>{snippet.content}</code>
              </pre>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-5 rounded-[20px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
          {client.reason ? t(getProviderAccessReasonKey(client.reason)) : null}
        </div>
      )}
    </div>
  );
}

export function ApiRouterInstanceSelectorPanel({
  title,
  description,
  apiKeyStrategy,
  modelMappings = [],
  selectedModelMappingId = null,
  availableInstances,
  selectedInstanceIds,
  isLoading,
  isApplying,
  onApiKeyStrategyChange,
  onModelMappingChange,
  onRefresh,
  onCancel,
  onApply,
  onSelectAll,
  onClearSelection,
  onToggleInstance,
}: {
  title: string;
  description: string;
  apiKeyStrategy: OpenClawApiKeyStrategy;
  modelMappings?: ModelMapping[];
  selectedModelMappingId?: string | null;
  availableInstances: InstanceDirectoryItem[];
  selectedInstanceIds: string[];
  isLoading: boolean;
  isApplying: boolean;
  onApiKeyStrategyChange: (strategy: OpenClawApiKeyStrategy) => void;
  onModelMappingChange?: (modelMappingId: string | null) => void;
  onRefresh: () => void;
  onCancel: () => void;
  onApply: () => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onToggleInstance: (instanceId: string, isSelected: boolean) => void;
}) {
  const { t } = useTranslation();
  const selectedModelMapping =
    selectedModelMappingId &&
    modelMappings.some((item) => item.id === selectedModelMappingId)
      ? modelMappings.find((item) => item.id === selectedModelMappingId) || null
      : null;
  const modelMappingSelectionValue = selectedModelMapping?.id || OPENCLAW_MODEL_MAPPING_NONE_VALUE;
  const showModelMappingSection = Boolean(onModelMappingChange);

  return (
    <div className="space-y-5">
      <div className="rounded-[24px] border border-zinc-200 bg-zinc-50/80 p-5 dark:border-zinc-800 dark:bg-zinc-900/60">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">{title}</div>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500 dark:text-zinc-400">
              {description}
            </p>
          </div>

          <span className="inline-flex items-center rounded-full border border-primary-500/15 bg-primary-500/10 px-3 py-1 text-xs font-semibold text-primary-600 dark:border-primary-500/20 dark:text-primary-300">
            {t('apiRouterPage.quickSetup.selectionCount', {
              count: selectedInstanceIds.length,
            })}
          </span>
        </div>
      </div>

      <div className="rounded-[24px] border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
          {t('apiRouterPage.quickSetup.openclawApiKeyStrategy.title')}
        </div>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500 dark:text-zinc-400">
          {t('apiRouterPage.quickSetup.openclawApiKeyStrategy.description')}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {(['shared', 'per-instance'] as const).map((strategy) => (
            <Button
              key={strategy}
              type="button"
              size="sm"
              variant={apiKeyStrategy === strategy ? 'default' : 'outline'}
              onClick={() => onApiKeyStrategyChange(strategy)}
            >
              {t(getOpenClawApiKeyStrategyLabelKey(strategy))}
            </Button>
          ))}
        </div>
      </div>

      {showModelMappingSection ? (
        <div className="rounded-[24px] border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
            {t('apiRouterPage.quickSetup.modelMapping.title')}
          </div>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500 dark:text-zinc-400">
            {t('apiRouterPage.quickSetup.modelMapping.description')}
          </p>

          {modelMappings.length > 0 ? (
            <div className="mt-4 space-y-3">
              <Select
                value={modelMappingSelectionValue}
                onValueChange={(value) =>
                  onModelMappingChange?.(
                    value === OPENCLAW_MODEL_MAPPING_NONE_VALUE ? null : value,
                  )
                }
              >
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={OPENCLAW_MODEL_MAPPING_NONE_VALUE}>
                    {t('apiRouterPage.quickSetup.modelMapping.none')}
                  </SelectItem>
                  {modelMappings.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {`${item.name} (${t('apiRouterPage.modelMapping.values.ruleCount', {
                        count: item.rules.length,
                      })})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <p className="text-xs leading-6 text-zinc-500 dark:text-zinc-400">
                {selectedModelMapping
                  ? selectedModelMapping.description ||
                    t('apiRouterPage.modelMapping.values.noDescription')
                  : t('apiRouterPage.quickSetup.modelMapping.none')}
              </p>
            </div>
          ) : (
            <div className="mt-4 rounded-[20px] border border-dashed border-zinc-300 bg-zinc-50/80 px-4 py-3 text-sm leading-6 text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-400">
              {t('apiRouterPage.quickSetup.modelMapping.empty')}
            </div>
          )}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {t('apiRouterPage.quickSetup.selectionHint')}
        </p>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={availableInstances.length === 0}
            onClick={onSelectAll}
          >
            {t('apiRouterPage.quickSetup.selectAll')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={selectedInstanceIds.length === 0}
            onClick={onClearSelection}
          >
            {t('apiRouterPage.quickSetup.clearSelection')}
          </Button>
          <Button type="button" variant="outline" size="sm" disabled={isLoading} onClick={onRefresh}>
            <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
            {t('apiRouterPage.actions.refresh')}
          </Button>
        </div>
      </div>

      {isLoading && availableInstances.length === 0 ? (
        <div className="flex min-h-[12rem] items-center justify-center rounded-[24px] border border-dashed border-zinc-300 bg-white/70 px-6 py-10 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/50 dark:text-zinc-400">
          <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
          {t('apiRouterPage.quickSetup.loadingInstances')}
        </div>
      ) : availableInstances.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-zinc-300 bg-white/70 px-6 py-10 text-center dark:border-zinc-800 dark:bg-zinc-950/50">
          <div className="text-base font-semibold text-zinc-950 dark:text-zinc-50">
            {t('apiRouterPage.quickSetup.emptyInstancesTitle')}
          </div>
          <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
            {t('apiRouterPage.quickSetup.emptyInstancesDescription')}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {availableInstances.map((instance) => {
            const isSelected = selectedInstanceIds.includes(instance.id);

            return (
              <div
                key={instance.id}
                role="button"
                tabIndex={0}
                className={cn(
                  'rounded-[24px] border p-4 text-left transition focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-zinc-950',
                  isSelected
                    ? 'border-primary-500/40 bg-primary-500/5 dark:border-primary-500/30 dark:bg-primary-500/10'
                    : 'border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700',
                )}
                onClick={() => onToggleInstance(instance.id, !isSelected)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onToggleInstance(instance.id, !isSelected);
                  }
                }}
              >
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={isSelected}
                    className="mt-1"
                    onClick={(event) => event.stopPropagation()}
                    onCheckedChange={(checked) => onToggleInstance(instance.id, checked === true)}
                  />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-zinc-100 text-xs font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                        {getInstanceInitials(instance.name)}
                      </span>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                          {instance.name}
                        </div>
                        <div className="mt-1 truncate text-xs text-zinc-500 dark:text-zinc-400">
                          {instance.ip}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center gap-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                      <span
                        className={cn(
                          'h-2 w-2 rounded-full',
                          getInstanceStatusClassName(instance.status),
                        )}
                      />
                      {t(`apiRouterPage.quickSetup.instanceStatus.${instance.status}`)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button type="button" disabled={selectedInstanceIds.length === 0 || isApplying} onClick={onApply}>
          {isApplying ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <Rocket className="h-4 w-4" />
          )}
          {isApplying
            ? t('apiRouterPage.quickSetup.processing')
            : t('apiRouterPage.quickSetup.applyToInstances')}
        </Button>
      </div>
    </div>
  );
}
