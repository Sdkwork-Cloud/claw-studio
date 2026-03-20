import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Download,
  ExternalLink,
  HardDrive,
  Loader2,
  RefreshCw,
  Share,
  ShieldCheck,
  Star,
  Wrench,
} from 'lucide-react';
import {
  installerService,
  type HubInstallAssessmentDependency,
  type HubInstallCatalogVariant,
  type HubInstallProgressEvent,
  type HubInstallProgressOperationKind,
  type HubInstallRecordStatus,
  type RuntimeEventUnsubscribe,
} from '@sdkwork/claw-infrastructure';
import { toast } from 'sonner';
import { type AppInstallInspection, type AppItem, appStoreService } from '../../services';

type InstallState =
  | 'idle'
  | 'inspecting'
  | 'installing-dependencies'
  | 'installing'
  | 'uninstalling'
  | 'installed'
  | 'error';

type InstallDirectoryKey = 'installRoot' | 'workRoot' | 'binDir' | 'dataRoot' | 'additional';

interface ProgressSummary {
  currentStage: string | null;
  currentStep: string | null;
  lastCommand: string | null;
  totalStages: number;
  completedStages: number;
  totalArtifacts: number;
  completedArtifacts: number;
}

interface InstallDirectoryEntry {
  key: InstallDirectoryKey;
  id: string;
  path: string;
  customizable?: boolean | null;
  purpose?: string | null;
}

let installProgressRequestSequence = 0;

function createProgressSummary(): ProgressSummary {
  return {
    currentStage: null,
    currentStep: null,
    lastCommand: null,
    totalStages: 0,
    completedStages: 0,
    totalArtifacts: 0,
    completedArtifacts: 0,
  };
}

function createInstallProgressRequestId(
  softwareName: string,
  operationKind: HubInstallProgressOperationKind,
) {
  installProgressRequestSequence += 1;
  return `${softwareName}-${operationKind}-${Date.now().toString(36)}-${installProgressRequestSequence.toString(36)}`;
}

function humanizeLabel(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const normalized = value.replace(/[_-]+/g, ' ').trim();
  if (!normalized) {
    return null;
  }

  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function isBusyInstallState(installState: InstallState) {
  return (
    installState === 'inspecting' ||
    installState === 'installing-dependencies' ||
    installState === 'installing' ||
    installState === 'uninstalling'
  );
}

function reduceProgressEvent(state: ProgressSummary, event: HubInstallProgressEvent): ProgressSummary {
  if (event.type === 'stageStarted') {
    return {
      ...state,
      currentStage: event.stage,
      totalStages: Math.max(state.totalStages, state.completedStages + 1),
    };
  }

  if (event.type === 'stageCompleted') {
    return {
      ...state,
      currentStage: event.stage,
      completedStages: state.completedStages + 1,
      totalStages: Math.max(state.totalStages, state.completedStages + 1),
    };
  }

  if (event.type === 'artifactStarted') {
    return {
      ...state,
      totalArtifacts: Math.max(state.totalArtifacts, state.completedArtifacts + 1),
    };
  }

  if (event.type === 'artifactCompleted') {
    return {
      ...state,
      completedArtifacts: state.completedArtifacts + 1,
      totalArtifacts: Math.max(state.totalArtifacts, state.completedArtifacts + 1),
    };
  }

  if (event.type === 'stepStarted') {
    return {
      ...state,
      currentStep: event.description,
    };
  }

  if (event.type === 'stepCommandStarted') {
    return {
      ...state,
      lastCommand: event.commandLine,
    };
  }

  return state;
}

function formatProgressEvent(event: HubInstallProgressEvent) {
  if (event.type === 'dependencyStarted') {
    return `Checking ${event.description || event.target || event.dependencyId}`;
  }

  if (event.type === 'dependencyCompleted') {
    if (event.skipped) {
      return `${event.target || event.dependencyId}: already ready`;
    }
    return `${event.target || event.dependencyId}: ${event.success ? 'ready' : 'failed'}`;
  }

  if (event.type === 'stepStarted') {
    return event.description;
  }

  if (event.type === 'stepCommandStarted') {
    return event.commandLine;
  }

  if (event.type === 'stepCompleted') {
    return event.success ? 'Step completed' : 'Step failed';
  }

  if (event.type === 'artifactStarted') {
    return `Starting ${event.artifactId}`;
  }

  if (event.type === 'artifactCompleted') {
    return `${event.artifactId}: ${event.success ? 'completed' : 'failed'}`;
  }

  if (event.type === 'stageStarted') {
    return `Stage: ${humanizeLabel(event.stage) || event.stage}`;
  }

  if (event.type === 'stageCompleted') {
    return `Stage complete: ${humanizeLabel(event.stage) || event.stage}`;
  }

  if (event.type === 'stepLogChunk') {
    return event.chunk.trim();
  }

  return '';
}

function matchesProgressEvent(
  event: HubInstallProgressEvent,
  requestId: string,
  softwareName: string,
  operationKind: HubInstallProgressOperationKind,
) {
  if (event.requestId) {
    return event.requestId === requestId;
  }

  return event.softwareName === softwareName && event.operationKind === operationKind;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function getDependencyBadgeColor(dependency: HubInstallAssessmentDependency) {
  if (dependency.status === 'available') {
    return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300';
  }

  if (dependency.status === 'remediable') {
    return 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300';
  }

  if (dependency.status === 'unsupported') {
    return 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-300';
  }

  return 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300';
}

function getSupportTone(supported?: boolean | null) {
  if (supported === true) {
    return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300';
  }

  if (supported === false) {
    return 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300';
  }

  return 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300';
}

function getSupportLabel(supported?: boolean | null) {
  if (supported === true) {
    return 'Supported';
  }

  if (supported === false) {
    return 'Documented';
  }

  return 'Declared';
}

function getBooleanTone(value: boolean) {
  return value
    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
    : 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-300';
}

function getBooleanLabel(value: boolean) {
  return value ? 'Available' : 'Missing';
}

function getInstallStatusLabel(value: HubInstallRecordStatus | null | undefined) {
  if (value === 'installed') {
    return 'Installed';
  }

  if (value === 'uninstalled') {
    return 'Uninstalled';
  }

  return 'Not managed yet';
}

function getInstallStatusTone(value: HubInstallRecordStatus | null | undefined) {
  if (value === 'installed') {
    return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300';
  }

  if (value === 'uninstalled') {
    return 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300';
  }

  return 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300';
}

function collectInstallationDirectories(inspection: AppInstallInspection | null): InstallDirectoryEntry[] {
  const directories = inspection?.assessment.installation?.directories;
  if (!directories) {
    return [];
  }

  const items: InstallDirectoryEntry[] = [];
  if (directories.installRoot) {
    items.push({
      key: 'installRoot',
      id: directories.installRoot.id || 'install-root',
      path: directories.installRoot.path,
      customizable: directories.installRoot.customizable,
      purpose: directories.installRoot.purpose,
    });
  }
  if (directories.workRoot) {
    items.push({
      key: 'workRoot',
      id: directories.workRoot.id || 'work-root',
      path: directories.workRoot.path,
      customizable: directories.workRoot.customizable,
      purpose: directories.workRoot.purpose,
    });
  }
  if (directories.binDir) {
    items.push({
      key: 'binDir',
      id: directories.binDir.id || 'bin-dir',
      path: directories.binDir.path,
      customizable: directories.binDir.customizable,
      purpose: directories.binDir.purpose,
    });
  }
  if (directories.dataRoot) {
    items.push({
      key: 'dataRoot',
      id: directories.dataRoot.id || 'data-root',
      path: directories.dataRoot.path,
      customizable: directories.dataRoot.customizable,
      purpose: directories.dataRoot.purpose,
    });
  }
  directories.additional.forEach((directory, index) => {
    items.push({
      key: 'additional',
      id: directory.id || `additional-${index}`,
      path: directory.path,
      customizable: directory.customizable,
      purpose: directory.purpose,
    });
  });

  return items;
}

function getDirectoryLabel(entry: InstallDirectoryEntry) {
  if (entry.key === 'installRoot') {
    return 'Install Root';
  }

  if (entry.key === 'workRoot') {
    return 'Work Root';
  }

  if (entry.key === 'binDir') {
    return 'Bin Directory';
  }

  if (entry.key === 'dataRoot') {
    return 'Data Root';
  }

  return humanizeLabel(entry.id) || 'Additional Directory';
}

function getVariantDocumentationUrl(
  variant: HubInstallCatalogVariant | null,
  inspection: AppInstallInspection | null,
  app: AppItem | null,
) {
  return (
    variant?.installationMethod?.documentationUrl ||
    variant?.manifestHomepage ||
    inspection?.assessment.manifestHomepage ||
    app?.installHomepage ||
    null
  );
}

export function AppDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const progressUnsubscribeRef = useRef<RuntimeEventUnsubscribe | null>(null);
  const currentProgressRequestIdRef = useRef<string | null>(null);
  const [app, setApp] = useState<AppItem | null>(null);
  const [inspection, setInspection] = useState<AppInstallInspection | null>(null);
  const [loading, setLoading] = useState(true);
  const [installState, setInstallState] = useState<InstallState>('inspecting');
  const [assessmentError, setAssessmentError] = useState<string | null>(null);
  const [progressSummary, setProgressSummary] = useState<ProgressSummary>(createProgressSummary());
  const [progressLines, setProgressLines] = useState<string[]>([]);
  const [refreshTick, setRefreshTick] = useState(0);
  const [selectedVariantByApp, setSelectedVariantByApp] = useState<Record<string, string>>({});
  const [optimisticInstallStatus, setOptimisticInstallStatus] = useState<HubInstallRecordStatus | null>(null);
  const [dependencyActionTarget, setDependencyActionTarget] = useState<string | 'all' | null>(null);
  const selectedVariantId = id ? selectedVariantByApp[id] ?? null : null;

  useEffect(() => {
    return () => {
      const unsubscribe = progressUnsubscribeRef.current;
      progressUnsubscribeRef.current = null;
      currentProgressRequestIdRef.current = null;
      if (typeof unsubscribe === 'function') {
        void unsubscribe();
      }
    };
  }, []);

  useEffect(() => {
    if (!id) {
      currentProgressRequestIdRef.current = null;
      return;
    }

    let active = true;
    const requestedVariantId = selectedVariantId ?? undefined;

    const loadAppDetail = async () => {
      currentProgressRequestIdRef.current = null;
      setLoading(true);
      setInstallState('inspecting');
      setAssessmentError(null);

      try {
        const nextApp = await appStoreService.getApp(id);
        if (!active) {
          return;
        }

        setApp(nextApp);

        if (!nextApp.installable) {
          setInspection(null);
          setOptimisticInstallStatus(null);
          setInstallState('idle');
          setLoading(false);
          return;
        }

        const nextInspection = await appStoreService.inspectInstall(
          id,
          requestedVariantId ? { variantId: requestedVariantId } : undefined,
        );
        if (!active) {
          return;
        }

        setInspection(nextInspection);
        setSelectedVariantByApp((current) => {
          if (current[id] === nextInspection.target.variant.id) {
            return current;
          }

          return {
            ...current,
            [id]: nextInspection.target.variant.id,
          };
        });
        setOptimisticInstallStatus(null);
        setInstallState('idle');
      } catch (error) {
        if (!active) {
          return;
        }

        setAssessmentError(getErrorMessage(error));
        setInstallState('error');
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadAppDetail();

    return () => {
      active = false;
    };
  }, [id, refreshTick]);

  const compatibleVariants = useMemo(
    () =>
      inspection?.definition.variants.filter((variant) =>
        variant.hostPlatforms.includes(inspection.target.hostPlatform),
      ) ?? [],
    [inspection],
  );
  const selectedVariant = useMemo(
    () =>
      compatibleVariants.find((variant) => variant.id === selectedVariantId) ??
      compatibleVariants.find((variant) => variant.id === inspection?.target.variant.id) ??
      compatibleVariants[0] ??
      null,
    [compatibleVariants, inspection, selectedVariantId],
  );
  const autoRemediableDependencies = useMemo(
    () =>
      inspection?.assessment.dependencies.filter(
        (dependency) => dependency.status !== 'available' && dependency.supportsAutoRemediation,
      ) ?? [],
    [inspection],
  );
  const blockingIssues = useMemo(
    () => inspection?.assessment.issues.filter((issue) => issue.severity === 'error') ?? [],
    [inspection],
  );
  const warningIssues = useMemo(
    () => inspection?.assessment.issues.filter((issue) => issue.severity === 'warning') ?? [],
    [inspection],
  );
  const readyToInstall = inspection?.assessment.ready ?? false;
  const installTargetLabel = inspection?.target.variant.label ?? null;
  const installationMethod =
    inspection?.assessment.installation?.method ?? selectedVariant?.installationMethod ?? null;
  const installationDirectories = useMemo(
    () => collectInstallationDirectories(inspection),
    [inspection],
  );
  const installDocumentationUrl = getVariantDocumentationUrl(selectedVariant, inspection, app);
  const runtime = inspection?.assessment.runtime ?? null;
  const installBusy = isBusyInstallState(installState);
  const installStatus = optimisticInstallStatus ?? inspection?.assessment.installStatus ?? null;
  const isInstalledTarget = installStatus === 'installed';
  const progressSoftwareName =
    inspection?.target.request.softwareName ?? app?.defaultSoftwareName ?? app?.id ?? 'app';

  const extendedApp = app
    ? {
        ...app,
        reviewsCount: app.reviewsCount || '12.4K',
        screenshots:
          app.screenshots ||
          [
            `https://picsum.photos/seed/${app.id}_1/800/500`,
            `https://picsum.photos/seed/${app.id}_2/800/500`,
            `https://picsum.photos/seed/${app.id}_3/800/500`,
          ],
        version: app.version || '1.0.0',
        size: app.size || 'Unknown',
        releaseDate: app.releaseDate || '2026-03-20',
        compatibility: app.compatibility || 'Windows 11, macOS 13+, Ubuntu 22.04+',
        ageRating: app.ageRating || '4+',
      }
    : null;

  const startProgressTracking = async (
    requestId: string,
    softwareName: string,
    operationKind: HubInstallProgressOperationKind,
  ) => {
    const unsubscribe = progressUnsubscribeRef.current;
    progressUnsubscribeRef.current = null;
    currentProgressRequestIdRef.current = requestId;
    if (typeof unsubscribe === 'function') {
      await unsubscribe();
    }

    setProgressSummary(createProgressSummary());
    setProgressLines([]);

    progressUnsubscribeRef.current = await installerService.subscribeHubInstallProgress((event) => {
      if (
        currentProgressRequestIdRef.current !== requestId ||
        !matchesProgressEvent(event, requestId, softwareName, operationKind)
      ) {
        return;
      }

      setProgressSummary((current) => reduceProgressEvent(current, event));

      const line = formatProgressEvent(event);
      if (!line) {
        return;
      }

      setProgressLines((current) => [...current.slice(-11), line]);
    });
  };

  const refreshInspection = () => {
    setRefreshTick((current) => current + 1);
  };

  const handleSelectVariant = (variantId: string) => {
    if (!id || installBusy || selectedVariantId === variantId) {
      return;
    }

    setSelectedVariantByApp((current) => ({
      ...current,
      [id]: variantId,
    }));
    setOptimisticInstallStatus(null);
    setAssessmentError(null);
    setProgressLines([]);
    setProgressSummary(createProgressSummary());
    currentProgressRequestIdRef.current = null;
    refreshInspection();
  };

  const runDependencyInstall = async (
    dependencyIds?: string[],
    dependencyLabel?: string,
  ) => {
    if (!id || !app?.installable) {
      return;
    }

    setInstallState('installing-dependencies');
    setDependencyActionTarget(dependencyIds?.[0] ?? 'all');
    setAssessmentError(null);

    try {
      const requestId = createInstallProgressRequestId(progressSoftwareName, 'dependencyInstall');
      await startProgressTracking(requestId, progressSoftwareName, 'dependencyInstall');
      await appStoreService.installDependencies(id, {
        variantId: selectedVariantId ?? undefined,
        requestId,
        dependencyIds: dependencyIds,
      });
      toast.success(
        dependencyIds?.length === 1
          ? `${dependencyLabel || dependencyIds[0]} is ready.`
          : `Dependencies are ready for ${app.name}.`,
      );
      setInstallState('idle');
      refreshInspection();
    } catch (error) {
      const message = getErrorMessage(error);
      setAssessmentError(message);
      setInstallState('error');
      toast.error(message);
    } finally {
      setDependencyActionTarget(null);
    }
  };

  const handleInstallDependencies = async () => {
    await runDependencyInstall();
  };

  const handleInstallDependency = async (dependency: HubInstallAssessmentDependency) => {
    await runDependencyInstall(
      [dependency.id],
      dependency.description || dependency.target || dependency.id,
    );
  };

  const handleInstall = async () => {
    if (!id || !app?.installable) {
      return;
    }

    setAssessmentError(null);

    try {
      const guidedInstallNavigation = await appStoreService.getGuidedInstallNavigation(id, {
        variantId: selectedVariantId ?? undefined,
      });
      if (guidedInstallNavigation) {
        navigate(guidedInstallNavigation);
        return;
      }

      setInstallState('installing');
      const requestId = createInstallProgressRequestId(progressSoftwareName, 'install');
      await startProgressTracking(requestId, progressSoftwareName, 'install');
      await appStoreService.installApp(id, {
        variantId: selectedVariantId ?? undefined,
        requestId,
      });
      setOptimisticInstallStatus('installed');
      setInstallState('installed');
      toast.success(t('apps.detail.installSuccess', { name: app.name }));
      refreshInspection();
    } catch (error) {
      const message = getErrorMessage(error);
      setAssessmentError(message);
      setInstallState('error');
      toast.error(message);
    }
  };

  const handleUninstall = async () => {
    if (!id || !app?.installable) {
      return;
    }

    setInstallState('uninstalling');
    setAssessmentError(null);

    try {
      const requestId = createInstallProgressRequestId(progressSoftwareName, 'uninstall');
      await startProgressTracking(requestId, progressSoftwareName, 'uninstall');
      await appStoreService.uninstallApp(id, {
        variantId: selectedVariantId ?? undefined,
        requestId,
      });
      setOptimisticInstallStatus('uninstalled');
      setInstallState('idle');
      toast.success(`${app.name} uninstall finished.`);
      refreshInspection();
    } catch (error) {
      const message = getErrorMessage(error);
      setAssessmentError(message);
      setInstallState('error');
      toast.error(message);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-white dark:bg-zinc-950">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  if (!app || !extendedApp) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-white dark:bg-zinc-950">
        <h2 className="mb-4 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          {t('apps.detail.notFoundTitle')}
        </h2>
        <button
          onClick={() => navigate(-1)}
          className="rounded-xl bg-primary-600 px-4 py-2 font-bold text-white"
        >
          {t('common.goBack')}
        </button>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-white dark:bg-zinc-950">
      <div className="sticky top-0 z-20 flex items-center gap-4 border-b border-zinc-200 bg-white/80 px-6 py-4 backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-900/80">
        <button
          onClick={() => navigate(-1)}
          className="rounded-full p-2 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          <ArrowLeft className="h-5 w-5 text-zinc-600 dark:text-zinc-400" />
        </button>
        <div className="font-semibold text-zinc-900 dark:text-zinc-100">
          {t('apps.detail.pageTitle')}
        </div>
      </div>

      <div className="mx-auto max-w-6xl p-8">
        <div className="mb-12 flex flex-col items-start gap-8 md:flex-row">
          <img
            src={extendedApp.icon}
            alt={app.name}
            className="h-32 w-32 shrink-0 rounded-3xl border border-zinc-100 object-cover shadow-lg md:h-40 md:w-40 dark:border-zinc-800"
            referrerPolicy="no-referrer"
          />

          <div className="flex-1">
            <h1 className="mb-2 text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 md:text-4xl">
              {app.name}
            </h1>
            <h2 className="mb-4 text-lg text-zinc-500 dark:text-zinc-400">{app.developer}</h2>

            {app.installTags?.length ? (
              <div className="mb-5 flex flex-wrap gap-2">
                {app.installTags.slice(0, 8).map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}

            <div className="mb-6 flex flex-wrap items-center gap-6">
              <div className="flex flex-col">
                <span className="mb-1 text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  {t('apps.detail.rating')}
                </span>
                <div className="flex items-center gap-1 font-bold text-zinc-900 dark:text-zinc-100">
                  {app.rating}
                  <Star className="h-4 w-4 fill-zinc-900 dark:fill-zinc-100" />
                </div>
              </div>
              <div className="h-8 w-px bg-zinc-200 dark:bg-zinc-800" />
              <div className="flex flex-col">
                <span className="mb-1 text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  {t('apps.detail.category')}
                </span>
                <div className="font-medium text-zinc-900 dark:text-zinc-100">{app.category}</div>
              </div>
              <div className="h-8 w-px bg-zinc-200 dark:bg-zinc-800" />
              <div className="flex flex-col">
                <span className="mb-1 text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  {t('apps.detail.age')}
                </span>
                <div className="font-medium text-zinc-900 dark:text-zinc-100">
                  {extendedApp.ageRating}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <span
                className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wider ${getInstallStatusTone(
                  installStatus,
                )}`}
              >
                {getInstallStatusLabel(installStatus)}
              </span>

              {autoRemediableDependencies.length > 0 && installState !== 'installing' ? (
                <button
                  onClick={handleInstallDependencies}
                  disabled={installBusy}
                  className="flex items-center gap-2 rounded-full bg-amber-500 px-6 py-2.5 font-bold text-zinc-950 shadow-sm transition-colors hover:bg-amber-400 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-500 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500"
                >
                  {installState === 'installing-dependencies' && dependencyActionTarget === 'all' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Wrench className="h-4 w-4" />
                  )}
                  {installState === 'installing-dependencies' && dependencyActionTarget === 'all'
                    ? 'Installing Dependencies...'
                    : 'Install All Dependencies'}
                </button>
              ) : null}

              {isInstalledTarget ? (
                <button className="flex items-center gap-2 rounded-full bg-zinc-900 px-8 py-2.5 font-bold text-white shadow-sm transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200">
                  <Check className="h-4 w-4" />
                  Installed
                </button>
              ) : (
                <button
                  onClick={handleInstall}
                  disabled={installBusy || !!blockingIssues.length || !inspection || !readyToInstall}
                  className="flex items-center gap-2 rounded-full bg-primary-500 px-8 py-2.5 font-bold text-white shadow-sm transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-500 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500"
                >
                  {installState === 'installing' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  {installState === 'installing'
                    ? 'Installing...'
                    : selectedVariant
                      ? `Install ${selectedVariant.label}`
                      : t('apps.detail.installToLocal')}
                </button>
              )}

              {inspection && installDocumentationUrl ? (
                <a
                  href={installDocumentationUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 rounded-full border border-zinc-300 px-5 py-2.5 font-bold text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  <ExternalLink className="h-4 w-4" />
                  Docs
                </a>
              ) : null}

              {isInstalledTarget ? (
                <button
                  onClick={handleUninstall}
                  disabled={installBusy}
                  className="flex items-center gap-2 rounded-full border border-zinc-300 px-6 py-2.5 font-bold text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  <RefreshCw className="h-4 w-4" />
                  Uninstall
                </button>
              ) : null}

              <button className="rounded-full p-2.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-100">
                <Share className="h-5 w-5" />
              </button>
            </div>

            {inspection ? (
              <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/60">
                  <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Selected Profile
                  </div>
                  <div className="mt-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {installTargetLabel}
                  </div>
                  <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    {inspection.target.softwareName}
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/60">
                  <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Runtime
                  </div>
                  <div className="mt-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {humanizeLabel(inspection.target.runtimePlatform) || inspection.target.runtimePlatform}
                  </div>
                  <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    Host: {humanizeLabel(inspection.target.hostPlatform) || inspection.target.hostPlatform}
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/60">
                  <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Installation Method
                  </div>
                  <div className="mt-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {installationMethod?.label || installTargetLabel || 'Managed profile'}
                  </div>
                  <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    {installationMethod
                      ? humanizeLabel(installationMethod.type) || installationMethod.type
                      : inspection.assessment.installControlLevel}
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/60">
                  <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Readiness
                  </div>
                  <div className="mt-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {readyToInstall ? 'Ready to install' : 'Needs attention'}
                  </div>
                  <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    {inspection.assessment.dependencies.length} dependency checks
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/60">
                  <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Install Status
                  </div>
                  <div className="mt-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {getInstallStatusLabel(inspection.assessment.installStatus)}
                  </div>
                  <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    State comes from the Rust assessment record for this selected profile.
                  </div>
                </div>
              </div>
            ) : null}

            {assessmentError ? (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
                {assessmentError}
              </div>
            ) : null}
          </div>
        </div>

        {inspection ? (
          <div className="mb-12 grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
            <div className="space-y-6">
              <div className="rounded-3xl border border-zinc-200 bg-zinc-50/80 p-6 dark:border-zinc-800 dark:bg-zinc-900/60">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                      Install Profiles
                    </h3>
                    <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                      Choose the Rust-backed installation path that best matches this host and runtime.
                    </p>
                  </div>
                  <span className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300">
                    {compatibleVariants.length} available
                  </span>
                </div>

                <div className="grid gap-3 xl:grid-cols-2">
                  {compatibleVariants.map((variant) => {
                    const isSelected = selectedVariant?.id === variant.id;
                    const variantDocs =
                      variant.installationMethod?.documentationUrl || variant.manifestHomepage || null;

                    return (
                      <div
                        key={variant.id}
                        className={`rounded-2xl border p-4 transition-colors ${
                          isSelected
                            ? 'border-primary-300 bg-primary-50/80 shadow-sm dark:border-primary-500/40 dark:bg-primary-500/10'
                            : 'border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950/60'
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                              {variant.label}
                            </div>
                            <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                              {variant.softwareName}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                              {humanizeLabel(variant.runtimePlatform) || variant.runtimePlatform}
                            </span>
                            {variant.installationMethod ? (
                              <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                                {humanizeLabel(variant.installationMethod.type) || variant.installationMethod.type}
                              </span>
                            ) : null}
                          </div>
                        </div>

                        <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
                          {variant.summary}
                        </p>

                        <div className="mt-4 flex flex-wrap items-center gap-2">
                          {variant.hostPlatforms.map((hostPlatform) => (
                            <span
                              key={`${variant.id}-${hostPlatform}`}
                              className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                            >
                              {humanizeLabel(hostPlatform) || hostPlatform}
                            </span>
                          ))}
                        </div>

                        <div className="mt-4 flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleSelectVariant(variant.id)}
                            disabled={installBusy || isSelected}
                            className="rounded-full bg-primary-500 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-500 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500"
                          >
                            {isSelected ? 'Selected' : 'Use Profile'}
                          </button>
                          {variantDocs ? (
                            <a
                              href={variantDocs}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-2 rounded-full border border-zinc-200 px-4 py-2 text-xs font-bold text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              Profile Docs
                            </a>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-3xl border border-zinc-200 bg-zinc-50/80 p-6 dark:border-zinc-800 dark:bg-zinc-900/60">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                      Install Readiness
                    </h3>
                    <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                      Dependency inspection comes directly from the Rust installer assessment.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={refreshInspection}
                    disabled={installBusy}
                    className="rounded-full border border-zinc-200 px-4 py-1.5 text-xs font-bold text-zinc-600 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    Refresh
                  </button>
                </div>

                <div className="space-y-3">
                  {inspection.assessment.dependencies.map((dependency) => (
                    <div
                      key={dependency.id}
                      className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950/60"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                            {dependency.description || dependency.id}
                          </div>
                          <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                            {dependency.target}
                          </div>
                        </div>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${getDependencyBadgeColor(dependency)}`}
                        >
                          {dependency.status}
                        </span>
                      </div>

                      {dependency.remediationCommands.length > 0 ? (
                        <div className="mt-4 space-y-2">
                          {dependency.remediationCommands.map((command, index) => (
                            <div
                              key={`${dependency.id}-${index}`}
                              className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/70"
                            >
                              <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                                {command.description}
                              </div>
                              <div className="mt-2 font-mono text-xs leading-relaxed text-zinc-700 dark:text-zinc-300">
                                {command.commandLine}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : null}

                      {dependency.status !== 'available' ? (
                        <div className="mt-4 flex flex-wrap items-center gap-2">
                          {dependency.supportsAutoRemediation ? (
                            <button
                              type="button"
                              onClick={() => void handleInstallDependency(dependency)}
                              disabled={installBusy}
                              className="flex items-center gap-2 rounded-full bg-amber-500 px-4 py-2 text-xs font-bold text-zinc-950 transition-colors hover:bg-amber-400 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-500 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500"
                            >
                              {installState === 'installing-dependencies' &&
                              dependencyActionTarget === dependency.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Wrench className="h-3.5 w-3.5" />
                              )}
                              Fix This Dependency
                            </button>
                          ) : (
                            <span className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
                              Manual setup required
                            </span>
                          )}
                          <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                            Check: {dependency.checkType}
                          </span>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>

              {(installationMethod || installationDirectories.length > 0) ? (
                <div className="rounded-3xl border border-zinc-200 bg-zinc-50/80 p-6 dark:border-zinc-800 dark:bg-zinc-900/60">
                  <div className="mb-4">
                    <h3 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                      Installation Blueprint
                    </h3>
                    <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                      The selected profile exposes method, directory, and lifecycle metadata from Rust.
                    </p>
                  </div>

                  <div className="grid gap-4 xl:grid-cols-2">
                    <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                          {installationMethod?.label || 'Managed profile'}
                        </div>
                        {installationMethod ? (
                          <>
                            <span
                              className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wider ${getSupportTone(
                                installationMethod.supported,
                              )}`}
                            >
                              {getSupportLabel(installationMethod.supported)}
                            </span>
                            <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                              {humanizeLabel(installationMethod.type) || installationMethod.type}
                            </span>
                          </>
                        ) : null}
                      </div>

                      <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
                        {inspection.assessment.installation?.method.summary ||
                          selectedVariant?.summary ||
                          inspection.assessment.manifestDescription ||
                          'Profile metadata is available through the selected Rust manifest.'}
                      </p>

                      {inspection.assessment.installation?.alternatives.length ? (
                        <div className="mt-4 space-y-2">
                          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                            Alternatives
                          </div>
                          {inspection.assessment.installation.alternatives.map((method) => (
                            <div
                              key={method.id}
                              className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/70"
                            >
                              <div className="flex flex-wrap items-center gap-2">
                                <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                                  {method.label}
                                </div>
                                <span
                                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider ${getSupportTone(
                                    method.supported,
                                  )}`}
                                >
                                  {getSupportLabel(method.supported)}
                                </span>
                              </div>
                              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
                                {method.summary}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>

                    <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
                      <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        Managed Directories
                      </div>
                      <div className="mt-4 space-y-3">
                        {installationDirectories.length > 0 ? (
                          installationDirectories.map((entry) => (
                            <div
                              key={`${entry.key}-${entry.id}`}
                              className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/70"
                            >
                              <div className="flex flex-wrap items-center gap-2">
                                <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                                  {getDirectoryLabel(entry)}
                                </div>
                                <span className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                                  {entry.customizable ? 'Customizable' : 'Fixed'}
                                </span>
                              </div>
                              <div className="mt-2 break-all text-sm font-medium text-zinc-700 dark:text-zinc-200">
                                {entry.path}
                              </div>
                              {entry.purpose ? (
                                <p className="mt-2 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
                                  {entry.purpose}
                                </p>
                              ) : null}
                            </div>
                          ))
                        ) : (
                          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/70 dark:text-zinc-400">
                            The selected profile does not declare managed directories.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
              {(inspection.assessment.dataItems.length > 0 ||
                inspection.assessment.migrationStrategies.length > 0) ? (
                <div className="rounded-3xl border border-zinc-200 bg-zinc-50/80 p-6 dark:border-zinc-800 dark:bg-zinc-900/60">
                  <div className="mb-4">
                    <h3 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                      Data and Migration
                    </h3>
                    <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                      Data layout and migration guidance help preserve existing OpenClaw state safely.
                    </p>
                  </div>

                  {inspection.assessment.dataItems.length > 0 ? (
                    <div className="space-y-3">
                      {inspection.assessment.dataItems.map((item) => (
                        <div
                          key={item.id}
                          className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950/60"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                                {item.title}
                              </div>
                              {item.path ? (
                                <div className="mt-1 break-all text-xs text-zinc-500 dark:text-zinc-400">
                                  {item.path}
                                </div>
                              ) : null}
                              {item.description ? (
                                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
                                  {item.description}
                                </p>
                              ) : null}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                                {humanizeLabel(item.kind) || item.kind}
                              </span>
                              <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                                {humanizeLabel(item.uninstallByDefault) || item.uninstallByDefault}
                              </span>
                            </div>
                          </div>

                          {item.includes.length > 0 ? (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {item.includes.map((entry) => (
                                <span
                                  key={`${item.id}-${entry}`}
                                  className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                                >
                                  {entry}
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {inspection.assessment.migrationStrategies.length > 0 ? (
                    <div className="mt-4 space-y-3">
                      {inspection.assessment.migrationStrategies.map((strategy) => (
                        <div
                          key={strategy.id}
                          className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950/60"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                                {strategy.title}
                              </div>
                              <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
                                {strategy.summary}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                                {humanizeLabel(strategy.mode) || strategy.mode}
                              </span>
                              <span
                                className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wider ${getSupportTone(
                                  strategy.supported,
                                )}`}
                              >
                                {getSupportLabel(strategy.supported)}
                              </span>
                            </div>
                          </div>

                          {strategy.warnings.length > 0 ? (
                            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                              {strategy.warnings.map((warning) => (
                                <div key={`${strategy.id}-${warning}`}>{warning}</div>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="space-y-6">
              <div className="rounded-3xl border border-zinc-200 bg-zinc-50/80 p-6 dark:border-zinc-800 dark:bg-zinc-900/60">
                <h3 className="mb-4 text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                  Summary
                </h3>
                <div className="grid gap-4 text-sm">
                  <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
                    <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      Blocking Issues
                    </div>
                    <div className="mt-2 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                      {blockingIssues.length}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
                    <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      Warnings
                    </div>
                    <div className="mt-2 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                      {warningIssues.length}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
                    <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      Auto-fixable Dependencies
                    </div>
                    <div className="mt-2 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                      {autoRemediableDependencies.length}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
                    <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      Elevated Setup
                    </div>
                    <div className="mt-2 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                      {inspection.assessment.requiresElevatedSetup ? 'Required' : 'Not required'}
                    </div>
                  </div>
                </div>

                {blockingIssues.length > 0 ? (
                  <div className="mt-4 space-y-2">
                    {blockingIssues.map((issue) => (
                      <div
                        key={`${issue.code}-${issue.message}`}
                        className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
                      >
                        {issue.message}
                      </div>
                    ))}
                  </div>
                ) : null}

                {warningIssues.length > 0 ? (
                  <div className="mt-4 space-y-2">
                    {warningIssues.map((issue) => (
                      <div
                        key={`${issue.code}-${issue.message}`}
                        className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
                      >
                        {issue.message}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              {runtime ? (
                <div className="rounded-3xl border border-zinc-200 bg-zinc-50/80 p-6 dark:border-zinc-800 dark:bg-zinc-900/60">
                  <h3 className="mb-4 text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                    Runtime Detection
                  </h3>
                  <div className="grid gap-3">
                    <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
                      <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                        Host Platform
                      </div>
                      <div className="mt-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        {humanizeLabel(runtime.hostPlatform) || runtime.hostPlatform}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
                      <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                        Effective Runtime
                      </div>
                      <div className="mt-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        {humanizeLabel(runtime.effectiveRuntimePlatform) || runtime.effectiveRuntimePlatform}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
                      <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                        Container Runtime
                      </div>
                      <div className="mt-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        {humanizeLabel(runtime.resolvedContainerRuntime) || 'Not applicable'}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${getBooleanTone(
                          runtime.wslAvailable,
                        )}`}
                      >
                        WSL: {getBooleanLabel(runtime.wslAvailable)}
                      </span>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${getBooleanTone(
                          runtime.hostDockerAvailable,
                        )}`}
                      >
                        Host Docker: {getBooleanLabel(runtime.hostDockerAvailable)}
                      </span>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${getBooleanTone(
                          runtime.wslDockerAvailable,
                        )}`}
                      >
                        WSL Docker: {getBooleanLabel(runtime.wslDockerAvailable)}
                      </span>
                    </div>

                    {runtime.availableWslDistributions.length > 0 ? (
                      <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
                        <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                          Available WSL Distributions
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {runtime.availableWslDistributions.map((distribution) => (
                            <span
                              key={distribution}
                              className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                            >
                              {distribution}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {(inspection.assessment.recommendations.length > 0 || installDocumentationUrl) ? (
                <div className="rounded-3xl border border-zinc-200 bg-zinc-50/80 p-6 dark:border-zinc-800 dark:bg-zinc-900/60">
                  <h3 className="mb-4 text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                    Guidance
                  </h3>

                  {installDocumentationUrl ? (
                    <a
                      href={installDocumentationUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-full border border-zinc-200 px-4 py-2 text-sm font-bold text-primary-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-primary-300 dark:hover:bg-zinc-800"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Open Installation Docs
                    </a>
                  ) : null}

                  {inspection.assessment.recommendations.length > 0 ? (
                    <div className="mt-4 space-y-2">
                      {inspection.assessment.recommendations.map((recommendation) => (
                        <div
                          key={recommendation}
                          className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm leading-relaxed text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950/60 dark:text-zinc-300"
                        >
                          {recommendation}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {progressLines.length ? (
                <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
                  <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-zinc-100">
                    <Loader2 className="h-4 w-4" />
                    Live Progress
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
                      <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                        Stage
                      </div>
                      <div className="mt-2 text-sm font-semibold text-zinc-100">
                        {humanizeLabel(progressSummary.currentStage) || 'Waiting'}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
                      <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                        Step
                      </div>
                      <div className="mt-2 text-sm font-semibold text-zinc-100">
                        {progressSummary.currentStep || 'Waiting'}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                      Recent Output
                    </div>
                    <div className="max-h-56 space-y-2 overflow-y-auto font-mono text-xs leading-relaxed text-zinc-300">
                      {progressLines.map((line, index) => (
                        <div key={`${line}-${index}`}>{line}</div>
                      ))}
                    </div>
                    {progressSummary.lastCommand ? (
                      <div className="mt-4 border-t border-zinc-800 pt-4 text-[11px] text-zinc-400">
                        {progressSummary.lastCommand}
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="mb-12">
          <h3 className="mb-4 text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            {t('common.preview')}
          </h3>
          <div className="flex snap-x gap-4 overflow-x-auto pb-4 scrollbar-hide">
            {extendedApp.screenshots.map((src: string, index: number) => (
              <img
                key={src}
                src={src}
                alt={t('apps.detail.screenshotAlt', { index: index + 1 })}
                className="h-64 shrink-0 snap-start rounded-2xl border border-zinc-200 object-cover shadow-sm md:h-80 dark:border-zinc-800"
                referrerPolicy="no-referrer"
              />
            ))}
          </div>
        </div>

        <div className="grid gap-12 md:grid-cols-3">
          <div className="space-y-8 md:col-span-2">
            <div>
              <h3 className="mb-4 text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                {t('apps.detail.about')}
              </h3>
              <div className="prose prose-zinc max-w-none dark:prose-invert">
                <p className="whitespace-pre-wrap leading-relaxed text-zinc-600 dark:text-zinc-400">
                  {app.description}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-6 dark:border-zinc-800/50 dark:bg-zinc-900/50">
              <h4 className="mb-2 font-bold text-zinc-900 dark:text-zinc-100">
                {t('apps.detail.whatsNew')}
              </h4>
              <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
                {t('apps.detail.versionReleased', {
                  version: extendedApp.version,
                  date: extendedApp.releaseDate,
                })}
              </p>
              <div className="space-y-2 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                <p>
                  -{' '}
                  {selectedVariant?.summary ||
                    app.installSummary ||
                    'Platform-aware install flow backed by Rust hub-installer.'}
                </p>
                <p>- Dependency inspection runs before the install action and supports per-item repair.</p>
                <p>- Install progress comes from the desktop runtime event stream.</p>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <h3 className="mb-4 text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              {t('apps.detail.information')}
            </h3>

            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <HardDrive className="h-5 w-5 shrink-0 text-zinc-400 dark:text-zinc-500" />
                <div>
                  <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {t('apps.detail.size')}
                  </div>
                  <div className="text-sm text-zinc-500 dark:text-zinc-400">
                    {extendedApp.size}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <ShieldCheck className="h-5 w-5 shrink-0 text-zinc-400 dark:text-zinc-500" />
                <div>
                  <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {t('apps.detail.compatibility')}
                  </div>
                  <div className="text-sm text-zinc-500 dark:text-zinc-400">
                    {extendedApp.compatibility}
                  </div>
                </div>
              </div>

              {blockingIssues.length ? (
                <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 dark:border-red-500/30 dark:bg-red-500/10">
                  <AlertTriangle className="h-5 w-5 shrink-0 text-red-500" />
                  <div className="text-sm text-red-700 dark:text-red-300">
                    {blockingIssues[0]?.message || 'Install is currently blocked.'}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
