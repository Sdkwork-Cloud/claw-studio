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

type ProductConfig = {
  id: ProductId;
  nameKey: string;
  descriptionKey: string;
  accent: string;
  methods: InstallChoice[];
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

type MigrationCandidate = {
  id: MigrationId;
  titleKey: string;
  descriptionKey: string;
  sourcePath: string | null;
  destinationRoot: string;
  sourceKind: 'detected' | 'manual';
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

const PRODUCTS: ProductConfig[] = [
  {
    id: 'openclaw',
    nameKey: 'install.page.products.openclaw.name',
    descriptionKey: 'install.page.products.openclaw.description',
    accent: 'from-primary-500/15 via-primary-500/5 to-transparent',
    methods: OPENCLAW_METHODS,
  },
  {
    id: 'zeroclaw',
    nameKey: 'install.page.products.zeroclaw.name',
    descriptionKey: 'install.page.products.zeroclaw.description',
    accent: 'from-cyan-500/15 via-cyan-500/5 to-transparent',
    methods: OPENCLAW_METHODS.filter((choice) => !['wsl', 'docker', 'npm'].includes(choice.id)),
  },
  {
    id: 'ironclaw',
    nameKey: 'install.page.products.ironclaw.name',
    descriptionKey: 'install.page.products.ironclaw.description',
    accent: 'from-amber-500/20 via-amber-500/5 to-transparent',
    methods: OPENCLAW_METHODS.filter((choice) => !['wsl', 'docker', 'npm'].includes(choice.id)),
  },
];

const UNINSTALL_CHOICES: UninstallChoice[] = [
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

  const hostOs = useMemo(() => getHostOs(runtimeInfo), [runtimeInfo]);
  const product = PRODUCTS.find((item) => item.id === productId) ?? PRODUCTS[0];
  const installChoices = product.methods.filter((choice) => supports(hostOs, choice));
  const uninstallChoices = UNINSTALL_CHOICES.filter((choice) => supports(hostOs, choice));
  const selectedMigrationCandidates = migrationCandidates.filter(
    (item) => item.sourcePath && selectedMigrationIds.includes(item.id),
  );

  const cleanupProgress = async () => {
    const unsubscribe = progressUnsubscribeRef.current;
    progressUnsubscribeRef.current = null;
    if (unsubscribe) await unsubscribe();
  };

  const refreshInstallRecord = async (nextRuntimeInfo: RuntimeInfo | null) => {
    const userRoot = nextRuntimeInfo?.paths?.userRoot;
    if (!userRoot) return setInstallRecord(null);
    const recordPath = pathJoin(getHostOs(nextRuntimeInfo), userRoot, 'hub-installer', 'state', 'install-records', 'openclaw.json');
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
    const nextCandidates: MigrationCandidate[] = [
      {
        id: 'config',
        titleKey: 'install.page.migrate.sections.config.title',
        descriptionKey: 'install.page.migrate.sections.config.description',
        sourcePath: await firstExisting([pathJoin(nextHostOs, home, '.openclaw'), pathJoin(nextHostOs, home, '.config', 'openclaw')]),
        destinationRoot: pathJoin(nextHostOs, paths.configDir, 'openclaw'),
        sourceKind: 'detected',
      },
      {
        id: 'data',
        titleKey: 'install.page.migrate.sections.data.title',
        descriptionKey: 'install.page.migrate.sections.data.description',
        sourcePath: await firstExisting([nextRecord?.dataRoot, pathJoin(nextHostOs, home, '.local', 'share', 'openclaw')]),
        destinationRoot: pathJoin(nextHostOs, paths.dataDir, 'openclaw'),
        sourceKind: 'detected',
      },
      {
        id: 'workspace',
        titleKey: 'install.page.migrate.sections.workspace.title',
        descriptionKey: 'install.page.migrate.sections.workspace.description',
        sourcePath: await firstExisting([nextRecord?.workRoot, pathJoin(nextHostOs, home, '.openclaw', 'workspace')]),
        destinationRoot: pathJoin(nextHostOs, paths.workspacesDir, 'openclaw'),
        sourceKind: 'detected',
      },
      {
        id: 'logs',
        titleKey: 'install.page.migrate.sections.logs.title',
        descriptionKey: 'install.page.migrate.sections.logs.description',
        sourcePath: await firstExisting([pathJoin(nextHostOs, home, '.openclaw', 'logs'), pathJoin(nextHostOs, home, '.local', 'state', 'openclaw')]),
        destinationRoot: pathJoin(nextHostOs, paths.logsDir, 'openclaw'),
        sourceKind: 'detected',
      },
    ];
    if (manualSource) {
      nextCandidates.push({
        id: 'manual',
        titleKey: 'install.page.migrate.sections.manual.title',
        descriptionKey: 'install.page.migrate.sections.manual.description',
        sourcePath: manualSource,
        destinationRoot: pathJoin(nextHostOs, paths.dataDir, 'openclaw', 'imports'),
        sourceKind: 'manual',
      });
    }
    setMigrationCandidates(nextCandidates);
    setSelectedMigrationIds(nextCandidates.filter((item) => item.sourcePath).map((item) => item.id));
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
  }, [runtimeInfo]);

  useEffect(() => {
    void refreshMigrationCandidates(runtimeInfo, installRecord, customMigrationSource);
  }, [runtimeInfo, installRecord, customMigrationSource]);

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

  return (
    <div className="mx-auto h-full max-w-7xl overflow-y-auto bg-zinc-50 p-6 scrollbar-hide dark:bg-zinc-950 md:p-10">
      <div className="mx-auto mb-8 max-w-4xl text-center">
        <motion.div initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }} className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl border border-primary-100/50 bg-primary-50 text-primary-600 shadow-inner dark:border-primary-500/20 dark:bg-primary-500/10 dark:text-primary-400">
          {pageMode === 'install' && <DownloadCloud className="h-10 w-10" />}
          {pageMode === 'uninstall' && <Trash2 className="h-10 w-10" />}
          {pageMode === 'migrate' && <ArrowRightLeft className="h-10 w-10" />}
        </motion.div>
        <h1 className="mb-4 text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 md:text-5xl">{t('install.page.hero.title')}</h1>
        <p className="mx-auto max-w-3xl text-lg leading-relaxed text-zinc-500 dark:text-zinc-400">{t(`install.page.modes.${pageMode}.description`)}</p>
      </div>

      <div className="mx-auto mb-6 flex max-w-3xl flex-wrap items-center justify-center gap-3 rounded-3xl border border-zinc-200 bg-white p-2 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        {PAGE_MODE_TABS.map((tab) => (
          <button key={tab.id} type="button" onClick={() => setPageMode(tab.id)} className={`rounded-2xl px-5 py-3 text-sm font-bold transition-all ${pageMode === tab.id ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900' : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'}`}>
            {t(tab.labelKey)}
          </button>
        ))}
      </div>

      <div className="mx-auto mb-8 flex max-w-4xl flex-wrap items-center justify-center gap-3 rounded-3xl border border-zinc-200 bg-white px-5 py-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">{t('install.page.runtime.label')}</span>
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{t(`install.page.runtime.values.${hostOs}`)}</span>
        {installRecord && <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">{t('install.page.runtime.detectedInstall')}</span>}
      </div>

      {pageMode === 'install' && (
        <>
          <div className="mx-auto mb-8 grid max-w-4xl grid-cols-1 gap-3 md:grid-cols-3">
            {PRODUCTS.map((item) => (
              <button key={item.id} type="button" onClick={() => setProductId(item.id)} className={`rounded-3xl border p-5 text-left transition-all ${product.id === item.id ? 'border-zinc-900 bg-zinc-900 text-white shadow-lg dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900' : 'border-zinc-200 bg-white hover:border-zinc-300 hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-zinc-700'}`}>
                <div className="text-lg font-bold">{t(item.nameKey)}</div>
                <div className={`mt-2 text-sm leading-relaxed ${product.id === item.id ? 'text-zinc-300 dark:text-zinc-700' : 'text-zinc-500 dark:text-zinc-400'}`}>{t(item.descriptionKey)}</div>
              </button>
            ))}
          </div>
          <div className={`relative mx-auto mb-10 flex max-w-5xl items-center gap-6 overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-xl`}><div className={`absolute inset-0 bg-gradient-to-r ${product.accent}`} /><div className="relative z-10 flex h-14 w-14 items-center justify-center rounded-2xl border border-zinc-700 bg-zinc-800 text-zinc-300"><Cpu className="h-7 w-7" /></div><div className="relative z-10"><h3 className="mb-1 text-lg font-bold text-white">{t('install.page.systemRequirements.title')}</h3><p className="text-sm leading-relaxed text-zinc-300">{t('install.page.systemRequirements.description', { product: t(product.nameKey) })}</p></div></div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {installChoices.map((choice) => (
              <div key={`${product.id}-${choice.id}`} className="flex h-full flex-col rounded-3xl border border-zinc-200 bg-white p-6 transition-all hover:border-zinc-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700 dark:hover:shadow-zinc-900/50">
                <div className="mb-5 mt-2 flex h-12 w-12 items-center justify-center rounded-2xl border border-zinc-100 bg-zinc-50 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">{choice.icon}</div>
                <h3 className="mb-2 text-xl font-bold text-zinc-900 dark:text-zinc-100">{t(choice.titleKey)}</h3>
                <p className="mb-6 flex-1 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">{t(choice.descriptionKey)}</p>
                <div className="mb-8 flex flex-wrap gap-2">{choice.tags.map((tag) => <span key={tag} className="rounded-lg border border-zinc-100 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-600 dark:border-zinc-800 dark:bg-zinc-800/50 dark:text-zinc-400">{t(`install.page.tags.${tag}`)}</span>)}</div>
                <button type="button" onClick={() => { if (!choice.disabled) { setAction({ kind: 'install', product, choice }); setStatus('idle'); setOutput(''); setResult(null); setIsModalOpen(true); } }} disabled={choice.disabled} className={`mt-auto flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition-all ${choice.disabled ? 'cursor-not-allowed bg-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-500' : 'bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200'}`}><DownloadCloud className="h-4 w-4" />{t(choice.disabled ? 'install.page.method.actions.comingSoon' : 'install.page.method.actions.install')}</button>
              </div>
            ))}
          </div>
        </>
      )}

      {pageMode === 'uninstall' && (
        <div className="space-y-8">
          <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{t('install.page.uninstall.title')}</h3>
            <p className="mt-2 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">{t('install.page.uninstall.description')}</p>
            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/60"><div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{t('install.page.uninstall.detected.installMode')}</div><div className="mt-2 break-all text-sm font-medium text-zinc-800 dark:text-zinc-200">{installRecord?.manifestName ?? t('install.page.uninstall.detected.notFound')}</div></div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/60"><div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{t('install.page.uninstall.detected.installRoot')}</div><div className="mt-2 break-all text-sm font-medium text-zinc-800 dark:text-zinc-200">{installRecord?.installRoot ?? t('install.page.uninstall.detected.notFound')}</div></div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/60"><div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{t('install.page.uninstall.detected.dataRoot')}</div><div className="mt-2 break-all text-sm font-medium text-zinc-800 dark:text-zinc-200">{installRecord?.dataRoot ?? t('install.page.uninstall.detected.notFound')}</div></div>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {uninstallChoices.map((choice) => (
              <div key={choice.id} className="flex h-full flex-col rounded-3xl border border-zinc-200 bg-white p-6 transition-all hover:border-zinc-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700 dark:hover:shadow-zinc-900/50">
                <div className="mb-5 mt-2 flex h-12 w-12 items-center justify-center rounded-2xl border border-zinc-100 bg-zinc-50 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">{choice.icon}</div>
                <h3 className="mb-2 text-xl font-bold text-zinc-900 dark:text-zinc-100">{t(choice.titleKey)}</h3>
                <p className="mb-6 flex-1 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">{t(choice.descriptionKey)}</p>
                <div className="mb-8 flex flex-wrap gap-2">{choice.tags.map((tag) => <span key={tag} className="rounded-lg border border-zinc-100 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-600 dark:border-zinc-800 dark:bg-zinc-800/50 dark:text-zinc-400">{t(`install.page.tags.${tag}`)}</span>)}</div>
                <button type="button" onClick={() => { setAction({ kind: 'uninstall', choice }); setStatus('idle'); setOutput(''); setResult(null); setIsModalOpen(true); }} className="mt-auto flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"><Trash2 className="h-4 w-4" />{t('install.page.method.actions.uninstall')}</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {pageMode === 'migrate' && (
        <div className="space-y-8">
          <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{t('install.page.migrate.title')}</h3>
                <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">{t('install.page.migrate.description')}</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={() => { void refreshMigrationCandidates(runtimeInfo, installRecord, customMigrationSource); }} className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"><RefreshCw className="h-4 w-4" />{t('install.page.migrate.actions.rescan')}</button>
                <button type="button" onClick={() => { void (async () => { const selected = await fileDialogService.selectDirectory({ title: t('install.page.migrate.actions.selectSource') }); if (selected) setCustomMigrationSource(selected); })(); }} className="flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"><FolderOpen className="h-4 w-4" />{t('install.page.migrate.actions.selectSource')}</button>
              </div>
            </div>
            <div className="mt-6 rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/60"><div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{t('install.page.migrate.customSourceLabel')}</div><div className="mt-2 break-all text-sm font-medium text-zinc-800 dark:text-zinc-200">{customMigrationSource ?? t('install.page.migrate.customSourcePlaceholder')}</div></div>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {migrationCandidates.map((item) => (
              <label key={item.id} className="flex h-full cursor-pointer flex-col rounded-3xl border border-zinc-200 bg-white p-6 transition-all hover:border-zinc-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700 dark:hover:shadow-zinc-900/50">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-zinc-100 bg-zinc-50 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">{item.id === 'manual' ? <ArrowRightLeft className="h-6 w-6 text-sky-500 dark:text-sky-400" /> : <FileText className="h-6 w-6 text-primary-500 dark:text-primary-400" />}</div>
                  <Checkbox checked={selectedMigrationIds.includes(item.id)} disabled={!item.sourcePath || migrationStatus === 'running'} onCheckedChange={() => setSelectedMigrationIds((previous) => previous.includes(item.id) ? previous.filter((value) => value !== item.id) : [...previous, item.id])} aria-label={t(item.titleKey)} />
                </div>
                <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{t(item.titleKey)}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">{t(item.descriptionKey)}</p>
                <div className="mt-5 space-y-4 text-sm">
                  <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-950/60"><div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{t('install.page.migrate.labels.source')}</div><div className="mt-2 break-all text-zinc-700 dark:text-zinc-300">{item.sourcePath ?? t('install.page.migrate.labels.notFound')}</div></div>
                  <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-950/60"><div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{t('install.page.migrate.labels.destination')}</div><div className="mt-2 break-all text-zinc-700 dark:text-zinc-300">{item.destinationRoot}</div></div>
                </div>
              </label>
            ))}
          </div>
          <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div><h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{t('install.page.migrate.readyTitle')}</h3><p className="mt-1 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">{t('install.page.migrate.readyDescription')}</p></div>
              <button type="button" onClick={() => { void startMigration(); }} disabled={migrationStatus === 'running' || !selectedMigrationCandidates.length} className="flex items-center gap-2 rounded-xl bg-primary-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-primary-900/20 transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-500 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500"><ArrowRightLeft className="h-4 w-4" />{t('install.page.migrate.actions.start')}</button>
            </div>
            <div className="mt-6 flex items-center gap-3 rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/60">{migrationStatus === 'running' && <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />}{migrationStatus === 'success' && <CheckCircle2 className="h-6 w-6 text-emerald-500" />}{migrationStatus === 'error' && <AlertCircle className="h-6 w-6 text-red-500" />}<span className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{t(`install.page.migrate.status.${migrationStatus}`)}</span></div>
            <div className="mt-6 flex h-72 flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-inner"><div className="flex shrink-0 items-center gap-2 border-b border-zinc-800 bg-zinc-900 px-4 py-3"><SquareTerminal className="h-4 w-4 text-zinc-400" /><span className="text-xs font-bold uppercase tracking-wider text-zinc-400">{t('install.page.migrate.output.title')}</span></div><div className="flex-1 overflow-y-auto p-5 font-mono text-sm whitespace-pre-wrap leading-relaxed"><span className={migrationStatus === 'error' ? 'text-red-400' : 'text-emerald-400'}>{migrationOutput || t('install.page.migrate.output.placeholder')}</span>{migrationStatus === 'running' && <span className="ml-1 inline-block h-4 w-2 animate-pulse bg-zinc-400 align-middle" />}</div></div>
          </div>
        </div>
      )}

      <AnimatePresence>
        {isModalOpen && action && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-zinc-950/60 backdrop-blur-sm" onClick={() => { if (status !== 'running') setIsModalOpen(false); }} />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} transition={{ duration: 0.2, ease: 'easeOut' }} className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center justify-between border-b border-zinc-100 bg-white px-6 py-5 dark:border-zinc-800 dark:bg-zinc-900"><div className="flex items-center gap-4"><div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-zinc-100 bg-zinc-50 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">{action.choice.icon}</div><div><h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{action.kind === 'install' ? t('install.page.modal.title.install', { product: t(action.product.nameKey), method: t(action.choice.titleKey) }) : t('install.page.modal.title.uninstall', { method: t(action.choice.titleKey) })}</h2><p className="mt-0.5 text-sm font-medium text-zinc-500 dark:text-zinc-400">{t(`install.page.modal.subtitle.${action.kind}`)}</p></div></div><button type="button" onClick={() => { if (status !== 'running') setIsModalOpen(false); }} disabled={status === 'running'} aria-label={t('install.page.modal.actions.close')} className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800 disabled:opacity-50"><X className="h-5 w-5" /></button></div>
              <div className="flex-1 overflow-y-auto bg-zinc-50/50 p-6 dark:bg-zinc-950/50">
                {status === 'idle' ? <div className="space-y-6"><div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"><div className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{t('install.page.modal.summaryLabel')}</div><div className="mt-3 space-y-2 text-sm text-zinc-600 dark:text-zinc-300"><div><span className="font-semibold text-zinc-900 dark:text-zinc-100">{t('install.page.modal.operationLabel')}:</span> {t(`install.page.tabs.${action.kind}`)}</div>{action.kind === 'install' && <div><span className="font-semibold text-zinc-900 dark:text-zinc-100">{t('install.page.modal.productLabel')}:</span> {t(action.product.nameKey)}</div>}<div><span className="font-semibold text-zinc-900 dark:text-zinc-100">{t('install.page.modal.methodLabel')}:</span> {t(action.choice.titleKey)}</div></div></div><div className="flex gap-4 rounded-2xl border border-primary-100 bg-primary-50/50 p-5 dark:border-primary-500/20 dark:bg-primary-500/5"><Sparkles className="h-6 w-6 shrink-0 text-primary-500 dark:text-primary-400" /><p className="text-sm font-medium leading-relaxed text-primary-900 dark:text-primary-200">{t(`install.page.modal.info.${action.kind}`)}</p></div></div> : <div className="space-y-6"><div className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">{status === 'running' && <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />}{status === 'success' && <CheckCircle2 className="h-6 w-6 text-emerald-500" />}{status === 'error' && <AlertCircle className="h-6 w-6 text-red-500" />}<span className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{t(`install.page.modal.status.${action.kind}.${status}`)}</span></div>{result && <div className="grid grid-cols-1 gap-4 md:grid-cols-2"><div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"><div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{t('install.page.modal.result.installRoot')}</div><div className="mt-2 break-all text-sm text-zinc-700 dark:text-zinc-300">{result.resolvedInstallRoot}</div></div><div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"><div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{t('install.page.modal.result.dataRoot')}</div><div className="mt-2 break-all text-sm text-zinc-700 dark:text-zinc-300">{result.resolvedDataRoot}</div></div></div>}<div className="flex h-80 flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-inner"><div className="flex shrink-0 items-center gap-2 border-b border-zinc-800 bg-zinc-900 px-4 py-3"><SquareTerminal className="h-4 w-4 text-zinc-400" /><span className="text-xs font-bold uppercase tracking-wider text-zinc-400">{t('install.page.modal.terminalOutput')}</span></div><div className="flex-1 overflow-y-auto p-5 font-mono text-sm whitespace-pre-wrap leading-relaxed"><span className={status === 'error' ? 'text-red-400' : 'text-emerald-400'}>{output}</span>{status === 'running' && <span className="ml-1 inline-block h-4 w-2 animate-pulse bg-zinc-400 align-middle" />}</div></div></div>}
              </div>
              <div className="flex justify-end gap-3 border-t border-zinc-100 bg-white px-6 py-5 dark:border-zinc-800 dark:bg-zinc-900">{status === 'idle' ? <><button type="button" onClick={() => setIsModalOpen(false)} className="rounded-xl px-6 py-3 text-sm font-bold text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800">{t('common.cancel')}</button><button type="button" onClick={() => { void startAction(); }} className="flex items-center gap-2 rounded-xl bg-primary-600 px-8 py-3 text-sm font-bold text-white shadow-lg shadow-primary-900/20 transition-colors hover:bg-primary-700"><Play className="h-4 w-4" />{t(`install.page.modal.actions.start${action.kind === 'install' ? 'Install' : 'Uninstall'}`)}</button></> : <button type="button" onClick={() => setIsModalOpen(false)} disabled={status === 'running'} className="rounded-xl bg-zinc-900 px-8 py-3 text-sm font-bold text-white shadow-md transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200">{status === 'success' ? t('install.page.modal.actions.done') : t('install.page.modal.actions.close')}</button>}</div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
