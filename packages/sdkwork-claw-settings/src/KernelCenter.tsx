import { useEffect, useState } from 'react';
import {
  Activity,
  Box,
  Database,
  HardDrive,
  Layers3,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Waypoints,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@sdkwork/claw-ui';
import { Section } from './Shared';
import {
  kernelCenterService,
  type KernelCenterDashboard,
} from './services/index.ts';

type Translate = (key: string, options?: Record<string, unknown>) => string;

function toneClasses(tone: KernelCenterDashboard['statusTone']) {
  switch (tone) {
    case 'healthy':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300';
    case 'degraded':
      return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300';
    default:
      return 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300';
  }
}

function renderList(values: string[], emptyLabel: string) {
  if (values.length === 0) {
    return emptyLabel;
  }

  return values.join(', ');
}

function translateRuntimeState(t: Translate, state?: string | null) {
  switch (state) {
    case 'running':
      return t('settings.kernelCenter.runtimeStates.running');
    case 'starting':
      return t('settings.kernelCenter.runtimeStates.starting');
    case 'recovering':
      return t('settings.kernelCenter.runtimeStates.recovering');
    case 'degraded':
      return t('settings.kernelCenter.runtimeStates.degraded');
    case 'crashLoop':
      return t('settings.kernelCenter.runtimeStates.crashLoop');
    case 'failedSafe':
      return t('settings.kernelCenter.runtimeStates.failedSafe');
    case 'stopped':
      return t('settings.kernelCenter.runtimeStates.stopped');
    default:
      return t('settings.kernelCenter.runtimeStates.unavailable');
  }
}

function translateTopologyKind(t: Translate, kind?: string | null) {
  switch (kind) {
    case 'localManagedNative':
      return t('settings.kernelCenter.topologies.localManagedNative');
    case 'localManagedWsl':
      return t('settings.kernelCenter.topologies.localManagedWsl');
    case 'localManagedContainer':
      return t('settings.kernelCenter.topologies.localManagedContainer');
    case 'localExternal':
      return t('settings.kernelCenter.topologies.localExternal');
    case 'remoteManagedNode':
      return t('settings.kernelCenter.topologies.remoteManagedNode');
    case 'remoteAttachedNode':
      return t('settings.kernelCenter.topologies.remoteAttachedNode');
    default:
      return t('settings.kernelCenter.topologies.unknown');
  }
}

function translateServiceManager(t: Translate, serviceManager?: string | null) {
  switch (serviceManager) {
    case 'windowsService':
      return t('settings.kernelCenter.serviceManagers.windowsService');
    case 'launchdLaunchAgent':
      return t('settings.kernelCenter.serviceManagers.launchdLaunchAgent');
    case 'systemdUser':
      return t('settings.kernelCenter.serviceManagers.systemdUser');
    case 'systemdSystem':
      return t('settings.kernelCenter.serviceManagers.systemdSystem');
    case 'tauriSupervisor':
      return t('settings.kernelCenter.serviceManagers.tauriSupervisor');
    default:
      return t('settings.kernelCenter.serviceManagers.unknown');
  }
}

function translateOwnership(t: Translate, ownership?: string | null) {
  switch (ownership) {
    case 'nativeService':
      return t('settings.kernelCenter.ownership.nativeService');
    case 'appSupervisor':
      return t('settings.kernelCenter.ownership.appSupervisor');
    case 'attached':
      return t('settings.kernelCenter.ownership.attached');
    default:
      return t('settings.kernelCenter.ownership.unknown');
  }
}

function translateStartupMode(t: Translate, startupMode?: string | null) {
  switch (startupMode) {
    case 'auto':
      return t('settings.kernelCenter.startupModes.auto');
    case 'manual':
      return t('settings.kernelCenter.startupModes.manual');
    default:
      return t('settings.kernelCenter.values.unknown');
  }
}

function translateInstallSource(t: Translate, installSource?: string | null) {
  switch (installSource) {
    case 'bundled':
      return t('settings.kernelCenter.installSources.bundled');
    case 'external':
      return t('settings.kernelCenter.installSources.external');
    case 'remote':
      return t('settings.kernelCenter.installSources.remote');
    default:
      return t('settings.kernelCenter.installSources.unknown');
  }
}

function translateSupervisorLifecycle(t: Translate, lifecycle?: string | null) {
  switch (lifecycle) {
    case 'active':
      return t('settings.kernelCenter.supervisorLifecycle.active');
    case 'inactive':
      return t('settings.kernelCenter.supervisorLifecycle.inactive');
    case 'stopping':
      return t('settings.kernelCenter.supervisorLifecycle.stopping');
    default:
      return t('settings.kernelCenter.supervisorLifecycle.unknown');
  }
}

function translateBoolean(t: Translate, value: boolean) {
  return value
    ? t('settings.kernelCenter.values.yes')
    : t('settings.kernelCenter.values.no');
}

function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-[1.5rem] border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
            {label}
          </div>
          <div className="mt-2 text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            {value}
          </div>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <div className="mt-3 text-sm leading-6 text-zinc-500 dark:text-zinc-400">{detail}</div>
    </div>
  );
}

function ValueRow({
  label,
  value,
  emptyLabel,
  mono = false,
}: {
  label: string;
  value: string | null;
  emptyLabel: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-zinc-100 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
        {label}
      </div>
      <div
        className={`mt-2 break-all text-sm text-zinc-800 dark:text-zinc-200 ${mono ? 'font-mono' : ''}`}
      >
        {value || emptyLabel}
      </div>
    </div>
  );
}

export function KernelCenter() {
  const { t } = useTranslation();
  const [dashboard, setDashboard] = useState<KernelCenterDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeAction, setActiveAction] = useState<'ensure' | 'restart' | null>(null);

  const notAvailableLabel = t('settings.kernelCenter.values.notAvailable');
  const noneLabel = t('settings.kernelCenter.values.none');
  const runtimeLabel = translateRuntimeState(t, dashboard?.snapshot?.runtimeState);
  const topologyLabel = translateTopologyKind(t, dashboard?.snapshot?.topologyKind);
  const serviceManagerLabel = translateServiceManager(
    t,
    dashboard?.snapshot?.raw.host.serviceManager,
  );
  const ownershipLabel = translateOwnership(t, dashboard?.snapshot?.raw.host.ownership);
  const startupModeLabel = translateStartupMode(t, dashboard?.snapshot?.raw.host.startupMode);
  const installSourceLabel = translateInstallSource(
    t,
    dashboard?.snapshot?.raw.provenance.installSource,
  );

  const loadDashboard = async () => {
    setIsLoading(true);
    try {
      setDashboard(await kernelCenterService.getDashboard());
    } catch (error: any) {
      toast.error(error?.message || t('settings.kernelCenter.toasts.loadFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadDashboard();
  }, []);

  const handleEnsureRunning = async () => {
    setActiveAction('ensure');
    try {
      setDashboard(await kernelCenterService.ensureRunning());
      toast.success(t('settings.kernelCenter.toasts.ensureSuccess'));
    } catch (error: any) {
      toast.error(error?.message || t('settings.kernelCenter.toasts.ensureFailed'));
    } finally {
      setActiveAction(null);
    }
  };

  const handleRestart = async () => {
    setActiveAction('restart');
    try {
      setDashboard(await kernelCenterService.restart());
      toast.success(t('settings.kernelCenter.toasts.restartSuccess'));
    } catch (error: any) {
      toast.error(error?.message || t('settings.kernelCenter.toasts.restartFailed'));
    } finally {
      setActiveAction(null);
    }
  };

  if (isLoading && !dashboard) {
    return (
      <div className="mx-auto flex h-72 max-w-7xl items-center justify-center p-6 md:p-10">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div
      data-slot="kernel-center-page"
      className="scrollbar-hide mx-auto h-full max-w-7xl overflow-y-auto p-6 md:p-10"
    >
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-[2rem] border border-zinc-200/80 bg-[radial-gradient(circle_at_top_left,_rgba(244,114,182,0.12),_transparent_42%),linear-gradient(135deg,_rgba(255,255,255,0.98),_rgba(244,244,245,0.92))] p-7 shadow-sm dark:border-zinc-800 dark:bg-[radial-gradient(circle_at_top_left,_rgba(244,114,182,0.12),_transparent_40%),linear-gradient(135deg,_rgba(24,24,27,0.96),_rgba(9,9,11,0.98))]"
      >
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-500/10 text-primary-600 dark:text-primary-300">
                <Waypoints className="h-5 w-5" />
              </div>
              <span
                className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${toneClasses(
                  dashboard?.statusTone || 'warning',
                )}`}
              >
                {runtimeLabel}
              </span>
            </div>
            <h1 className="mt-5 text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              {t('sidebar.kernelCenter')}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              {t('settings.kernelCenter.description')}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={() => void loadDashboard()}
              disabled={isLoading}
              className="rounded-xl"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              {t('settings.kernelCenter.actions.refresh')}
            </Button>
            <Button
              variant="secondary"
              onClick={() => void handleEnsureRunning()}
              disabled={activeAction !== null}
              className="rounded-xl"
            >
              <ShieldCheck className="h-4 w-4" />
              {activeAction === 'ensure'
                ? t('settings.kernelCenter.actions.ensuring')
                : t('settings.kernelCenter.actions.ensureRunning')}
            </Button>
            <Button
              onClick={() => void handleRestart()}
              disabled={activeAction !== null}
              className="rounded-xl"
            >
              <RotateCcw className="h-4 w-4" />
              {activeAction === 'restart'
                ? t('settings.kernelCenter.actions.restarting')
                : t('settings.kernelCenter.actions.restart')}
            </Button>
          </div>
        </div>
      </motion.div>

      <div className="mt-8 grid grid-cols-1 gap-4 xl:grid-cols-4">
        <MetricCard
          icon={Activity}
          label={t('settings.kernelCenter.metrics.runtime')}
          value={runtimeLabel}
          detail={dashboard?.statusSummary || t('settings.kernelCenter.values.noRuntimeSummary')}
        />
        <MetricCard
          icon={Layers3}
          label={t('settings.kernelCenter.metrics.topology')}
          value={topologyLabel}
          detail={
            dashboard?.snapshot?.raw.topology.label
            || t('settings.kernelCenter.values.noTopologyReported')
          }
        />
        <MetricCard
          icon={ShieldCheck}
          label={t('settings.kernelCenter.metrics.host')}
          value={serviceManagerLabel}
          detail={ownershipLabel || t('settings.kernelCenter.values.hostOwnershipUnavailable')}
        />
        <MetricCard
          icon={Waypoints}
          label={t('settings.kernelCenter.metrics.endpoint')}
          value={dashboard?.endpoint.baseUrl || notAvailableLabel}
          detail={
            dashboard?.endpoint.usesDynamicPort
              ? t('settings.kernelCenter.endpoint.dynamicPort')
              : t('settings.kernelCenter.endpoint.preferredActive')
          }
        />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Section title={t('settings.kernelCenter.sections.hostOwnership')}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <ValueRow
              label={t('settings.kernelCenter.fields.serviceManager')}
              value={serviceManagerLabel}
              emptyLabel={notAvailableLabel}
            />
            <ValueRow
              label={t('settings.kernelCenter.fields.ownership')}
              value={ownershipLabel}
              emptyLabel={notAvailableLabel}
            />
            <ValueRow
              label={t('settings.kernelCenter.fields.startupMode')}
              value={startupModeLabel}
              emptyLabel={notAvailableLabel}
            />
            <ValueRow
              label={t('settings.kernelCenter.fields.controlSocket')}
              value={
                dashboard?.host.controlSocketLabel
                || t('settings.kernelCenter.values.notExposedYet')
              }
              emptyLabel={notAvailableLabel}
              mono
            />
            <ValueRow
              label={t('settings.kernelCenter.fields.controlSocketAvailable')}
              value={translateBoolean(t, Boolean(dashboard?.host.controlSocketAvailable))}
              emptyLabel={notAvailableLabel}
            />
            <ValueRow
              label={t('settings.kernelCenter.fields.serviceConfigPath')}
              value={dashboard?.host.serviceConfigPath || null}
              emptyLabel={notAvailableLabel}
              mono
            />
          </div>
        </Section>

        <Section title={t('settings.kernelCenter.sections.endpointRuntime')}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <ValueRow
              label={t('settings.kernelCenter.fields.baseUrl')}
              value={dashboard?.endpoint.baseUrl || null}
              emptyLabel={notAvailableLabel}
              mono
            />
            <ValueRow
              label={t('settings.kernelCenter.fields.websocketUrl')}
              value={dashboard?.endpoint.websocketUrl || null}
              emptyLabel={notAvailableLabel}
              mono
            />
            <ValueRow
              label={t('settings.kernelCenter.fields.preferredPort')}
              value={
                dashboard?.endpoint.preferredPort !== null
                  ? String(dashboard.endpoint.preferredPort)
                  : null
              }
              emptyLabel={notAvailableLabel}
            />
            <ValueRow
              label={t('settings.kernelCenter.fields.activePort')}
              value={
                dashboard?.endpoint.activePort !== null
                  ? String(dashboard.endpoint.activePort)
                  : null
              }
              emptyLabel={notAvailableLabel}
            />
            <ValueRow
              label={t('settings.kernelCenter.fields.openclawVersion')}
              value={dashboard?.provenance.openclawVersion || null}
              emptyLabel={notAvailableLabel}
            />
            <ValueRow
              label={t('settings.kernelCenter.fields.nodeVersion')}
              value={dashboard?.provenance.nodeVersion || null}
              emptyLabel={notAvailableLabel}
            />
          </div>
        </Section>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Section title={t('settings.kernelCenter.sections.storage')}>
          <div className="space-y-4">
            <ValueRow
              label={t('settings.kernelCenter.fields.activeProfile')}
              value={dashboard?.storage.activeProfileLabel || dashboard?.storage.activeProfileId || null}
              emptyLabel={notAvailableLabel}
            />
            <ValueRow
              label={t('settings.kernelCenter.fields.profilePath')}
              value={dashboard?.storage.activeProfilePath || null}
              emptyLabel={notAvailableLabel}
              mono
            />
            <ValueRow
              label={t('settings.kernelCenter.fields.storageRoot')}
              value={dashboard?.storage.rootDir || null}
              emptyLabel={notAvailableLabel}
              mono
            />
            <ValueRow
              label={t('settings.kernelCenter.fields.profileCount')}
              value={String(dashboard?.storage.profileCount || 0)}
              emptyLabel={notAvailableLabel}
            />
          </div>
        </Section>

        <Section title={t('settings.kernelCenter.sections.provenance')}>
          <div className="space-y-4">
            <ValueRow
              label={t('settings.kernelCenter.fields.installSource')}
              value={installSourceLabel}
              emptyLabel={notAvailableLabel}
            />
            <ValueRow
              label={t('settings.kernelCenter.fields.platform')}
              value={dashboard?.provenance.platformLabel || null}
              emptyLabel={notAvailableLabel}
            />
            <ValueRow
              label={t('settings.kernelCenter.fields.configPath')}
              value={dashboard?.provenance.configPath || null}
              emptyLabel={notAvailableLabel}
              mono
            />
            <ValueRow
              label={t('settings.kernelCenter.fields.runtimeHome')}
              value={dashboard?.provenance.runtimeHomeDir || null}
              emptyLabel={notAvailableLabel}
              mono
            />
            <ValueRow
              label={t('settings.kernelCenter.fields.runtimeInstallDir')}
              value={dashboard?.provenance.runtimeInstallDir || null}
              emptyLabel={notAvailableLabel}
              mono
            />
          </div>
        </Section>

        <Section title={t('settings.kernelCenter.sections.capabilityRollup')}>
          <div className="space-y-4 text-sm text-zinc-600 dark:text-zinc-400">
            <div className="rounded-2xl border border-zinc-100 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                {t('settings.kernelCenter.capabilityRollup.ready')}
              </div>
              <div className="mt-2 text-zinc-800 dark:text-zinc-200">
                {renderList(dashboard?.capabilities.readyKeys || [], noneLabel)}
              </div>
            </div>
            <div className="rounded-2xl border border-zinc-100 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                {t('settings.kernelCenter.capabilityRollup.planned')}
              </div>
              <div className="mt-2 text-zinc-800 dark:text-zinc-200">
                {renderList(dashboard?.capabilities.plannedKeys || [], noneLabel)}
              </div>
            </div>
            <div className="rounded-2xl border border-zinc-100 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                {t('settings.kernelCenter.capabilityRollup.bundledComponents')}
              </div>
              <div className="mt-2 text-zinc-800 dark:text-zinc-200">
                {t('settings.kernelCenter.capabilityRollup.bundledComponentsSummary', {
                  count: dashboard?.info?.bundledComponents.componentCount ?? 0,
                  autoStartCount:
                    dashboard?.info?.bundledComponents.defaultStartupComponentIds.length ?? 0,
                })}
              </div>
            </div>
          </div>
        </Section>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Section title={t('settings.kernelCenter.sections.managedDirectories')}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <ValueRow
              label={t('settings.kernelCenter.fields.machineState')}
              value={dashboard?.info?.directories.machineStateDir || null}
              emptyLabel={notAvailableLabel}
              mono
            />
            <ValueRow
              label={t('settings.kernelCenter.fields.machineStaging')}
              value={dashboard?.info?.directories.machineStagingDir || null}
              emptyLabel={notAvailableLabel}
              mono
            />
            <ValueRow
              label={t('settings.kernelCenter.fields.userRoot')}
              value={dashboard?.info?.directories.userRoot || null}
              emptyLabel={notAvailableLabel}
              mono
            />
            <ValueRow
              label={t('settings.kernelCenter.fields.studioDir')}
              value={dashboard?.info?.directories.studioDir || null}
              emptyLabel={notAvailableLabel}
              mono
            />
            <ValueRow
              label={t('settings.kernelCenter.fields.storageDir')}
              value={dashboard?.info?.directories.storageDir || null}
              emptyLabel={notAvailableLabel}
              mono
            />
            <ValueRow
              label={t('settings.kernelCenter.fields.backupsDir')}
              value={dashboard?.info?.directories.backupsDir || null}
              emptyLabel={notAvailableLabel}
              mono
            />
          </div>
        </Section>

        <Section title={t('settings.kernelCenter.sections.supervisorAndBundles')}>
          <div className="space-y-4">
            <div className="rounded-2xl border border-zinc-100 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                <Box className="h-4 w-4" />
                {t('settings.kernelCenter.bundles.supervisor')}
              </div>
              <div className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                {t('settings.kernelCenter.bundles.supervisorSummary', {
                  lifecycle: translateSupervisorLifecycle(t, dashboard?.info?.supervisor.lifecycle),
                  count: dashboard?.info?.supervisor.serviceCount ?? 0,
                })}
              </div>
            </div>
            <div className="rounded-2xl border border-zinc-100 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                <Database className="h-4 w-4" />
                {t('settings.kernelCenter.bundles.bundledStartupSet')}
              </div>
              <div className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                {renderList(
                  dashboard?.info?.bundledComponents.defaultStartupComponentIds || [],
                  noneLabel,
                )}
              </div>
            </div>
            <div className="rounded-2xl border border-zinc-100 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                <HardDrive className="h-4 w-4" />
                {t('settings.kernelCenter.bundles.silentHostTarget')}
              </div>
              <div className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                {t('settings.kernelCenter.bundles.silentHostTargetDescription', {
                  serviceManager: serviceManagerLabel,
                })}
              </div>
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
}
