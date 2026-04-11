import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Download,
  ExternalLink,
  Loader2,
  RefreshCw,
  Share,
  Wrench,
} from 'lucide-react';
import {
  installerService,
  type InstallAssessmentDependency,
  type InstallCatalogVariant,
  type InstallProgressEvent,
  type InstallProgressOperationKind,
  type InstallRecordStatus,
  type RuntimeEventUnsubscribe,
} from '@sdkwork/claw-infrastructure';
import { toast } from 'sonner';
import { type AppInstallInspection, type AppItem, appStoreService } from '../../services';
import {
  createCatalogMetadataFields,
  type CatalogMetadataField,
} from './appCatalogPresentation.ts';

type InstallState =
  | 'idle'
  | 'inspecting'
  | 'installing-dependencies'
  | 'installing'
  | 'uninstalling'
  | 'installed'
  | 'error';

type InstallDirectoryKey = 'installRoot' | 'workRoot' | 'binDir' | 'dataRoot' | 'additional';
type Translator = ReturnType<typeof useTranslation>['t'];

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
  operationKind: InstallProgressOperationKind,
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

function normalizeTranslationToken(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
}

function translateDynamicLabel(
  t: Translator,
  baseKey: string,
  value: string | null | undefined,
) {
  if (!value) {
    return null;
  }

  return t(`${baseKey}.${normalizeTranslationToken(value)}`, {
    defaultValue: humanizeLabel(value) || value,
  });
}

function isBusyInstallState(installState: InstallState) {
  return (
    installState === 'inspecting' ||
    installState === 'installing-dependencies' ||
    installState === 'installing' ||
    installState === 'uninstalling'
  );
}

function reduceProgressEvent(state: ProgressSummary, event: InstallProgressEvent): ProgressSummary {
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

function formatProgressEvent(t: Translator, event: InstallProgressEvent) {
  if (event.type === 'dependencyStarted') {
    return t('apps.detail.progress.dependencyChecking', {
      target: event.description || event.target || event.dependencyId,
    });
  }

  if (event.type === 'dependencyCompleted') {
    if (event.skipped) {
      return t('apps.detail.progress.dependencyReady', {
        target: event.target || event.dependencyId,
      });
    }
    return t(
      event.success
        ? 'apps.detail.progress.dependencyCompleted'
        : 'apps.detail.progress.dependencyFailed',
      {
        target: event.target || event.dependencyId,
      },
    );
  }

  if (event.type === 'stepStarted') {
    return event.description;
  }

  if (event.type === 'stepCommandStarted') {
    return event.commandLine;
  }

  if (event.type === 'stepCompleted') {
    return t(
      event.success ? 'apps.detail.progress.stepCompleted' : 'apps.detail.progress.stepFailed',
    );
  }

  if (event.type === 'artifactStarted') {
    return t('apps.detail.progress.artifactStarting', {
      artifact: event.artifactId,
    });
  }

  if (event.type === 'artifactCompleted') {
    return t(
      event.success ? 'apps.detail.progress.artifactCompleted' : 'apps.detail.progress.artifactFailed',
      {
        artifact: event.artifactId,
      },
    );
  }

  if (event.type === 'stageStarted') {
    return t('apps.detail.progress.stageStarted', {
      stage: humanizeLabel(event.stage) || event.stage,
    });
  }

  if (event.type === 'stageCompleted') {
    return t('apps.detail.progress.stageCompleted', {
      stage: humanizeLabel(event.stage) || event.stage,
    });
  }

  if (event.type === 'stepLogChunk') {
    return event.chunk.trim();
  }

  return '';
}

function matchesProgressEvent(
  event: InstallProgressEvent,
  requestId: string,
  softwareName: string,
  operationKind: InstallProgressOperationKind,
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

function getDependencyBadgeColor(dependency: InstallAssessmentDependency) {
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

function getSupportLabel(t: Translator, supported?: boolean | null) {
  if (supported === true) {
    return t('install.page.assessment.installation.supported');
  }

  if (supported === false) {
    return t('install.page.assessment.installation.documentedOnly');
  }

  return t('install.page.assessment.installation.declared');
}

function getBooleanTone(value: boolean) {
  return value
    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
    : 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-300';
}

function getBooleanLabel(t: Translator, value: boolean) {
  return value ? t('apps.detail.availability.available') : t('apps.detail.availability.missing');
}

function getInstallStatusLabel(
  t: Translator,
  value: InstallRecordStatus | null | undefined,
) {
  if (value === 'installed') {
    return t('install.page.install.states.installed');
  }

  if (value === 'uninstalled') {
    return t('apps.detail.installStatus.uninstalled');
  }

  return t('apps.detail.installStatus.notManaged');
}

function getInstallStatusTone(value: InstallRecordStatus | null | undefined) {
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

function getDirectoryLabel(t: Translator, entry: InstallDirectoryEntry) {
  if (entry.key === 'installRoot') {
    return t('install.page.assessment.installation.directoryKinds.installRoot');
  }

  if (entry.key === 'workRoot') {
    return t('install.page.assessment.installation.directoryKinds.workRoot');
  }

  if (entry.key === 'binDir') {
    return t('install.page.assessment.installation.directoryKinds.binDir');
  }

  if (entry.key === 'dataRoot') {
    return t('install.page.assessment.installation.directoryKinds.dataRoot');
  }

  return humanizeLabel(entry.id) || t('install.page.assessment.installation.directoryKinds.additional');
}

function getDependencyStatusLabel(
  t: Translator,
  value: InstallAssessmentDependency['status'],
) {
  return t(`install.page.assessment.dependencyStatus.${value}`, {
    defaultValue: humanizeLabel(value) || value,
  });
}

function getCheckTypeLabel(t: Translator, value: InstallAssessmentDependency['checkType']) {
  return t(`apps.detail.values.checkTypes.${normalizeTranslationToken(value)}`, {
    defaultValue: humanizeLabel(value) || value,
  });
}

function getPlatformLabel(t: Translator, value: string | null | undefined) {
  return translateDynamicLabel(t, 'apps.detail.values.platforms', value);
}

function getCatalogMetadataFieldLabel(t: Translator, value: CatalogMetadataField['id']) {
  if (value === 'registry') {
    return t('apps.detail.metadata.registry');
  }

  if (value === 'defaultSoftwareName') {
    return t('apps.detail.metadata.defaultSoftwareName');
  }

  if (value === 'selectedSoftwareName') {
    return t('apps.detail.metadata.selectedSoftwareName');
  }

  return t('apps.detail.metadata.supportedHosts');
}

function getControlLevelLabel(t: Translator, value: string | null | undefined) {
  return translateDynamicLabel(t, 'apps.detail.values.controlLevels', value);
}

function getDataKindLabel(t: Translator, value: string | null | undefined) {
  if (!value) {
    return null;
  }

  return t(`install.page.assessment.dataKind.${value}`, {
    defaultValue: humanizeLabel(value) || value,
  });
}

function getUninstallPolicyLabel(t: Translator, value: string | null | undefined) {
  if (!value) {
    return null;
  }

  return t(`install.page.assessment.uninstallPolicy.${value}`, {
    defaultValue: humanizeLabel(value) || value,
  });
}

function getMigrationModeLabel(t: Translator, value: string | null | undefined) {
  if (!value) {
    return null;
  }

  return t(`install.page.assessment.migration.mode.${value}`, {
    defaultValue: humanizeLabel(value) || value,
  });
}

function getVariantDocumentationUrl(
  variant: InstallCatalogVariant | null,
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
  const progressSummaryStateRef = useRef<ProgressSummary>(createProgressSummary());
  const progressLinesStateRef = useRef<string[]>([]);
  const pendingProgressSummaryRef = useRef<ProgressSummary | null>(null);
  const pendingProgressLinesRef = useRef<string[] | null>(null);
  const progressFlushHandleRef = useRef<number | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [selectedVariantByApp, setSelectedVariantByApp] = useState<Record<string, string>>({});
  const [optimisticInstallStatus, setOptimisticInstallStatus] = useState<InstallRecordStatus | null>(null);
  const [dependencyActionTarget, setDependencyActionTarget] = useState<string | 'all' | null>(null);
  const selectedVariantId = id ? selectedVariantByApp[id] ?? null : null;

  const cancelScheduledProgressFlush = () => {
    if (progressFlushHandleRef.current === null) {
      return;
    }

    if (typeof window === 'undefined') {
      clearTimeout(progressFlushHandleRef.current);
    } else {
      window.cancelAnimationFrame(progressFlushHandleRef.current);
    }

    progressFlushHandleRef.current = null;
  };

  const flushProgressState = () => {
    progressFlushHandleRef.current = null;

    if (pendingProgressSummaryRef.current) {
      progressSummaryStateRef.current = pendingProgressSummaryRef.current;
      setProgressSummary(pendingProgressSummaryRef.current);
      pendingProgressSummaryRef.current = null;
    }

    if (pendingProgressLinesRef.current) {
      progressLinesStateRef.current = pendingProgressLinesRef.current;
      setProgressLines(pendingProgressLinesRef.current);
      pendingProgressLinesRef.current = null;
    }
  };

  const scheduleProgressFlush = () => {
    if (progressFlushHandleRef.current !== null) {
      return;
    }

    if (typeof window === 'undefined') {
      progressFlushHandleRef.current = setTimeout(flushProgressState, 0) as unknown as number;
      return;
    }

    progressFlushHandleRef.current = window.requestAnimationFrame(flushProgressState);
  };

  const resetProgressState = () => {
    cancelScheduledProgressFlush();
    const nextProgressSummary = createProgressSummary();
    progressSummaryStateRef.current = nextProgressSummary;
    progressLinesStateRef.current = [];
    pendingProgressSummaryRef.current = null;
    pendingProgressLinesRef.current = null;
    setProgressSummary(nextProgressSummary);
    setProgressLines([]);
  };

  useEffect(() => {
    return () => {
      cancelScheduledProgressFlush();
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
      resetProgressState();
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
          setAssessmentError(null);
          setInstallState('idle');
          return;
        }

        const nextInspection = await appStoreService.inspectSetup(
          id,
          requestedVariantId ? { variantId: requestedVariantId } : undefined,
        );
        if (!active) {
          return;
        }

        setApp(nextInspection.app);
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

        setApp(null);
        setInspection(null);
        setOptimisticInstallStatus(null);
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
  const showExternalAccessOnly = Boolean(app) && !inspection;
  const runtime = inspection?.assessment.runtime ?? null;
  const installBusy = isBusyInstallState(installState);
  const installStatus = optimisticInstallStatus ?? inspection?.assessment.installStatus ?? null;
  const isInstalledTarget = installStatus === 'installed';
  const progressSoftwareName =
    inspection?.target.request.softwareName ?? app?.defaultSoftwareName ?? app?.id ?? 'app';
  const totalProfileCount = compatibleVariants.length || inspection?.definition.variants.length || 0;
  const supportedHostLabels = useMemo(
    () =>
      (app?.supportedHostPlatforms ?? inspection?.definition.supportedHostPlatforms ?? [])
        .map((platform) => getPlatformLabel(t, platform) || platform)
        .filter((value): value is string => Boolean(value)),
    [app?.supportedHostPlatforms, inspection?.definition.supportedHostPlatforms, t],
  );
  const supportedHostSummary =
    supportedHostLabels.join(', ') || t('apps.detail.metadata.notAvailable');
  const aboutText =
    app?.description || app?.installSummary || inspection?.assessment.manifestDescription || null;
  const catalogNotes = useMemo(
    () =>
      [
        selectedVariant?.summary,
        app?.installSummary,
        installationMethod?.summary,
        inspection?.assessment.manifestDescription,
      ].filter((value, index, values): value is string => {
        if (!value?.trim()) {
          return false;
        }

        return values.indexOf(value) === index;
      }),
    [
      app?.installSummary,
      inspection?.assessment.manifestDescription,
      installationMethod?.summary,
      selectedVariant?.summary,
    ],
  );
  const catalogMetadataFields = useMemo(
    () =>
      createCatalogMetadataFields({
        registryName: inspection?.assessment.registryName,
        defaultSoftwareName: app?.defaultSoftwareName ?? inspection?.definition.defaultSoftwareName,
        selectedSoftwareName: inspection?.target.softwareName,
        supportedHostLabels,
      }),
    [
      app?.defaultSoftwareName,
      inspection?.assessment.registryName,
      inspection?.definition.defaultSoftwareName,
      inspection?.target.softwareName,
      supportedHostLabels,
    ],
  );

  const startProgressTracking = async (
    requestId: string,
    softwareName: string,
    operationKind: InstallProgressOperationKind,
  ) => {
    const unsubscribe = progressUnsubscribeRef.current;
    progressUnsubscribeRef.current = null;
    currentProgressRequestIdRef.current = requestId;
    if (typeof unsubscribe === 'function') {
      await unsubscribe();
    }

    resetProgressState();

    progressUnsubscribeRef.current = await installerService.subscribeInstallProgress((event) => {
      if (
        currentProgressRequestIdRef.current !== requestId ||
        !matchesProgressEvent(event, requestId, softwareName, operationKind)
      ) {
        return;
      }

      pendingProgressSummaryRef.current = reduceProgressEvent(
        pendingProgressSummaryRef.current ?? progressSummaryStateRef.current,
        event,
      );

      const line = formatProgressEvent(t, event);
      if (line) {
        pendingProgressLinesRef.current = [
          ...(pendingProgressLinesRef.current ?? progressLinesStateRef.current).slice(-11),
          line,
        ];
      }

      scheduleProgressFlush();
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
    resetProgressState();
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
          ? t('apps.detail.toasts.dependencyReady', {
              dependency: dependencyLabel || dependencyIds[0],
            })
          : t('apps.detail.toasts.dependenciesReady', {
              name: app.name,
            }),
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

  const handleInstallDependency = async (dependency: InstallAssessmentDependency) => {
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
      toast.success(
        t('apps.detail.toasts.uninstallSuccess', {
          name: app.name,
        }),
      );
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

  if (!app) {
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
          type="button"
          onClick={() => navigate(-1)}
          aria-label={t('common.back')}
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
            src={app.icon}
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
                  {t('apps.detail.category')}
                </span>
                <div className="font-bold text-zinc-900 dark:text-zinc-100">{app.category}</div>
              </div>
              <div className="h-8 w-px bg-zinc-200 dark:bg-zinc-800" />
              <div className="flex flex-col">
                <span className="mb-1 text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  {t('apps.detail.catalogProfiles')}
                </span>
                <div className="font-medium text-zinc-900 dark:text-zinc-100">
                  {totalProfileCount}
                </div>
              </div>
              <div className="h-8 w-px bg-zinc-200 dark:bg-zinc-800" />
              <div className="flex flex-col">
                <span className="mb-1 text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  {t('apps.detail.supportedHosts')}
                </span>
                <div className="font-medium text-zinc-900 dark:text-zinc-100">
                  {supportedHostSummary}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <span
                className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wider ${getInstallStatusTone(
                  installStatus,
                )}`}
              >
                {getInstallStatusLabel(t, installStatus)}
              </span>

              {autoRemediableDependencies.length > 0 && installState !== 'installing' ? (
                <button
                  type="button"
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
                    ? t('apps.detail.actions.installingDependencies')
                    : t('apps.detail.actions.installAllDependencies')}
                </button>
              ) : null}

              {inspection ? (
                isInstalledTarget ? (
                  <button
                    type="button"
                    className="flex items-center gap-2 rounded-full bg-zinc-900 px-8 py-2.5 font-bold text-white shadow-sm transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                  >
                    <Check className="h-4 w-4" />
                    {t('install.page.install.states.installed')}
                  </button>
                ) : (
                  <button
                    type="button"
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
                      ? t('apps.detail.installing')
                      : selectedVariant
                        ? t('apps.detail.actions.installVariant', { variant: selectedVariant.label })
                        : t('apps.detail.installToLocal')}
                  </button>
                )
              ) : null}

              {!inspection && app?.downloadUrl ? (
                <a
                  href={app.downloadUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 rounded-full bg-primary-500 px-8 py-2.5 font-bold text-white shadow-sm transition-colors hover:bg-primary-600"
                >
                  <Download className="h-4 w-4" />
                  {t('apps.detail.actions.download')}
                </a>
              ) : null}

              {!inspection && app?.storeUrl ? (
                <a
                  href={app.storeUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 rounded-full border border-zinc-300 px-5 py-2.5 font-bold text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  <ExternalLink className="h-4 w-4" />
                  {t('apps.detail.actions.openStore')}
                </a>
              ) : null}

              {installDocumentationUrl ? (
                <a
                  href={installDocumentationUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 rounded-full border border-zinc-300 px-5 py-2.5 font-bold text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  <ExternalLink className="h-4 w-4" />
                  {t('apps.detail.actions.docs')}
                </a>
              ) : null}

              {inspection && isInstalledTarget ? (
                <button
                  type="button"
                  onClick={handleUninstall}
                  disabled={installBusy}
                  className="flex items-center gap-2 rounded-full border border-zinc-300 px-6 py-2.5 font-bold text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  <RefreshCw className="h-4 w-4" />
                  {t('install.page.method.actions.uninstall')}
                </button>
              ) : null}

              <button
                type="button"
                aria-label={t('apps.detail.actions.share')}
                title={t('apps.detail.actions.share')}
                className="rounded-full p-2.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              >
                <Share className="h-5 w-5" />
              </button>
            </div>

            {inspection ? (
              <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/60">
                  <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    {t('apps.detail.cards.selectedProfile')}
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
                    {t('install.page.assessment.labels.runtime')}
                  </div>
                  <div className="mt-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {getPlatformLabel(t, inspection.target.runtimePlatform)}
                  </div>
                  <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    {t('apps.detail.hostValue', {
                      host: getPlatformLabel(t, inspection.target.hostPlatform),
                    })}
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/60">
                  <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    {t('apps.detail.cards.installationMethod')}
                  </div>
                  <div className="mt-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {installationMethod?.label || installTargetLabel || t('apps.detail.methodFallback')}
                  </div>
                  <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    {installationMethod
                      ? t(`install.page.assessment.methodType.${installationMethod.type}`, {
                          defaultValue: humanizeLabel(installationMethod.type) || installationMethod.type,
                        })
                      : getControlLevelLabel(t, inspection.assessment.installControlLevel)}
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/60">
                  <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    {t('apps.detail.cards.readiness')}
                  </div>
                  <div className="mt-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {readyToInstall
                      ? t('install.page.install.readyHint')
                      : t('install.page.install.labels.needsAttention')}
                  </div>
                  <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    {t('apps.detail.dependencyChecks', {
                      count: inspection.assessment.dependencies.length,
                    })}
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/60">
                  <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    {t('apps.detail.cards.installStatus')}
                  </div>
                  <div className="mt-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {getInstallStatusLabel(t, inspection.assessment.installStatus)}
                  </div>
                  <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    {t('apps.detail.installStatusNote')}
                  </div>
                </div>
              </div>
            ) : null}

            {assessmentError ? (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
                {assessmentError}
              </div>
            ) : null}

            {showExternalAccessOnly ? (
              <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-800 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200">
                {t('apps.detail.externalAccessDescription')}
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
                      {t('apps.detail.sections.installProfiles')}
                    </h3>
                    <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                      {t('apps.detail.sections.installProfilesDescription')}
                    </p>
                  </div>
                  <span className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300">
                    {t('apps.detail.installProfilesCount', { count: compatibleVariants.length })}
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
                              {getPlatformLabel(t, variant.runtimePlatform)}
                            </span>
                            {variant.installationMethod ? (
                              <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                                {t(`install.page.assessment.methodType.${variant.installationMethod.type}`, {
                                  defaultValue:
                                    humanizeLabel(variant.installationMethod.type) ||
                                    variant.installationMethod.type,
                                })}
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
                              {getPlatformLabel(t, hostPlatform)}
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
                              {isSelected ? t('apps.detail.actions.selected') : t('apps.detail.actions.useProfile')}
                            </button>
                          {variantDocs ? (
                            <a
                              href={variantDocs}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-2 rounded-full border border-zinc-200 px-4 py-2 text-xs font-bold text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              {t('apps.detail.actions.profileDocs')}
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
                      {t('apps.detail.sections.installReadiness')}
                    </h3>
                    <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                      {t('apps.detail.sections.installReadinessDescription')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={refreshInspection}
                    disabled={installBusy}
                    className="rounded-full border border-zinc-200 px-4 py-1.5 text-xs font-bold text-zinc-600 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    {t('install.page.assessment.actions.refresh')}
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
                          {getDependencyStatusLabel(t, dependency.status)}
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
                              {t('apps.detail.actions.fixDependency')}
                            </button>
                          ) : (
                            <span className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
                              {t('apps.detail.dependency.manualSetupRequired')}
                            </span>
                          )}
                          <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                            {t('apps.detail.dependency.check', {
                              check: getCheckTypeLabel(t, dependency.checkType),
                            })}
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
                      {t('apps.detail.sections.installationBlueprint')}
                    </h3>
                    <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                      {t('apps.detail.sections.installationBlueprintDescription')}
                    </p>
                  </div>

                  <div className="grid gap-4 xl:grid-cols-2">
                    <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                          {installationMethod?.label || t('apps.detail.methodFallback')}
                        </div>
                        {installationMethod ? (
                          <>
                            <span
                              className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wider ${getSupportTone(
                                installationMethod.supported,
                              )}`}
                            >
                              {getSupportLabel(t, installationMethod.supported)}
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
                          t('apps.detail.defaults.manifestSummary')}
                      </p>

                      {inspection.assessment.installation?.alternatives.length ? (
                        <div className="mt-4 space-y-2">
                          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                            {t('install.page.assessment.installation.alternatives')}
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
                                  {getSupportLabel(t, method.supported)}
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
                        {t('install.page.assessment.installation.directories')}
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
                                  {getDirectoryLabel(t, entry)}
                                </div>
                                <span className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                                  {entry.customizable
                                    ? t('install.page.assessment.installation.customizable')
                                    : t('install.page.assessment.installation.fixed')}
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
                            {t('install.page.assessment.installation.noDirectories')}
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
                      {t('apps.detail.sections.dataMigration')}
                    </h3>
                    <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                      {t('apps.detail.sections.dataMigrationDescription')}
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
                                {getDataKindLabel(t, item.kind)}
                              </span>
                              <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                                {getUninstallPolicyLabel(t, item.uninstallByDefault)}
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
                                {getMigrationModeLabel(t, strategy.mode)}
                              </span>
                              <span
                                className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wider ${getSupportTone(
                                  strategy.supported,
                                )}`}
                              >
                                {getSupportLabel(t, strategy.supported)}
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
                  {t('apps.detail.sections.summary')}
                </h3>
                <div className="grid gap-4 text-sm">
                  <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
                    <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      {t('apps.detail.summary.blockingIssues')}
                    </div>
                    <div className="mt-2 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                      {blockingIssues.length}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
                    <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      {t('apps.detail.summary.warnings')}
                    </div>
                    <div className="mt-2 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                      {warningIssues.length}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
                    <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      {t('apps.detail.summary.autoFixableDependencies')}
                    </div>
                    <div className="mt-2 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                      {autoRemediableDependencies.length}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
                    <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      {t('apps.detail.summary.elevatedSetup')}
                    </div>
                    <div className="mt-2 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                      {inspection.assessment.requiresElevatedSetup
                        ? t('apps.detail.summary.required')
                        : t('apps.detail.summary.notRequired')}
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
                    {t('apps.detail.sections.runtimeDetection')}
                  </h3>
                  <div className="grid gap-3">
                    <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
                      <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                        {t('apps.detail.runtime.hostPlatform')}
                      </div>
                      <div className="mt-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        {getPlatformLabel(t, runtime.hostPlatform)}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
                      <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                        {t('apps.detail.runtime.effectiveRuntime')}
                      </div>
                      <div className="mt-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        {getPlatformLabel(t, runtime.effectiveRuntimePlatform)}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
                      <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                        {t('apps.detail.runtime.containerRuntime')}
                      </div>
                      <div className="mt-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        {getPlatformLabel(t, runtime.resolvedContainerRuntime) || t('apps.detail.runtime.notApplicable')}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${getBooleanTone(
                          runtime.wslAvailable,
                        )}`}
                      >
                        {t('apps.detail.runtime.wsl', {
                          status: getBooleanLabel(t, runtime.wslAvailable),
                        })}
                      </span>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${getBooleanTone(
                          runtime.hostDockerAvailable,
                        )}`}
                      >
                        {t('apps.detail.runtime.hostDocker', {
                          status: getBooleanLabel(t, runtime.hostDockerAvailable),
                        })}
                      </span>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${getBooleanTone(
                          runtime.wslDockerAvailable,
                        )}`}
                      >
                        {t('apps.detail.runtime.wslDocker', {
                          status: getBooleanLabel(t, runtime.wslDockerAvailable),
                        })}
                      </span>
                    </div>

                    {runtime.availableWslDistributions.length > 0 ? (
                      <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
                        <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                          {t('install.page.assessment.labels.availableWslDistributions')}
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
                    {t('apps.detail.sections.guidance')}
                  </h3>

                  {installDocumentationUrl ? (
                    <a
                      href={installDocumentationUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-full border border-zinc-200 px-4 py-2 text-sm font-bold text-primary-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-primary-300 dark:hover:bg-zinc-800"
                    >
                      <ExternalLink className="h-4 w-4" />
                      {t('apps.detail.actions.openInstallationDocs')}
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
                    {t('apps.detail.sections.liveProgress')}
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
                      <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                        {t('apps.detail.progress.stage')}
                      </div>
                      <div className="mt-2 text-sm font-semibold text-zinc-100">
                        {humanizeLabel(progressSummary.currentStage) || t('apps.detail.progress.waiting')}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
                      <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                        {t('apps.detail.progress.step')}
                      </div>
                      <div className="mt-2 text-sm font-semibold text-zinc-100">
                        {progressSummary.currentStep || t('apps.detail.progress.waiting')}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                      {t('apps.detail.progress.recentOutput')}
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

        <div className="grid gap-12 md:grid-cols-3">
          <div className="space-y-8 md:col-span-2">
            {aboutText ? (
              <div>
                <h3 className="mb-4 text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                  {t('apps.detail.about')}
                </h3>
                <div className="prose prose-zinc max-w-none dark:prose-invert">
                  <p className="whitespace-pre-wrap leading-relaxed text-zinc-600 dark:text-zinc-400">
                    {aboutText}
                  </p>
                </div>
              </div>
            ) : null}

            {catalogNotes.length > 0 ? (
              <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-6 dark:border-zinc-800/50 dark:bg-zinc-900/50">
                <h4 className="mb-2 font-bold text-zinc-900 dark:text-zinc-100">
                  {t('apps.detail.catalogNotesTitle')}
                </h4>
                <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
                  {t('apps.detail.catalogNotesDescription')}
                </p>
                <div className="space-y-2 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                  {catalogNotes.map((note) => (
                    <p key={note}>- {note}</p>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className="space-y-6">
            <h3 className="mb-4 text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              {t('apps.detail.information')}
            </h3>

            <div className="space-y-4">
              {catalogMetadataFields.map((field) => (
                <div
                  key={field.id}
                  className="rounded-2xl border border-zinc-200 bg-zinc-50/90 p-4 dark:border-zinc-800 dark:bg-zinc-900/60"
                >
                  <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    {getCatalogMetadataFieldLabel(t, field.id)}
                  </div>
                  <div className="mt-2 break-words text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {field.value}
                  </div>
                </div>
              ))}

              {installDocumentationUrl ? (
                <a
                  href={installDocumentationUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-zinc-300 px-4 py-2 text-sm font-bold text-primary-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-primary-300 dark:hover:bg-zinc-800"
                >
                  <ExternalLink className="h-4 w-4" />
                  {t('apps.detail.actions.openInstallationDocs')}
                </a>
              ) : null}

              {blockingIssues.length ? (
                <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 dark:border-red-500/30 dark:bg-red-500/10">
                  <AlertTriangle className="h-5 w-5 shrink-0 text-red-500" />
                  <div className="text-sm text-red-700 dark:text-red-300">
                    {blockingIssues[0]?.message || t('apps.detail.installBlockedFallback')}
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
