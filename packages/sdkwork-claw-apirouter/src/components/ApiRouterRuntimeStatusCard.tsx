import {
  Activity,
  KeyRound,
  RefreshCw,
  ShieldCheck,
  ShieldX,
  Waypoints,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ApiRouterRuntimeStatus } from '@sdkwork/claw-infrastructure';
import { Button, cn } from '@sdkwork/claw-ui';
import {
  buildApiRouterRuntimeView,
  type ApiRouterRuntimeSignalView,
  type ApiRouterRuntimeTone,
} from '../services';

function getToneBadgeClassName(tone: ApiRouterRuntimeTone) {
  switch (tone) {
    case 'success':
      return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/15 dark:text-emerald-300';
    case 'warning':
      return 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:border-amber-500/25 dark:bg-amber-500/15 dark:text-amber-200';
    default:
      return 'border-sky-500/20 bg-sky-500/10 text-sky-700 dark:border-sky-500/25 dark:bg-sky-500/15 dark:text-sky-200';
  }
}

function getToneCardClassName(tone: ApiRouterRuntimeTone) {
  switch (tone) {
    case 'success':
      return 'border-emerald-500/15 bg-emerald-500/5 dark:border-emerald-500/20 dark:bg-emerald-500/10';
    case 'warning':
      return 'border-amber-500/15 bg-amber-500/5 dark:border-amber-500/20 dark:bg-amber-500/10';
    default:
      return 'border-sky-500/15 bg-sky-500/5 dark:border-sky-500/20 dark:bg-sky-500/10';
  }
}

function getSignalIcon(signal: ApiRouterRuntimeSignalView) {
  switch (signal.id) {
    case 'gateway':
      return Waypoints;
    case 'admin':
      return signal.ready ? ShieldCheck : ShieldX;
    case 'authSession':
      return Activity;
    case 'adminAuth':
      return KeyRound;
  }
}

function getSignalLabelKey(signalId: ApiRouterRuntimeSignalView['id']) {
  return `apiRouterPage.runtime.signals.${signalId}`;
}

function getEndpointLabelKey(endpointId: 'gateway' | 'admin') {
  return `apiRouterPage.runtime.endpoints.${endpointId}`;
}

function getProcessLabelKey(processId: 'gatewayPid' | 'adminPid') {
  return `apiRouterPage.runtime.processes.${processId}`;
}

function getPathLabelKey(pathId: 'routerHomeDir' | 'metadataDir' | 'databasePath' | 'extractionDir') {
  return `apiRouterPage.runtime.paths.${pathId}`;
}

export function ApiRouterRuntimeStatusCard({
  runtimeStatus,
  isRefreshing,
  onRefresh,
}: {
  runtimeStatus: ApiRouterRuntimeStatus;
  isRefreshing: boolean;
  onRefresh: () => void;
}) {
  const { t } = useTranslation();
  const view = buildApiRouterRuntimeView(runtimeStatus);
  const ownershipLabel = t(`apiRouterPage.runtime.ownership.values.${view.ownership.mode}`);
  const ownershipDescription = t(
    `apiRouterPage.runtime.ownership.descriptions.${view.ownership.mode}`,
  );

  return (
    <section className="rounded-[28px] border border-zinc-200/80 bg-white/92 p-5 shadow-[0_18px_48px_rgba(15,23,42,0.08)] backdrop-blur dark:border-zinc-800/80 dark:bg-zinc-950/70">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
            {t('apiRouterPage.runtime.title')}
          </div>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-500 dark:text-zinc-400">
            {t('apiRouterPage.runtime.description')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span
            className={cn(
              'inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold',
              getToneBadgeClassName(view.ownership.tone),
            )}
          >
            {ownershipLabel}
          </span>
          <Button type="button" variant="outline" size="sm" onClick={onRefresh} disabled={isRefreshing}>
            <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
            {t('apiRouterPage.actions.refresh')}
          </Button>
        </div>
      </div>

      <div
        className={cn(
          'mt-5 rounded-[24px] border px-4 py-3 text-sm leading-6',
          getToneCardClassName(view.ownership.tone),
        )}
      >
        {ownershipDescription}
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {view.signals.map((signal) => {
          const Icon = getSignalIcon(signal);

          return (
            <article
              key={signal.id}
              className={cn(
                'rounded-[24px] border p-4',
                getToneCardClassName(signal.tone),
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                    {t(getSignalLabelKey(signal.id))}
                  </div>
                  <div className="mt-3 text-lg font-semibold text-zinc-950 dark:text-zinc-50">
                    {signal.ready
                      ? t('apiRouterPage.runtime.signals.ready')
                      : t('apiRouterPage.runtime.signals.notReady')}
                  </div>
                </div>
                <div
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-2xl border',
                    getToneBadgeClassName(signal.tone),
                  )}
                >
                  <Icon className="h-5 w-5" />
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        {view.endpoints.map((endpoint) => (
          <article
            key={endpoint.id}
            className="rounded-[24px] border border-zinc-200 bg-zinc-50/80 p-5 dark:border-zinc-800 dark:bg-zinc-900/70"
          >
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
              {t(getEndpointLabelKey(endpoint.id))}
            </div>
            <div className="mt-3 break-all rounded-[20px] bg-white px-4 py-3 font-mono text-sm text-zinc-950 shadow-sm dark:bg-zinc-950 dark:text-zinc-100">
              {endpoint.url || t('apiRouterPage.runtime.values.unavailable')}
            </div>
            <dl className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                  {t('apiRouterPage.runtime.endpoints.binding')}
                </dt>
                <dd className="mt-2 break-all font-mono text-sm text-zinc-700 dark:text-zinc-300">
                  {endpoint.binding || t('apiRouterPage.runtime.values.unavailable')}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                  {t('apiRouterPage.runtime.endpoints.path')}
                </dt>
                <dd className="mt-2 break-all font-mono text-sm text-zinc-700 dark:text-zinc-300">
                  {endpoint.pathname || t('apiRouterPage.runtime.values.unavailable')}
                </dd>
              </div>
            </dl>
          </article>
        ))}
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        <article className="rounded-[24px] border border-zinc-200 bg-zinc-50/80 p-5 dark:border-zinc-800 dark:bg-zinc-900/70">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
            {t('apiRouterPage.runtime.processes.title')}
          </div>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            {view.processes.map((process) => (
              <div key={process.id}>
                <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                  {t(getProcessLabelKey(process.id))}
                </dt>
                <dd className="mt-2 font-mono text-sm text-zinc-700 dark:text-zinc-300">
                  {process.value || t('apiRouterPage.runtime.processes.unavailable')}
                </dd>
              </div>
            ))}
          </dl>
        </article>

        <article className="rounded-[24px] border border-zinc-200 bg-zinc-50/80 p-5 dark:border-zinc-800 dark:bg-zinc-900/70">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
            {t('apiRouterPage.runtime.paths.title')}
          </div>
          <dl className="mt-4 grid gap-4">
            {view.paths.map((path) => (
              <div key={path.id}>
                <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                  {t(getPathLabelKey(path.id))}
                </dt>
                <dd className="mt-2 break-all font-mono text-sm text-zinc-700 dark:text-zinc-300">
                  {path.value || t('apiRouterPage.runtime.values.unavailable')}
                </dd>
              </div>
            ))}
          </dl>
        </article>
      </div>
    </section>
  );
}
