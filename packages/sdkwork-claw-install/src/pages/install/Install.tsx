import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  type HubInstallProgressEvent,
  type HubInstallRequest,
  type HubInstallResult,
  type HubUninstallRequest,
  type HubUninstallResult,
  type RuntimeEventUnsubscribe,
  type RuntimeInfo,
} from '@sdkwork/claw-infrastructure';
import { Checkbox } from '@sdkwork/claw-ui';
import { useTranslation } from 'react-i18next';
import { installerService } from '../../services';

type ProductId = 'openclaw' | 'zeroclaw' | 'ironclaw';
type PageMode = 'install' | 'uninstall' | 'migrate';
type HostOs = 'windows' | 'macos' | 'linux' | 'unknown';
type Status = 'idle' | 'running' | 'success' | 'error';
type MethodId = 'wsl' | 'docker' | 'npm' | 'pnpm' | 'source' | 'cloud';
type TagId =
  | 'cloud'
  | 'docker'
  | 'git'
  | 'linux'
  | 'macos'
  | 'managed'
  | 'nodejs'
  | 'npm'
  | 'pnpm'
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
  | { kind: 'uninstall'; choice: UninstallChoice };

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
  return [
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
    id: 'pnpm',
    titleKey: 'install.page.methods.pnpm.title',
    descriptionKey: 'install.page.methods.pnpm.description',
    icon: <Package className="h-6 w-6 text-amber-500 dark:text-amber-400" />,
    tags: ['nodejs', 'pnpm', 'windows', 'macos', 'linux'],
    request: { softwareName: 'zeroclaw-pnpm' },
    supportedHosts: ['windows', 'macos', 'linux'],
  },
  {
    id: 'source',
    titleKey: 'install.page.methods.source.title',
    descriptionKey: 'install.page.methods.source.description',
    icon: <Github className="h-6 w-6 text-zinc-700 dark:text-zinc-300" />,
    tags: ['source', 'git', 'windows', 'macos', 'linux'],
    request: { softwareName: 'zeroclaw-source' },
    supportedHosts: ['windows', 'macos', 'linux'],
  },
];

const IRONCLAW_METHODS: InstallChoice[] = [
  {
    id: 'pnpm',
    titleKey: 'install.page.methods.pnpm.title',
    descriptionKey: 'install.page.methods.pnpm.description',
    icon: <Package className="h-6 w-6 text-amber-500 dark:text-amber-400" />,
    tags: ['nodejs', 'pnpm', 'windows', 'macos', 'linux'],
    request: { softwareName: 'ironclaw-pnpm' },
    supportedHosts: ['windows', 'macos', 'linux'],
  },
  {
    id: 'source',
    titleKey: 'install.page.methods.source.title',
    descriptionKey: 'install.page.methods.source.description',
    icon: <Github className="h-6 w-6 text-zinc-700 dark:text-zinc-300" />,
    tags: ['source', 'git', 'windows', 'macos', 'linux'],
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
    id: 'pnpm',
    titleKey: 'install.page.methods.pnpm.title',
    descriptionKey: 'install.page.uninstall.methods.pnpm.description',
    icon: <Trash2 className="h-6 w-6 text-amber-500 dark:text-amber-400" />,
    tags: ['pnpm', 'windows', 'macos', 'linux'],
    request: { softwareName: 'zeroclaw-pnpm', purgeData: false },
    supportedHosts: ['windows', 'macos', 'linux'],
  },
  {
    id: 'source',
    titleKey: 'install.page.methods.source.title',
    descriptionKey: 'install.page.uninstall.methods.source.description',
    icon: <Trash2 className="h-6 w-6 text-zinc-700 dark:text-zinc-300" />,
    tags: ['source', 'git', 'windows', 'macos', 'linux'],
    request: { softwareName: 'zeroclaw-source', purgeData: false },
    supportedHosts: ['windows', 'macos', 'linux'],
  },
];

const IRONCLAW_UNINSTALL_METHODS: UninstallChoice[] = [
  {
    id: 'pnpm',
    titleKey: 'install.page.methods.pnpm.title',
    descriptionKey: 'install.page.uninstall.methods.pnpm.description',
    icon: <Trash2 className="h-6 w-6 text-amber-500 dark:text-amber-400" />,
    tags: ['pnpm', 'windows', 'macos', 'linux'],
    request: { softwareName: 'ironclaw-pnpm', purgeData: false },
    supportedHosts: ['windows', 'macos', 'linux'],
  },
  {
    id: 'source',
    titleKey: 'install.page.methods.source.title',
    descriptionKey: 'install.page.uninstall.methods.source.description',
    icon: <Trash2 className="h-6 w-6 text-zinc-700 dark:text-zinc-300" />,
    tags: ['source', 'git', 'windows', 'macos', 'linux'],
    request: { softwareName: 'ironclaw-source', purgeData: false },
    supportedHosts: ['windows', 'macos', 'linux'],
  },
];

const PRODUCTS: ProductConfig[] = [
  {
    id: 'openclaw',
    nameKey: 'install.page.products.openclaw.name',
    descriptionKey: 'install.page.products.openclaw.description',
    accent: 'from-primary-500/15 via-primary-500/5 to-transparent',
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
    methods: IRONCLAW_METHODS,
    uninstallMethods: IRONCLAW_UNINSTALL_METHODS,
    migrationDefinitions: createMigrationDefinitions('ironclaw'),
    legacyRecordFileName: createLegacyRecordFileName('ironclaw'),
  },
];

function formatProgressEvent(t: (key: string) => string, event: HubInstallProgressEvent) {
  if (event.type === 'stepStarted') return event.description;
  if (event.type === 'stepLogChunk') return event.chunk;
  if (event.type === 'artifactCompleted' && !event.success) return t('install.page.modal.progress.downloadFailed');
  if (event.type === 'stepCompleted' && event.skipped) return t('install.page.modal.progress.stepSkipped');
  if (event.type === 'stepCompleted' && !event.success) return t('install.page.modal.progress.stepFailed');
  return '';
}

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

const INSTALL_METHOD_PRIORITY: MethodId[] = ['wsl', 'docker', 'pnpm', 'npm', 'source', 'cloud'];

function getInstallChoicePriority(choice: InstallChoice) {
  const priority = INSTALL_METHOD_PRIORITY.indexOf(choice.id);
  return priority === -1 ? INSTALL_METHOD_PRIORITY.length : priority;
}

function getAssessmentPresentation(assessmentState?: InstallAssessmentState) {
  const assessment = assessmentState?.result;
  const assessmentCounts = getAssessmentCounts(assessment);
  const statusKey =
    assessmentState?.status === 'loading'
      ? 'install.page.assessment.status.inspecting'
      : assessmentState?.status === 'error'
        ? 'install.page.assessment.status.failed'
        : assessment
          ? assessment.ready
            ? assessmentCounts.blockers > 0
              ? 'install.page.assessment.status.blocked'
              : assessmentCounts.warnings > 0 || assessmentCounts.autoFixes > 0
                ? 'install.page.assessment.status.needsSetup'
                : 'install.page.assessment.status.ready'
            : 'install.page.assessment.status.blocked'
          : 'install.page.assessment.status.inspecting';

  const toneClasses =
    assessmentState?.status === 'error'
      ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300'
      : assessment?.ready
        ? assessmentCounts.warnings > 0 || assessmentCounts.autoFixes > 0
          ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300'
          : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300'
        : 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300';

  return {
    assessmentState,
    assessment,
    assessmentCounts,
    statusKey,
    toneClasses,
  };
}

export function Install() {
  const { t } = useTranslation();
  const progressUnsubscribeRef = useRef<RuntimeEventUnsubscribe | null>(null);
  const [pageMode, setPageMode] = useState<PageMode>('install');
  const [productId, setProductId] = useState<ProductId>('openclaw');
  const [runtimeInfo, setRuntimeInfo] = useState<RuntimeInfo | null>(null);
  const [installRecord, setInstallRecord] = useState<LegacyInstallRecord | null>(null);
  const [action, setAction] = useState<ActionState | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const [output, setOutput] = useState('');
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
  const [selectedInstallChoiceId, setSelectedInstallChoiceId] = useState<MethodId | null>(null);

  const hostOs = useMemo(() => getHostOs(runtimeInfo), [runtimeInfo]);
  const lifecycleModeTabs = PAGE_MODE_TABS;
  const productShelf = useMemo(() => {
    return [...PRODUCTS]
      .map((item) => {
        const supportedInstallChoices = item.methods.filter((choice) => supports(hostOs, choice));
        const supportedUninstallChoices = item.uninstallMethods.filter((choice) =>
          supports(hostOs, choice),
        );
        const detectedMigrationSources =
          item.id === productId
            ? migrationCandidates.filter((candidate) => candidate.sourcePath).length
            : 0;
        const modeCount =
          pageMode === 'install'
            ? supportedInstallChoices.length
            : pageMode === 'uninstall'
              ? supportedUninstallChoices.length
              : detectedMigrationSources;

        const statusLabel =
          pageMode === 'install'
            ? supportedInstallChoices.length
              ? t('install.page.productShelf.status.installReady', {
                  count: supportedInstallChoices.length,
                })
              : t('install.page.productShelf.status.reviewRequired')
            : pageMode === 'uninstall'
              ? item.id === productId && installRecord
                ? t('install.page.productShelf.status.detectedInstall')
                : supportedUninstallChoices.length
                  ? t('install.page.productShelf.status.uninstallReady', {
                      count: supportedUninstallChoices.length,
                    })
                  : t('install.page.productShelf.status.reviewRequired')
              : detectedMigrationSources > 0
                ? t('install.page.productShelf.status.migrationReady', {
                    count: detectedMigrationSources,
                  })
                : t('install.page.productShelf.status.manualImport');

        return {
          product: item,
          modeCount,
          statusLabel,
        };
      })
      .sort((left, right) => {
        if (left.product.id === productId) return -1;
        if (right.product.id === productId) return 1;
        return right.modeCount - left.modeCount;
      });
  }, [hostOs, installRecord, migrationCandidates, pageMode, productId, t]);
  const product = productShelf.find((item) => item.product.id === productId)?.product ?? PRODUCTS[0];
  const currentInstallChoices = product.methods.filter((choice) => supports(hostOs, choice));
  const currentUninstallChoices = product.uninstallMethods.filter((choice) => supports(hostOs, choice));
  const currentMigrationCandidates = migrationCandidates;
  const sortedInstallChoices = useMemo(
    () => [...currentInstallChoices].sort((left, right) => getInstallChoicePriority(left) - getInstallChoicePriority(right)),
    [currentInstallChoices],
  );
  const featuredInstallChoice =
    sortedInstallChoices.find((choice) => !choice.disabled) ?? sortedInstallChoices[0] ?? null;
  const secondaryInstallChoices = sortedInstallChoices.filter(
    (choice) => choice.id !== featuredInstallChoice?.id,
  );
  const selectedInstallChoice =
    sortedInstallChoices.find((choice) => choice.id === selectedInstallChoiceId) ??
    featuredInstallChoice;
  const selectedMigrationCandidates = currentMigrationCandidates.filter(
    (item) => item.sourcePath && selectedMigrationIds.includes(item.id),
  );
  const actionAssessment =
    action?.kind === 'install'
      ? installAssessments[getInstallRequestKey(action.choice.request)]
      : undefined;
  const selectedInstallAssessment =
    selectedInstallChoice &&
    installAssessments[getInstallRequestKey(selectedInstallChoice.request)];

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
    if (!isModalOpen || action?.kind !== 'install') return;
    void inspectInstallChoice(action.choice);
  }, [action, isModalOpen]);

  useEffect(() => {
    if (pageMode !== 'install') return;
    if (!selectedInstallChoiceId || !sortedInstallChoices.some((choice) => choice.id === selectedInstallChoiceId)) {
      setSelectedInstallChoiceId(featuredInstallChoice?.id ?? null);
    }
  }, [featuredInstallChoice?.id, pageMode, selectedInstallChoiceId, sortedInstallChoices]);

  const startAction = async () => {
    if (!action) return;
    await cleanupProgress();
    setStatus('running');
    setResult(null);
    setOutput(`${action.kind === 'install' ? t('install.page.modal.output.preparingInstall', { product: t(action.product.nameKey), method: t(action.choice.titleKey) }) : t('install.page.modal.output.preparingUninstall', { method: t(action.choice.titleKey) })}\n${t('install.page.modal.output.starting')}\n`);
    progressUnsubscribeRef.current = await installerService.subscribeHubInstallProgress((event) => {
      const line = formatProgressEvent(t as (key: string) => string, event).trim();
      if (!line) return;
      setOutput((previous) => `${previous}${previous.endsWith('\n') ? '' : '\n'}${line}\n`);
    });
    try {
      const nextResult = action.kind === 'install' ? await installerService.runHubInstall(action.choice.request) : await installerService.runHubUninstall(action.choice.request);
      setResult(nextResult);
      setStatus(nextResult.success ? 'success' : 'error');
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

  const beginInstallChoice = (choice: InstallChoice) => {
    if (choice.disabled) return;
    setSelectedInstallChoiceId(choice.id);
    void inspectInstallChoice(choice, { force: true });
    setAction({ kind: 'install', product, choice });
    setStatus('idle');
    setOutput('');
    setResult(null);
    setIsModalOpen(true);
  };

  const lifecycleWorkspaceHeader = {
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
    description: t(`install.page.modes.${pageMode}.description`),
  };

  const lifecycleStatusBadges: Array<{
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
            value: t('install.page.uninstall.detectedTitle'),
            tone: 'emerald' as const,
          },
        ]
      : []),
    pageMode === 'install'
      ? {
          key: 'install-paths',
          label: t('install.page.header.badges.availableForProduct'),
          value: `${currentInstallChoices.length} ${t('install.page.header.badges.installPaths')}`,
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
  ];

  const installSupportNote = {
    title: t('install.page.install.supportTitle'),
    description: t('install.page.install.supportDescription', {
      product: t(product.nameKey),
    }),
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
                {t('install.page.uninstall.detectedTitle')}
              </div>
              <h2 className="mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                {t('install.page.uninstall.title')}
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
                {t('install.page.uninstall.description')}
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
                setAction({ kind: 'uninstall', choice });
                setStatus('idle');
                setOutput('');
                setResult(null);
                setIsModalOpen(true);
              }}
              className="mt-auto flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
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
                {t('install.page.migrate.title')}
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
            <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              {t('install.page.migrate.customSourceLabel')}
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
          <div className="flex-1 overflow-y-auto p-5 font-mono text-sm leading-relaxed whitespace-pre-wrap">
            <span className={migrationStatus === 'error' ? 'text-red-400' : 'text-emerald-400'}>
              {migrationOutput || t('install.page.migrate.output.placeholder')}
            </span>
            {migrationStatus === 'running' && (
              <span className="ml-1 inline-block h-4 w-2 animate-pulse bg-zinc-400 align-middle" />
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const featuredAssessmentPresentation = getAssessmentPresentation(
    featuredInstallChoice
      ? installAssessments[getInstallRequestKey(featuredInstallChoice.request)]
      : undefined,
  );
  const selectedAssessmentPresentation = getAssessmentPresentation(selectedInstallAssessment);

  const focusWorkspace =
    pageMode === 'install' ? (
      <div className="focusWorkspace space-y-6">
        <div className="rounded-[2rem] border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
            {t('install.page.install.sectionTitle')}
          </div>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            {t('install.page.install.sectionHeading')}
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
            {t('install.page.install.sectionDescription', { product: t(product.nameKey) })}
          </p>
        </div>

        {featuredInstallChoice ? (
          <div className="rounded-[2rem] border border-primary-200 bg-gradient-to-br from-primary-50 via-white to-white p-6 shadow-sm dark:border-primary-500/30 dark:from-primary-500/10 dark:via-zinc-900 dark:to-zinc-900">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.25rem] border border-primary-200 bg-white text-primary-600 shadow-sm dark:border-primary-500/30 dark:bg-zinc-950 dark:text-primary-300">
                  {featuredInstallChoice.icon}
                </div>
                <div>
                  <div className="inline-flex items-center rounded-full border border-primary-300/70 bg-primary-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary-700 dark:border-primary-500/20 dark:bg-primary-500/10 dark:text-primary-200">
                    {t('install.page.install.recommendedTitle')}
                  </div>
                  <h3 className="mt-3 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                    {t(featuredInstallChoice.titleKey)}
                  </h3>
                  <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
                    {t(featuredInstallChoice.descriptionKey)}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {featuredInstallChoice.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full border border-primary-200 bg-white/80 px-3 py-1 text-xs font-medium text-primary-700 dark:border-primary-500/20 dark:bg-primary-500/10 dark:text-primary-200"
                      >
                        {t(`install.page.tags.${tag}`)}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="min-w-[220px] rounded-[1.5rem] border border-white/70 bg-white/80 p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/70">
                <div
                  className={`rounded-2xl border px-4 py-3 text-sm ${featuredAssessmentPresentation.toneClasses}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold uppercase tracking-wider">
                      {t('install.page.assessment.title')}
                    </span>
                    <span className="font-semibold">
                      {t(featuredAssessmentPresentation.statusKey)}
                    </span>
                  </div>
                  {featuredAssessmentPresentation.assessment && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {featuredAssessmentPresentation.assessmentCounts.blockers > 0 && (
                        <span className="rounded-full border border-current/20 px-2.5 py-1 text-xs font-medium">
                          {t('install.page.assessment.summary.blockers', {
                            count: featuredAssessmentPresentation.assessmentCounts.blockers,
                          })}
                        </span>
                      )}
                      {featuredAssessmentPresentation.assessmentCounts.warnings > 0 && (
                        <span className="rounded-full border border-current/20 px-2.5 py-1 text-xs font-medium">
                          {t('install.page.assessment.summary.warnings', {
                            count: featuredAssessmentPresentation.assessmentCounts.warnings,
                          })}
                        </span>
                      )}
                      {featuredAssessmentPresentation.assessmentCounts.autoFixes > 0 && (
                        <span className="rounded-full border border-current/20 px-2.5 py-1 text-xs font-medium">
                          {t('install.page.assessment.summary.autoFixes', {
                            count: featuredAssessmentPresentation.assessmentCounts.autoFixes,
                          })}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => beginInstallChoice(featuredInstallChoice)}
                  disabled={featuredInstallChoice.disabled}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-500 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500"
                >
                  <DownloadCloud className="h-4 w-4" />
                  {t('install.page.install.recommendedAction')}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-[2rem] border border-zinc-200 bg-white p-6 text-sm leading-relaxed text-zinc-500 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
            {t('install.page.install.noSupportedPath')}
          </div>
        )}

        {selectedInstallChoice && (
          <div className="rounded-[2rem] border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-zinc-100 bg-zinc-50 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
                  {selectedInstallChoice.icon}
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                    {t('install.page.install.detailTitle')}
                  </div>
                  <h3 className="mt-2 text-xl font-bold text-zinc-900 dark:text-zinc-100">
                    {t(selectedInstallChoice.titleKey)}
                  </h3>
                  <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
                    {t(selectedInstallChoice.descriptionKey)}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {selectedInstallChoice.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-lg border border-zinc-100 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-600 dark:border-zinc-800 dark:bg-zinc-800/50 dark:text-zinc-400"
                      >
                        {t(`install.page.tags.${tag}`)}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="min-w-[240px] space-y-3">
                <div
                  className={`rounded-2xl border px-4 py-3 text-sm ${selectedAssessmentPresentation.toneClasses}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold uppercase tracking-wider">
                      {t('install.page.assessment.title')}
                    </span>
                    <span className="font-semibold">
                      {t(selectedAssessmentPresentation.statusKey)}
                    </span>
                  </div>
                  {selectedAssessmentPresentation.assessmentState?.status === 'error' && (
                    <p className="mt-2 leading-relaxed">
                      {selectedAssessmentPresentation.assessmentState.error}
                    </p>
                  )}
                  {selectedAssessmentPresentation.assessment && (
                    <>
                      <p className="mt-2 leading-relaxed">
                        {t('install.page.assessment.runtimeSummary', {
                          runtime:
                            selectedAssessmentPresentation.assessment.runtime
                              .effectiveRuntimePlatform,
                        })}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {selectedAssessmentPresentation.assessmentCounts.blockers > 0 && (
                          <span className="rounded-full border border-current/20 px-2.5 py-1 text-xs font-medium">
                            {t('install.page.assessment.summary.blockers', {
                              count: selectedAssessmentPresentation.assessmentCounts.blockers,
                            })}
                          </span>
                        )}
                        {selectedAssessmentPresentation.assessmentCounts.warnings > 0 && (
                          <span className="rounded-full border border-current/20 px-2.5 py-1 text-xs font-medium">
                            {t('install.page.assessment.summary.warnings', {
                              count: selectedAssessmentPresentation.assessmentCounts.warnings,
                            })}
                          </span>
                        )}
                        {selectedAssessmentPresentation.assessmentCounts.autoFixes > 0 && (
                          <span className="rounded-full border border-current/20 px-2.5 py-1 text-xs font-medium">
                            {t('install.page.assessment.summary.autoFixes', {
                              count: selectedAssessmentPresentation.assessmentCounts.autoFixes,
                            })}
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </div>
                <button
                  type="button"
                  data-slot="recommended-action"
                  onClick={() => beginInstallChoice(selectedInstallChoice)}
                  disabled={selectedInstallChoice.disabled}
                  className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition-all ${
                    selectedInstallChoice.disabled
                      ? 'cursor-not-allowed bg-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-500'
                      : 'bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200'
                  }`}
                >
                  <DownloadCloud className="h-4 w-4" />
                  {t(
                    selectedInstallChoice.disabled
                      ? 'install.page.method.actions.comingSoon'
                      : 'install.page.method.actions.install',
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {!!secondaryInstallChoices.length && (
          <div className="rounded-[2rem] border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                  {t('install.page.install.alternateTitle')}
                </div>
                <h3 className="mt-2 text-xl font-bold text-zinc-900 dark:text-zinc-100">
                  {t('install.page.install.alternateHeading')}
                </h3>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
                  {t('install.page.install.alternateDescription')}
                </p>
              </div>
            </div>
            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
              {secondaryInstallChoices.map((choice) => {
                const choiceAssessmentPresentation = getAssessmentPresentation(
                  installAssessments[getInstallRequestKey(choice.request)],
                );

                return (
                  <button
                    key={`${product.id}-${choice.id}`}
                    type="button"
                    onClick={() => setSelectedInstallChoiceId(choice.id)}
                    className={`rounded-[1.5rem] border p-5 text-left transition-all ${
                      selectedInstallChoice?.id === choice.id
                        ? 'border-zinc-900 bg-zinc-900 text-white shadow-lg dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900'
                        : 'border-zinc-200 bg-zinc-50 hover:border-zinc-300 hover:bg-white dark:border-zinc-800 dark:bg-zinc-950/50 dark:hover:border-zinc-700 dark:hover:bg-zinc-900'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-zinc-100 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
                        {choice.icon}
                      </div>
                      <span
                        className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${
                          choiceAssessmentPresentation.toneClasses
                        }`}
                      >
                        {t(choiceAssessmentPresentation.statusKey)}
                      </span>
                    </div>
                    <div className="mt-4 text-lg font-bold">{t(choice.titleKey)}</div>
                    <p
                      className={`mt-2 text-sm leading-relaxed ${
                        selectedInstallChoice?.id === choice.id
                          ? 'text-zinc-300 dark:text-zinc-700'
                          : 'text-zinc-500 dark:text-zinc-400'
                      }`}
                    >
                      {t(choice.descriptionKey)}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="installSupportNote rounded-[1.75rem] border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-start gap-4">
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-zinc-200 bg-gradient-to-br ${product.accent} dark:border-zinc-700`}>
              <Cpu className="h-5 w-5 text-zinc-800 dark:text-zinc-100" />
            </div>
            <div>
              <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {installSupportNote.title}
              </div>
              <p className="mt-1 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
                {installSupportNote.description}
              </p>
            </div>
          </div>
        </div>
      </div>
    ) : pageMode === 'uninstall' ? (
      uninstallWorkspace
    ) : (
      migrationWorkspace
    );

  const contextRail = (
    <div className="contextRail space-y-4">
      <div className="rounded-[1.75rem] border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
          {t('install.page.contextRail.title')}
        </div>
        <h3 className="mt-2 text-lg font-bold text-zinc-900 dark:text-zinc-100">
          {t('install.page.contextRail.heading')}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
          {t('install.page.contextRail.description', {
            product: t(product.nameKey),
            mode: t(`install.page.tabs.${pageMode}`),
          })}
        </p>
      </div>

      <div className="rounded-[1.75rem] border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
            {t('install.page.runtime.label')}
          </div>
          <button
            type="button"
            onClick={() => setAssessmentRefreshTick((previous) => previous + 1)}
            className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-semibold text-zinc-700 transition-colors hover:bg-white dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            {t('install.page.runtime.actions.rescan')}
          </button>
        </div>
        <div className="space-y-3 text-sm">
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
            <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              {t('install.page.header.badges.lifecycleMode')}
            </div>
            <div className="mt-2 font-semibold text-zinc-900 dark:text-zinc-100">
              {t(`install.page.tabs.${pageMode}`)}
            </div>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
            <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              {t('install.page.runtime.label')}
            </div>
            <div className="mt-2 font-semibold text-zinc-900 dark:text-zinc-100">
              {t(`install.page.runtime.values.${hostOs}`)}
            </div>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
            <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              {t('install.page.header.badges.currentProduct')}
            </div>
            <div className="mt-2 font-semibold text-zinc-900 dark:text-zinc-100">
              {t(product.nameKey)}
            </div>
          </div>
        </div>
      </div>

      {pageMode === 'install' && selectedInstallChoice && (
        <div className="rounded-[1.75rem] border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
            {t('install.page.contextRail.selectedPath')}
          </div>
          <div className="mt-2 text-lg font-bold text-zinc-900 dark:text-zinc-100">
            {t(selectedInstallChoice.titleKey)}
          </div>
          <p className="mt-2 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
            {selectedAssessmentPresentation.assessment
              ? t('install.page.assessment.runtimeSummary', {
                  runtime:
                    selectedAssessmentPresentation.assessment.runtime.effectiveRuntimePlatform,
                })
              : t('install.page.install.pendingAssessment')}
          </p>
        </div>
      )}

      {pageMode === 'uninstall' && (
        <div className="rounded-[1.75rem] border border-amber-200 bg-amber-50/80 p-5 shadow-sm dark:border-amber-500/30 dark:bg-amber-500/10">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-300">
            {t('install.page.uninstall.reviewTitle')}
          </div>
          <h3 className="mt-2 text-lg font-bold text-amber-950 dark:text-amber-100">
            {t('install.page.uninstall.reviewHeading')}
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-amber-800 dark:text-amber-200">
            {t('install.page.uninstall.reviewDescription', { product: t(product.nameKey) })}
          </p>
          <div className="mt-4 space-y-3 text-sm">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-amber-700/80 dark:text-amber-300/80">
                {t('install.page.uninstall.detected.installRoot')}
              </div>
              <div className="mt-1 break-all font-medium text-amber-950 dark:text-amber-100">
                {installRecord?.installRoot ?? t('install.page.uninstall.detected.notFound')}
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-amber-700/80 dark:text-amber-300/80">
                {t('install.page.uninstall.detected.dataRoot')}
              </div>
              <div className="mt-1 break-all font-medium text-amber-950 dark:text-amber-100">
                {installRecord?.dataRoot ?? t('install.page.uninstall.detected.notFound')}
              </div>
            </div>
          </div>
        </div>
      )}

      {pageMode === 'migrate' && (
        <div className="rounded-[1.75rem] border border-sky-200 bg-sky-50/80 p-5 shadow-sm dark:border-sky-500/30 dark:bg-sky-500/10">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700 dark:text-sky-300">
            {t('install.page.migrate.workspaceTitle')}
          </div>
          <h3 className="mt-2 text-lg font-bold text-sky-950 dark:text-sky-100">
            {t('install.page.migrate.readyTitle')}
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-sky-800 dark:text-sky-200">
            {t('install.page.migrate.readyDescription')}
          </p>
          <div className="mt-4 space-y-3 text-sm">
            <div className="rounded-2xl border border-sky-200/70 bg-white/70 p-4 dark:border-sky-500/20 dark:bg-zinc-950/60">
              <div className="text-xs font-semibold uppercase tracking-wider text-sky-700 dark:text-sky-300">
                {t('install.page.header.badges.availableForProduct')}
              </div>
              <div className="mt-2 font-semibold text-sky-950 dark:text-sky-100">
                {`${currentMigrationCandidates.filter((item) => item.sourcePath).length} ${t('install.page.header.badges.migrationSources')}`}
              </div>
            </div>
            <div className="rounded-2xl border border-sky-200/70 bg-white/70 p-4 dark:border-sky-500/20 dark:bg-zinc-950/60">
              <div className="text-xs font-semibold uppercase tracking-wider text-sky-700 dark:text-sky-300">
                {t('install.page.migrate.actions.start')}
              </div>
              <div className="mt-2 font-semibold text-sky-950 dark:text-sky-100">
                {selectedMigrationCandidates.length}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="mx-auto h-full max-w-7xl overflow-y-auto bg-zinc-50 p-5 scrollbar-hide dark:bg-zinc-950 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="lifecycleWorkspaceHeader overflow-hidden rounded-[2rem] border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div className="border-b border-zinc-100 px-5 py-5 dark:border-zinc-800 md:px-6">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-zinc-200 bg-zinc-100 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100">
                  {lifecycleWorkspaceHeader.icon}
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">
                    {lifecycleWorkspaceHeader.eyebrow}
                  </div>
                  <h1 className="mt-2 text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 md:text-[2.25rem]">
                    {lifecycleWorkspaceHeader.title}
                  </h1>
                  <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-500 dark:text-zinc-400 md:text-base">
                    {lifecycleWorkspaceHeader.description}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-1.5 dark:border-zinc-800 dark:bg-zinc-950/80">
                <div className="px-3 pt-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                  {t('install.page.header.taskTitle')}
                </div>
                <div className="flex flex-wrap gap-1">
                  {lifecycleModeTabs.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setPageMode(tab.id)}
                      className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${
                        pageMode === tab.id
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
            <div className="lifecycleStatusBadges flex flex-wrap items-center gap-3">
              {lifecycleStatusBadges.map((badge) => (
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
          </div>
        </motion.div>

        <div className="productShelf rounded-[2rem] border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">
                {t('install.page.productShelf.eyebrow')}
              </div>
              <h2 className="mt-2 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                {t('install.page.productShelf.title')}
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
                {t('install.page.productShelf.description', {
                  mode: t(`install.page.tabs.${pageMode}`),
                })}
              </p>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3">
            {productShelf.map((item) => (
              <button
                key={item.product.id}
                type="button"
                onClick={() => setProductId(item.product.id)}
                data-slot={
                  product.id === item.product.id
                    ? 'active-product-shelf-option'
                    : 'product-shelf-option'
                }
                className={`rounded-[1.75rem] border p-5 text-left transition-all ${
                  product.id === item.product.id
                    ? 'border-zinc-900 bg-zinc-900 text-white shadow-lg dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900'
                    : 'border-zinc-200 bg-zinc-50 hover:border-zinc-300 hover:bg-white dark:border-zinc-800 dark:bg-zinc-950/60 dark:text-zinc-100 dark:hover:border-zinc-700 dark:hover:bg-zinc-900'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-lg font-bold">{t(item.product.nameKey)}</div>
                    <div
                      className={`mt-2 text-sm leading-relaxed ${
                        product.id === item.product.id
                          ? 'text-zinc-300 dark:text-zinc-700'
                          : 'text-zinc-500 dark:text-zinc-400'
                      }`}
                    >
                      {t(item.product.descriptionKey)}
                    </div>
                  </div>
                  {product.id === item.product.id && (
                    <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white dark:bg-zinc-900 dark:text-zinc-100">
                      {t('install.page.install.selectedProduct')}
                    </span>
                  )}
                </div>
                <div
                  className={`mt-4 text-xs font-semibold uppercase tracking-[0.18em] ${
                    product.id === item.product.id
                      ? 'text-zinc-200 dark:text-zinc-700'
                      : 'text-zinc-500 dark:text-zinc-400'
                  }`}
                >
                  {item.statusLabel}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          {focusWorkspace}
          {contextRail}
        </div>

      <AnimatePresence>
        {isModalOpen && action && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-zinc-950/60 backdrop-blur-sm" onClick={() => { if (status !== 'running') setIsModalOpen(false); }} />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} transition={{ duration: 0.2, ease: 'easeOut' }} className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center justify-between border-b border-zinc-100 bg-white px-6 py-5 dark:border-zinc-800 dark:bg-zinc-900"><div className="flex items-center gap-4"><div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-zinc-100 bg-zinc-50 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">{action.choice.icon}</div><div><h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{action.kind === 'install' ? t('install.page.modal.title.install', { product: t(action.product.nameKey), method: t(action.choice.titleKey) }) : t('install.page.modal.title.uninstall', { method: t(action.choice.titleKey) })}</h2><p className="mt-0.5 text-sm font-medium text-zinc-500 dark:text-zinc-400">{t(`install.page.modal.subtitle.${action.kind}`)}</p></div></div><button type="button" onClick={() => { if (status !== 'running') setIsModalOpen(false); }} disabled={status === 'running'} aria-label={t('install.page.modal.actions.close')} className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800 disabled:opacity-50"><X className="h-5 w-5" /></button></div>
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
                        {action.kind === 'install' && (
                          <div>
                            <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                              {t('install.page.modal.productLabel')}:
                            </span>{' '}
                            {t(action.product.nameKey)}
                          </div>
                        )}
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
                    {result && <div className="grid grid-cols-1 gap-4 md:grid-cols-2"><div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"><div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{t('install.page.modal.result.installRoot')}</div><div className="mt-2 break-all text-sm text-zinc-700 dark:text-zinc-300">{result.resolvedInstallRoot}</div></div><div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"><div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{t('install.page.modal.result.dataRoot')}</div><div className="mt-2 break-all text-sm text-zinc-700 dark:text-zinc-300">{result.resolvedDataRoot}</div></div></div>}
                    <div className="flex h-80 flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-inner"><div className="flex shrink-0 items-center gap-2 border-b border-zinc-800 bg-zinc-900 px-4 py-3"><SquareTerminal className="h-4 w-4 text-zinc-400" /><span className="text-xs font-bold uppercase tracking-wider text-zinc-400">{t('install.page.modal.terminalOutput')}</span></div><div className="flex-1 overflow-y-auto p-5 font-mono text-sm whitespace-pre-wrap leading-relaxed"><span className={status === 'error' ? 'text-red-400' : 'text-emerald-400'}>{output}</span>{status === 'running' && <span className="ml-1 inline-block h-4 w-2 animate-pulse bg-zinc-400 align-middle" />}</div></div>
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-3 border-t border-zinc-100 bg-white px-6 py-5 dark:border-zinc-800 dark:bg-zinc-900">
                {status === 'idle' ? (
                  <>
                    <button type="button" onClick={() => setIsModalOpen(false)} className="rounded-xl px-6 py-3 text-sm font-bold text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800">
                      {t('common.cancel')}
                    </button>
                    <button type="button" onClick={() => { void startAction(); }} disabled={action.kind === 'install' && (actionAssessment?.status === 'loading' || actionAssessment?.status === 'error' || !actionAssessment?.result?.ready)} className="flex items-center gap-2 rounded-xl bg-primary-600 px-8 py-3 text-sm font-bold text-white shadow-lg shadow-primary-900/20 transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-500 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500">
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
