import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  AlertCircle,
  ArrowRightLeft,
  CheckCircle2,
  Cloud,
  Cpu,
  DownloadCloud,
  FileText,
  FolderOpen,
  Github,
  Package,
  Play,
  RefreshCw,
  Server,
  Sparkles,
  SquareTerminal,
  Trash2,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import {
  fileDialogService,
  getRuntimePlatform,
  platform,
  type HubInstallAssessmentResult,
  type HubInstallRequest,
  type HubInstallResult,
  type HubUninstallRequest,
  type HubUninstallResult,
  type RuntimeEventUnsubscribe,
  type RuntimeInfo,
} from '@sdkwork/claw-infrastructure';
import { Checkbox } from '@sdkwork/claw-ui';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { HubInstallDescriptorSummary, OpenClawGuidedInstallWizard } from '../../components';
import {
  applyHubInstallResultToProgressState,
  buildInstallRecommendationSummary,
  createHubInstallProgressState,
  formatHubInstallProgressEvent,
  humanizeHubInstallProgressLabel,
  installerService,
  reduceHubInstallProgressEvent,
} from '../../services';

type ProductId = 'openclaw' | 'zeroclaw' | 'ironclaw';
type PageMode = 'install' | 'uninstall' | 'migrate';
type HostOs = 'windows' | 'macos' | 'linux' | 'unknown';
type Status = 'idle' | 'running' | 'success' | 'error';
type MethodId = 'wsl' | 'docker' | 'npm' | 'pnpm' | 'source' | 'cloud';
type TagId =
  | 'cargo'
  | 'cloud'
  | 'docker'
  | 'git'
  | 'linux'
  | 'macos'
  | 'managed'
  | 'nodejs'
  | 'npm'
  | 'pnpm'
  | 'postgresql'
  | 'rust'
  | 'security'
  | 'source'
  | 'windows'
  | 'wsl';
type MigrationId = 'config' | 'data' | 'workspace' | 'logs' | 'manual';

type InstallChoice = {
  id: MethodId;
  titleKey: string;
  descriptionKey: string;
  icon: React.ReactNode;
  tags: TagId[];
  request: HubInstallRequest;
  supportedHosts: HostOs[];
  disabled?: boolean;
};

type UninstallChoice = {
  id: Exclude<MethodId, 'cloud'>;
  titleKey: string;
  descriptionKey: string;
  icon: React.ReactNode;
  tags: TagId[];
  request: HubUninstallRequest;
  supportedHosts: HostOs[];
};

type ActionState =
  | { kind: 'install'; product: ProductConfig; choice: InstallChoice }
  | { kind: 'uninstall'; product: ProductConfig; choice: UninstallChoice };

type LegacyInstallRecord = {
  manifestName: string;
  installRoot: string;
  workRoot: string;
  dataRoot: string;
  status: string;
};

type RuntimePaths = NonNullable<RuntimeInfo['paths']>;

type MigrationDefinition = {
  id: MigrationId;
  titleKey: string;
  descriptionKey: string;
  destinationRootKey: 'configDir' | 'dataDir' | 'workspacesDir' | 'logsDir';
  destinationSegments: string[];
  detectedSourceSegments?: string[][];
  installRecordField?: keyof Pick<LegacyInstallRecord, 'dataRoot' | 'workRoot'>;
  sourceKind: 'detected' | 'manual';
};

type ProductConfig = {
  id: ProductId;
  nameKey: string;
  descriptionKey: string;
  accent: string;
  recommendedMethodId: MethodId;
  recommendedMethodByHost?: Partial<Record<Exclude<HostOs, 'unknown'>, MethodId>>;
  methods: InstallChoice[];
  uninstallMethods: UninstallChoice[];
  migrationDefinitions: MigrationDefinition[];
  legacyRecordFileName: string;
};

type MigrationCandidate = {
  id: MigrationId;
  titleKey: string;
  descriptionKey: string;
  sourcePath: string | null;
  destinationRoot: string;
  sourceKind: 'detected' | 'manual';
};

type AssessmentLoadStatus = 'idle' | 'loading' | 'success' | 'error';

type InstallAssessmentState = {
  status: AssessmentLoadStatus;
  result?: HubInstallAssessmentResult;
  error?: string;
};

const INSTALL_ASSESSMENT_RECHECK_INTERVAL_MS = 45000;

const PAGE_MODE_TABS: Array<{
  id: PageMode;
  labelKey:
    | 'install.page.tabs.install'
    | 'install.page.tabs.uninstall'
    | 'install.page.tabs.migrate';
}> = [
  { id: 'install', labelKey: 'install.page.tabs.install' },
  { id: 'uninstall', labelKey: 'install.page.tabs.uninstall' },
  { id: 'migrate', labelKey: 'install.page.tabs.migrate' },
];

function createLegacyRecordFileName(productId: ProductId) {
  return `${productId}.json`;
}

function createMigrationDefinitions(productId: ProductId): MigrationDefinition[] {
  const hiddenRoot = `.${productId}`;
  const definitions: MigrationDefinition[] = [
    {
      id: 'config',
      titleKey: 'install.page.migrate.sections.config.title',
      descriptionKey: 'install.page.migrate.sections.config.description',
      destinationRootKey: 'configDir',
      destinationSegments: [productId],
      detectedSourceSegments: [[hiddenRoot], ['.config', productId]],
      sourceKind: 'detected',
    },
    {
      id: 'data',
      titleKey: 'install.page.migrate.sections.data.title',
      descriptionKey: 'install.page.migrate.sections.data.description',
      destinationRootKey: 'dataDir',
      destinationSegments: [productId],
      detectedSourceSegments: [['.local', 'share', productId]],
      installRecordField: 'dataRoot',
      sourceKind: 'detected',
    },
    {
      id: 'workspace',
      titleKey: 'install.page.migrate.sections.workspace.title',
      descriptionKey: 'install.page.migrate.sections.workspace.description',
      destinationRootKey: 'workspacesDir',
      destinationSegments: [productId],
      detectedSourceSegments: [[hiddenRoot, 'workspace']],
      installRecordField: 'workRoot',
      sourceKind: 'detected',
    },
    {
      id: 'logs',
      titleKey: 'install.page.migrate.sections.logs.title',
      descriptionKey: 'install.page.migrate.sections.logs.description',
      destinationRootKey: 'logsDir',
      destinationSegments: [productId],
      detectedSourceSegments: [[hiddenRoot, 'logs'], ['.local', 'state', productId]],
      sourceKind: 'detected',
    },
    {
      id: 'manual',
      titleKey: 'install.page.migrate.sections.manual.title',
      descriptionKey: 'install.page.migrate.sections.manual.description',
      destinationRootKey: 'dataDir',
      destinationSegments: [productId, 'imports'],
      sourceKind: 'manual',
    },
  ];

  if (productId === 'ironclaw') {
    return definitions.filter((definition) => definition.id !== 'data');
  }

  return definitions;
}

const OPENCLAW_METHODS: InstallChoice[] = [
  {
    id: 'wsl',
    titleKey: 'install.page.methods.wsl.title',
    descriptionKey: 'install.page.methods.wsl.description',
    icon: <Sparkles className="h-6 w-6 text-primary-500 dark:text-primary-400" />,
    tags: ['wsl', 'windows', 'managed'],
    request: { softwareName: 'openclaw-wsl', effectiveRuntimePlatform: 'wsl' },
    supportedHosts: ['windows'],
  },
  {
    id: 'docker',
    titleKey: 'install.page.methods.docker.title',
    descriptionKey: 'install.page.methods.docker.description',
    icon: <Server className="h-6 w-6 text-emerald-500 dark:text-emerald-400" />,
    tags: ['docker', 'windows', 'macos', 'linux'],
    request: { softwareName: 'openclaw-docker', containerRuntimePreference: 'auto' },
    supportedHosts: ['windows', 'macos', 'linux'],
  },
  {
    id: 'npm',
    titleKey: 'install.page.methods.npm.title',
    descriptionKey: 'install.page.methods.npm.description',
    icon: <Package className="h-6 w-6 text-sky-500 dark:text-sky-400" />,
    tags: ['nodejs', 'npm', 'windows', 'macos', 'linux'],
    request: { softwareName: 'openclaw-npm' },
    supportedHosts: ['windows', 'macos', 'linux'],
  },
  {
    id: 'pnpm',
    titleKey: 'install.page.methods.pnpm.title',
    descriptionKey: 'install.page.methods.pnpm.description',
    icon: <Package className="h-6 w-6 text-amber-500 dark:text-amber-400" />,
    tags: ['nodejs', 'pnpm', 'windows', 'macos', 'linux'],
    request: { softwareName: 'openclaw-pnpm' },
    supportedHosts: ['windows', 'macos', 'linux'],
  },
  {
    id: 'source',
    titleKey: 'install.page.methods.source.title',
    descriptionKey: 'install.page.methods.source.description',
    icon: <Github className="h-6 w-6 text-zinc-700 dark:text-zinc-300" />,
    tags: ['source', 'git', 'windows', 'macos', 'linux'],
    request: { softwareName: 'openclaw-source' },
    supportedHosts: ['windows', 'macos', 'linux'],
  },
  {
    id: 'cloud',
    titleKey: 'install.page.methods.cloud.title',
    descriptionKey: 'install.page.methods.cloud.description',
    icon: <Cloud className="h-6 w-6 text-slate-500 dark:text-slate-400" />,
    tags: ['cloud'],
    request: { softwareName: 'openclaw-cloud' },
    supportedHosts: ['windows', 'macos', 'linux'],
    disabled: true,
  },
];

const ZEROCLAW_METHODS: InstallChoice[] = [
  {
    id: 'source',
    titleKey: 'install.page.methods.zeroclawSource.title',
    descriptionKey: 'install.page.methods.zeroclawSource.description',
    icon: <Github className="h-6 w-6 text-cyan-600 dark:text-cyan-400" />,
    tags: ['source', 'git', 'rust', 'cargo'],
    request: { softwareName: 'zeroclaw-source' },
    supportedHosts: ['windows', 'macos', 'linux'],
  },
];

const IRONCLAW_METHODS: InstallChoice[] = [
  {
    id: 'source',
    titleKey: 'install.page.methods.ironclawSource.title',
    descriptionKey: 'install.page.methods.ironclawSource.description',
    icon: <Github className="h-6 w-6 text-amber-600 dark:text-amber-400" />,
    tags: ['source', 'git', 'rust', 'postgresql', 'security'],
    request: { softwareName: 'ironclaw-source' },
    supportedHosts: ['windows', 'macos', 'linux'],
  },
];

const OPENCLAW_UNINSTALL_METHODS: UninstallChoice[] = [
  {
    id: 'wsl',
    titleKey: 'install.page.methods.wsl.title',
    descriptionKey: 'install.page.uninstall.methods.wsl.description',
    icon: <Trash2 className="h-6 w-6 text-primary-500 dark:text-primary-400" />,
    tags: ['wsl', 'windows'],
    request: { softwareName: 'openclaw-wsl', effectiveRuntimePlatform: 'wsl', purgeData: false },
    supportedHosts: ['windows'],
  },
  {
    id: 'docker',
    titleKey: 'install.page.methods.docker.title',
    descriptionKey: 'install.page.uninstall.methods.docker.description',
    icon: <Trash2 className="h-6 w-6 text-emerald-500 dark:text-emerald-400" />,
    tags: ['docker', 'windows', 'macos', 'linux'],
    request: { softwareName: 'openclaw-docker', purgeData: false },
    supportedHosts: ['windows', 'macos', 'linux'],
  },
  {
    id: 'npm',
    titleKey: 'install.page.methods.npm.title',
    descriptionKey: 'install.page.uninstall.methods.npm.description',
    icon: <Trash2 className="h-6 w-6 text-sky-500 dark:text-sky-400" />,
    tags: ['npm', 'windows', 'macos', 'linux'],
    request: { softwareName: 'openclaw-npm', purgeData: false },
    supportedHosts: ['windows', 'macos', 'linux'],
  },
  {
    id: 'pnpm',
    titleKey: 'install.page.methods.pnpm.title',
    descriptionKey: 'install.page.uninstall.methods.pnpm.description',
    icon: <Trash2 className="h-6 w-6 text-amber-500 dark:text-amber-400" />,
    tags: ['pnpm', 'windows', 'macos', 'linux'],
    request: { softwareName: 'openclaw-pnpm', purgeData: false },
    supportedHosts: ['windows', 'macos', 'linux'],
  },
  {
    id: 'source',
    titleKey: 'install.page.methods.source.title',
    descriptionKey: 'install.page.uninstall.methods.source.description',
    icon: <Trash2 className="h-6 w-6 text-zinc-700 dark:text-zinc-300" />,
    tags: ['source', 'git', 'windows', 'macos', 'linux'],
    request: { softwareName: 'openclaw-source', purgeData: false },
    supportedHosts: ['windows', 'macos', 'linux'],
  },
];

const ZEROCLAW_UNINSTALL_METHODS: UninstallChoice[] = [
  {
    id: 'source',
    titleKey: 'install.page.methods.zeroclawSource.title',
    descriptionKey: 'install.page.uninstall.methods.zeroclawSource.description',
    icon: <Trash2 className="h-6 w-6 text-cyan-600 dark:text-cyan-400" />,
    tags: ['source', 'git', 'rust', 'cargo'],
    request: { softwareName: 'zeroclaw-source', purgeData: false },
    supportedHosts: ['windows', 'macos', 'linux'],
  },
];

const IRONCLAW_UNINSTALL_METHODS: UninstallChoice[] = [
  {
    id: 'source',
    titleKey: 'install.page.methods.ironclawSource.title',
    descriptionKey: 'install.page.uninstall.methods.ironclawSource.description',
    icon: <Trash2 className="h-6 w-6 text-amber-600 dark:text-amber-400" />,
    tags: ['source', 'git', 'rust', 'postgresql', 'security'],
    request: { softwareName: 'ironclaw-source', purgeData: false },
    supportedHosts: ['windows', 'macos', 'linux'],
  },
];

const PRODUCT_MIGRATION_NOTES: Partial<
  Record<ProductId, { titleKey: string; descriptionKey: string }>
> = {
  ironclaw: {
    titleKey: 'install.page.migrate.notes.ironclaw.title',
    descriptionKey: 'install.page.migrate.notes.ironclaw.description',
  },
};

const PRODUCTS: ProductConfig[] = [
  {
    id: 'openclaw',
    nameKey: 'install.page.products.openclaw.name',
    descriptionKey: 'install.page.products.openclaw.description',
    accent: 'from-primary-500/15 via-primary-500/5 to-transparent',
    recommendedMethodId: 'npm',
    recommendedMethodByHost: {
      windows: 'wsl',
      macos: 'npm',
      linux: 'npm',
    },
    methods: OPENCLAW_METHODS,
    uninstallMethods: OPENCLAW_UNINSTALL_METHODS,
    migrationDefinitions: createMigrationDefinitions('openclaw'),
    legacyRecordFileName: createLegacyRecordFileName('openclaw'),
  },
  {
    id: 'zeroclaw',
    nameKey: 'install.page.products.zeroclaw.name',
    descriptionKey: 'install.page.products.zeroclaw.description',
    accent: 'from-cyan-500/15 via-cyan-500/5 to-transparent',
    recommendedMethodId: 'source',
    methods: ZEROCLAW_METHODS,
    uninstallMethods: ZEROCLAW_UNINSTALL_METHODS,
    migrationDefinitions: createMigrationDefinitions('zeroclaw'),
    legacyRecordFileName: createLegacyRecordFileName('zeroclaw'),
  },
  {
    id: 'ironclaw',
    nameKey: 'install.page.products.ironclaw.name',
    descriptionKey: 'install.page.products.ironclaw.description',
    accent: 'from-amber-500/20 via-amber-500/5 to-transparent',
    recommendedMethodId: 'source',
    methods: IRONCLAW_METHODS,
    uninstallMethods: IRONCLAW_UNINSTALL_METHODS,
    migrationDefinitions: createMigrationDefinitions('ironclaw'),
    legacyRecordFileName: createLegacyRecordFileName('ironclaw'),
  },
];

function getHostOs(runtimeInfo: RuntimeInfo | null): HostOs {
  const os = runtimeInfo?.system?.os?.toLowerCase() ?? '';
  if (os.includes('win')) return 'windows';
  if (os.includes('mac') || os.includes('darwin')) return 'macos';
  if (os.includes('linux') || os.includes('ubuntu')) return 'linux';
  return 'unknown';
}

function pathJoin(hostOs: HostOs, ...parts: Array<string | null | undefined>) {
  const items = parts.filter(Boolean) as string[];
  if (!items.length) return '';
  const sep = hostOs === 'windows' ? '\\' : '/';
  return items.reduce((acc, item) => `${acc.replace(/[\\/]+$/, '')}${sep}${item.replace(/^[\\/]+/, '')}`);
}

function pathParent(value: string | null | undefined) {
  if (!value) return null;
  const clean = value.replace(/[\\/]+$/, '');
  const index = Math.max(clean.lastIndexOf('/'), clean.lastIndexOf('\\'));
  return index > 0 ? clean.slice(0, index) : null;
}

async function firstExisting(paths: Array<string | null | undefined>) {
  for (const candidate of paths) {
    if (!candidate) continue;
    try {
      if (await platform.pathExists(candidate)) return candidate;
    } catch {}
  }
  return null;
}

function supports(hostOs: HostOs, choice: { id: string; supportedHosts: HostOs[] }) {
  return hostOs === 'unknown' ? choice.id !== 'wsl' : choice.supportedHosts.includes(hostOs);
}

function getRecommendedMethodId(product: ProductConfig, hostOs: HostOs) {
  if (hostOs !== 'unknown' && product.recommendedMethodByHost?.[hostOs]) {
    return product.recommendedMethodByHost[hostOs];
  }

  return product.recommendedMethodId;
}

function getInstallRequestKey(request: HubInstallRequest) {
  return JSON.stringify({
    softwareName: request.softwareName,
    effectiveRuntimePlatform: request.effectiveRuntimePlatform ?? null,
    containerRuntimePreference: request.containerRuntimePreference ?? null,
    wslDistribution: request.wslDistribution ?? null,
  });
}

function getAssessmentCounts(assessment?: HubInstallAssessmentResult) {
  return {
    blockers: assessment?.issues.filter((item) => item.severity === 'error').length ?? 0,
    warnings: assessment?.issues.filter((item) => item.severity === 'warning').length ?? 0,
    autoFixes:
      assessment?.dependencies.filter(
        (item) => item.status === 'remediable' && item.supportsAutoRemediation,
      ).length ?? 0,
  };
}

function getRecommendationStateStatusKey(state: string) {
  if (state === 'installed') return 'install.page.assessment.status.installed';
  if (state === 'ready') return 'install.page.assessment.status.ready';
  if (state === 'setupNeeded') return 'install.page.assessment.status.needsSetup';
  if (state === 'fixFirst') return 'install.page.assessment.status.blocked';
  if (state === 'comingSoon') return 'install.page.install.states.comingSoon';
  return 'install.page.assessment.status.inspecting';
}

function getRecommendationStateTone(state: string) {
  if (state === 'installed') {
    return 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-300';
  }

  if (state === 'ready') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300';
  }

  if (state === 'setupNeeded') {
    return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300';
  }

  if (state === 'fixFirst') {
    return 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300';
  }

  return 'border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300';
}

function getSignalTone(value: boolean | null) {
  if (value === true) {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300';
  }

  if (value === false) {
    return 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300';
  }

  return 'border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300';
}

export function Install() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const progressUnsubscribeRef = useRef<RuntimeEventUnsubscribe | null>(null);
  const terminalRef = useRef<HTMLDivElement>(null);
  const migrationTerminalRef = useRef<HTMLDivElement>(null);
  const [modalShake, setModalShake] = useState(false);
  const [pageMode, setPageMode] = useState<PageMode>('install');
  const [productId, setProductId] = useState<ProductId>('openclaw');
  const [runtimeInfo, setRuntimeInfo] = useState<RuntimeInfo | null>(null);
  const [installRecord, setInstallRecord] = useState<LegacyInstallRecord | null>(null);
  const [action, setAction] = useState<ActionState | null>(null);
  const [guidedInstallAction, setGuidedInstallAction] = useState<{
    product: ProductConfig;
    choice: InstallChoice;
  } | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const [output, setOutput] = useState('');
  const [operationProgress, setOperationProgress] = useState(createHubInstallProgressState());
  const [result, setResult] = useState<HubInstallResult | HubUninstallResult | null>(null);
  const [customMigrationSource, setCustomMigrationSource] = useState<string | null>(null);
  const [migrationStatus, setMigrationStatus] = useState<Status>('idle');
  const [migrationOutput, setMigrationOutput] = useState('');
  const [migrationCandidates, setMigrationCandidates] = useState<MigrationCandidate[]>([]);
  const [selectedMigrationIds, setSelectedMigrationIds] = useState<MigrationId[]>([]);
  const [installAssessments, setInstallAssessments] = useState<
    Record<string, InstallAssessmentState>
  >({});
  const [assessmentRefreshTick, setAssessmentRefreshTick] = useState(0);
  const [copiedCommandId, setCopiedCommandId] = useState<string | null>(null);

  const hostOs = useMemo(() => getHostOs(runtimeInfo), [runtimeInfo]);
  const product = PRODUCTS.find((item) => item.id === productId) ?? PRODUCTS[0];
  const productSidebar = PRODUCTS;
  const workspaceModeTabs = PAGE_MODE_TABS;
  const currentInstallChoices = product.methods.filter((choice) => supports(hostOs, choice));
  const currentUninstallChoices = product.uninstallMethods.filter((choice) => supports(hostOs, choice));
  const recommendedInstallMethodId = getRecommendedMethodId(product, hostOs);
  const hostPreferredInstallChoice =
    currentInstallChoices.find((choice) => choice.id === recommendedInstallMethodId) ??
    currentInstallChoices[0] ??
    null;
  const installRecommendationSummary = useMemo(
    () =>
      buildInstallRecommendationSummary({
        hostOs,
        arch: runtimeInfo?.system?.arch ?? null,
        productPreferredChoiceId: recommendedInstallMethodId,
        choices: currentInstallChoices.map((choice) => ({
          id: choice.id,
          softwareName: choice.request.softwareName,
          disabled: choice.disabled,
          assessment: installAssessments[getInstallRequestKey(choice.request)],
        })),
      }),
    [currentInstallChoices, hostOs, installAssessments, recommendedInstallMethodId, runtimeInfo],
  );
  const recommendedInstallChoice =
    currentInstallChoices.find(
      (choice) => choice.id === installRecommendationSummary.primaryChoice?.id,
    ) ??
    hostPreferredInstallChoice;
  const productProfileBaseKey = `install.page.productProfiles.${product.id}` as const;
  const currentMigrationCandidates = migrationCandidates;
  const selectedMigrationCandidates = currentMigrationCandidates.filter(
    (item) => item.sourcePath && selectedMigrationIds.includes(item.id),
  );
  const recommendedInstallInsight = installRecommendationSummary.primaryChoice;
  const recommendedInstallAssessment = recommendedInstallChoice
    ? installAssessments[getInstallRequestKey(recommendedInstallChoice.request)]
    : undefined;
  const recommendedInstallCounts = getAssessmentCounts(recommendedInstallAssessment?.result);
  const installPrimaryChoices = installRecommendationSummary.choices
    .map((insight) => {
      const choice = currentInstallChoices.find((item) => item.id === insight.id);
      return choice ? { choice, insight } : null;
    })
    .filter(
      (
        item,
      ): item is {
        choice: InstallChoice;
        insight: (typeof installRecommendationSummary.choices)[number];
      } => Boolean(item),
    );
  const actionAssessment =
    action?.kind === 'install'
      ? installAssessments[getInstallRequestKey(action.choice.request)]
      : undefined;
  const operationStageLabel =
    humanizeHubInstallProgressLabel(operationProgress.currentStage) ?? t('common.none');
  const operationStepLabel = operationProgress.activeStepDescription ?? t('common.none');
  const operationLastCommand = operationProgress.lastCommand ?? t('common.none');
  const clearGuidedInstallSearchParams = useCallback(() => {
    if (
      !searchParams.has('guided') &&
      !searchParams.has('product') &&
      !searchParams.has('method')
    ) {
      return;
    }

    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.delete('guided');
    nextSearchParams.delete('product');
    nextSearchParams.delete('method');
    setSearchParams(nextSearchParams, { replace: true });
  }, [searchParams, setSearchParams]);
  const handleGuidedInstallClose = useCallback(() => {
    setGuidedInstallAction(null);
    clearGuidedInstallSearchParams();
  }, [clearGuidedInstallSearchParams]);

  // Auto-scroll terminals when output updates
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [output]);

  useEffect(() => {
    if (migrationTerminalRef.current) {
      migrationTerminalRef.current.scrollTop = migrationTerminalRef.current.scrollHeight;
    }
  }, [migrationOutput]);

  const triggerModalShake = useCallback(() => {
    setModalShake(true);
    window.setTimeout(() => setModalShake(false), 500);
  }, []);

  const cleanupProgress = async () => {
    const unsubscribe = progressUnsubscribeRef.current;
    progressUnsubscribeRef.current = null;
    if (unsubscribe) await unsubscribe();
  };

  const refreshInstallRecord = async (nextRuntimeInfo: RuntimeInfo | null) => {
    const userRoot = nextRuntimeInfo?.paths?.userRoot;
    if (!userRoot) return setInstallRecord(null);
    const recordPath = pathJoin(
      getHostOs(nextRuntimeInfo),
      userRoot,
      'hub-installer',
      'state',
      'install-records',
      product.legacyRecordFileName,
    );
    try {
      if (!(await platform.pathExists(recordPath))) return setInstallRecord(null);
      const parsed = JSON.parse(await platform.readFile(recordPath)) as LegacyInstallRecord;
      setInstallRecord(parsed.status === 'uninstalled' ? null : parsed);
    } catch {
      setInstallRecord(null);
    }
  };

  const refreshMigrationCandidates = async (
    nextRuntimeInfo: RuntimeInfo | null,
    nextRecord: LegacyInstallRecord | null,
    manualSource: string | null,
  ) => {
    const paths = nextRuntimeInfo?.paths;
    if (!paths) return;
    const nextHostOs = getHostOs(nextRuntimeInfo);
    const home = pathParent(pathParent(paths.userRoot)) ?? pathParent(paths.userRoot) ?? paths.userRoot;
    const nextCandidates = await Promise.all(
      product.migrationDefinitions.map(async (definition) => {
        const detectedPaths =
          definition.detectedSourceSegments?.map((segments) => pathJoin(nextHostOs, home, ...segments)) ?? [];
        const sourcePath =
          definition.sourceKind === 'manual'
            ? manualSource
            : await firstExisting([
                definition.installRecordField ? nextRecord?.[definition.installRecordField] : null,
                ...detectedPaths,
              ]);

        return {
          id: definition.id,
          titleKey: definition.titleKey,
          descriptionKey: definition.descriptionKey,
          sourcePath,
          destinationRoot: pathJoin(
            nextHostOs,
            paths[definition.destinationRootKey as keyof RuntimePaths],
            ...definition.destinationSegments,
          ),
          sourceKind: definition.sourceKind,
        } satisfies MigrationCandidate;
      }),
    );
    const visibleCandidates = manualSource
      ? nextCandidates
      : nextCandidates.filter((item) => item.sourceKind !== 'manual');
    setMigrationCandidates(visibleCandidates);
    setSelectedMigrationIds(
      visibleCandidates.filter((item) => item.sourcePath).map((item) => item.id),
    );
  };

  const inspectInstallChoice = async (
    choice: InstallChoice,
    options: { force?: boolean } = {},
  ) => {
    if (choice.disabled) return;
    const key = getInstallRequestKey(choice.request);
    if (!options.force && installAssessments[key]?.status === 'success') return;

    setInstallAssessments((previous) => ({
      ...previous,
      [key]: {
        status: 'loading',
        result: previous[key]?.result,
      },
    }));

    try {
      const result = await installerService.inspectHubInstall(choice.request);
      setInstallAssessments((previous) => ({
        ...previous,
        [key]: {
          status: 'success',
          result,
        },
      }));
    } catch (error: unknown) {
      setInstallAssessments((previous) => ({
        ...previous,
        [key]: {
          status: 'error',
          result: previous[key]?.result,
          error: error instanceof Error ? error.message : String(error),
        },
      }));
    }
  };

  const copyAssessmentCommand = async (commandLine: string, commandId: string) => {
    await platform.copy(commandLine);
    setCopiedCommandId(commandId);
    window.setTimeout(() => {
      setCopiedCommandId((previous) => (previous === commandId ? null : previous));
    }, 1500);
  };

  useEffect(() => {
    void (async () => {
      const nextRuntimeInfo = await getRuntimePlatform().getRuntimeInfo();
      setRuntimeInfo(nextRuntimeInfo);
    })();
    return () => void cleanupProgress();
  }, []);

  useEffect(() => {
    void refreshInstallRecord(runtimeInfo);
  }, [runtimeInfo, product]);

  useEffect(() => {
    void refreshMigrationCandidates(runtimeInfo, installRecord, customMigrationSource);
  }, [runtimeInfo, installRecord, customMigrationSource, product]);

  useEffect(() => {
    if (pageMode !== 'install') return;

    let cancelled = false;

    void (async () => {
      for (const choice of currentInstallChoices) {
        if (cancelled || choice.disabled) continue;
        await inspectInstallChoice(choice, { force: assessmentRefreshTick > 0 });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pageMode, product.id, hostOs, assessmentRefreshTick, runtimeInfo]);

  useEffect(() => {
    if (pageMode !== 'install') {
      return;
    }

    const timer = window.setInterval(() => {
      setAssessmentRefreshTick((previous) => previous + 1);
    }, INSTALL_ASSESSMENT_RECHECK_INTERVAL_MS);

    return () => {
      window.clearInterval(timer);
    };
  }, [pageMode, product.id]);

  useEffect(() => {
    if (!isModalOpen || action?.kind !== 'install') return;
    void inspectInstallChoice(action.choice);
  }, [action, isModalOpen]);

  useEffect(() => {
    const requestedProductId = searchParams.get('product');
    const requestedMethodId = searchParams.get('method');
    const isGuidedInstall = searchParams.get('guided') === '1';
    if (!isGuidedInstall || !requestedProductId || !requestedMethodId) {
      return;
    }

    const requestedProduct = PRODUCTS.find((item) => item.id === requestedProductId);
    if (!requestedProduct) {
      return;
    }

    if (pageMode !== 'install') {
      setPageMode('install');
    }
    if (productId !== requestedProduct.id) {
      setProductId(requestedProduct.id);
    }

    const requestedChoice = requestedProduct.methods.find((item) => item.id === requestedMethodId);
    if (!requestedChoice || requestedChoice.disabled) {
      return;
    }

    if (!supports(hostOs, requestedChoice)) {
      if (hostOs !== 'unknown') {
        setGuidedInstallAction(null);
      }
      return;
    }

    const isSameGuidedAction =
      guidedInstallAction?.product.id === requestedProduct.id &&
      guidedInstallAction.choice.id === requestedChoice.id;
    if (isSameGuidedAction) {
      return;
    }

    void inspectInstallChoice(requestedChoice, { force: true });
    setGuidedInstallAction({
      product: requestedProduct,
      choice: requestedChoice,
    });
  }, [guidedInstallAction, hostOs, pageMode, productId, searchParams]);

  const startAction = async () => {
    if (!action) return;
    await cleanupProgress();
    setStatus('running');
    setResult(null);
    setOperationProgress(createHubInstallProgressState());
    setOutput(`${action.kind === 'install' ? t('install.page.modal.output.preparingInstall', { product: t(action.product.nameKey), method: t(action.choice.titleKey) }) : t('install.page.modal.output.preparingUninstall', { product: t(action.product.nameKey), method: t(action.choice.titleKey) })}\n${t('install.page.modal.output.starting')}\n`);
    progressUnsubscribeRef.current = await installerService.subscribeHubInstallProgress((event) => {
      setOperationProgress((previous) => reduceHubInstallProgressEvent(previous, event));
      const line = formatHubInstallProgressEvent(t as (key: string) => string, event).trim();
      if (!line) return;
      setOutput((previous) => `${previous}${previous.endsWith('\n') ? '' : '\n'}${line}\n`);
    });
    try {
      const nextResult = action.kind === 'install' ? await installerService.runHubInstall(action.choice.request) : await installerService.runHubUninstall(action.choice.request);
      setResult(nextResult);
      setStatus(nextResult.success ? 'success' : 'error');
      setOperationProgress((previous) => applyHubInstallResultToProgressState(previous, nextResult));
      setOutput((previous) => `${previous}\n${nextResult.success ? t(action.kind === 'install' ? 'install.page.modal.output.completedInstall' : 'install.page.modal.output.completedUninstall') : t(action.kind === 'install' ? 'install.page.modal.output.failedInstall' : 'install.page.modal.output.failedUninstall')}\n`);
    } catch (error: unknown) {
      setStatus('error');
      setOutput((previous) => `${previous}\n${t('install.page.modal.output.errorPrefix')}: ${error instanceof Error ? error.message : String(error)}\n`);
    } finally {
      await cleanupProgress();
      await refreshInstallRecord(runtimeInfo);
    }
  };

  const startMigration = async () => {
    const selected = selectedMigrationCandidates;
    if (!selected.length) return;
    setMigrationStatus('running');
    setMigrationOutput(`${t('install.page.migrate.output.starting')}\n`);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    let failed = false;
    for (const item of selected) {
      try {
        const destination = pathJoin(hostOs, item.destinationRoot, `import-${stamp}`);
        await platform.createDirectory(item.destinationRoot);
        if (!(await platform.pathExists(item.sourcePath!))) throw new Error(t('install.page.migrate.output.missing'));
        await platform.copyPath(item.sourcePath!, destination);
        setMigrationOutput((previous) => `${previous}${t('install.page.migrate.output.copying', { title: t(item.titleKey) })}\n${t('install.page.migrate.output.completedSection')}\n`);
      } catch (error: unknown) {
        failed = true;
        setMigrationOutput((previous) => `${previous}${t('install.page.modal.output.errorPrefix')}: ${error instanceof Error ? error.message : String(error)}\n`);
      }
    }
    setMigrationStatus(failed ? 'error' : 'success');
    setMigrationOutput((previous) => `${previous}${t(failed ? 'install.page.migrate.output.partial' : 'install.page.migrate.output.completed')}\n`);
  };

  const workspaceHeader = {
    icon:
      pageMode === 'install' ? (
        <DownloadCloud className="h-5 w-5" />
      ) : pageMode === 'uninstall' ? (
        <Trash2 className="h-5 w-5" />
      ) : (
        <ArrowRightLeft className="h-5 w-5" />
    ),
    title: t('install.page.hero.title'),
    eyebrow: t('install.page.header.eyebrow'),
    description: t(`install.page.modes.${pageMode}.description`, {
      product: t(product.nameKey),
    }),
  };

  const workspaceStatusBadges: Array<{
    key: string;
    label: string;
    value: string;
    tone: 'zinc' | 'emerald' | 'sky' | 'amber';
  }> = [
    {
      key: 'current-product',
      label: t('install.page.header.badges.currentProduct'),
      value: t(product.nameKey),
      tone: 'zinc',
    },
    {
      key: 'lifecycle-mode',
      label: t('install.page.header.badges.lifecycleMode'),
      value: t(`install.page.tabs.${pageMode}`),
      tone: 'sky',
    },
    {
      key: 'platform',
      label: t('install.page.runtime.label'),
      value: t(`install.page.runtime.values.${hostOs}`),
      tone: 'zinc',
    },
    ...(installRecord
      ? [
          {
            key: 'detected-install',
            label: t('install.page.header.badges.detectedInstall'),
            value: t('install.page.uninstall.detectedTitle', { product: t(product.nameKey) }),
            tone: 'emerald' as const,
          },
        ]
      : []),
    pageMode === 'install'
      ? {
          key: 'recommended-path',
          label: t('install.page.header.badges.recommendedPath'),
          value: recommendedInstallChoice ? t(recommendedInstallChoice.titleKey) : t('common.none'),
          tone: 'sky',
        }
      : pageMode === 'uninstall'
        ? {
            key: 'uninstall-paths',
            label: t('install.page.header.badges.availableForProduct'),
            value: `${currentUninstallChoices.length} ${t('install.page.header.badges.uninstallPaths')}`,
            tone: 'amber',
          }
        : {
            key: 'migration-sources',
            label: t('install.page.header.badges.availableForProduct'),
            value: `${currentMigrationCandidates.filter((item) => item.sourcePath).length} ${t('install.page.header.badges.migrationSources')}`,
            tone: 'sky',
          },
    ...(pageMode === 'install'
      ? [
          {
            key: 'ready-paths',
            label: t('install.page.header.badges.readyPaths'),
            value: String(installRecommendationSummary.readyChoiceCount),
            tone: 'emerald' as const,
          },
          ...(installRecommendationSummary.fixFirstChoiceCount > 0
            ? [
                {
                  key: 'needs-attention',
                  label: t('install.page.header.badges.needsAttention'),
                  value: String(installRecommendationSummary.fixFirstChoiceCount),
                  tone: 'amber' as const,
                },
              ]
            : []),
        ]
      : []),
  ];

  const installSupportNote = {
    title: t('install.page.install.briefingTitle'),
    description: t(`${productProfileBaseKey}.recommendedReason`),
  };
  const migrationNote = PRODUCT_MIGRATION_NOTES[product.id] ?? null;
  const installBriefingCards = [
    {
      key: 'recommended-path',
      label: t('install.page.install.briefingLabels.recommendedPath'),
      value: recommendedInstallChoice ? t(recommendedInstallChoice.titleKey) : t('common.none'),
      description: t(`${productProfileBaseKey}.recommendedPath`),
    },
    {
      key: 'best-for',
      label: t('install.page.install.briefingLabels.bestFor'),
      value: t(`${productProfileBaseKey}.bestFor`),
      description: t(`${productProfileBaseKey}.runtime`),
    },
    {
      key: 'first-run',
      label: t('install.page.install.briefingLabels.firstRun'),
      value: t(`${productProfileBaseKey}.firstRunTitle`),
      description: t(`${productProfileBaseKey}.firstRun`),
    },
  ];
  const installChecklist = [
    t(`${productProfileBaseKey}.prerequisites.one`),
    t(`${productProfileBaseKey}.prerequisites.two`),
    t(`${productProfileBaseKey}.prerequisites.three`),
  ];
  const autoAssessmentRefreshDescription = t('install.page.install.autoRefresh', {
    seconds: Math.round(INSTALL_ASSESSMENT_RECHECK_INTERVAL_MS / 1000),
  });
  const recommendedReasonDescription = recommendedInstallInsight
    ? t(
        `install.page.install.recommendationReasons.${recommendedInstallInsight.recommendationReason}`,
        {
          method: recommendedInstallChoice ? t(recommendedInstallChoice.titleKey) : t('common.none'),
          product: t(product.nameKey),
        },
      )
    : t(`${productProfileBaseKey}.recommendedReason`);
  const runtimePlatformValue =
    installRecommendationSummary.platformSignals.runtimePlatform === 'wsl'
      ? t('install.page.tags.wsl')
      : installRecommendationSummary.platformSignals.runtimePlatform === 'ubuntu'
        ? t('install.page.runtime.values.linux')
        : installRecommendationSummary.platformSignals.runtimePlatform === 'windows' ||
            installRecommendationSummary.platformSignals.runtimePlatform === 'macos' ||
            installRecommendationSummary.platformSignals.runtimePlatform === 'linux'
          ? t(
              `install.page.runtime.values.${installRecommendationSummary.platformSignals.runtimePlatform}`,
            )
          : installRecommendationSummary.platformSignals.runtimePlatform ?? t('common.none');
  const platformSignals = [
    {
      key: 'host',
      label: t('install.page.install.autoDetection.signals.host'),
      value: t(`install.page.runtime.values.${installRecommendationSummary.platformSignals.hostOs}`),
      tone:
        'border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
    },
    {
      key: 'arch',
      label: t('install.page.install.autoDetection.signals.arch'),
      value:
        installRecommendationSummary.platformSignals.arch?.toUpperCase() ?? t('common.none'),
      tone:
        'border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
    },
    {
      key: 'runtime',
      label: t('install.page.install.autoDetection.signals.runtime'),
      value: runtimePlatformValue,
      tone:
        'border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
    },
    {
      key: 'wsl',
      label: t('install.page.install.autoDetection.signals.wsl'),
      value:
        installRecommendationSummary.platformSignals.wslAvailable === null
          ? t('install.page.install.autoDetection.values.unknown')
          : t(
              `install.page.install.autoDetection.values.${
                installRecommendationSummary.platformSignals.wslAvailable ? 'available' : 'unavailable'
              }`,
            ),
      tone: getSignalTone(installRecommendationSummary.platformSignals.wslAvailable),
    },
    {
      key: 'docker',
      label: t('install.page.install.autoDetection.signals.docker'),
      value:
        installRecommendationSummary.platformSignals.dockerAvailable === null
          ? t('install.page.install.autoDetection.values.unknown')
          : t(
              `install.page.install.autoDetection.values.${
                installRecommendationSummary.platformSignals.dockerAvailable
                  ? 'available'
                  : 'unavailable'
              }`,
            ),
      tone: getSignalTone(installRecommendationSummary.platformSignals.dockerAvailable),
    },
    {
      key: 'node',
      label: t('install.page.install.autoDetection.signals.node'),
      value:
        installRecommendationSummary.platformSignals.nodeAvailable === null
          ? t('install.page.install.autoDetection.values.unknown')
          : t(
              `install.page.install.autoDetection.values.${
                installRecommendationSummary.platformSignals.nodeAvailable
                  ? 'available'
                  : 'unavailable'
              }`,
            ),
      tone: getSignalTone(installRecommendationSummary.platformSignals.nodeAvailable),
    },
  ];
  const openGuidedInstall = (choice: InstallChoice) => {
    if (choice.disabled) {
      return;
    }

    void inspectInstallChoice(choice, { force: true });
    setGuidedInstallAction({ product, choice });
  };

  const uninstallWorkspace = (
    <div className="uninstallWorkspace space-y-6">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <div className="rounded-[2rem] border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
              <Trash2 className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                {t('install.page.uninstall.detectedTitle', { product: t(product.nameKey) })}
              </div>
              <h2 className="mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                {t('install.page.uninstall.title', { product: t(product.nameKey) })}
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
                {t('install.page.uninstall.description', { product: t(product.nameKey) })}
              </p>
            </div>
          </div>
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
              <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                {t('install.page.uninstall.detected.installMode')}
              </div>
              <div className="mt-2 break-all text-sm font-medium text-zinc-800 dark:text-zinc-200">
                {installRecord?.manifestName ?? t('install.page.uninstall.detected.notFound')}
              </div>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
              <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                {t('install.page.uninstall.detected.installRoot')}
              </div>
              <div className="mt-2 break-all text-sm font-medium text-zinc-800 dark:text-zinc-200">
                {installRecord?.installRoot ?? t('install.page.uninstall.detected.notFound')}
              </div>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
              <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                {t('install.page.uninstall.detected.dataRoot')}
              </div>
              <div className="mt-2 break-all text-sm font-medium text-zinc-800 dark:text-zinc-200">
                {installRecord?.dataRoot ?? t('install.page.uninstall.detected.notFound')}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[2rem] border border-amber-200 bg-amber-50/80 p-6 shadow-sm dark:border-amber-500/30 dark:bg-amber-500/10">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-300">
            {t('install.page.uninstall.reviewTitle')}
          </div>
          <h3 className="mt-3 text-lg font-bold text-amber-950 dark:text-amber-100">
            {t('install.page.uninstall.reviewHeading')}
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-amber-800 dark:text-amber-200">
            {t('install.page.uninstall.reviewDescription', { product: t(product.nameKey) })}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        {currentUninstallChoices.map((choice) => (
          <div
            key={choice.id}
            className="flex h-full flex-col rounded-[2rem] border border-zinc-200 bg-white p-6 transition-all hover:border-zinc-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700 dark:hover:shadow-zinc-900/50"
          >
            <div className="mb-5 mt-1 flex h-12 w-12 items-center justify-center rounded-2xl border border-zinc-100 bg-zinc-50 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
              {choice.icon}
            </div>
            <h3 className="mb-2 text-xl font-bold text-zinc-900 dark:text-zinc-100">
              {t(choice.titleKey)}
            </h3>
            <p className="mb-6 flex-1 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
              {t(choice.descriptionKey)}
            </p>
            <div className="mb-8 flex flex-wrap gap-2">
              {choice.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-lg border border-zinc-100 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-600 dark:border-zinc-800 dark:bg-zinc-800/50 dark:text-zinc-400"
                >
                  {t(`install.page.tags.${tag}`)}
                </span>
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                setAction({ kind: 'uninstall', product, choice });
                setStatus('idle');
                setOutput('');
                setResult(null);
                setOperationProgress(createHubInstallProgressState());
                setIsModalOpen(true);
              }}
              className="mt-auto flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              <Trash2 className="h-4 w-4" />
              {t('install.page.method.actions.uninstall')}
            </button>
          </div>
        ))}
      </div>
    </div>
  );

  const migrationWorkspace = (
    <div className="migrationWorkspace space-y-6">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <div className="rounded-[2rem] border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                {t('install.page.migrate.workspaceTitle')}
              </div>
              <h2 className="mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                {t('install.page.migrate.title', { product: t(product.nameKey) })}
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
                {t('install.page.migrate.productDescription', { product: t(product.nameKey) })}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => {
                  void refreshMigrationCandidates(runtimeInfo, installRecord, customMigrationSource);
                }}
                className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                <RefreshCw className="h-4 w-4" />
                {t('install.page.migrate.actions.rescan')}
              </button>
              <button
                type="button"
                onClick={() => {
                  void (async () => {
                    const selected = await fileDialogService.selectDirectory({
                      title: t('install.page.migrate.actions.selectSource'),
                    });
                    if (selected) setCustomMigrationSource(selected);
                  })();
                }}
                className="flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                <FolderOpen className="h-4 w-4" />
                {t('install.page.migrate.actions.selectSource')}
              </button>
            </div>
          </div>
          <div className="mt-6 rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                {t('install.page.migrate.customSourceLabel')}
              </div>
              {customMigrationSource && (
                <button
                  type="button"
                  onClick={() => setCustomMigrationSource(null)}
                  className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-2.5 py-1 text-xs font-semibold text-zinc-500 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-red-500/30 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                >
                  <X className="h-3 w-3" />
                  {t('install.page.migrate.actions.clearSource')}
                </button>
              )}
            </div>
            <div className="mt-2 break-all text-sm font-medium text-zinc-800 dark:text-zinc-200">
              {customMigrationSource ?? t('install.page.migrate.customSourcePlaceholder')}
            </div>
          </div>
        </div>

        <div className="rounded-[2rem] border border-sky-200 bg-sky-50/80 p-6 shadow-sm dark:border-sky-500/30 dark:bg-sky-500/10">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700 dark:text-sky-300">
            {t('install.page.migrate.workspaceTitle')}
          </div>
          <h3 className="mt-3 text-lg font-bold text-sky-950 dark:text-sky-100">
            {t('install.page.migrate.readyTitle')}
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-sky-800 dark:text-sky-200">
            {t('install.page.migrate.readyDescription')}
          </p>
          {migrationNote && (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-white/85 p-4 text-left shadow-sm dark:border-amber-500/30 dark:bg-zinc-950/50">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-300">
                {t(migrationNote.titleKey)}
              </div>
              <p className="mt-2 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                {t(migrationNote.descriptionKey)}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        {currentMigrationCandidates.map((item) => (
          <label
            key={item.id}
            className="flex h-full cursor-pointer flex-col rounded-[2rem] border border-zinc-200 bg-white p-6 transition-all hover:border-zinc-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700 dark:hover:shadow-zinc-900/50"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-zinc-100 bg-zinc-50 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
                {item.id === 'manual' ? (
                  <ArrowRightLeft className="h-6 w-6 text-sky-500 dark:text-sky-400" />
                ) : (
                  <FileText className="h-6 w-6 text-primary-500 dark:text-primary-400" />
                )}
              </div>
              <Checkbox
                checked={selectedMigrationIds.includes(item.id)}
                disabled={!item.sourcePath || migrationStatus === 'running'}
                onCheckedChange={() =>
                  setSelectedMigrationIds((previous) =>
                    previous.includes(item.id)
                      ? previous.filter((value) => value !== item.id)
                      : [...previous, item.id],
                  )
                }
                aria-label={t(item.titleKey)}
              />
            </div>
            <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{t(item.titleKey)}</h3>
            <p className="mt-2 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
              {t(item.descriptionKey)}
            </p>
            <div className="mt-5 space-y-4 text-sm">
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
                <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  {t('install.page.migrate.labels.source')}
                </div>
                <div className="mt-2 break-all text-zinc-700 dark:text-zinc-300">
                  {item.sourcePath ?? t('install.page.migrate.labels.notFound')}
                </div>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
                <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  {t('install.page.migrate.labels.destination')}
                </div>
                <div className="mt-2 break-all text-zinc-700 dark:text-zinc-300">
                  {item.destinationRoot}
                </div>
              </div>
            </div>
          </label>
        ))}
      </div>

      <div className="rounded-[2rem] border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
              {t('install.page.migrate.readyTitle')}
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
              {t('install.page.migrate.readyDescription')}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              void startMigration();
            }}
            disabled={migrationStatus === 'running' || !selectedMigrationCandidates.length}
            className="flex items-center gap-2 rounded-xl bg-primary-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-primary-900/20 transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-500 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500"
          >
            <ArrowRightLeft className="h-4 w-4" />
            {t('install.page.migrate.actions.start')}
          </button>
        </div>
        <div className="mt-6 flex items-center gap-3 rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/60">
          {migrationStatus === 'running' && (
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
          )}
          {migrationStatus === 'success' && <CheckCircle2 className="h-6 w-6 text-emerald-500" />}
          {migrationStatus === 'error' && <AlertCircle className="h-6 w-6 text-red-500" />}
          <span className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
            {t(`install.page.migrate.status.${migrationStatus}`)}
          </span>
        </div>
        <div className="mt-6 flex h-72 flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-inner">
          <div className="flex shrink-0 items-center gap-2 border-b border-zinc-800 bg-zinc-900 px-4 py-3">
            <SquareTerminal className="h-4 w-4 text-zinc-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
              {t('install.page.migrate.output.title')}
            </span>
          </div>
          <div ref={migrationTerminalRef} className="flex-1 overflow-y-auto p-5 font-mono text-sm leading-relaxed whitespace-pre-wrap">
            {migrationOutput
              ? migrationOutput.split('\n').map((line, i) => (
                  <span
                    key={i}
                    className={
                      /error|fail/i.test(line)
                        ? 'text-red-400'
                        : /✓|complete|ok/i.test(line)
                          ? 'text-emerald-400'
                          : 'text-zinc-300'
                    }
                  >
                    {line}{'\n'}
                  </span>
                ))
              : <span className="text-zinc-500">{t('install.page.migrate.output.placeholder')}</span>
            }
            {migrationStatus === 'running' && (
              <span className="ml-1 inline-block h-4 w-2 animate-pulse bg-zinc-400 align-middle" />
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="mx-auto h-full max-w-7xl overflow-y-auto bg-zinc-50 p-5 scrollbar-hide dark:bg-zinc-950 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="workspaceHeader overflow-hidden rounded-[2rem] border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div className="border-b border-zinc-100 px-5 py-5 dark:border-zinc-800 md:px-6">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-zinc-200 bg-zinc-100 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100">
                  {workspaceHeader.icon}
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">
                    {workspaceHeader.eyebrow}
                  </div>
                  <h1 className="mt-2 text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 md:text-[2.25rem]">
                    {workspaceHeader.title}
                  </h1>
                  <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-500 dark:text-zinc-400 md:text-base">
                    {workspaceHeader.description}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-1.5 dark:border-zinc-800 dark:bg-zinc-950/80">
                <div className="flex flex-wrap gap-1">
                  {workspaceModeTabs.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setPageMode(tab.id)}
                      className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 ${
                        tab.id === 'uninstall'
                          ? pageMode === 'uninstall'
                            ? 'bg-amber-600 text-white shadow-sm'
                            : 'text-amber-600 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-500/10'
                          : pageMode === tab.id
                            ? 'bg-zinc-900 text-white shadow-sm dark:bg-zinc-100 dark:text-zinc-900'
                            : 'text-zinc-600 hover:bg-white dark:text-zinc-400 dark:hover:bg-zinc-900'
                      }`}
                    >
                      {t(tab.labelKey)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="px-5 py-4 md:px-6">
            <div className="flex flex-wrap items-center gap-3">
              {workspaceStatusBadges.map((badge) => (
                <div
                  key={badge.key}
                  className={`rounded-2xl border px-3.5 py-2.5 ${
                    badge.tone === 'emerald'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300'
                      : badge.tone === 'sky'
                        ? 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-300'
                        : badge.tone === 'amber'
                          ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300'
                          : 'border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                  }`}
                >
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] opacity-75">
                    {badge.label}
                  </div>
                  <div className="mt-1 text-sm font-semibold">{badge.value}</div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={() => setAssessmentRefreshTick((previous) => previous + 1)}
                className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                <RefreshCw className="h-4 w-4" />
                {t('install.page.runtime.actions.rescan')}
              </button>
            </div>
          </div>
        </motion.div>

        {pageMode === 'install' && (
          <div className="space-y-6">
            <div className="flex flex-col gap-2">
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">
                {t('install.page.install.sectionTitle')}
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 md:text-3xl">
                {t('install.page.install.sectionHeading')}
              </h2>
              <p className="text-sm leading-relaxed text-zinc-500 dark:text-zinc-400 md:text-base">
                {t('install.page.install.sectionDescription')}
              </p>
            </div>

            <div className="productSidebar grid grid-cols-1 gap-3 md:grid-cols-3">
              {productSidebar.map((item) => (
                (() => {
                  const itemProfileBaseKey = `install.page.productProfiles.${item.id}` as const;
                  const itemHighlights = [
                    {
                      key: 'best-for',
                      label: t('install.page.install.briefingLabels.bestFor'),
                      value: t(`${itemProfileBaseKey}.bestFor`),
                    },
                    {
                      key: 'runtime',
                      label: t('install.page.install.briefingLabels.runtime'),
                      value: t(`${itemProfileBaseKey}.runtime`),
                    },
                  ];

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setProductId(item.id)}
                      data-slot={product.id === item.id ? 'active-product' : 'product-option'}
                      className={`overflow-hidden rounded-[1.75rem] border text-left transition-all ${
                        product.id === item.id
                          ? 'border-zinc-900 bg-zinc-900 text-white shadow-lg dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900'
                          : 'border-zinc-200 bg-white hover:border-zinc-300 hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-zinc-700'
                      }`}
                    >
                      <div className={`h-2 w-full bg-gradient-to-r ${item.accent} dark:opacity-80`} />
                      <div className="p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-lg font-bold">{t(item.nameKey)}</div>
                            <div
                              className={`mt-2 text-sm leading-relaxed ${
                                product.id === item.id
                                  ? 'text-zinc-300 dark:text-zinc-700'
                                  : 'text-zinc-500 dark:text-zinc-400'
                              }`}
                            >
                              {t(item.descriptionKey)}
                            </div>
                          </div>
                          {product.id === item.id && (
                            <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white dark:bg-zinc-900 dark:text-zinc-100">
                              {t('install.page.install.selectedProduct')}
                            </span>
                          )}
                        </div>

                        <div className="mt-4 grid grid-cols-1 gap-2">
                          {itemHighlights.map((highlight) => (
                            <div
                              key={`${item.id}-${highlight.key}`}
                              className={`rounded-2xl border px-3.5 py-3 ${
                                product.id === item.id
                                  ? 'border-white/10 bg-white/5 dark:border-zinc-800 dark:bg-zinc-900/70'
                                  : 'border-zinc-200 bg-zinc-50/80 dark:border-zinc-800 dark:bg-zinc-950/60'
                              }`}
                            >
                              <div
                                className={`text-[11px] font-semibold uppercase tracking-[0.16em] ${
                                  product.id === item.id
                                    ? 'text-zinc-300 dark:text-zinc-500'
                                    : 'text-zinc-500 dark:text-zinc-400'
                                }`}
                              >
                                {highlight.label}
                              </div>
                              <div className="mt-1 text-sm font-semibold">{highlight.value}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </button>
                  );
                })()
              ))}
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.35fr_0.65fr]">
              <div className="overflow-hidden rounded-[1.75rem] border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <div className={`h-2 w-full bg-gradient-to-r ${product.accent} dark:opacity-80`} />
                <div className="p-6">
                  <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                    <div className="flex items-start gap-4">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.5rem] border border-zinc-200 bg-zinc-50 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
                        {recommendedInstallChoice?.icon ?? <DownloadCloud className="h-6 w-6" />}
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-300">
                            {t('install.page.install.autoDetection.featuredBadge')}
                          </span>
                          {recommendedInstallInsight && (
                            <span
                              className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${getRecommendationStateTone(
                                recommendedInstallInsight.state,
                              )}`}
                            >
                              {t(getRecommendationStateStatusKey(recommendedInstallInsight.state))}
                            </span>
                          )}
                        </div>
                        <div className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                          {t('install.page.install.sections.recommended')}
                        </div>
                        <h3 className="mt-2 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                          {recommendedInstallChoice
                            ? t(recommendedInstallChoice.titleKey)
                            : t('common.none')}
                        </h3>
                        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
                          {recommendedInstallChoice
                            ? t(recommendedInstallChoice.descriptionKey)
                            : t('install.page.install.autoDetection.description')}
                        </p>
                        <p className="mt-3 text-sm font-medium leading-relaxed text-zinc-700 dark:text-zinc-200">
                          {recommendedReasonDescription}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      data-slot="recommended-action"
                      onClick={() => {
                        if (recommendedInstallChoice) {
                          openGuidedInstall(recommendedInstallChoice);
                        }
                      }}
                      disabled={!recommendedInstallChoice || recommendedInstallChoice.disabled}
                      className={`flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 ${
                        !recommendedInstallChoice || recommendedInstallChoice.disabled
                          ? 'cursor-not-allowed bg-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-500'
                          : 'bg-zinc-900 text-white shadow-lg shadow-zinc-900/15 hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200'
                      }`}
                    >
                      <DownloadCloud className="h-4 w-4" />
                      {t(
                        recommendedInstallChoice?.disabled
                          ? 'install.page.method.actions.comingSoon'
                          : 'install.page.method.actions.guidedInstall',
                      )}
                    </button>
                  </div>

                  <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div className="rounded-[1.35rem] border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                        {t('install.page.install.labels.installRoot')}
                      </div>
                      <div className="mt-2 break-all text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        {recommendedInstallAssessment?.result?.resolvedInstallRoot ?? t('common.none')}
                      </div>
                    </div>
                    <div className="rounded-[1.35rem] border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                        {t('install.page.install.labels.dataRoot')}
                      </div>
                      <div className="mt-2 break-all text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        {recommendedInstallAssessment?.result?.resolvedDataRoot ?? t('common.none')}
                      </div>
                    </div>
                    <div
                      className={`rounded-[1.35rem] border p-4 ${getRecommendationStateTone(
                        recommendedInstallInsight?.state ?? 'checking',
                      )}`}
                    >
                      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] opacity-75">
                        {t('install.page.install.labels.nextStep')}
                      </div>
                      <div className="mt-2 text-sm font-semibold">
                        {recommendedInstallInsight?.primaryIssue ??
                          t(`${productProfileBaseKey}.firstRunTitle`)}
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    {recommendedInstallChoice?.tags.map((tag) => (
                      <span
                        key={`${recommendedInstallChoice.id}-${tag}`}
                        className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                      >
                        {t(`install.page.tags.${tag}`)}
                      </span>
                    ))}
                    {recommendedInstallCounts.blockers > 0 && (
                      <span className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-medium text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
                        {t('install.page.assessment.summary.blockers', {
                          count: recommendedInstallCounts.blockers,
                        })}
                      </span>
                    )}
                    {recommendedInstallCounts.warnings > 0 && (
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                        {t('install.page.assessment.summary.warnings', {
                          count: recommendedInstallCounts.warnings,
                        })}
                      </span>
                    )}
                    {recommendedInstallCounts.autoFixes > 0 && (
                      <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-300">
                        {t('install.page.assessment.summary.autoFixes', {
                          count: recommendedInstallCounts.autoFixes,
                        })}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="rounded-[1.75rem] border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="flex items-start gap-4">
                    <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-zinc-200 bg-gradient-to-br ${product.accent} dark:border-zinc-700`}>
                      <Cpu className="h-5 w-5 text-zinc-800 dark:text-zinc-100" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                        {t('install.page.install.autoDetection.title')}
                      </div>
                      <div className="mt-2 text-lg font-bold text-zinc-900 dark:text-zinc-100">
                        {t('install.page.install.autoDetection.heading')}
                      </div>
                      <p className="mt-2 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
                        {t('install.page.install.autoDetection.description')}
                      </p>
                      <p className="mt-3 text-xs font-medium uppercase tracking-[0.16em] text-zinc-400 dark:text-zinc-500">
                        {autoAssessmentRefreshDescription}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {platformSignals.map((signal) => (
                      <div
                        key={signal.key}
                        className={`rounded-[1.25rem] border px-4 py-3 ${signal.tone}`}
                      >
                        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] opacity-75">
                          {signal.label}
                        </div>
                        <div className="mt-2 text-sm font-semibold">{signal.value}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-[1.75rem] border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                    {installSupportNote.title}
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
                    {installSupportNote.description}
                  </p>
                  <div className="mt-4 space-y-3">
                    {installBriefingCards.map((card) => (
                      <div
                        key={card.key}
                        className="rounded-[1.25rem] border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/60"
                      >
                        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                          {card.label}
                        </div>
                        <div className="mt-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                          {card.value}
                        </div>
                        <p className="mt-2 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
                          {card.description}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 rounded-[1.25rem] border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                        {t('install.page.install.briefingLabels.prerequisites')}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
                          {t('install.page.install.labels.readyPaths')}: {installRecommendationSummary.readyChoiceCount}
                        </span>
                        <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                          {t('install.page.install.labels.needsAttention')}: {installRecommendationSummary.fixFirstChoiceCount}
                        </span>
                      </div>
                    </div>
                    <ul className="mt-4 space-y-3">
                      {installChecklist.map((item, index) => (
                        <li key={`${product.id}-check-${index}`} className="flex items-start gap-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
                          <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-zinc-900 dark:bg-zinc-100" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
              {installPrimaryChoices.map(({ choice, insight }) => {
                const assessmentState = installAssessments[getInstallRequestKey(choice.request)];
                const assessment = assessmentState?.result;
                const assessmentCounts = getAssessmentCounts(assessment);
                const assessmentStatusKey = getRecommendationStateStatusKey(insight.state);
                const assessmentTone = getRecommendationStateTone(insight.state);
                const isRecommendedChoice = choice.id === recommendedInstallInsight?.id;

                return (
                  <div
                    key={`${product.id}-${choice.id}`}
                    className={`flex h-full flex-col rounded-[2rem] border bg-white p-6 transition-all hover:shadow-md dark:bg-zinc-900 ${
                      insight.state === 'fixFirst'
                        ? 'border-red-200 hover:border-red-300 dark:border-red-500/30 dark:hover:border-red-500/40'
                        : isRecommendedChoice
                          ? 'border-zinc-900 shadow-md dark:border-zinc-100'
                          : 'border-zinc-200 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700 dark:hover:shadow-zinc-900/50'
                    }`}
                  >
                    <div className="mb-5 flex items-start justify-between gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-zinc-100 bg-zinc-50 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
                        {choice.icon}
                      </div>
                      <div className="flex flex-wrap justify-end gap-2">
                        {isRecommendedChoice && (
                          <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-300">
                            {t('install.page.install.recommendedMethod')}
                          </span>
                        )}
                        <span
                          className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${assessmentTone}`}
                        >
                          {t(assessmentStatusKey)}
                        </span>
                      </div>
                    </div>
                    <h3 className="mb-2 text-xl font-bold text-zinc-900 dark:text-zinc-100">
                      {t(choice.titleKey)}
                    </h3>
                    <p className="mb-5 flex-1 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
                      {t(choice.descriptionKey)}
                    </p>
                    <div className={`mb-5 rounded-2xl border px-4 py-3 text-sm ${assessmentTone}`}>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-semibold uppercase tracking-wider">
                          {t('install.page.assessment.title')}
                        </span>
                        <span className="font-semibold">{t(assessmentStatusKey)}</span>
                      </div>
                      {assessmentState?.status === 'error' && (
                        <p className="mt-2 leading-relaxed">{assessmentState.error}</p>
                      )}
                      {assessment && (
                        <>
                          <p className="mt-2 leading-relaxed">
                            {t('install.page.assessment.runtimeSummary', {
                              runtime: assessment.runtime.effectiveRuntimePlatform,
                            })}
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {assessmentCounts.blockers > 0 && (
                              <span className="rounded-full border border-current/20 px-2.5 py-1 text-xs font-medium">
                                {t('install.page.assessment.summary.blockers', {
                                  count: assessmentCounts.blockers,
                                })}
                              </span>
                            )}
                            {assessmentCounts.warnings > 0 && (
                              <span className="rounded-full border border-current/20 px-2.5 py-1 text-xs font-medium">
                                {t('install.page.assessment.summary.warnings', {
                                  count: assessmentCounts.warnings,
                                })}
                              </span>
                            )}
                            {assessmentCounts.autoFixes > 0 && (
                              <span className="rounded-full border border-current/20 px-2.5 py-1 text-xs font-medium">
                                {t('install.page.assessment.summary.autoFixes', {
                                  count: assessmentCounts.autoFixes,
                                })}
                              </span>
                            )}
                          </div>
                        </>
                      )}
                      {!assessment && insight.primaryIssue && (
                        <p className="mt-2 leading-relaxed">{insight.primaryIssue}</p>
                      )}
                    </div>
                    <div className="mb-8 flex flex-wrap gap-2">
                      {choice.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-lg border border-zinc-100 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-600 dark:border-zinc-800 dark:bg-zinc-800/50 dark:text-zinc-400"
                        >
                          {t(`install.page.tags.${tag}`)}
                        </span>
                      ))}
                    </div>
                    <button
                      type="button"
                      data-slot="recommended-action"
                      onClick={() => openGuidedInstall(choice)}
                      disabled={choice.disabled}
                      className={`mt-auto flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 ${
                        choice.disabled
                          ? 'cursor-not-allowed bg-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-500'
                          : 'bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200'
                      }`}
                    >
                      <DownloadCloud className="h-4 w-4" />
                      {t(
                        choice.disabled
                          ? 'install.page.method.actions.comingSoon'
                          : 'install.page.method.actions.guidedInstall',
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
      )}

        {pageMode === 'uninstall' && (
          installRecord
            ? uninstallWorkspace
            : <div className="flex flex-col items-center justify-center rounded-[2rem] border border-zinc-200 bg-white py-20 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800">
                  <Trash2 className="h-7 w-7 text-zinc-300 dark:text-zinc-600" />
                </div>
                <h3 className="mt-5 text-lg font-bold text-zinc-900 dark:text-zinc-100">
                  {t('install.page.uninstall.noInstallDetected')}
                </h3>
                <p className="mt-2 max-w-sm text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
                  {t('install.page.uninstall.noInstallDetectedDescription', { product: t(product.nameKey) })}
                </p>
                <button
                  type="button"
                  onClick={() => setPageMode('install')}
                  className="mt-6 flex items-center gap-2 rounded-xl bg-zinc-900 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  <DownloadCloud className="h-4 w-4" />
                  {t('install.page.tabs.install')}
                </button>
              </div>
        )}

        {pageMode === 'migrate' && migrationWorkspace}

      <OpenClawGuidedInstallWizard
        isOpen={Boolean(guidedInstallAction)}
        productName={guidedInstallAction ? t(guidedInstallAction.product.nameKey) : ''}
        methodLabel={guidedInstallAction ? t(guidedInstallAction.choice.titleKey) : ''}
        methodIcon={guidedInstallAction?.choice.icon}
        request={guidedInstallAction?.choice.request ?? { softwareName: 'openclaw' }}
        steps={guidedInstallAction?.product.id === 'openclaw' ? undefined : ['dependencies', 'install']}
        onClose={handleGuidedInstallClose}
        onInstallSuccess={() => {
          setAssessmentRefreshTick((previous) => previous + 1);
          void refreshInstallRecord(runtimeInfo);
        }}
      />

      <AnimatePresence>
        {isModalOpen && action && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-zinc-950/60 backdrop-blur-sm" onClick={() => { if (status !== 'running') { setIsModalOpen(false); } else { triggerModalShake(); } }} />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} transition={{ duration: 0.2, ease: 'easeOut' }} className={`relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 ${modalShake ? 'animate-[shake_0.4s_ease-in-out]' : ''}`}>
              <div className="flex items-center justify-between border-b border-zinc-100 bg-white px-6 py-5 dark:border-zinc-800 dark:bg-zinc-900"><div className="flex items-center gap-4"><div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-zinc-100 bg-zinc-50 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">{action.choice.icon}</div><div><h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{action.kind === 'install' ? t('install.page.modal.title.install', { product: t(action.product.nameKey), method: t(action.choice.titleKey) }) : t('install.page.modal.title.uninstall', { product: t(action.product.nameKey), method: t(action.choice.titleKey) })}</h2><p className="mt-0.5 text-sm font-medium text-zinc-500 dark:text-zinc-400">{t(`install.page.modal.subtitle.${action.kind}`, { product: t(action.product.nameKey) })}</p></div></div><button type="button" onClick={() => { if (status !== 'running') setIsModalOpen(false); }} disabled={status === 'running'} aria-label={t('install.page.modal.actions.close')} className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800 disabled:opacity-50"><X className="h-5 w-5" /></button></div>
              <div className="flex-1 overflow-y-auto bg-zinc-50/50 p-6 dark:bg-zinc-950/50">
                {status === 'idle' ? (
                  <div className="space-y-6">
                    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                      <div className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                        {t('install.page.modal.summaryLabel')}
                      </div>
                      <div className="mt-3 space-y-2 text-sm text-zinc-600 dark:text-zinc-300">
                        <div>
                          <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                            {t('install.page.modal.operationLabel')}:
                          </span>{' '}
                          {t(`install.page.tabs.${action.kind}`)}
                        </div>
                        <div>
                          <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                            {t('install.page.modal.productLabel')}:
                          </span>{' '}
                          {t(action.product.nameKey)}
                        </div>
                        <div>
                          <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                            {t('install.page.modal.methodLabel')}:
                          </span>{' '}
                          {t(action.choice.titleKey)}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-4 rounded-2xl border border-primary-100 bg-primary-50/50 p-5 dark:border-primary-500/20 dark:bg-primary-500/5">
                      <Sparkles className="h-6 w-6 shrink-0 text-primary-500 dark:text-primary-400" />
                      <p className="text-sm font-medium leading-relaxed text-primary-900 dark:text-primary-200">
                        {t(`install.page.modal.info.${action.kind}`)}
                      </p>
                    </div>

                    {action.kind === 'install' && (
                      <div className="space-y-4">
                        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                                {t('install.page.assessment.title')}
                              </div>
                              <h3 className="mt-2 text-lg font-bold text-zinc-900 dark:text-zinc-100">
                                {t('install.page.assessment.modalTitle')}
                              </h3>
                            </div>
                            <button type="button" onClick={() => { void inspectInstallChoice(action.choice, { force: true }); }} className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800">
                              <RefreshCw className="h-4 w-4" />
                              {t('install.page.assessment.actions.refresh')}
                            </button>
                          </div>

                          {actionAssessment?.status === 'loading' && (
                            <div className="mt-5 flex items-center gap-3 rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
                              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
                              <span className="font-medium text-zinc-700 dark:text-zinc-300">
                                {t('install.page.assessment.status.inspecting')}
                              </span>
                            </div>
                          )}

                          {actionAssessment?.status === 'error' && (
                            <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
                              {actionAssessment.error}
                            </div>
                          )}

                          {actionAssessment?.result && (
                            <div className="mt-5 space-y-5">
                              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
                                  <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                                    {t('install.page.assessment.labels.runtime')}
                                  </div>
                                  <div className="mt-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
                                    {actionAssessment.result.runtime.effectiveRuntimePlatform}
                                  </div>
                                </div>
                                <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
                                  <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                                    {t('install.page.assessment.labels.controlLevel')}
                                  </div>
                                  <div className="mt-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
                                    {actionAssessment.result.installControlLevel}
                                  </div>
                                </div>
                                <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
                                  <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                                    {t('install.page.assessment.labels.installRoot')}
                                  </div>
                                  <div className="mt-2 break-all text-sm font-medium text-zinc-800 dark:text-zinc-200">
                                    {actionAssessment.result.resolvedInstallRoot}
                                  </div>
                                </div>
                                <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
                                  <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                                    {t('install.page.assessment.labels.dataRoot')}
                                  </div>
                                  <div className="mt-2 break-all text-sm font-medium text-zinc-800 dark:text-zinc-200">
                                    {actionAssessment.result.resolvedDataRoot}
                                  </div>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
                                  <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                                    {t('install.page.assessment.labels.availableWslDistributions')}
                                  </div>
                                  <div className="mt-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
                                    {actionAssessment.result.runtime.availableWslDistributions.length
                                      ? actionAssessment.result.runtime.availableWslDistributions.join(', ')
                                      : t('install.page.uninstall.detected.notFound')}
                                  </div>
                                </div>
                                <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
                                  <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                                    {t('install.page.assessment.labels.commands')}
                                  </div>
                                  <div className="mt-2 flex flex-wrap gap-2 text-xs font-medium">
                                    {Object.entries(actionAssessment.result.runtime.commandAvailability).length
                                      ? Object.entries(actionAssessment.result.runtime.commandAvailability).map(([name, present]) => (
                                        <span key={name} className={`rounded-full px-2.5 py-1 ${present ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' : 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'}`}>
                                          {name}: {present ? 'ok' : 'missing'}
                                        </span>
                                      ))
                                      : <span className="text-zinc-500 dark:text-zinc-400">{t('install.page.uninstall.detected.notFound')}</span>}
                                  </div>
                                </div>
                              </div>

                              {actionAssessment.result.issues.length > 0 && (
                                <div className="space-y-3">
                                  <div className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                                    {t('install.page.assessment.sections.issues')}
                                  </div>
                                  <div className="space-y-3">
                                    {actionAssessment.result.issues.map((issue) => (
                                      <div key={`${issue.code}-${issue.dependencyId ?? 'general'}`} className={`rounded-2xl border p-4 text-sm leading-relaxed ${issue.severity === 'error' ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300' : issue.severity === 'warning' ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300' : 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-300'}`}>
                                        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider">
                                          <span>{t(`install.page.assessment.issueSeverity.${issue.severity}`)}</span>
                                          <span className="opacity-70">{issue.code}</span>
                                        </div>
                                        <div>{issue.message}</div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              <div className="space-y-3">
                                <div className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                                  {t('install.page.assessment.sections.dependencies')}
                                </div>
                                <div className="space-y-3">
                                  {actionAssessment.result.dependencies.map((dependency) => (
                                    <div key={dependency.id} className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
                                      <div className="flex flex-wrap items-center justify-between gap-3">
                                        <div>
                                          <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                                            {dependency.description ?? dependency.id}
                                          </div>
                                          <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                                            {dependency.target}
                                          </div>
                                        </div>
                                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${dependency.status === 'available' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' : dependency.status === 'remediable' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300' : dependency.status === 'unsupported' ? 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-300' : 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'}`}>
                                          {t(`install.page.assessment.dependencyStatus.${dependency.status}`)}
                                        </span>
                                      </div>
                                      {!!dependency.remediationCommands.length && (
                                        <div className="mt-4 space-y-3">
                                          {dependency.remediationCommands.map((command, index) => {
                                            const commandId = `${dependency.id}-${index}`;
                                            return (
                                              <div key={commandId} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                                                <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                                                  <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                                                    {command.autoRun
                                                      ? t('install.page.assessment.actions.autoRun')
                                                      : t('install.page.assessment.actions.manualFix')}
                                                  </div>
                                                  <button type="button" onClick={() => { void copyAssessmentCommand(command.commandLine, commandId); }} className="rounded-lg border border-zinc-700 px-3 py-1 text-xs font-semibold text-zinc-200 transition-colors hover:bg-zinc-800">
                                                    {copiedCommandId === commandId ? t('common.copied') : t('common.copy')}
                                                  </button>
                                                </div>
                                                <div className="mb-2 text-sm font-medium text-zinc-100">
                                                  {command.description}
                                                </div>
                                                <pre className="overflow-x-auto text-xs leading-relaxed whitespace-pre-wrap text-emerald-300">{command.commandLine}</pre>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>

                              <HubInstallDescriptorSummary assessment={actionAssessment.result} />

                              <div className="space-y-3">
                                <div className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                                  {t('install.page.assessment.sections.recommendations')}
                                </div>
                                <div className="space-y-3">
                                  {actionAssessment.result.recommendations.length ? actionAssessment.result.recommendations.map((item) => (
                                    <div key={item} className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4 text-sm leading-relaxed text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950/60 dark:text-zinc-300">
                                      {item}
                                    </div>
                                  )) : (
                                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4 text-sm leading-relaxed text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/60 dark:text-zinc-400">
                                      {t('install.page.assessment.emptyRecommendations')}
                                    </div>
                                  )}
                                </div>
                              </div>

                              {!actionAssessment.result.ready && (
                                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm leading-relaxed text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
                                  {t('install.page.assessment.blockedDescription')}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                      {status === 'running' && <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />}
                      {status === 'success' && <CheckCircle2 className="h-6 w-6 text-emerald-500" />}
                      {status === 'error' && <AlertCircle className="h-6 w-6 text-red-500" />}
                      <span className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{t(`install.page.modal.status.${action.kind}.${status}`)}</span>
                    </div>
                    {operationProgress.currentStage ? (
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                            {t('install.page.modal.progressSummary.currentStage')}
                          </div>
                          <div className="mt-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                            {operationStageLabel}
                          </div>
                        </div>
                        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                            {t('install.page.modal.progressSummary.currentStep')}
                          </div>
                          <div className="mt-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                            {operationStepLabel}
                          </div>
                        </div>
                        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                            {t('install.page.modal.progressSummary.stages')}
                          </div>
                          <div className="mt-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                            {operationProgress.totalStageCount
                              ? `${operationProgress.completedStageCount}/${operationProgress.totalStageCount}`
                              : t('common.none')}
                          </div>
                        </div>
                        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                            {t('install.page.modal.progressSummary.artifacts')}
                          </div>
                          <div className="mt-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                            {operationProgress.totalArtifactCount
                              ? `${operationProgress.completedArtifactCount}/${operationProgress.totalArtifactCount}`
                              : t('common.none')}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="h-20 animate-pulse rounded-2xl bg-zinc-100 dark:bg-zinc-800" />
                    )}
                    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                      <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                        {t('install.page.modal.progressSummary.lastCommand')}
                      </div>
                      <div className="mt-2 break-all font-mono text-xs leading-relaxed text-zinc-700 dark:text-zinc-300">
                        {operationLastCommand}
                      </div>
                    </div>
                    {result && (
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                            {t('install.page.modal.result.installRoot')}
                          </div>
                          <div className="mt-2 break-all text-sm text-zinc-700 dark:text-zinc-300">
                            {result.resolvedInstallRoot}
                          </div>
                        </div>
                        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                            {t('install.page.modal.result.dataRoot')}
                          </div>
                          <div className="mt-2 break-all text-sm text-zinc-700 dark:text-zinc-300">
                            {result.resolvedDataRoot}
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="flex h-80 flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-inner">
                      <div className="flex shrink-0 items-center gap-2 border-b border-zinc-800 bg-zinc-900 px-4 py-3">
                        <SquareTerminal className="h-4 w-4 text-zinc-400" />
                        <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                          {t('install.page.modal.terminalOutput')}
                        </span>
                      </div>
                      <div ref={terminalRef} className="flex-1 overflow-y-auto p-5 font-mono text-sm whitespace-pre-wrap leading-relaxed">
                        {output.split('\n').map((line, i) => (
                          <span
                            key={i}
                            className={
                              /error|fail/i.test(line)
                                ? 'text-red-400'
                                : /✓|complete|success|ok/i.test(line)
                                  ? 'text-emerald-400'
                                  : 'text-zinc-300'
                            }
                          >
                            {line}{'\n'}
                          </span>
                        ))}
                        {status === 'running' && (
                          <span className="ml-1 inline-block h-4 w-2 animate-pulse bg-zinc-400 align-middle" />
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-3 border-t border-zinc-100 bg-white px-6 py-5 dark:border-zinc-800 dark:bg-zinc-900">
                {status === 'idle' ? (
                  <>
                    <button type="button" onClick={() => setIsModalOpen(false)} className="rounded-xl px-6 py-3 text-sm font-bold text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800">
                      {t('common.cancel')}
                    </button>
                    <button type="button" onClick={() => { void startAction(); }} disabled={action.kind === 'install' && (actionAssessment?.status === 'loading' || (actionAssessment?.result !== undefined && !actionAssessment.result.ready && getAssessmentCounts(actionAssessment.result).blockers > 0))} className="flex items-center gap-2 rounded-xl bg-primary-600 px-8 py-3 text-sm font-bold text-white shadow-lg shadow-primary-900/20 transition-colors hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-500 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500">
                      <Play className="h-4 w-4" />
                      {t(`install.page.modal.actions.start${action.kind === 'install' ? 'Install' : 'Uninstall'}`)}
                    </button>
                  </>
                ) : (
                  <button type="button" onClick={() => setIsModalOpen(false)} disabled={status === 'running'} className="rounded-xl bg-zinc-900 px-8 py-3 text-sm font-bold text-white shadow-md transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200">
                    {status === 'success' ? t('install.page.modal.actions.done') : t('install.page.modal.actions.close')}
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      </div>
    </div>
  );
}
