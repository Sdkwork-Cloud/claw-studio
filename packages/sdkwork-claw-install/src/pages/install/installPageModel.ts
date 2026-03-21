import type { HubInstallRequest, HubUninstallRequest, RuntimeInfo } from '@sdkwork/claw-infrastructure';

export type ProductId = 'openclaw' | 'zeroclaw' | 'ironclaw';
export type PageMode = 'install' | 'uninstall' | 'migrate';
export type HostOs = 'windows' | 'macos' | 'linux' | 'unknown';
export type Status = 'idle' | 'running' | 'success' | 'error';
export type MethodId = 'wsl' | 'docker' | 'npm' | 'pnpm' | 'source' | 'cloud';
export type IconId = 'sparkles' | 'server' | 'package' | 'github' | 'cloud' | 'trash' | 'file';
export type TagId =
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
export type MigrationId = 'config' | 'data' | 'workspace' | 'logs' | 'manual';
export type GuidedInstallStepId =
  | 'dependencies'
  | 'install'
  | 'configure'
  | 'initialize'
  | 'success';

export type LegacyInstallRecord = {
  manifestName: string;
  installRoot?: string;
  workRoot?: string;
  dataRoot?: string;
  status?: string;
};

export type InstallChoice = {
  id: MethodId;
  titleKey: string;
  descriptionKey: string;
  iconId: IconId;
  tags: TagId[];
  request: HubInstallRequest;
  supportedHosts: HostOs[];
  disabled?: boolean;
};

export type UninstallChoice = {
  id: Exclude<MethodId, 'cloud'>;
  titleKey: string;
  descriptionKey: string;
  iconId: IconId;
  tags: TagId[];
  request: HubUninstallRequest;
  supportedHosts: HostOs[];
};

export type MigrationDefinition = {
  id: MigrationId;
  titleKey: string;
  descriptionKey: string;
  destinationRootKey: 'configDir' | 'dataDir' | 'workspacesDir' | 'logsDir';
  destinationSegments: string[];
  detectedSourceSegments?: string[][];
  installRecordField?: keyof Pick<LegacyInstallRecord, 'dataRoot' | 'workRoot'>;
  sourceKind: 'detected' | 'manual';
};

export type ProductConfig = {
  id: ProductId;
  nameKey: string;
  descriptionKey: string;
  recommendedMethodId: MethodId;
  recommendedMethodByHost?: Partial<Record<Exclude<HostOs, 'unknown'>, MethodId>>;
  methods: InstallChoice[];
  uninstallMethods: UninstallChoice[];
  migrationDefinitions: MigrationDefinition[];
  legacyRecordFileName: string;
};

export type MigrationCandidate = {
  id: MigrationId;
  titleKey: string;
  descriptionKey: string;
  sourcePath: string | null;
  destinationRoot: string;
  sourceKind: 'detected' | 'manual';
};

export const GUIDED_INSTALL_STEPS: Array<{ id: GuidedInstallStepId; labelKey: string }> = [
  { id: 'dependencies', labelKey: 'install.page.guided.steps.dependencies.title' },
  { id: 'install', labelKey: 'install.page.guided.steps.install.title' },
  { id: 'configure', labelKey: 'install.page.guided.steps.configure.title' },
  { id: 'initialize', labelKey: 'install.page.guided.steps.initialize.title' },
  { id: 'success', labelKey: 'install.page.guided.steps.success.title' },
];

export const PAGE_MODE_TABS: Array<{ id: PageMode; labelKey: string }> = [
  { id: 'install', labelKey: 'install.page.tabs.install' },
  { id: 'migrate', labelKey: 'install.page.tabs.migrate' },
  { id: 'uninstall', labelKey: 'install.page.tabs.uninstall' },
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
    iconId: 'sparkles',
    tags: ['wsl', 'windows', 'managed'],
    request: { softwareName: 'openclaw-wsl', effectiveRuntimePlatform: 'wsl' },
    supportedHosts: ['windows'],
  },
  {
    id: 'docker',
    titleKey: 'install.page.methods.docker.title',
    descriptionKey: 'install.page.methods.docker.description',
    iconId: 'server',
    tags: ['docker', 'windows', 'macos', 'linux'],
    request: { softwareName: 'openclaw-docker', containerRuntimePreference: 'auto' },
    supportedHosts: ['windows', 'macos', 'linux'],
  },
  {
    id: 'npm',
    titleKey: 'install.page.methods.npm.title',
    descriptionKey: 'install.page.methods.npm.description',
    iconId: 'package',
    tags: ['nodejs', 'npm', 'windows', 'macos', 'linux'],
    request: { softwareName: 'openclaw-npm' },
    supportedHosts: ['windows', 'macos', 'linux'],
  },
  {
    id: 'pnpm',
    titleKey: 'install.page.methods.pnpm.title',
    descriptionKey: 'install.page.methods.pnpm.description',
    iconId: 'package',
    tags: ['nodejs', 'pnpm', 'windows', 'macos', 'linux'],
    request: { softwareName: 'openclaw-pnpm' },
    supportedHosts: ['windows', 'macos', 'linux'],
  },
  {
    id: 'source',
    titleKey: 'install.page.methods.source.title',
    descriptionKey: 'install.page.methods.source.description',
    iconId: 'github',
    tags: ['source', 'git', 'windows', 'macos', 'linux'],
    request: { softwareName: 'openclaw-source' },
    supportedHosts: ['windows', 'macos', 'linux'],
  },
  {
    id: 'cloud',
    titleKey: 'install.page.methods.cloud.title',
    descriptionKey: 'install.page.methods.cloud.description',
    iconId: 'cloud',
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
    iconId: 'github',
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
    iconId: 'github',
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
    iconId: 'trash',
    tags: ['wsl', 'windows'],
    request: { softwareName: 'openclaw-wsl', effectiveRuntimePlatform: 'wsl', purgeData: false },
    supportedHosts: ['windows'],
  },
  {
    id: 'docker',
    titleKey: 'install.page.methods.docker.title',
    descriptionKey: 'install.page.uninstall.methods.docker.description',
    iconId: 'trash',
    tags: ['docker', 'windows', 'macos', 'linux'],
    request: { softwareName: 'openclaw-docker', purgeData: false },
    supportedHosts: ['windows', 'macos', 'linux'],
  },
  {
    id: 'npm',
    titleKey: 'install.page.methods.npm.title',
    descriptionKey: 'install.page.uninstall.methods.npm.description',
    iconId: 'trash',
    tags: ['npm', 'windows', 'macos', 'linux'],
    request: { softwareName: 'openclaw-npm', purgeData: false },
    supportedHosts: ['windows', 'macos', 'linux'],
  },
  {
    id: 'pnpm',
    titleKey: 'install.page.methods.pnpm.title',
    descriptionKey: 'install.page.uninstall.methods.pnpm.description',
    iconId: 'trash',
    tags: ['pnpm', 'windows', 'macos', 'linux'],
    request: { softwareName: 'openclaw-pnpm', purgeData: false },
    supportedHosts: ['windows', 'macos', 'linux'],
  },
  {
    id: 'source',
    titleKey: 'install.page.methods.source.title',
    descriptionKey: 'install.page.uninstall.methods.source.description',
    iconId: 'trash',
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
    iconId: 'trash',
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
    iconId: 'trash',
    tags: ['source', 'git', 'rust', 'postgresql', 'security'],
    request: { softwareName: 'ironclaw-source', purgeData: false },
    supportedHosts: ['windows', 'macos', 'linux'],
  },
];

export const PRODUCTS: ProductConfig[] = [
  {
    id: 'openclaw',
    nameKey: 'install.page.products.openclaw.name',
    descriptionKey: 'install.page.products.openclaw.description',
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
    recommendedMethodId: 'source',
    methods: IRONCLAW_METHODS,
    uninstallMethods: IRONCLAW_UNINSTALL_METHODS,
    migrationDefinitions: createMigrationDefinitions('ironclaw'),
    legacyRecordFileName: createLegacyRecordFileName('ironclaw'),
  },
];

export function getHostOs(runtimeInfo: RuntimeInfo | null): HostOs {
  const os = runtimeInfo?.system?.os?.toLowerCase() ?? '';
  if (os.includes('win')) return 'windows';
  if (os.includes('mac') || os.includes('darwin')) return 'macos';
  if (os.includes('linux') || os.includes('ubuntu')) return 'linux';
  return 'unknown';
}

export function pathJoin(hostOs: HostOs, ...parts: Array<string | null | undefined>) {
  const items = parts.filter(Boolean) as string[];
  if (!items.length) return '';
  const sep = hostOs === 'windows' ? '\\' : '/';
  return items.reduce(
    (acc, item) => `${acc.replace(/[\\/]+$/, '')}${sep}${item.replace(/^[\\/]+/, '')}`,
  );
}

export function pathParent(value: string | null | undefined) {
  if (!value) return null;
  const clean = value.replace(/[\\/]+$/, '');
  const index = Math.max(clean.lastIndexOf('/'), clean.lastIndexOf('\\'));
  return index > 0 ? clean.slice(0, index) : null;
}

export function supports(hostOs: HostOs, choice: { id: string; supportedHosts: HostOs[] }) {
  return hostOs === 'unknown' ? choice.id !== 'wsl' : choice.supportedHosts.includes(hostOs);
}

export function getVisibleInstallChoices(product: ProductConfig, hostOs: HostOs) {
  return product.methods.filter((choice) => supports(hostOs, choice) && !choice.disabled);
}

export function getInstallGridClassName(count: number) {
  if (count <= 1) {
    return 'grid-cols-1';
  }

  if (count === 2) {
    return 'grid-cols-1 xl:grid-cols-2';
  }

  if (count === 3) {
    return 'grid-cols-1 md:grid-cols-2 2xl:grid-cols-3';
  }

  return 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3';
}

export function getVisibleUninstallChoices(product: ProductConfig, hostOs: HostOs) {
  return product.uninstallMethods.filter((choice) => supports(hostOs, choice));
}

export function getRecommendedMethodId(product: ProductConfig, hostOs: HostOs) {
  if (hostOs !== 'unknown' && product.recommendedMethodByHost?.[hostOs]) {
    return product.recommendedMethodByHost[hostOs];
  }

  return product.recommendedMethodId;
}

export function getDetectedMethodId(
  record: Pick<LegacyInstallRecord, 'manifestName'> | null | undefined,
): MethodId | null {
  const manifestName = record?.manifestName ?? '';
  if (manifestName.endsWith('-wsl')) return 'wsl';
  if (manifestName.endsWith('-docker')) return 'docker';
  if (manifestName.endsWith('-npm')) return 'npm';
  if (manifestName.endsWith('-pnpm')) return 'pnpm';
  if (manifestName.endsWith('-source')) return 'source';
  if (manifestName.endsWith('-cloud')) return 'cloud';
  return null;
}
