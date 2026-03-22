import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Globe,
  Network,
  RefreshCcw,
  Router,
  Server,
  ShieldCheck,
  Sparkles,
  Wifi,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { studio } from '@sdkwork/claw-infrastructure';
import type { StudioInstanceRecord } from '@sdkwork/claw-types';

function getStatusClasses(status: StudioInstanceRecord['status']) {
  switch (status) {
    case 'online':
      return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300';
    case 'starting':
    case 'syncing':
      return 'border-amber-500/20 bg-amber-500/10 text-amber-300';
    case 'error':
      return 'border-rose-500/20 bg-rose-500/10 text-rose-300';
    default:
      return 'border-zinc-500/20 bg-zinc-500/10 text-zinc-300';
  }
}

function getDeploymentLabel(
  deploymentMode: StudioInstanceRecord['deploymentMode'],
  t: (key: string) => string,
) {
  return t(`clawUpload.deploymentModes.${deploymentMode}`);
}

function getTransportLabel(
  transportKind: StudioInstanceRecord['transportKind'],
  t: (key: string) => string,
) {
  return t(`clawUpload.transportKinds.${transportKind}`);
}

function formatLastSeen(
  instance: StudioInstanceRecord,
  locale: string,
  t: (key: string) => string,
) {
  if (!instance.lastSeenAt) {
    return t('clawUpload.notAvailable');
  }

  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(instance.lastSeenAt);
}

function RegistryField({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
        {label}
      </span>
      <span
        className={`max-w-[65%] break-all text-right text-sm text-zinc-200 ${
          mono ? 'font-mono text-[12px]' : ''
        }`}
      >
        {value}
      </span>
    </div>
  );
}

export function ClawUpload() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [openClawInstances, setOpenClawInstances] = useState<StudioInstanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const locale = typeof navigator !== 'undefined' ? navigator.language : 'en-US';

  const loadRegistry = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const registeredInstances = await studio.listInstances();
      setOpenClawInstances(
        registeredInstances.filter((instance) => instance.runtimeKind === 'openclaw'),
      );
    } catch (registryError) {
      setError(
        registryError instanceof Error
          ? registryError.message
          : t('clawUpload.loadFailedDescription'),
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadRegistry();
  }, []);

  const summary = useMemo(() => {
    const onlineCount = openClawInstances.filter((instance) => instance.status === 'online').length;
    const gatewayReadyCount = openClawInstances.filter(
      (instance) =>
        instance.transportKind === 'openclawGatewayWs' &&
        Boolean(instance.baseUrl || instance.websocketUrl),
    ).length;
    const builtInCount = openClawInstances.filter((instance) => instance.isBuiltIn).length;

    return {
      registeredCount: openClawInstances.length,
      onlineCount,
      gatewayReadyCount,
      builtInCount,
    };
  }, [openClawInstances]);

  return (
    <div className="h-full overflow-y-auto bg-zinc-50 p-6 scrollbar-hide dark:bg-zinc-950 md:p-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <section className="overflow-hidden rounded-[32px] border border-zinc-200/80 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.10)] dark:border-zinc-800/80 dark:bg-zinc-900 dark:shadow-none">
          <div className="relative overflow-hidden px-6 py-6 md:px-8 md:py-8">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(59,130,246,0.16),_transparent_48%),radial-gradient(circle_at_bottom_left,_rgba(16,185,129,0.14),_transparent_42%)]" />
            <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
              <div className="max-w-3xl">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary-500/15 bg-primary-500/8 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary-600 dark:border-primary-400/20 dark:bg-primary-400/10 dark:text-primary-300">
                  <Sparkles className="h-3.5 w-3.5" />
                  {t('clawUpload.eyebrow')}
                </div>
                <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight text-zinc-900 dark:text-white md:text-4xl">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-500/12 text-primary-500">
                    <Globe className="h-7 w-7" />
                  </div>
                  {t('clawUpload.title')}
                </h1>
                <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-600 dark:text-zinc-300">
                  {t('clawUpload.subtitle')}
                </p>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-500 dark:text-zinc-400">
                  {t('clawUpload.description')}
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => {
                    void loadRegistry();
                  }}
                  className="inline-flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  <RefreshCcw className="h-4 w-4" />
                  {t('clawUpload.refresh')}
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/api-router')}
                  className="inline-flex items-center gap-2 rounded-2xl bg-zinc-950 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-200"
                >
                  <Router className="h-4 w-4" />
                  {t('clawUpload.openApiRouter')}
                </button>
              </div>
            </div>
          </div>

          <div className="grid gap-3 border-t border-zinc-200/80 bg-zinc-50/70 p-4 dark:border-zinc-800/80 dark:bg-zinc-950/60 md:grid-cols-2 xl:grid-cols-4">
            {[
              {
                icon: Network,
                label: t('clawUpload.summary.registered'),
                value: summary.registeredCount,
              },
              {
                icon: Wifi,
                label: t('clawUpload.summary.online'),
                value: summary.onlineCount,
              },
              {
                icon: Router,
                label: t('clawUpload.summary.gatewayReady'),
                value: summary.gatewayReadyCount,
              },
              {
                icon: ShieldCheck,
                label: t('clawUpload.summary.builtIn'),
                value: summary.builtInCount,
              },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-[24px] border border-zinc-200/80 bg-white px-5 py-4 dark:border-zinc-800/80 dark:bg-zinc-900"
              >
                <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-primary-500/10 text-primary-500">
                  <item.icon className="h-5 w-5" />
                </div>
                <div className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">
                  {item.value}
                </div>
                <div className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{item.label}</div>
              </div>
            ))}
          </div>
        </section>

        {error ? (
          <section className="rounded-[28px] border border-rose-500/20 bg-rose-500/8 px-5 py-4 text-sm text-rose-200">
            <div className="font-semibold">{t('clawUpload.loadFailed')}</div>
            <div className="mt-1 text-rose-100/80">{error}</div>
          </section>
        ) : null}

        {isLoading ? (
          <section className="flex min-h-[18rem] items-center justify-center rounded-[28px] border border-zinc-200/80 bg-white dark:border-zinc-800/80 dark:bg-zinc-900">
            <div className="flex flex-col items-center gap-4 text-zinc-500 dark:text-zinc-400">
              <div className="h-9 w-9 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
              <div className="text-sm">{t('common.loading')}</div>
            </div>
          </section>
        ) : openClawInstances.length === 0 ? (
          <section className="rounded-[28px] border border-zinc-200/80 bg-white px-6 py-12 text-center dark:border-zinc-800/80 dark:bg-zinc-900">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary-500/10 text-primary-500">
              <Server className="h-10 w-10" />
            </div>
            <h2 className="mt-6 text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
              {t('clawUpload.emptyTitle')}
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-zinc-500 dark:text-zinc-400">
              {t('clawUpload.emptyDescription')}
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={() => navigate('/install')}
                className="inline-flex items-center gap-2 rounded-2xl bg-primary-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-700"
              >
                <ArrowRight className="h-4 w-4" />
                {t('clawUpload.openInstall')}
              </button>
              <button
                type="button"
                onClick={() => navigate('/instances')}
                className="inline-flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                <Server className="h-4 w-4" />
                {t('clawUpload.openInstances')}
              </button>
            </div>
          </section>
        ) : (
          <section className="grid gap-4 xl:grid-cols-2">
            {openClawInstances.map((instance, index) => (
              <motion.article
                key={instance.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: index * 0.04 }}
                className="overflow-hidden rounded-[28px] border border-zinc-200/80 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.08)] dark:border-zinc-800/80 dark:bg-zinc-900 dark:shadow-none"
              >
                <div className="border-b border-zinc-200/80 bg-[linear-gradient(135deg,_rgba(24,24,27,0.03),_rgba(59,130,246,0.06))] px-6 py-5 dark:border-zinc-800/80 dark:bg-[linear-gradient(135deg,_rgba(255,255,255,0.02),_rgba(59,130,246,0.08))]">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="truncate text-xl font-bold tracking-tight text-zinc-900 dark:text-white">
                          {instance.name}
                        </h2>
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${getStatusClasses(
                            instance.status,
                          )}`}
                        >
                          {t(`clawUpload.status.${instance.status}`)}
                        </span>
                        {instance.isBuiltIn ? (
                          <span className="inline-flex items-center rounded-full border border-primary-500/20 bg-primary-500/10 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-300">
                            {t('clawUpload.builtInBadge')}
                          </span>
                        ) : null}
                        {instance.isDefault ? (
                          <span className="inline-flex items-center rounded-full border border-zinc-500/20 bg-zinc-500/10 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-300">
                            {t('clawUpload.defaultBadge')}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-3 text-sm leading-7 text-zinc-600 dark:text-zinc-300">
                        {instance.description || t('clawUpload.noDescription')}
                      </p>
                    </div>

                    <div className="grid shrink-0 gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                      <div className="rounded-2xl border border-zinc-200/70 bg-white/80 px-3 py-2 dark:border-zinc-800/80 dark:bg-zinc-950/60">
                        {getDeploymentLabel(instance.deploymentMode, t)}
                      </div>
                      <div className="rounded-2xl border border-zinc-200/70 bg-white/80 px-3 py-2 dark:border-zinc-800/80 dark:bg-zinc-950/60">
                        {getTransportLabel(instance.transportKind, t)}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 px-6 py-5">
                  <RegistryField label={t('clawUpload.labels.instanceId')} value={instance.id} mono />
                  <RegistryField
                    label={t('clawUpload.labels.gateway')}
                    value={instance.baseUrl || t('clawUpload.notAvailable')}
                    mono
                  />
                  <RegistryField
                    label={t('clawUpload.labels.websocket')}
                    value={instance.websocketUrl || t('clawUpload.notAvailable')}
                    mono
                  />
                  <RegistryField
                    label={t('clawUpload.labels.storage')}
                    value={instance.storage.namespace}
                    mono
                  />
                  <RegistryField
                    label={t('clawUpload.labels.capabilities')}
                    value={instance.capabilities.join(' · ')}
                  />
                  <RegistryField
                    label={t('clawUpload.labels.lastSeen')}
                    value={formatLastSeen(instance, locale, t)}
                  />
                </div>

                <div className="flex flex-wrap gap-3 border-t border-zinc-200/80 px-6 py-4 dark:border-zinc-800/80">
                  <button
                    type="button"
                    onClick={() => navigate(`/instances/${instance.id}`)}
                    className="inline-flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    <Server className="h-4 w-4" />
                    {t('clawUpload.actions.viewInstance')}
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/api-router')}
                    className="inline-flex items-center gap-2 rounded-2xl bg-zinc-950 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-200"
                  >
                    <Router className="h-4 w-4" />
                    {t('clawUpload.actions.configureRouting')}
                  </button>
                </div>
              </motion.article>
            ))}
          </section>
        )}
      </div>
    </div>
  );
}
