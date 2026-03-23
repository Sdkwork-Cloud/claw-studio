import type { HubInstallRequest, HubUninstallRequest, RuntimeInfo } from '@sdkwork/claw-infrastructure';

export type ProductId = 'openclaw';
export type PageMode = 'install' | 'uninstall' | 'migrate';
export type HostOs = 'windows' | 'macos' | 'linux' | 'unknown';
export type Status = 'idle' | 'running' | 'success' | 'error';
export type MethodId =
  | 'wsl'
  | 'installer'
  | 'installerCli'
  | 'git'
  | 'docker'
  | 'npm'
  | 'pnpm'
  | 'source'
  | 'podman'
  | 'bun'
  | 'ansible'
  | 'nix'
  | 'cloud';
export type IconId = 'sparkles' | 'server' | 'package' | 'github' | 'cloud' | 'trash' | 'file';
export type TagId =
  | 'ansible'
  | 'automation'
  | 'bun'
  | 'cargo'
  | 'cloud'
  | 'declarative'
  | 'docker'
  | 'experimental'
  | 'git'
  | 'linux'
  | 'macos'
  | 'managed'
  | 'nix'
  | 'nodejs'
  | 'npm'
  | 'pnpm'
  | 'podman'
  | 'postgresql'
  | 'rust'
  | 'security'
  | 'script'
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
  softwareName?: string;
  manifestName: string;
  effectiveRuntimePlatform?: string;
  installRoot?: string;
  workRoot?: string;
  dataRoot?: string;
  status?: string;
  installedAt?: string;
  updatedAt?: string;
};

export type InstallChoice = {
  id: MethodId;
  titleKey: string;
  titleFallback?: string;
  descriptionKey: string;
  descriptionFallback?: string;
  iconId: IconId;
  tags: TagId[];
  request: HubInstallRequest;
  supportedHosts: HostOs[];
  disabled?: boolean;
};

export type UninstallChoice = {
  id: Exclude<MethodId, 'cloud'>;
  titleKey: string;
  titleFallback?: string;
  descriptionKey: string;
  descriptionFallback?: string;
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

type OpenClawChoiceDefinition = {
  id: Exclude<MethodId, 'cloud'>;
  titleKey: string;
  titleFallback: string;
  descriptionKey: string;
  descriptionFallback: string;
  uninstallDescriptionKey: string;
  uninstallDescriptionFallback: string;
  iconId: Exclude<IconId, 'cloud' | 'trash'>;
  tags: TagId[];
  request: HubInstallRequest;
  supportedHosts: HostOs[];
};

const OPENCLAW_CHOICE_DEFINITIONS: OpenClawChoiceDefinition[] = [
  {
    id: 'wsl',
    titleKey: 'install.page.methods.wsl.title',
    titleFallback: 'WSL install',
    descriptionKey: 'install.page.methods.wsl.description',
    descriptionFallback: 'Install OpenClaw inside WSL on Windows for a Linux-style runtime path.',
    uninstallDescriptionKey: 'install.page.uninstall.methods.wsl.description',
    uninstallDescriptionFallback: 'Remove the OpenClaw runtime installed inside WSL.',
    iconId: 'sparkles',
    tags: ['wsl', 'windows', 'managed'],
    request: { softwareName: 'openclaw-wsl', effectiveRuntimePlatform: 'wsl' },
    supportedHosts: ['windows'],
  },
  {
    id: 'installer',
    titleKey: 'install.page.methods.installer.title',
    titleFallback: 'Official installer script',
    descriptionKey: 'install.page.methods.installer.description',
    descriptionFallback:
      'Run the upstream OpenClaw installer script with hub-installer-managed defaults.',
    uninstallDescriptionKey: 'install.page.uninstall.methods.installer.description',
    uninstallDescriptionFallback:
      'Remove the OpenClaw installation created by the official installer script while preserving user data by default.',
    iconId: 'sparkles',
    tags: ['managed', 'script', 'windows', 'macos', 'linux'],
    request: { softwareName: 'openclaw' },
    supportedHosts: ['windows', 'macos', 'linux'],
  },
  {
    id: 'installerCli',
    titleKey: 'install.page.methods.installerCli.title',
    titleFallback: 'Installer CLI local prefix',
    descriptionKey: 'install.page.methods.installerCli.description',
    descriptionFallback:
      'Install OpenClaw into a managed local prefix with the documented install-cli workflow.',
    uninstallDescriptionKey: 'install.page.uninstall.methods.installerCli.description',
    uninstallDescriptionFallback:
      'Remove the managed local-prefix OpenClaw installation created by install-cli.sh.',
    iconId: 'package',
    tags: ['managed', 'script', 'macos', 'linux'],
    request: { softwareName: 'openclaw-cli-script' },
    supportedHosts: ['macos', 'linux'],
  },
  {
    id: 'git',
    titleKey: 'install.page.methods.git.title',
    titleFallback: 'Installer script (git mode)',
    descriptionKey: 'install.page.methods.git.description',
    descriptionFallback:
      'Use the official installer in git mode to keep a local working tree under hub-installer control.',
    uninstallDescriptionKey: 'install.page.uninstall.methods.git.description',
    uninstallDescriptionFallback:
      'Remove the installer-script git-mode OpenClaw checkout and associated managed wrappers.',
    iconId: 'github',
    tags: ['git', 'windows', 'macos', 'linux'],
    request: { softwareName: 'openclaw-git' },
    supportedHosts: ['windows', 'macos', 'linux'],
  },
  {
    id: 'npm',
    titleKey: 'install.page.methods.npm.title',
    titleFallback: 'npm install',
    descriptionKey: 'install.page.methods.npm.description',
    descriptionFallback: 'Install globally with npm when Node.js is already available on the host.',
    uninstallDescriptionKey: 'install.page.uninstall.methods.npm.description',
    uninstallDescriptionFallback: 'Remove the globally installed OpenClaw npm package.',
    iconId: 'package',
    tags: ['nodejs', 'npm', 'windows', 'macos', 'linux'],
    request: { softwareName: 'openclaw-npm' },
    supportedHosts: ['windows', 'macos', 'linux'],
  },
  {
    id: 'pnpm',
    titleKey: 'install.page.methods.pnpm.title',
    titleFallback: 'pnpm install',
    descriptionKey: 'install.page.methods.pnpm.description',
    descriptionFallback:
      'Install globally with pnpm for teams already using a pnpm-based toolchain.',
    uninstallDescriptionKey: 'install.page.uninstall.methods.pnpm.description',
    uninstallDescriptionFallback: 'Remove the globally installed OpenClaw pnpm package.',
    iconId: 'package',
    tags: ['nodejs', 'pnpm', 'windows', 'macos', 'linux'],
    request: { softwareName: 'openclaw-pnpm' },
    supportedHosts: ['windows', 'macos', 'linux'],
  },
  {
    id: 'source',
    titleKey: 'install.page.methods.source.title',
    titleFallback: 'Source install',
    descriptionKey: 'install.page.methods.source.description',
    descriptionFallback: 'Clone, build, and run the selected product from source.',
    uninstallDescriptionKey: 'install.page.uninstall.methods.source.description',
    uninstallDescriptionFallback:
      'Remove the source-based OpenClaw runtime and local build artifacts.',
    iconId: 'github',
    tags: ['source', 'git', 'windows', 'macos', 'linux'],
    request: { softwareName: 'openclaw-source' },
    supportedHosts: ['windows', 'macos', 'linux'],
  },
  {
    id: 'docker',
    titleKey: 'install.page.methods.docker.title',
    titleFallback: 'Docker install',
    descriptionKey: 'install.page.methods.docker.description',
    descriptionFallback:
      'Install with Docker and support local Docker or Docker running inside WSL.',
    uninstallDescriptionKey: 'install.page.uninstall.methods.docker.description',
    uninstallDescriptionFallback: 'Stop and remove the OpenClaw Docker deployment.',
    iconId: 'server',
    tags: ['docker', 'windows', 'macos', 'linux'],
    request: { softwareName: 'openclaw-docker', containerRuntimePreference: 'auto' },
    supportedHosts: ['windows', 'macos', 'linux'],
  },
  {
    id: 'podman',
    titleKey: 'install.page.methods.podman.title',
    titleFallback: 'Podman workflow',
    descriptionKey: 'install.page.methods.podman.description',
    descriptionFallback:
      'Run the documented rootless Podman deployment workflow on the current Unix host.',
    uninstallDescriptionKey: 'install.page.uninstall.methods.podman.description',
    uninstallDescriptionFallback:
      'Remove the rootless Podman OpenClaw deployment and related launcher assets.',
    iconId: 'server',
    tags: ['podman', 'macos', 'linux'],
    request: { softwareName: 'openclaw-podman' },
    supportedHosts: ['macos', 'linux'],
  },
  {
    id: 'bun',
    titleKey: 'install.page.methods.bun.title',
    titleFallback: 'Bun experimental workflow',
    descriptionKey: 'install.page.methods.bun.description',
    descriptionFallback:
      'Build OpenClaw from source with the documented Bun runtime workflow on the current Unix host.',
    uninstallDescriptionKey: 'install.page.uninstall.methods.bun.description',
    uninstallDescriptionFallback:
      'Remove the Bun-based OpenClaw build artifacts and managed wrappers.',
    iconId: 'package',
    tags: ['bun', 'source', 'experimental', 'macos', 'linux'],
    request: { softwareName: 'openclaw-bun' },
    supportedHosts: ['macos', 'linux'],
  },
  {
    id: 'ansible',
    titleKey: 'install.page.methods.ansible.title',
    titleFallback: 'Ansible workflow',
    descriptionKey: 'install.page.methods.ansible.description',
    descriptionFallback:
      'Install OpenClaw through the documented openclaw-ansible automation repository on Debian/Ubuntu hosts.',
    uninstallDescriptionKey: 'install.page.uninstall.methods.ansible.description',
    uninstallDescriptionFallback:
      'Remove the OpenClaw automation repository install and related host-side assets.',
    iconId: 'server',
    tags: ['ansible', 'automation', 'linux'],
    request: { softwareName: 'openclaw-ansible' },
    supportedHosts: ['linux'],
  },
  {
    id: 'nix',
    titleKey: 'install.page.methods.nix.title',
    titleFallback: 'Nix workflow',
    descriptionKey: 'install.page.methods.nix.description',
    descriptionFallback:
      'Install OpenClaw with the documented nix-openclaw flake workflows on the current Unix host.',
    uninstallDescriptionKey: 'install.page.uninstall.methods.nix.description',
    uninstallDescriptionFallback:
      'Remove the nix-openclaw profile integration while preserving data roots by default.',
    iconId: 'package',
    tags: ['nix', 'declarative', 'macos', 'linux'],
    request: { softwareName: 'openclaw-nix' },
    supportedHosts: ['macos', 'linux'],
  },
];

const OPENCLAW_METHODS: InstallChoice[] = [
  ...OPENCLAW_CHOICE_DEFINITIONS.map(
    ({
      uninstallDescriptionFallback: _uninstallDescriptionFallback,
      uninstallDescriptionKey: _uninstallDescriptionKey,
      ...choice
    }) => choice,
  ),
  {
    id: 'cloud',
    titleKey: 'install.page.methods.cloud.title',
    titleFallback: 'Cloud install',
    descriptionKey: 'install.page.methods.cloud.description',
    descriptionFallback: 'Provision the selected product in the cloud. This mode is in development.',
    iconId: 'cloud',
    tags: ['cloud'],
    request: { softwareName: 'openclaw-cloud' },
    supportedHosts: ['windows', 'macos', 'linux'],
    disabled: true,
  },
];

const OPENCLAW_UNINSTALL_METHODS: UninstallChoice[] = OPENCLAW_CHOICE_DEFINITIONS.map(
  ({
    descriptionFallback: _descriptionFallback,
    descriptionKey: _descriptionKey,
    iconId: _iconId,
    request,
    uninstallDescriptionFallback,
    uninstallDescriptionKey,
    ...choice
  }) => ({
    ...choice,
    descriptionKey: uninstallDescriptionKey,
    descriptionFallback: uninstallDescriptionFallback,
    iconId: 'trash',
    request: {
      ...request,
      purgeData: false,
    },
  }),
);

export const PRODUCTS: ProductConfig[] = [
  {
    id: 'openclaw',
    nameKey: 'install.page.products.openclaw.name',
    descriptionKey: 'install.page.products.openclaw.description',
    recommendedMethodId: 'installer',
    recommendedMethodByHost: {
      windows: 'wsl',
      macos: 'installer',
      linux: 'installer',
    },
    methods: OPENCLAW_METHODS,
    uninstallMethods: OPENCLAW_UNINSTALL_METHODS,
    migrationDefinitions: createMigrationDefinitions('openclaw'),
    legacyRecordFileName: createLegacyRecordFileName('openclaw'),
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
  if (hostOs === 'unknown') {
    return ['windows', 'macos', 'linux'].every((platform) => choice.supportedHosts.includes(platform));
  }

  return choice.supportedHosts.includes(hostOs);
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

export function shouldShowProductSidebar(productCount: number) {
  return productCount > 1;
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
  record: Pick<LegacyInstallRecord, 'softwareName' | 'manifestName'> | null | undefined,
): MethodId | null {
  const candidates = [record?.softwareName ?? '', record?.manifestName ?? ''].map((value) =>
    value.trim().toLowerCase(),
  );

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }

    if (candidate.endsWith('-wsl') || candidate.includes('wsl')) return 'wsl';
    if (
      candidate.endsWith('-cli-script') ||
      candidate.includes('installer cli') ||
      candidate.includes('cli script') ||
      candidate.includes('install-cli')
    ) {
      return 'installerCli';
    }
    if (candidate.endsWith('-git') || candidate.includes('git mode')) return 'git';
    if (candidate.endsWith('-podman') || candidate.includes('podman')) return 'podman';
    if (candidate.endsWith('-bun') || candidate.includes('bun')) return 'bun';
    if (candidate.endsWith('-ansible') || candidate.includes('ansible')) return 'ansible';
    if (candidate.endsWith('-nix') || candidate.includes('nix')) return 'nix';
    if (candidate.endsWith('-docker') || candidate.includes('docker')) return 'docker';
    if (candidate.endsWith('-pnpm') || candidate.includes('pnpm')) return 'pnpm';
    if (candidate.endsWith('-npm') || candidate.includes('npm')) return 'npm';
    if (candidate.endsWith('-source') || candidate.includes('source')) return 'source';
    if (
      candidate === 'openclaw' ||
      candidate.includes('official installer script') ||
      candidate.includes('installer script')
    ) {
      return 'installer';
    }
    if (candidate.endsWith('-cloud') || candidate.includes('cloud')) return 'cloud';
  }

  return null;
}
