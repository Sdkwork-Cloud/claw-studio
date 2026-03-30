import { useMemo, useState, type ReactNode } from 'react';
import { ExternalLink, Search, Wrench } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Input,
  getChannelCatalogIcon,
  getChannelCatalogMonogram,
  getChannelCatalogTone,
  getChannelOfficialLink,
} from '@sdkwork/claw-ui';
import type {
  AgentWorkbenchChannel,
  AgentWorkbenchSnapshot,
} from '../services';
import type { AgentWorkbenchTabId } from './agentWorkbenchPresentation.ts';
import { InstanceFileWorkbench } from './InstanceFileWorkbench';
import { OpenClawSkillWorkspace } from './OpenClawSkillWorkspace';

interface AgentWorkbenchDetailSectionsProps {
  activeTab: AgentWorkbenchTabId;
  snapshot: AgentWorkbenchSnapshot;
  onInstallSkill: (slug: string) => void;
  onSetSkillEnabled: (skillKey: string, enabled: boolean) => void;
  onRemoveSkill: (skill: AgentWorkbenchSnapshot['skills'][number]) => void;
  onSaveSkillConfiguration?: (input: {
    skillKey: string;
    enabled: boolean;
    apiKey?: string;
    env?: Record<string, string>;
  }) => Promise<void> | void;
  isSavingSkillSelection?: boolean;
  onSaveSkillSelection?: (
    nextConfiguredSkillNames: string[] | null,
  ) => Promise<void> | void;
  onSaveFile: (
    file: AgentWorkbenchSnapshot['files'][number],
    content: string,
  ) => Promise<void> | void;
  isReadonly: boolean;
  isInstallingSkill: boolean;
  updatingSkillKeys: string[];
  removingSkillKeys: string[];
}

function getTone(status: string) {
  if (status === 'bound' || status === 'ready' || status === 'connected' || status === 'active') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300';
  }
  if (status === 'available' || status === 'degraded' || status === 'paused' || status === 'running') {
    return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300';
  }
  if (status === 'failed') {
    return 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300';
  }
  return 'border-zinc-200 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300';
}

function formatStatus(status: string, translate: (key: string) => string) {
  const labels: Record<string, string> = {
    bound: translate('instances.detail.instanceWorkbench.agents.status.bound'),
    available: translate('instances.detail.instanceWorkbench.agents.status.available'),
    notConfigured: translate('instances.detail.instanceWorkbench.agents.status.notConfigured'),
    ready: translate('instances.detail.instanceWorkbench.agents.status.ready'),
    connected: translate('instances.detail.instanceWorkbench.agents.status.connected'),
    degraded: translate('instances.detail.instanceWorkbench.agents.status.degraded'),
    configurationRequired: translate(
      'instances.detail.instanceWorkbench.agents.status.configurationRequired',
    ),
    active: translate('instances.detail.instanceWorkbench.agents.status.active'),
    paused: translate('instances.detail.instanceWorkbench.agents.status.paused'),
    running: translate('instances.detail.instanceWorkbench.agents.status.running'),
    failed: translate('instances.detail.instanceWorkbench.agents.status.failed'),
    disconnected: translate('instances.detail.instanceWorkbench.agents.status.disconnected'),
  };
  return labels[status] || status;
}

function formatModelSource(
  source: AgentWorkbenchSnapshot['model']['source'],
  translate: (key: string) => string,
) {
  if (source === 'agent') {
    return translate('instances.detail.instanceWorkbench.agents.modelSources.agent');
  }
  if (source === 'defaults') {
    return translate('instances.detail.instanceWorkbench.agents.modelSources.defaults');
  }
  return translate('instances.detail.instanceWorkbench.agents.modelSources.runtime');
}

function humanizeToken(token: string) {
  return token
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function matchesWorkbenchQuery(
  query: string,
  values: Array<string | null | undefined>,
) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return true;
  }

  return values
    .filter((value): value is string => Boolean(value?.trim()))
    .join(' ')
    .toLowerCase()
    .includes(normalizedQuery);
}

function normalizeGatewayChannelStatus(status: AgentWorkbenchChannel['status']) {
  if (status === 'not_configured') {
    return 'notConfigured';
  }

  return status;
}

function formatGatewayChannelState(
  status: AgentWorkbenchChannel['status'],
  translate: (key: string) => string,
) {
  return formatStatus(normalizeGatewayChannelStatus(status), translate);
}

function formatRouteScope(
  channel: AgentWorkbenchChannel,
  translate: (key: string, options?: Record<string, unknown>) => string,
) {
  if (channel.routeStatus !== 'bound' || channel.accountIds.length === 0) {
    return translate('instances.detail.instanceWorkbench.agents.channels.routeScopeNone');
  }

  if (
    channel.availableAccountIds.length > 0 &&
    channel.accountIds.length >= channel.availableAccountIds.length
  ) {
    return translate('instances.detail.instanceWorkbench.agents.channels.routeScopeAll');
  }

  if (channel.accountIds.length === 1) {
    return channel.accountIds[0] || translate('instances.detail.instanceWorkbench.agents.channels.routeScopeNone');
  }

  return translate('instances.detail.instanceWorkbench.agents.channels.routeScopeMultiple', {
    count: channel.accountIds.length,
  });
}

function formatSharedSetup(channel: AgentWorkbenchChannel, translate: (key: string) => string) {
  if (channel.configurationMode === 'none') {
    return translate('instances.detail.instanceWorkbench.agents.panel.builtIn');
  }

  if (channel.fieldCount > 0) {
    return `${channel.configuredFieldCount}/${channel.fieldCount}`;
  }

  return '--';
}

function resolveRouteHint(channel: AgentWorkbenchChannel, translate: (key: string) => string) {
  if (channel.routeStatus === 'bound') {
    return translate('instances.detail.instanceWorkbench.agents.channels.routeHintBound');
  }

  if (channel.routeStatus === 'available') {
    return translate('instances.detail.instanceWorkbench.agents.channels.routeHintAvailable');
  }

  return translate('instances.detail.instanceWorkbench.agents.channels.routeHintNotConfigured');
}

function resolveAvailableAccountFallback(
  channel: AgentWorkbenchChannel,
  translate: (key: string) => string,
) {
  if (channel.configurationMode === 'none') {
    return translate('instances.detail.instanceWorkbench.agents.panel.builtIn');
  }

  return translate('instances.detail.instanceWorkbench.agents.channels.noConfiguredAccounts');
}

function AccountChipGroup({
  values,
  emptyLabel,
  tone = 'muted',
}: {
  values: string[];
  emptyLabel: string;
  tone?: 'bound' | 'available' | 'muted';
}) {
  if (values.length === 0) {
    return <div className="text-xs text-zinc-500 dark:text-zinc-400">{emptyLabel}</div>;
  }

  const toneClassName =
    tone === 'bound'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300'
      : tone === 'available'
        ? 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-300'
        : 'border-zinc-200 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300';

  return (
    <div className="flex flex-wrap gap-2">
      {values.map((value) => (
        <span
          key={value}
          className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${toneClassName}`}
        >
          {value}
        </span>
      ))}
    </div>
  );
}

function ChannelIdentity({
  channelId,
  name,
}: {
  channelId: string;
  name: string;
}) {
  const icon = getChannelCatalogIcon(channelId);

  return (
    <div
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border shadow-sm ${getChannelCatalogTone(channelId)}`}
    >
      {icon ? (
        icon
      ) : (
        <span className="text-xs font-bold uppercase tracking-[0.18em]">
          {getChannelCatalogMonogram(channelId, name)}
        </span>
      )}
    </div>
  );
}

function ChannelCardMetric({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-[1rem] bg-zinc-950/[0.03] px-3 py-3 dark:bg-white/[0.04]">
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
        {label}
      </div>
      <div className="mt-1 text-xs font-medium text-zinc-900 dark:text-zinc-100">{value}</div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  const isLongValue = typeof value === 'string' && value.length > 18;
  return (
    <div className="rounded-[1.35rem] border border-zinc-200/70 bg-white/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/35">
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
        {label}
      </div>
      <div
        className={`mt-3 font-semibold tracking-tight text-zinc-950 dark:text-zinc-50 ${isLongValue ? 'break-words text-sm leading-6' : 'text-2xl'}`}
      >
        {value}
      </div>
    </div>
  );
}

function SectionShell({
  title,
  children,
  description,
  actions,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="rounded-[1.6rem] border border-zinc-200/70 bg-white/80 p-5 dark:border-zinc-800 dark:bg-zinc-950/35">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-base font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            {title}
          </h4>
          {description ? (
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      <div className="mt-5">{children}</div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-[1.3rem] border border-dashed border-zinc-200 bg-zinc-50/80 px-4 py-4 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/30 dark:text-zinc-400">
      {message}
    </div>
  );
}

function OverviewSection({ snapshot }: { snapshot: AgentWorkbenchSnapshot }) {
  const { t } = useTranslation();
  const boundChannelCount = snapshot.channels.filter((channel) => channel.routeStatus === 'bound').length;
  const activeTaskCount = snapshot.tasks.filter((task) => task.status === 'active').length;
  const readyToolCount = snapshot.tools.filter((tool) => tool.status === 'ready').length;
  const activeTasks = snapshot.tasks.slice(0, 3);
  const boundChannels = snapshot.channels.filter((channel) => channel.routeStatus === 'bound').slice(0, 3);
  const readyTools = snapshot.tools.filter((tool) => tool.status === 'ready').slice(0, 3);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label={t('instances.detail.instanceWorkbench.metrics.automationFitScore')}
          value={`${snapshot.agent.automationFitScore}%`}
        />
        <MetricCard
          label={t('instances.detail.instanceWorkbench.sections.channels.title')}
          value={boundChannelCount}
        />
        <MetricCard
          label={t('instances.detail.instanceWorkbench.sections.cronTasks.title')}
          value={snapshot.tasks.length}
        />
        <MetricCard
          label={t('instances.detail.instanceWorkbench.sections.skills.title')}
          value={snapshot.skills.length}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <SectionShell title={t('instances.detail.instanceWorkbench.sections.llmProviders.title')}>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-[1.2rem] bg-zinc-950/[0.03] p-4 dark:bg-white/[0.04]">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                {t('instances.detail.instanceWorkbench.agents.panel.primaryModel')}
              </div>
              <div className="mt-2 break-all text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {snapshot.model.primary || t('instances.detail.instanceWorkbench.agents.panel.inheritDefaults')}
              </div>
            </div>
            <div className="rounded-[1.2rem] bg-zinc-950/[0.03] p-4 dark:bg-white/[0.04]">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                {t('instances.detail.instanceWorkbench.agents.panel.fallbackModels')}
              </div>
              <div className="mt-2 break-all text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {snapshot.model.fallbacks.length ? snapshot.model.fallbacks.join(', ') : t('common.none')}
              </div>
            </div>
            <div className="rounded-[1.2rem] bg-zinc-950/[0.03] p-4 dark:bg-white/[0.04]">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                {t('instances.detail.instanceWorkbench.agents.panel.creator')}
              </div>
              <div className="mt-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {snapshot.agent.agent.creator || t('common.none')}
              </div>
            </div>
            <div className="rounded-[1.2rem] bg-zinc-950/[0.03] p-4 dark:bg-white/[0.04]">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                {t('instances.detail.instanceWorkbench.agents.panel.source')}
              </div>
              <div className="mt-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {formatModelSource(snapshot.model.source, t)}
              </div>
            </div>
          </div>
          <div className="mt-4 grid gap-3">
            {snapshot.modelProviders.length > 0 ? (
              snapshot.modelProviders.map((provider) => (
                <div
                  key={provider.id}
                  className="rounded-[1.2rem] border border-zinc-200/70 bg-white/70 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950/30"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                        {provider.name}
                      </div>
                      <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                        {provider.endpoint || '--'}
                      </div>
                    </div>
                    <span
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${getTone(provider.status)}`}
                    >
                      {formatStatus(provider.status, t)}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState message={t('instances.detail.instanceWorkbench.empty.llmProviders')} />
            )}
          </div>
        </SectionShell>

        <SectionShell title={t('instances.detail.instanceWorkbench.agents.panel.pathsTitle')}>
          <div className="grid gap-3">
            {[
              { label: t('instances.detail.instanceWorkbench.agents.panel.workspace'), value: snapshot.paths.workspacePath },
              { label: t('instances.detail.instanceWorkbench.agents.panel.skillsDirectory'), value: snapshot.paths.skillsDirectoryPath },
              { label: t('instances.detail.instanceWorkbench.agents.panel.agentDir'), value: snapshot.paths.agentDirPath },
              { label: 'auth-profiles.json', value: snapshot.paths.authProfilesPath },
              { label: 'models.json', value: snapshot.paths.modelsRegistryPath },
              { label: t('instances.detail.instanceWorkbench.agents.panel.sessions'), value: snapshot.paths.sessionsPath },
            ].map((item) => (
              <div key={item.label} className="rounded-[1.2rem] bg-zinc-950/[0.03] px-4 py-3 dark:bg-white/[0.04]">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                  {item.label}
                </div>
                <div className="mt-2 break-all font-mono text-xs text-zinc-700 dark:text-zinc-200">
                  {item.value || '--'}
                </div>
              </div>
            ))}
          </div>
        </SectionShell>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <SectionShell title={t('instances.detail.instanceWorkbench.sections.channels.title')}>
          {boundChannels.length > 0 ? (
            <div className="space-y-3">
              {boundChannels.map((channel) => (
                <div key={channel.id} className="rounded-[1.2rem] bg-zinc-950/[0.03] px-4 py-4 dark:bg-white/[0.04]">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">{channel.name}</div>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] ${getTone(channel.routeStatus)}`}>
                      {formatStatus(channel.routeStatus, t)}
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                    {channel.accountIds.length ? channel.accountIds.join(', ') : t('common.none')}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState message={t('instances.detail.instanceWorkbench.empty.channels')} />
          )}
        </SectionShell>

      <SectionShell
        title={t('instances.detail.instanceWorkbench.sections.cronTasks.title')}
        description={t('instances.detail.instanceWorkbench.sections.cronTasks.description')}
      >
          <div className="mb-3 text-sm text-zinc-500 dark:text-zinc-400">
            {t('instances.detail.instanceWorkbench.summary.activeTasks')}: {activeTaskCount}
          </div>
          {activeTasks.length > 0 ? (
            <div className="space-y-3">
              {activeTasks.map((task) => (
                <div key={task.id} className="rounded-[1.2rem] bg-zinc-950/[0.03] px-4 py-4 dark:bg-white/[0.04]">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">{task.name}</div>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] ${getTone(task.status)}`}>
                      {formatStatus(task.status, t)}
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">{task.schedule}</div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState message={t('instances.detail.instanceWorkbench.empty.cronTasks')} />
          )}
        </SectionShell>

        <SectionShell title={t('instances.detail.instanceWorkbench.sections.tools.title')}>
          <div className="mb-3 text-sm text-zinc-500 dark:text-zinc-400">
            {t('instances.detail.instanceWorkbench.summary.readyTools')}: {readyToolCount}
          </div>
          {readyTools.length > 0 ? (
            <div className="space-y-3">
              {readyTools.map((tool) => (
                <div key={tool.id} className="rounded-[1.2rem] bg-zinc-950/[0.03] px-4 py-4 dark:bg-white/[0.04]">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">{tool.name}</div>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] ${getTone(tool.status)}`}>
                      {formatStatus(tool.status, t)}
                    </span>
                  </div>
                  <div className="mt-2 line-clamp-2 text-xs text-zinc-500 dark:text-zinc-400">
                    {tool.description}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState message={t('instances.detail.instanceWorkbench.empty.tools')} />
          )}
        </SectionShell>
      </div>
    </div>
  );
}

function ChannelsSection({ snapshot }: { snapshot: AgentWorkbenchSnapshot }) {
  const { t } = useTranslation();
  const boundChannelCount = snapshot.channels.filter((channel) => channel.routeStatus === 'bound').length;
  const boundAccountCount = snapshot.channels.reduce((sum, channel) => sum + channel.accountIds.length, 0);
  const sharedSetupRequiredCount = snapshot.channels.filter(
    (channel) => channel.routeStatus === 'notConfigured',
  ).length;

  return (
    <div className="space-y-5">
      <div className="rounded-[1.35rem] border border-sky-200/70 bg-sky-50/80 px-4 py-4 dark:border-sky-500/20 dark:bg-sky-500/10">
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-700 dark:text-sky-300">
          {t('instances.detail.instanceWorkbench.agents.channels.routingNoticeEyebrow')}
        </div>
        <p className="mt-2 text-sm leading-6 text-sky-800 dark:text-sky-100">
          {t('instances.detail.instanceWorkbench.agents.channels.routingNotice')}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          label={t('instances.detail.instanceWorkbench.agents.channels.boundChannels')}
          value={boundChannelCount}
        />
        <MetricCard
          label={t('instances.detail.instanceWorkbench.agents.panel.boundAccounts')}
          value={boundAccountCount}
        />
        <MetricCard
          label={t('instances.detail.instanceWorkbench.agents.channels.sharedSetupRequired')}
          value={sharedSetupRequiredCount}
        />
      </div>
      <SectionShell
        title={t('instances.detail.instanceWorkbench.sections.channels.title')}
        description={t('instances.detail.instanceWorkbench.agents.channels.description')}
      >
        {snapshot.channels.length > 0 ? (
          <div className="grid gap-3">
            {snapshot.channels.map((channel) => {
              const officialLink = getChannelOfficialLink(channel.id);
              const gatewayStateLabel = formatGatewayChannelState(channel.status, t);
              const routeScopeLabel = formatRouteScope(channel, t);
              const routeHint = resolveRouteHint(channel, t);

              return (
                <div
                  key={channel.id}
                  className="rounded-[1.35rem] border border-zinc-200/70 bg-white/70 p-4 dark:border-zinc-800 dark:bg-zinc-950/30"
                >
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="flex items-start gap-4">
                      <ChannelIdentity channelId={channel.id} name={channel.name} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                            {channel.name}
                          </div>
                          <span
                            className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${getTone(channel.routeStatus)}`}
                          >
                            {formatStatus(channel.routeStatus, t)}
                          </span>
                          <span
                            className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${getTone(normalizeGatewayChannelStatus(channel.status))}`}
                          >
                            {gatewayStateLabel}
                          </span>
                        </div>
                        <div className="mt-1 text-xs leading-6 text-zinc-500 dark:text-zinc-400">
                          {channel.description}
                        </div>
                      </div>
                    </div>

                    {officialLink ? (
                      <Button variant="outline" className="rounded-2xl px-3 py-2" asChild>
                        <a href={officialLink.href} target="_blank" rel="noreferrer">
                          {t('instances.detail.instanceWorkbench.agents.channels.openGuide')}
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    ) : null}
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <ChannelCardMetric
                      label={t('instances.detail.instanceWorkbench.agents.channels.sharedSetup')}
                      value={formatSharedSetup(channel, t)}
                    />
                    <ChannelCardMetric
                      label={t('instances.detail.instanceWorkbench.metrics.deliveryState')}
                      value={
                        channel.enabled
                          ? t('instances.detail.instanceWorkbench.state.enabled')
                          : t('instances.detail.instanceWorkbench.state.pending')
                      }
                    />
                    <ChannelCardMetric
                      label={t('instances.detail.instanceWorkbench.agents.channels.routeScope')}
                      value={routeScopeLabel}
                    />
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="rounded-[1rem] bg-zinc-950/[0.03] px-3 py-3 dark:bg-white/[0.04]">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                        {t('instances.detail.instanceWorkbench.agents.panel.boundAccounts')}
                      </div>
                      <div className="mt-3">
                        <AccountChipGroup
                          values={channel.accountIds}
                          emptyLabel={t('instances.detail.instanceWorkbench.agents.channels.noBoundAccounts')}
                          tone="bound"
                        />
                      </div>
                    </div>

                    <div className="rounded-[1rem] bg-zinc-950/[0.03] px-3 py-3 dark:bg-white/[0.04]">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                        {t('instances.detail.instanceWorkbench.agents.panel.availableAccounts')}
                      </div>
                      <div className="mt-3">
                        <AccountChipGroup
                          values={channel.availableAccountIds}
                          emptyLabel={resolveAvailableAccountFallback(channel, t)}
                          tone="available"
                        />
                      </div>
                    </div>
                  </div>

                  <div
                    className={`mt-4 rounded-[1rem] border px-3 py-3 text-xs leading-6 ${
                      channel.routeStatus === 'bound'
                        ? 'border-emerald-200 bg-emerald-50/80 text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-100'
                        : channel.routeStatus === 'available'
                          ? 'border-amber-200 bg-amber-50/80 text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-100'
                          : 'border-zinc-200 bg-zinc-50/80 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-200'
                    }`}
                  >
                    <div>{routeHint}</div>
                    {channel.routeStatus === 'notConfigured' && channel.setupSteps[0] ? (
                      <div className="mt-2 text-[11px]">
                        {channel.setupSteps[0]}
                      </div>
                    ) : null}
                    <div className="mt-2 text-[11px] opacity-80">
                      {t('instances.detail.instanceWorkbench.agents.channels.sharedConfigHint')}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState message={t('instances.detail.instanceWorkbench.empty.channels')} />
        )}
      </SectionShell>
    </div>
  );
}

function CronTasksSection({ snapshot }: { snapshot: AgentWorkbenchSnapshot }) {
  const { t } = useTranslation();

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          label={t('instances.detail.instanceWorkbench.summary.activeTasks')}
          value={snapshot.tasks.filter((task) => task.status === 'active').length}
        />
        <MetricCard
          label={t('instances.detail.instanceWorkbench.metrics.nextRun')}
          value={snapshot.tasks.find((task) => task.nextRun)?.nextRun || '--'}
        />
        <MetricCard
          label={t('instances.detail.instanceWorkbench.metrics.lastRun')}
          value={snapshot.tasks.find((task) => task.lastRun)?.lastRun || '--'}
        />
      </div>
      <SectionShell
        title={t('instances.detail.instanceWorkbench.sections.cronTasks.title')}
        description={t('instances.detail.instanceWorkbench.sections.cronTasks.description')}
      >
        {snapshot.tasks.length > 0 ? (
          <div className="grid gap-3">
            {snapshot.tasks.map((task) => (
              <div key={task.id} className="rounded-[1.35rem] border border-zinc-200/70 bg-white/70 p-4 dark:border-zinc-800 dark:bg-zinc-950/30">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">{task.name}</div>
                    <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{task.schedule}</div>
                    <div className="mt-2 line-clamp-2 max-w-3xl text-xs leading-6 text-zinc-500 dark:text-zinc-400">
                      {task.prompt}
                    </div>
                  </div>
                  <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${getTone(task.status)}`}>
                    {formatStatus(task.status, t)}
                  </span>
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <div className="rounded-[1rem] bg-zinc-950/[0.03] px-3 py-3 dark:bg-white/[0.04]">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                      {t('instances.detail.instanceWorkbench.metrics.nextRun')}
                    </div>
                    <div className="mt-1 text-xs text-zinc-900 dark:text-zinc-100">{task.nextRun || '--'}</div>
                  </div>
                  <div className="rounded-[1rem] bg-zinc-950/[0.03] px-3 py-3 dark:bg-white/[0.04]">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                      {t('instances.detail.instanceWorkbench.metrics.lastRun')}
                    </div>
                    <div className="mt-1 text-xs text-zinc-900 dark:text-zinc-100">{task.lastRun || '--'}</div>
                  </div>
                  <div className="rounded-[1rem] bg-zinc-950/[0.03] px-3 py-3 dark:bg-white/[0.04]">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                      {t('instances.detail.instanceWorkbench.sections.channels.title')}
                    </div>
                    <div className="mt-1 text-xs text-zinc-900 dark:text-zinc-100">{task.deliveryLabel || t('common.none')}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState message={t('instances.detail.instanceWorkbench.empty.cronTasks')} />
        )}
      </SectionShell>
    </div>
  );
}

function SkillsSection(
      props: Omit<
  AgentWorkbenchDetailSectionsProps,
    'activeTab' | 'onSaveFile'
  >,
) {
  return <OpenClawSkillWorkspace {...props} />;
}

function ToolsSection({ snapshot }: { snapshot: AgentWorkbenchSnapshot }) {
  const { t } = useTranslation();
  const [toolQuery, setToolQuery] = useState('');
  const filteredTools = useMemo(
    () =>
      snapshot.tools.filter((tool) =>
        matchesWorkbenchQuery(toolQuery, [
          tool.name,
          tool.description,
          tool.command,
          tool.category,
          tool.access,
          tool.status,
        ]),
      ),
    [snapshot.tools, toolQuery],
  );
  const groupedTools = useMemo(
    () =>
      ['automation', 'filesystem', 'integration', 'observability', 'reasoning']
        .map((category) => ({
          category,
          tools: filteredTools.filter((tool) => tool.category === category),
        }))
        .filter((group) => group.tools.length > 0),
    [filteredTools],
  );

  return (
    <SectionShell
      title={t('instances.detail.instanceWorkbench.sections.tools.title')}
      description={t('instances.detail.instanceWorkbench.sections.tools.description')}
      actions={
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
          <Input
            value={toolQuery}
            onChange={(event) => setToolQuery(event.target.value)}
            placeholder={`${t('common.search')} ${t('instances.detail.instanceWorkbench.sections.tools.title')}`}
            className="pl-9"
          />
        </div>
      }
    >
      {snapshot.tools.length === 0 ? (
        <EmptyState message={t('instances.detail.instanceWorkbench.empty.tools')} />
      ) : groupedTools.length > 0 ? (
        <div className="space-y-5">
          {groupedTools.map((group) => (
            <div key={group.category} className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                  {humanizeToken(group.category)}
                </div>
                <div className="rounded-full bg-zinc-950/[0.04] px-2.5 py-1 text-[11px] font-semibold text-zinc-600 dark:bg-white/[0.06] dark:text-zinc-300">
                  {group.tools.length}
                </div>
              </div>
              <div className="grid gap-3">
                {group.tools.map((tool) => (
                  <div key={tool.id} className="rounded-[1.35rem] border border-zinc-200/70 bg-white/70 p-4 dark:border-zinc-800 dark:bg-zinc-950/30">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-zinc-950/[0.04] text-zinc-700 dark:bg-white/[0.06] dark:text-zinc-200">
                        <Wrench className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">{tool.name}</div>
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] ${getTone(tool.status)}`}>
                            {formatStatus(tool.status, t)}
                          </span>
                          <span className="rounded-full bg-zinc-950/[0.04] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-600 dark:bg-white/[0.06] dark:text-zinc-300">
                            {humanizeToken(tool.access)}
                          </span>
                        </div>
                        <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{tool.description}</div>
                        <div className="mt-3 rounded-2xl bg-zinc-950/[0.03] px-3 py-3 font-mono text-xs text-zinc-600 dark:bg-white/[0.04] dark:text-zinc-300">
                          {tool.command || tool.id}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState message={t('common.noResults')} />
      )}
    </SectionShell>
  );
}

function FilesSection({
  snapshot,
  onSaveFile,
}: {
  snapshot: AgentWorkbenchSnapshot;
  onSaveFile: (
    file: AgentWorkbenchSnapshot['files'][number],
    content: string,
  ) => Promise<void> | void;
}) {
  const { t } = useTranslation();

  return (
    <SectionShell
      title={t('instances.detail.instanceWorkbench.sections.files.title')}
      description={t('instances.detail.instanceWorkbench.sections.files.description')}
    >
      {snapshot.files.length > 0 ? (
        <div data-slot="agent-workbench-files">
          <InstanceFileWorkbench
            files={snapshot.files}
            workspacePath={snapshot.paths.workspacePath}
            onSaveFile={onSaveFile}
          />
        </div>
      ) : (
        <EmptyState message={t('instances.detail.instanceWorkbench.empty.files')} />
      )}
    </SectionShell>
  );
}

export function AgentWorkbenchDetailSections(props: AgentWorkbenchDetailSectionsProps) {
  const { activeTab, snapshot } = props;

  switch (activeTab) {
    case 'overview':
      return <OverviewSection snapshot={snapshot} />;
    case 'channels':
      return <ChannelsSection snapshot={snapshot} />;
    case 'cronTasks':
      return <CronTasksSection snapshot={snapshot} />;
    case 'skills':
      return <SkillsSection {...props} />;
    case 'tools':
      return <ToolsSection snapshot={snapshot} />;
    case 'files':
      return (
        <FilesSection
          snapshot={snapshot}
          onSaveFile={props.onSaveFile}
        />
      );
    default:
      return <OverviewSection snapshot={snapshot} />;
  }
}
