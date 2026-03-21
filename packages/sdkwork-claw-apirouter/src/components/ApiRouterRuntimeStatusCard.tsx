import { useTranslation } from 'react-i18next';
import type { RuntimeApiRouterRuntimeStatus } from '@sdkwork/claw-infrastructure';
import { describeApiRouterRuntimeStatus } from '../services';

export interface ApiRouterRuntimeStatusCardProps {
  status: RuntimeApiRouterRuntimeStatus;
}

function toneClassName(tone: ReturnType<typeof describeApiRouterRuntimeStatus>['tone']) {
  switch (tone) {
    case 'healthy':
      return {
        shell:
          'border-emerald-200/80 bg-emerald-50/90 text-emerald-950 dark:border-emerald-900/80 dark:bg-emerald-950/30 dark:text-emerald-100',
        badge:
          'bg-emerald-600 text-white dark:bg-emerald-400 dark:text-emerald-950',
      };
    case 'warning':
      return {
        shell:
          'border-amber-200/80 bg-amber-50/90 text-amber-950 dark:border-amber-900/80 dark:bg-amber-950/30 dark:text-amber-100',
        badge:
          'bg-amber-500 text-amber-950 dark:bg-amber-300 dark:text-amber-950',
      };
    case 'danger':
      return {
        shell:
          'border-rose-200/80 bg-rose-50/90 text-rose-950 dark:border-rose-900/80 dark:bg-rose-950/30 dark:text-rose-100',
        badge:
          'bg-rose-600 text-white dark:bg-rose-400 dark:text-rose-950',
      };
    default: {
      const exhaustiveCheck: never = tone;
      throw new Error(`Unsupported runtime tone: ${exhaustiveCheck}`);
    }
  }
}

function endpointHealthLabel(
  healthy: boolean,
  t: ReturnType<typeof useTranslation>['t'],
) {
  return healthy
    ? t('apiRouterPage.runtime.health.healthy')
    : t('apiRouterPage.runtime.health.unhealthy');
}

function portAvailabilityLabel(
  portAvailable: boolean,
  t: ReturnType<typeof useTranslation>['t'],
) {
  return portAvailable
    ? t('apiRouterPage.runtime.port.available')
    : t('apiRouterPage.runtime.port.occupied');
}

export function ApiRouterRuntimeStatusCard({
  status,
}: ApiRouterRuntimeStatusCardProps) {
  const { t } = useTranslation();
  const description = describeApiRouterRuntimeStatus(status);
  const tone = toneClassName(description.tone);

  return (
    <section
      data-slot="api-router-runtime-status-card"
      className={`rounded-[28px] border p-5 shadow-[0_18px_48px_rgba(15,23,42,0.08)] backdrop-blur ${tone.shell}`}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-[0.24em] opacity-70">
            {t('apiRouterPage.runtime.title')}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-semibold">
              {t(description.modeKey)}
            </h2>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${tone.badge}`}>
              {t(description.summaryKey)}
            </span>
          </div>
          <p className="max-w-3xl text-sm leading-6 opacity-85">
            {t('apiRouterPage.runtime.reason')}
            {': '}
            {status.reason}
          </p>
          {description.showManagedHint && description.recommendedManagedModeKey ? (
            <p className="text-sm leading-6 opacity-85">
              {t('apiRouterPage.runtime.recommendation')}
              {': '}
              {t(description.recommendedManagedModeKey)}
            </p>
          ) : null}
          {description.showConflictWarning ? (
            <p className="text-sm font-medium leading-6">
              {t('apiRouterPage.runtime.conflictHint')}
            </p>
          ) : null}
        </div>

        <dl className="grid min-w-0 gap-3 text-sm sm:grid-cols-2">
          <div className="rounded-[20px] bg-white/55 p-4 dark:bg-black/20">
            <dt className="text-xs font-semibold uppercase tracking-[0.18em] opacity-65">
              {t('apiRouterPage.runtime.sharedRoot')}
            </dt>
            <dd className="mt-2 break-all font-medium">{status.sharedRootDir}</dd>
          </div>
          <div className="rounded-[20px] bg-white/55 p-4 dark:bg-black/20">
            <dt className="text-xs font-semibold uppercase tracking-[0.18em] opacity-65">
              {t('apiRouterPage.runtime.configFile')}
            </dt>
            <dd className="mt-2 break-all font-medium">
              {status.resolvedConfigFile || t('apiRouterPage.runtime.configSource.defaults')}
            </dd>
          </div>
        </dl>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <div className="rounded-[22px] bg-white/55 p-4 dark:bg-black/20">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">
                {t('apiRouterPage.runtime.endpoint.admin')}
              </div>
              <div className="mt-1 text-xs opacity-70">{status.admin.healthUrl}</div>
            </div>
            <div className="text-right text-xs font-medium">
              <div>{endpointHealthLabel(status.admin.healthy, t)}</div>
              <div className="mt-1 opacity-70">{portAvailabilityLabel(status.admin.portAvailable, t)}</div>
            </div>
          </div>
          <div className="mt-3 text-sm">
            {t('apiRouterPage.runtime.bind')}
            {': '}
            <span className="font-medium">{status.admin.bindAddr}</span>
          </div>
        </div>

        <div className="rounded-[22px] bg-white/55 p-4 dark:bg-black/20">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">
                {t('apiRouterPage.runtime.endpoint.gateway')}
              </div>
              <div className="mt-1 text-xs opacity-70">{status.gateway.healthUrl}</div>
            </div>
            <div className="text-right text-xs font-medium">
              <div>{endpointHealthLabel(status.gateway.healthy, t)}</div>
              <div className="mt-1 opacity-70">
                {portAvailabilityLabel(status.gateway.portAvailable, t)}
              </div>
            </div>
          </div>
          <div className="mt-3 text-sm">
            {t('apiRouterPage.runtime.bind')}
            {': '}
            <span className="font-medium">{status.gateway.bindAddr}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
