import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRightLeft,
  Cloud,
  DownloadCloud,
  FolderOpen,
  Github,
  Package,
  RefreshCw,
  Server,
  Sparkles,
  SquareTerminal,
  Trash2,
  X,
} from 'lucide-react';
import {
  fileDialogService,
  getRuntimePlatform,
  platform,
  type HubInstallCatalogQuery,
  type HubInstallRequest,
  type HubUninstallRequest,
  type HubUninstallResult,
  type RuntimeEventUnsubscribe,
  type RuntimeInfo,
} from '@sdkwork/claw-infrastructure';
import { Checkbox } from '@sdkwork/claw-ui';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { GuidedInstallWizard, OpenClawGuidedInstallWizard } from '../../components';
import {
  buildInstallRecommendationSummary,
  detectOpenClawCatalogChoice,
  formatHubInstallProgressEvent,
  installerService,
  resolveOpenClawCatalogPresentation,
  selectProductInstallRecord,
  shouldReadProductInstallRecordEntry,
  type OpenClawCatalogChoice,
  type InstallChoiceAssessmentState,
} from '../../services';
import {
  PAGE_MODE_TABS,
  PRODUCTS,
  getHostOs,
  getInstallGridClassName,
  getRecommendedMethodId,
  getVisibleInstallChoices,
  getVisibleUninstallChoices,
  pathJoin,
  pathParent,
  type HostOs,
  type IconId,
  type LegacyInstallRecord,
  type MigrationCandidate,
  type MigrationId,
  type PageMode,
  type ProductConfig,
  type ProductId,
  type Status,
} from './installPageModel';

type ActionState =
  | {
      kind: 'uninstall';
      product: ProductConfig;
      methodId: string;
      methodLabel: string;
      request: HubUninstallRequest;
    };

type RuntimePaths = NonNullable<RuntimeInfo['paths']>;
type AssessmentStateMap = Partial<Record<string, InstallChoiceAssessmentState>>;

interface InstallSurfaceChoice {
  id: string;
  label: string;
  description: string;
  uninstallDescription: string;
  iconId: IconId;
  tags: string[];
  request: HubInstallRequest;
  uninstallRequest: HubUninstallRequest;
  supportedHosts: HostOs[];
  softwareName: string;
  runtimePlatform: 'host' | 'wsl';
}

function renderMethodIcon(iconId: IconId) {
  if (iconId === 'sparkles') return <Sparkles className="h-4 w-4" />;
  if (iconId === 'server') return <Server className="h-4 w-4" />;
  if (iconId === 'package') return <Package className="h-4 w-4" />;
  if (iconId === 'github') return <Github className="h-4 w-4" />;
  if (iconId === 'cloud') return <Cloud className="h-4 w-4" />;
  if (iconId === 'trash') return <Trash2 className="h-4 w-4" />;
  return <FolderOpen className="h-4 w-4" />;
}

async function firstExisting(paths: Array<string | null | undefined>) {
  for (const candidate of paths) {
    if (!candidate) continue;
    try {
      if (await platform.pathExists(candidate)) {
        return candidate;
      }
    } catch {}
  }

  return null;
}

function getChipTone(isActive: boolean) {
  return isActive
    ? 'border-primary-500/40 bg-primary-500/10 text-primary-700 dark:text-primary-300'
    : 'border-zinc-200 bg-white text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400';
}

function getRecommendationTone(state: string) {
  if (state === 'installed') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300';
  }

  if (state === 'ready') {
    return 'border-primary-500/30 bg-primary-500/10 text-primary-700 dark:text-primary-300';
  }

  if (state === 'setupNeeded') {
    return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300';
  }

  if (state === 'fixFirst') {
    return 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300';
  }

  return 'border-zinc-200 bg-white text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400';
}

function getTabIcon(mode: PageMode) {
  if (mode === 'install') return <DownloadCloud className="h-4 w-4" />;
  if (mode === 'migrate') return <ArrowRightLeft className="h-4 w-4" />;
  return <Trash2 className="h-4 w-4" />;
}

function appendTerminalOutput(previous: string, line: string) {
  const normalized = line.trimEnd();
  if (!normalized.trim()) {
    return previous;
  }

  return `${previous}${previous.endsWith('\n') || !previous ? '' : '\n'}${normalized}\n`;
}

function humanizeChoiceTag(value: string) {
  return value
    .split(/[-_]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

function toRuntimePlatform(value: string | null | undefined): 'host' | 'wsl' {
  return value === 'wsl' ? 'wsl' : 'host';
}

function toCatalogQuery(hostOs: HostOs): HubInstallCatalogQuery | undefined {
  if (hostOs === 'windows' || hostOs === 'macos') {
    return { hostPlatform: hostOs };
  }

  if (hostOs === 'linux') {
    return { hostPlatform: 'ubuntu' };
  }

  return undefined;
}

function buildStaticInstallChoices(
  product: ProductConfig,
  hostOs: HostOs,
  t: (key: string) => string,
): InstallSurfaceChoice[] {
  const uninstallById = new Map(
    getVisibleUninstallChoices(product, hostOs).map((choice) => [choice.id, choice]),
  );

  return getVisibleInstallChoices(product, hostOs).map((choice) => {
    const uninstallChoice = uninstallById.get(choice.id);

    return {
      id: choice.id,
      label: t(choice.titleKey),
      description: t(choice.descriptionKey),
      uninstallDescription: uninstallChoice ? t(uninstallChoice.descriptionKey) : t(choice.descriptionKey),
      iconId: choice.iconId,
      tags: [...choice.tags],
      request: choice.request,
      uninstallRequest: uninstallChoice?.request ?? {
        ...choice.request,
        purgeData: false,
      },
      supportedHosts: [...choice.supportedHosts],
      softwareName: choice.request.softwareName,
      runtimePlatform: toRuntimePlatform(choice.request.effectiveRuntimePlatform),
    };
  });
}

function buildStaticUninstallChoices(
  product: ProductConfig,
  hostOs: HostOs,
  t: (key: string) => string,
): InstallSurfaceChoice[] {
  const installById = new Map(product.methods.map((choice) => [choice.id, choice]));

  return getVisibleUninstallChoices(product, hostOs).map((choice) => {
    const installChoice = installById.get(choice.id);

    return {
      id: choice.id,
      label: t(choice.titleKey),
      description: installChoice ? t(installChoice.descriptionKey) : t(choice.descriptionKey),
      uninstallDescription: t(choice.descriptionKey),
      iconId: choice.iconId,
      tags: [...choice.tags],
      request: installChoice?.request ?? choice.request,
      uninstallRequest: choice.request,
      supportedHosts: [...choice.supportedHosts],
      softwareName: choice.request.softwareName,
      runtimePlatform: toRuntimePlatform(choice.request.effectiveRuntimePlatform),
    };
  });
}

async function refreshInstallRecord(
  runtimeInfo: RuntimeInfo | null,
  product: ProductConfig,
  hostOs: HostOs,
  setInstallRecord: (value: LegacyInstallRecord | null) => void,
) {
  const userRoot = runtimeInfo?.paths?.userRoot;
  if (!userRoot) {
    setInstallRecord(null);
    return;
  }

  const installRecordsDir = pathJoin(
    hostOs,
    userRoot,
    'hub-installer',
    'state',
    'install-records',
  );

  try {
    if (!(await platform.pathExists(installRecordsDir))) {
      setInstallRecord(null);
      return;
    }

    const entries = await platform.listDirectory(installRecordsDir);
    const candidateEntries = entries.filter(
      (entry) =>
        entry.kind === 'file' &&
        shouldReadProductInstallRecordEntry(product.id, entry.name),
    );

    if (!candidateEntries.length) {
      setInstallRecord(null);
      return;
    }

    const records = await Promise.all(
      candidateEntries.map(async (entry) => {
        try {
          return JSON.parse(await platform.readFile(entry.path)) as LegacyInstallRecord;
        } catch {
          return null;
        }
      }),
    );

    setInstallRecord(selectProductInstallRecord(product.id, records));
  } catch {
    setInstallRecord(null);
  }
}

async function refreshMigrationCandidates(
  runtimeInfo: RuntimeInfo | null,
  hostOs: HostOs,
  product: ProductConfig,
  installRecord: LegacyInstallRecord | null,
  customMigrationSource: string | null,
  setMigrationCandidates: (value: MigrationCandidate[]) => void,
  setSelectedMigrationIds: (value: MigrationId[]) => void,
) {
  const paths = runtimeInfo?.paths;
  if (!paths) {
    setMigrationCandidates([]);
    setSelectedMigrationIds([]);
    return;
  }

  const home =
    pathParent(pathParent(paths.userRoot)) ?? pathParent(paths.userRoot) ?? paths.userRoot;

  const nextCandidates = await Promise.all(
    product.migrationDefinitions.map(async (definition) => {
      const detectedPaths =
        definition.detectedSourceSegments?.map((segments) => pathJoin(hostOs, home, ...segments)) ??
        [];
      const sourcePath =
        definition.sourceKind === 'manual'
          ? customMigrationSource
          : await firstExisting([
              definition.installRecordField ? installRecord?.[definition.installRecordField] : null,
              ...detectedPaths,
            ]);

      return {
        id: definition.id,
        titleKey: definition.titleKey,
        descriptionKey: definition.descriptionKey,
        sourcePath,
        destinationRoot: pathJoin(
          hostOs,
          paths[definition.destinationRootKey as keyof RuntimePaths],
          ...definition.destinationSegments,
        ),
        sourceKind: definition.sourceKind,
      } satisfies MigrationCandidate;
    }),
  );

  const visibleCandidates = customMigrationSource
    ? nextCandidates
    : nextCandidates.filter((candidate) => candidate.sourceKind !== 'manual');

  setMigrationCandidates(visibleCandidates);
  setSelectedMigrationIds(
    visibleCandidates.filter((candidate) => candidate.sourcePath).map((candidate) => candidate.id),
  );
}

export function Install() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const progressUnsubscribeRef = useRef<RuntimeEventUnsubscribe | null>(null);
  const uninstallOutputRef = useRef<HTMLDivElement>(null);
  const migrationOutputRef = useRef<HTMLDivElement>(null);
  const requestedProductId = (searchParams.get('product') as ProductId | null) ?? 'openclaw';
  const requestedMode = (searchParams.get('mode') as PageMode | null) ?? 'install';

  const [productId, setProductId] = useState<ProductId>(
    PRODUCTS.some((item) => item.id === requestedProductId) ? requestedProductId : 'openclaw',
  );
  const [pageMode, setPageMode] = useState<PageMode>(
    PAGE_MODE_TABS.some((item) => item.id === requestedMode) ? requestedMode : 'install',
  );
  const [runtimeInfo, setRuntimeInfo] = useState<RuntimeInfo | null>(null);
  const [installRecord, setInstallRecord] = useState<LegacyInstallRecord | null>(null);
  const [installAssessments, setInstallAssessments] = useState<AssessmentStateMap>({});
  const [installWizardMethodId, setInstallWizardMethodId] = useState<string | null>(null);
  const [openClawCatalogChoices, setOpenClawCatalogChoices] = useState<OpenClawCatalogChoice[] | null>(
    null,
  );
  const [openClawRecommendedChoiceId, setOpenClawRecommendedChoiceId] = useState<string | null>(
    null,
  );
  const [customMigrationSource, setCustomMigrationSource] = useState<string | null>(null);
  const [migrationCandidates, setMigrationCandidates] = useState<MigrationCandidate[]>([]);
  const [selectedMigrationIds, setSelectedMigrationIds] = useState<MigrationId[]>([]);
  const [migrationStatus, setMigrationStatus] = useState<Status>('idle');
  const [migrationOutput, setMigrationOutput] = useState('');
  const [action, setAction] = useState<ActionState | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const [output, setOutput] = useState('');
  const [result, setResult] = useState<HubUninstallResult | null>(null);

  const product = useMemo(
    () => PRODUCTS.find((item) => item.id === productId) ?? PRODUCTS[0],
    [productId],
  );
  const hostOs = useMemo(() => getHostOs(runtimeInfo), [runtimeInfo]);
  const staticInstallChoices = useMemo(
    () => buildStaticInstallChoices(product, hostOs, t as (key: string) => string),
    [hostOs, product, t],
  );
  const staticUninstallChoices = useMemo(
    () => buildStaticUninstallChoices(product, hostOs, t as (key: string) => string),
    [hostOs, product, t],
  );
  const installChoices = useMemo(
    () =>
      product.id === 'openclaw' && openClawCatalogChoices?.length
        ? openClawCatalogChoices
        : staticInstallChoices,
    [openClawCatalogChoices, product.id, staticInstallChoices],
  );
  const uninstallChoices = useMemo(
    () =>
      product.id === 'openclaw' && openClawCatalogChoices?.length
        ? openClawCatalogChoices
        : staticUninstallChoices,
    [openClawCatalogChoices, product.id, staticUninstallChoices],
  );
  const selectedMigrationCandidates = useMemo(
    () =>
      migrationCandidates.filter(
        (candidate) => candidate.sourcePath && selectedMigrationIds.includes(candidate.id),
      ),
    [migrationCandidates, selectedMigrationIds],
  );
  const recommendedMethodId = useMemo(
    () =>
      product.id === 'openclaw' && openClawCatalogChoices?.length
        ? openClawRecommendedChoiceId ?? openClawCatalogChoices[0]?.id ?? null
        : getRecommendedMethodId(product, hostOs),
    [hostOs, openClawCatalogChoices, openClawRecommendedChoiceId, product],
  );
  const detectedInstallChoice = useMemo(
    () => detectOpenClawCatalogChoice(installRecord, installChoices),
    [installChoices, installRecord],
  );
  const activeInstallChoice = useMemo(
    () => installChoices.find((choice) => choice.id === installWizardMethodId) ?? null,
    [installChoices, installWizardMethodId],
  );
  const installRecommendationSummary = useMemo(
    () =>
      buildInstallRecommendationSummary({
        hostOs,
        arch: runtimeInfo?.system?.arch ?? null,
        productPreferredChoiceId: recommendedMethodId ?? installChoices[0]?.id ?? '',
        choices: installChoices.map((choice) => ({
          id: choice.id,
          softwareName: choice.request.softwareName,
          assessment: installAssessments[choice.id],
        })),
      }),
    [hostOs, installAssessments, installChoices, recommendedMethodId, runtimeInfo?.system?.arch],
  );
  const sortedInstallChoices = useMemo(() => {
    const rank = new Map(
      installRecommendationSummary.choices.map((choice, index) => [choice.id, index]),
    );
    return [...installChoices].sort(
      (left, right) => (rank.get(left.id) ?? 99) - (rank.get(right.id) ?? 99),
    );
  }, [installChoices, installRecommendationSummary.choices]);

  useEffect(() => {
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);
      next.set('product', productId);
      next.set('mode', pageMode);
      return next;
    });
  }, [pageMode, productId, setSearchParams]);

  useEffect(() => {
    void (async () => {
      const nextRuntimeInfo = await getRuntimePlatform().getRuntimeInfo();
      setRuntimeInfo(nextRuntimeInfo);
    })();

    return () => {
      void (async () => {
        const unsubscribe = progressUnsubscribeRef.current;
        progressUnsubscribeRef.current = null;
        if (unsubscribe) {
          await unsubscribe();
        }
      })();
    };
  }, []);

  useEffect(() => {
    if (uninstallOutputRef.current) {
      uninstallOutputRef.current.scrollTop = uninstallOutputRef.current.scrollHeight;
    }
  }, [output]);

  useEffect(() => {
    if (migrationOutputRef.current) {
      migrationOutputRef.current.scrollTop = migrationOutputRef.current.scrollHeight;
    }
  }, [migrationOutput]);

  useEffect(() => {
    void refreshInstallRecord(runtimeInfo, product, hostOs, setInstallRecord);
  }, [runtimeInfo, product, hostOs]);

  useEffect(() => {
    let cancelled = false;

    if (product.id !== 'openclaw' || hostOs === 'unknown') {
      setOpenClawCatalogChoices(null);
      setOpenClawRecommendedChoiceId(null);
      return;
    }

    void (async () => {
      try {
        const entries = await installerService.listHubInstallCatalog(toCatalogQuery(hostOs));
        const entry =
          entries.find((item) => item.appId === 'app-openclaw') ??
          entries.find((item) => item.defaultSoftwareName === 'openclaw') ??
          null;
        const presentation = resolveOpenClawCatalogPresentation(entry, hostOs);

        if (cancelled) {
          return;
        }

        setOpenClawCatalogChoices(presentation.installChoices.length ? presentation.installChoices : null);
        setOpenClawRecommendedChoiceId(presentation.recommendedChoiceId);
      } catch {
        if (cancelled) {
          return;
        }

        setOpenClawCatalogChoices(null);
        setOpenClawRecommendedChoiceId(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hostOs, product.id]);

  useEffect(() => {
    void refreshMigrationCandidates(
      runtimeInfo,
      hostOs,
      product,
      installRecord,
      customMigrationSource,
      setMigrationCandidates,
      setSelectedMigrationIds,
    );
  }, [customMigrationSource, hostOs, installRecord, product, runtimeInfo]);

  useEffect(() => {
    let cancelled = false;

    if (!installChoices.length) {
      setInstallAssessments({});
      return;
    }

    setInstallAssessments(
      installChoices.reduce<AssessmentStateMap>((accumulator, choice) => {
        accumulator[choice.id] = { status: 'loading' };
        return accumulator;
      }, {}),
    );

    void (async () => {
      const results = await Promise.all(
        installChoices.map(async (choice) => {
          try {
            const result = await installerService.inspectHubInstall(choice.request);
            return [choice.id, { status: 'success', result } satisfies InstallChoiceAssessmentState] as const;
          } catch (error: unknown) {
            return [
              choice.id,
              {
                status: 'error',
                error: error instanceof Error ? error.message : String(error),
              } satisfies InstallChoiceAssessmentState,
            ] as const;
          }
        }),
      );

      if (cancelled) {
        return;
      }

      setInstallAssessments(
        results.reduce<AssessmentStateMap>((accumulator, [id, assessment]) => {
          accumulator[id] = assessment;
          return accumulator;
        }, {}),
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [installChoices]);

  useEffect(() => {
    setInstallWizardMethodId(null);
  }, [pageMode, productId]);

  async function clearProgressSubscription() {
    const unsubscribe = progressUnsubscribeRef.current;
    progressUnsubscribeRef.current = null;
    if (unsubscribe) {
      await unsubscribe();
    }
  }

  async function refreshSelectedInstallAssessment(methodId: string) {
    const choice = installChoices.find((item) => item.id === methodId);
    if (!choice) {
      return;
    }

    setInstallAssessments((previous) => ({
      ...previous,
      [choice.id]: { status: 'loading', result: previous[choice.id]?.result },
    }));

    try {
      const assessment = await installerService.inspectHubInstall(choice.request);
      setInstallAssessments((previous) => ({
        ...previous,
        [choice.id]: { status: 'success', result: assessment },
      }));
    } catch (error: unknown) {
      setInstallAssessments((previous) => ({
        ...previous,
        [choice.id]: {
          status: 'error',
          error: error instanceof Error ? error.message : String(error),
        },
      }));
    }
  }

  async function handleInstallFinished(methodId: string) {
    await refreshInstallRecord(runtimeInfo, product, hostOs, setInstallRecord);
    await refreshSelectedInstallAssessment(methodId);
  }

  async function startAction() {
    if (!action) {
      return;
    }

    await clearProgressSubscription();

    setStatus('running');
    setResult(null);
    setOutput(
      `${t('install.page.modal.output.preparingUninstall', {
        product: t(action.product.nameKey),
        method: action.methodLabel,
      })}\n${t('install.page.modal.output.starting')}\n`,
    );

    progressUnsubscribeRef.current = await installerService.subscribeHubInstallProgress((event) => {
      const line = formatHubInstallProgressEvent(t as (key: string) => string, event).trim();
      if (!line) {
        return;
      }

      setOutput((previous) => appendTerminalOutput(previous, line));
    });

    try {
      const nextResult = await installerService.runHubUninstall(action.request);
      setResult(nextResult);
      setStatus(nextResult.success ? 'success' : 'error');
      setOutput((previous) =>
        appendTerminalOutput(
          previous,
          t(
            nextResult.success
              ? 'install.page.modal.output.completedUninstall'
              : 'install.page.modal.output.failedUninstall',
          ),
        ),
      );
    } catch (error: unknown) {
      setStatus('error');
      setOutput((previous) =>
        appendTerminalOutput(
          previous,
          `${t('install.page.modal.output.errorPrefix')}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        ),
      );
    } finally {
      await clearProgressSubscription();
      await refreshInstallRecord(runtimeInfo, product, hostOs, setInstallRecord);
    }
  }

  async function startMigration() {
    if (!selectedMigrationCandidates.length) {
      return;
    }

    setMigrationStatus('running');
    setMigrationOutput(`${t('install.page.migrate.output.starting')}\n`);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    let failed = false;

    for (const candidate of selectedMigrationCandidates) {
      try {
        const destination = pathJoin(hostOs, candidate.destinationRoot, `import-${stamp}`);
        await platform.createDirectory(candidate.destinationRoot);
        if (!(await platform.pathExists(candidate.sourcePath!))) {
          throw new Error(t('install.page.migrate.output.missing'));
        }

        await platform.copyPath(candidate.sourcePath!, destination);
        setMigrationOutput(
          (previous) =>
            `${previous}${t('install.page.migrate.output.copying', {
              title: t(candidate.titleKey),
            })}\n${t('install.page.migrate.output.completedSection')}\n`,
        );
      } catch (error: unknown) {
        failed = true;
        setMigrationOutput(
          (previous) =>
            `${previous}${t('install.page.modal.output.errorPrefix')}: ${
              error instanceof Error ? error.message : String(error)
            }\n`,
        );
      }
    }

    setMigrationStatus(failed ? 'error' : 'success');
    setMigrationOutput((previous) => {
      const key = failed
        ? 'install.page.migrate.output.partial'
        : 'install.page.migrate.output.completed';
      return `${previous}${t(key)}\n`;
    });
  }

  function openAction(nextAction: ActionState) {
    setAction(nextAction);
    setStatus('idle');
    setResult(null);
    setOutput('');
    setIsModalOpen(true);
  }

  return (
    <div className="h-full overflow-hidden bg-zinc-50 dark:bg-zinc-950">
      <div className="grid h-full grid-cols-1 md:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="border-b border-zinc-200 bg-white/90 p-4 dark:border-zinc-800 dark:bg-zinc-950/80 md:border-b-0 md:border-r">
          <div className="productSidebar space-y-2">
            {PRODUCTS.map((item) => {
              const active = item.id === product.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setProductId(item.id)}
                  className={`flex w-full items-center justify-between rounded-2xl border px-3 py-3 text-left text-sm font-semibold transition-colors ${
                    active
                      ? 'border-primary-500/40 bg-primary-500/10 text-zinc-950 dark:text-zinc-50'
                      : 'border-transparent bg-transparent text-zinc-500 hover:border-zinc-200 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:border-zinc-800 dark:hover:bg-zinc-900'
                  }`}
                >
                  <span>{t(item.nameKey)}</span>
                  {active && <span className="h-2.5 w-2.5 rounded-full bg-primary-500" />}
                </button>
              );
            })}
          </div>
        </aside>

        <main className="flex min-h-0 flex-col p-4 md:p-6">
          <div className="workspaceModeTabs mb-4 flex items-center justify-center">
            <div className="inline-flex rounded-2xl border border-zinc-200 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-900">
              {PAGE_MODE_TABS.map((tab) => {
                const active = tab.id === pageMode;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setPageMode(tab.id)}
                    title={t(tab.labelKey)}
                    aria-label={t(tab.labelKey)}
                    className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
                      active
                        ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                        : 'text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'
                    }`}
                  >
                    {getTabIcon(tab.id)}
                    <span>{t(tab.labelKey)}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {pageMode === 'install' && (
              <div
                className={`currentInstallChoices grid gap-4 ${getInstallGridClassName(
                  sortedInstallChoices.length,
                )}`}
              >
                {sortedInstallChoices.map((choice) => {
                  const recommendation =
                    installRecommendationSummary.choices.find((item) => item.id === choice.id) ?? null;
                  const assessment = installAssessments[choice.id];
                  const isFeatured = installRecommendationSummary.primaryChoice?.id === choice.id;
                  const issueText =
                    recommendation?.primaryIssue ||
                    assessment?.result?.recommendations?.[0] ||
                    choice.description;
                  const stateLabelKey =
                    recommendation?.state === 'installed'
                      ? 'install.page.install.states.installed'
                      : recommendation?.state === 'ready'
                        ? 'install.page.install.states.ready'
                        : recommendation?.state === 'setupNeeded'
                          ? 'install.page.install.states.setupNeeded'
                          : recommendation?.state === 'fixFirst'
                            ? 'install.page.install.states.fixFirst'
                            : recommendation?.state === 'comingSoon'
                              ? 'install.page.install.states.comingSoon'
                              : 'install.page.install.states.checking';

                  return (
                    <section
                      key={choice.id}
                      className="recommended-action rounded-[1.75rem] border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
                    >
                      <div className="mb-4 flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-zinc-200 bg-zinc-100 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">
                            {renderMethodIcon(choice.iconId)}
                          </div>
                          <div>
                            <div className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                              {choice.label}
                            </div>
                            <div className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                              {choice.description}
                            </div>
                          </div>
                        </div>
                        {isFeatured && (
                          <span className="rounded-full border border-primary-500/30 bg-primary-500/10 px-2.5 py-1 text-xs font-semibold text-primary-700 dark:text-primary-300">
                            {t('install.page.install.autoDetection.featuredBadge')}
                          </span>
                        )}
                      </div>

                      <div className="mb-4 flex flex-wrap gap-2">
                        <span
                          className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${getRecommendationTone(
                            recommendation?.state ?? 'checking',
                          )}`}
                        >
                          {t(stateLabelKey)}
                        </span>
                        {choice.tags.slice(0, 3).map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full border border-zinc-200 px-2.5 py-1 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400"
                          >
                            {(() => {
                              const key = `install.page.tags.${tag}`;
                              const label = t(key);
                              return label === key ? humanizeChoiceTag(tag) : label;
                            })()}
                          </span>
                        ))}
                      </div>

                      <div className="mb-4 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
                        <div className="font-medium text-zinc-900 dark:text-zinc-100">
                          {t(
                            `install.page.install.recommendationReasons.${
                              recommendation?.recommendationReason ?? 'platformPreferred'
                            }`,
                            {
                              method: choice.label,
                            },
                          )}
                        </div>
                        <div className="mt-2 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                          {issueText}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setInstallWizardMethodId(choice.id)}
                        className="w-full rounded-xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                      >
                        {t('install.page.method.actions.install')}
                      </button>
                    </section>
                  );
                })}
              </div>
            )}

            {pageMode === 'uninstall' && (
              <div
                className={`currentUninstallChoices grid gap-4 ${getInstallGridClassName(
                  uninstallChoices.length,
                )}`}
              >
                {uninstallChoices.map((choice) => {
                  const matched = detectedInstallChoice?.id === choice.id;
                  const instanceLabel = matched
                    ? installRecord?.installRoot ?? t('install.page.uninstall.detected.notFound')
                    : t('install.page.uninstall.detected.notFound');

                  return (
                    <section
                      key={choice.id}
                      className="rounded-[1.75rem] border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
                    >
                      <div className="mb-4 flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-zinc-200 bg-zinc-100 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">
                            {renderMethodIcon(choice.iconId)}
                          </div>
                          <div>
                            <div className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                              {choice.label}
                            </div>
                            <div className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                              {choice.uninstallDescription}
                            </div>
                          </div>
                        </div>
                        <span
                          className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${getChipTone(
                            matched,
                          )}`}
                        >
                          {matched
                            ? t('install.page.uninstall.detected.title')
                            : t('install.page.uninstall.detected.notFound')}
                        </span>
                      </div>

                      <div className="mb-4 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
                        {instanceLabel}
                      </div>

                      <button
                        type="button"
                        disabled={!matched}
                        onClick={() =>
                          openAction({
                            kind: 'uninstall',
                            product,
                            methodId: choice.id,
                            methodLabel: choice.label,
                            request: choice.uninstallRequest,
                          })
                        }
                        className="w-full rounded-xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-400 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500"
                      >
                        {t('install.page.method.actions.uninstall')}
                      </button>
                    </section>
                  );
                })}
              </div>
            )}

            {pageMode === 'migrate' && (
              <div className="currentMigrationCandidates space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-semibold ${getChipTone(
                      detectedInstallChoice !== null,
                    )}`}
                  >
                    {detectedInstallChoice
                      ? detectedInstallChoice.label
                      : t('install.page.uninstall.detected.notFound')}
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      void refreshMigrationCandidates(
                        runtimeInfo,
                        hostOs,
                        product,
                        installRecord,
                        customMigrationSource,
                        setMigrationCandidates,
                        setSelectedMigrationIds,
                      )
                    }
                    className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    <span className="inline-flex items-center gap-2">
                      <RefreshCw className="h-4 w-4" />
                      {t('install.page.migrate.actions.rescan')}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      void (async () => {
                        const selected = await fileDialogService.selectDirectory({
                          title: t('install.page.migrate.actions.selectSource'),
                        });
                        if (selected) {
                          setCustomMigrationSource(selected);
                        }
                      })();
                    }}
                    className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    <span className="inline-flex items-center gap-2">
                      <FolderOpen className="h-4 w-4" />
                      {t('install.page.migrate.actions.selectSource')}
                    </span>
                  </button>

                  {customMigrationSource && (
                    <button
                      type="button"
                      onClick={() => setCustomMigrationSource(null)}
                      className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      <span className="inline-flex items-center gap-2">
                        <X className="h-4 w-4" />
                        {t('install.page.migrate.actions.clearSource')}
                      </span>
                    </button>
                  )}
                </div>

                <div
                  className={`grid gap-4 ${getInstallGridClassName(migrationCandidates.length)}`}
                >
                  {migrationCandidates.map((candidate) => (
                    <label
                      key={candidate.id}
                      className="flex cursor-pointer items-start gap-4 rounded-[1.75rem] border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
                    >
                      <Checkbox
                        checked={selectedMigrationIds.includes(candidate.id)}
                        disabled={!candidate.sourcePath || migrationStatus === 'running'}
                        onCheckedChange={() =>
                          setSelectedMigrationIds((previous) =>
                            previous.includes(candidate.id)
                              ? previous.filter((value) => value !== candidate.id)
                              : [...previous, candidate.id],
                          )
                        }
                        aria-label={t(candidate.titleKey)}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-zinc-200 bg-zinc-100 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">
                            <FolderOpen className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-base font-semibold text-zinc-900 dark:text-zinc-100">
                              {t(candidate.titleKey)}
                            </div>
                            <div className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                              {t(candidate.descriptionKey)}
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 space-y-3 text-sm">
                          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
                            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                              {t('install.page.migrate.labels.source')}
                            </div>
                            <div className="break-all text-zinc-700 dark:text-zinc-300">
                              {candidate.sourcePath ?? t('install.page.migrate.labels.notFound')}
                            </div>
                          </div>

                          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
                            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                              {t('install.page.migrate.labels.destination')}
                            </div>
                            <div className="break-all text-zinc-700 dark:text-zinc-300">
                              {candidate.destinationRoot}
                            </div>
                          </div>
                        </div>
                      </div>
                    </label>
                  ))}
                </div>

                <div className="rounded-[1.75rem] border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-semibold ${getChipTone(
                        migrationStatus === 'success',
                      )}`}
                    >
                      {t(`install.page.migrate.status.${migrationStatus}`)}
                    </span>
                    <button
                      type="button"
                      onClick={() => void startMigration()}
                      disabled={migrationStatus === 'running' || !selectedMigrationCandidates.length}
                      className="rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-400 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500"
                    >
                      {t('install.page.migrate.actions.start')}
                    </button>
                  </div>

                  <div className="flex h-64 flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950">
                    <div className="flex items-center gap-2 border-b border-zinc-800 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                      <SquareTerminal className="h-4 w-4" />
                      {t('install.page.migrate.output.title')}
                    </div>
                    <div
                      ref={migrationOutputRef}
                      className="flex-1 overflow-y-auto p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap text-zinc-300"
                    >
                      {migrationOutput || t('install.page.migrate.output.placeholder')}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
      {activeInstallChoice &&
        (product.id === 'openclaw' ? (
          <OpenClawGuidedInstallWizard
            isOpen={Boolean(activeInstallChoice)}
            productName={t(product.nameKey)}
            methodLabel={activeInstallChoice.label}
            methodIcon={renderMethodIcon(activeInstallChoice.iconId)}
            request={activeInstallChoice.request}
            onClose={() => setInstallWizardMethodId(null)}
            onInstallSuccess={() => {
              void handleInstallFinished(activeInstallChoice.id);
            }}
          />
        ) : (
          <GuidedInstallWizard
            isOpen={Boolean(activeInstallChoice)}
            productName={t(product.nameKey)}
            methodLabel={activeInstallChoice.label}
            methodIcon={renderMethodIcon(activeInstallChoice.iconId)}
            request={activeInstallChoice.request}
            onClose={() => setInstallWizardMethodId(null)}
            onInstalled={() => {
              void handleInstallFinished(activeInstallChoice.id);
            }}
          />
        ))}

      {isModalOpen && action && (
        <div className="fixed inset-0 z-[90] flex min-h-screen items-center justify-center bg-zinc-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-3xl rounded-[2rem] border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
              <div>
                <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  {t(action.product.nameKey)} / {action.methodLabel}
                </div>
                <div className="mt-1 text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  {t('install.page.method.actions.uninstall')}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                disabled={status === 'running'}
                className="rounded-xl border border-zinc-200 p-2 text-zinc-500 transition-colors hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 px-6 py-5">
              <span
                className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getChipTone(
                  status === 'success',
                )}`}
              >
                {t(`install.page.modal.status.${action.kind}.${status}`)}
              </span>

              <div className="flex h-80 flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950">
                <div className="flex items-center gap-2 border-b border-zinc-800 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                  <SquareTerminal className="h-4 w-4" />
                  {t('install.page.modal.terminalOutput')}
                </div>
                <div
                  ref={uninstallOutputRef}
                  className="flex-1 overflow-y-auto p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap text-zinc-300"
                >
                  {output}
                </div>
              </div>

              {result && (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm dark:border-zinc-800 dark:bg-zinc-950">
                    <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                      {t('install.page.modal.result.installRoot')}
                    </div>
                    <div className="break-all text-zinc-700 dark:text-zinc-300">
                      {result.resolvedInstallRoot}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm dark:border-zinc-800 dark:bg-zinc-950">
                    <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                      {t('install.page.modal.result.dataRoot')}
                    </div>
                    <div className="break-all text-zinc-700 dark:text-zinc-300">
                      {result.resolvedDataRoot}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 border-t border-zinc-200 px-6 py-4 dark:border-zinc-800">
              {status === 'idle' ? (
                <>
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-semibold text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="button"
                    onClick={() => void startAction()}
                    className="rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                  >
                    {t('install.page.modal.actions.startUninstall')}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={status === 'running'}
                  className="rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 dark:disabled:bg-zinc-800"
                >
                  {status === 'running' ? t('common.loading') : t('install.page.modal.actions.close')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
