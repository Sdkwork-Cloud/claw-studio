export interface RuntimeAppInfo {
  name: string;
  version: string;
  target: string;
}

export interface RuntimePathsInfo {
  installRoot: string;
  foundationDir: string;
  foundationComponentsDir: string;
  modulesDir: string;
  runtimesDir: string;
  toolsDir: string;
  trustDir: string;
  packsDir: string;
  extensionsDir: string;
  machineRoot: string;
  machineStateDir: string;
  machineStoreDir: string;
  machineStagingDir: string;
  machineReceiptsDir: string;
  machineRuntimeDir: string;
  machineRecoveryDir: string;
  machineLogsDir: string;
  userRoot: string;
  userDir: string;
  userAuthDir: string;
  userStorageDir: string;
  userIntegrationsDir: string;
  studioDir: string;
  workspacesDir: string;
  studioBackupsDir: string;
  userLogsDir: string;
  configDir: string;
  dataDir: string;
  cacheDir: string;
  logsDir: string;
  stateDir: string;
  storageDir: string;
  pluginsDir: string;
  integrationsDir: string;
  backupsDir: string;
  configFile: string;
  layoutFile: string;
  activeFile: string;
  inventoryFile: string;
  retentionFile: string;
  pinnedFile: string;
  channelsFile: string;
  policiesFile: string;
  sourcesFile: string;
  serviceFile: string;
  componentsFile: string;
  upgradesFile: string;
  componentRegistryFile: string;
  serviceDefaultsFile: string;
  upgradePolicyFile: string;
  deviceIdFile: string;
  mainLogFile: string;
}

export interface RuntimeConfigStorageProfile {
  id: string;
  label: string;
  provider: 'memory' | 'localFile' | 'sqlite' | 'postgres' | 'remoteApi';
  namespace: string;
  path?: string | null;
  connectionConfigured: boolean;
  databaseConfigured: boolean;
  endpointConfigured: boolean;
  readOnly: boolean;
}

export interface RuntimeConfigStorageInfo {
  activeProfileId: string;
  profiles: RuntimeConfigStorageProfile[];
}

export interface RuntimeConfigSecurityInfo {
  strictPathPolicy: boolean;
  allowExternalHttp: boolean;
  allowCustomProcessCwd: boolean;
}

export interface RuntimeConfigNotificationsInfo {
  enabled: boolean;
  provider: string;
  requireUserConsent: boolean;
}

export interface RuntimeConfigPaymentsInfo {
  provider: string;
  sandbox: boolean;
}

export interface RuntimeConfigIntegrationsInfo {
  pluginsEnabled: boolean;
  remoteApiEnabled: boolean;
  allowUnsignedPlugins: boolean;
}

export interface RuntimeConfigProcessInfo {
  defaultTimeoutMs: number;
  maxConcurrentJobs: number;
}

export type RuntimeLanguagePreference = 'system' | 'en' | 'zh';

export interface RuntimeConfigInfo {
  version: number;
  distribution: string;
  logLevel: string;
  theme: string;
  language: RuntimeLanguagePreference;
  telemetryEnabled: boolean;
  security: RuntimeConfigSecurityInfo;
  storage: RuntimeConfigStorageInfo;
  notifications: RuntimeConfigNotificationsInfo;
  payments: RuntimeConfigPaymentsInfo;
  integrations: RuntimeConfigIntegrationsInfo;
  process: RuntimeConfigProcessInfo;
}

export interface RuntimeSystemInfo {
  os: string;
  arch: string;
  family: string;
  target: string;
}

export type RuntimeJobState = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';

export interface RuntimeJobRecord {
  id: string;
  kind: string;
  state: RuntimeJobState;
  stage: string;
  profileId?: string;
  processId?: string;
}

export interface RuntimeJobUpdateEvent {
  record: RuntimeJobRecord;
}

export type RuntimeProcessOutputStream = 'stdout' | 'stderr';

export interface RuntimeProcessOutputEvent {
  jobId?: string;
  processId: string;
  command: string;
  stream: RuntimeProcessOutputStream;
  chunk: string;
}

export type RuntimeStorageAvailability = 'ready' | 'configurationRequired' | 'planned';

export interface RuntimeStorageCapabilities {
  durable: boolean;
  structured: boolean;
  queryable: boolean;
  transactional: boolean;
  remote: boolean;
}

export interface RuntimeStorageProviderInfo {
  id: string;
  kind: 'memory' | 'localFile' | 'sqlite' | 'postgres' | 'remoteApi';
  label: string;
  availability: RuntimeStorageAvailability;
  requiresConfiguration: boolean;
  capabilities: RuntimeStorageCapabilities;
}

export interface RuntimeStorageProfileInfo {
  id: string;
  label: string;
  provider: 'memory' | 'localFile' | 'sqlite' | 'postgres' | 'remoteApi';
  active: boolean;
  availability: RuntimeStorageAvailability;
  namespace: string;
  readOnly: boolean;
  path?: string | null;
  connectionConfigured: boolean;
  databaseConfigured: boolean;
  endpointConfigured: boolean;
}

export interface RuntimeStorageInfo {
  activeProfileId: string;
  rootDir: string;
  providers: RuntimeStorageProviderInfo[];
  profiles: RuntimeStorageProfileInfo[];
}

export type RuntimeApiRouterRuntimeMode =
  | 'attachedExternal'
  | 'managedActive'
  | 'needsManagedStart'
  | 'conflicted';

export type RuntimeApiRouterManagedMode = 'inProcess';

export type RuntimeApiRouterConfigSource = 'defaults' | 'file' | 'env';

export interface RuntimeApiRouterEndpointStatus {
  bindAddr: string;
  healthUrl: string;
  enabled: boolean;
  publicBaseUrl?: string | null;
  healthy: boolean;
  portAvailable: boolean;
}

export interface RuntimeApiRouterRuntimeStatus {
  mode: RuntimeApiRouterRuntimeMode;
  recommendedManagedMode?: RuntimeApiRouterManagedMode | null;
  sharedRootDir: string;
  configDir: string;
  configSource: RuntimeApiRouterConfigSource;
  resolvedConfigFile?: string | null;
  admin: RuntimeApiRouterEndpointStatus;
  portal: RuntimeApiRouterEndpointStatus;
  gateway: RuntimeApiRouterEndpointStatus;
  adminSiteBaseUrl?: string | null;
  portalSiteBaseUrl?: string | null;
  reason: string;
}

export type RuntimeApiRouterAdminBootstrapSessionSource = 'managedLocalJwt';

export interface RuntimeApiRouterAdminBootstrapSessionUser {
  id: string;
  email: string;
  displayName: string;
  active: boolean;
  createdAtMs: number;
}

export interface RuntimeApiRouterAdminBootstrapSession {
  token: string;
  source: RuntimeApiRouterAdminBootstrapSessionSource;
  user: RuntimeApiRouterAdminBootstrapSessionUser;
}

export type RuntimeDesktopKernelCapabilityStatus = 'ready' | 'planned';
export type RuntimeDesktopProviderAvailability = 'ready' | 'configurationRequired' | 'planned';

export interface RuntimeDesktopKernelCapability {
  key: string;
  status: RuntimeDesktopKernelCapabilityStatus;
  detail: string;
}

export interface RuntimeDesktopKernelDirectories {
  installRoot: string;
  modulesDir: string;
  runtimesDir: string;
  machineRoot: string;
  machineStateDir: string;
  machineStoreDir: string;
  machineStagingDir: string;
  userRoot: string;
  studioDir: string;
  storageDir: string;
  pluginsDir: string;
  integrationsDir: string;
  backupsDir: string;
}

export interface RuntimeDesktopFilesystemInfo {
  defaultWorkingDirectory: string;
  managedRoots: string[];
  supportsBinaryIo: boolean;
}

export interface RuntimeDesktopSecurityInfo {
  strictPathPolicy: boolean;
  allowExternalHttp: boolean;
  allowCustomProcessCwd: boolean;
  allowedSpawnCommands: string[];
}

export interface RuntimeDesktopProcessProfileInfo {
  id: string;
  jobKind: string;
  command: string;
  args: string[];
  defaultTimeoutMs: number;
  allowCancellation: boolean;
}

export interface RuntimeDesktopProcessInfo {
  defaultTimeoutMs: number;
  maxConcurrentJobs: number;
  activeJobCount: number;
  activeProcessJobCount: number;
  availableProfiles: RuntimeDesktopProcessProfileInfo[];
}

export type RuntimeDesktopPermissionStatus = 'granted' | 'managed' | 'planned';

export interface RuntimeDesktopPermissionInfo {
  key: string;
  status: RuntimeDesktopPermissionStatus;
  required: boolean;
  detail: string;
}

export interface RuntimeDesktopPermissionsInfo {
  entries: RuntimeDesktopPermissionInfo[];
}

export interface RuntimeDesktopNotificationProviderInfo {
  id: string;
  label: string;
  availability: RuntimeDesktopProviderAvailability;
  transport: string;
  requiresUserConsent: boolean;
}

export interface RuntimeDesktopNotificationInfo {
  enabled: boolean;
  provider: string;
  requireUserConsent: boolean;
  status: RuntimeDesktopKernelCapabilityStatus;
  availableProviders: RuntimeDesktopNotificationProviderInfo[];
}

export interface RuntimeDesktopPaymentProviderInfo {
  id: string;
  label: string;
  availability: RuntimeDesktopProviderAvailability;
  supportsSandbox: boolean;
  remote: boolean;
}

export interface RuntimeDesktopPaymentInfo {
  provider: string;
  sandbox: boolean;
  status: RuntimeDesktopKernelCapabilityStatus;
  availableProviders: RuntimeDesktopPaymentProviderInfo[];
}

export interface RuntimeDesktopIntegrationAdapterInfo {
  id: string;
  label: string;
  kind: string;
  availability: RuntimeDesktopProviderAvailability;
  enabled: boolean;
  requiresSignedPlugins: boolean;
}

export interface RuntimeDesktopIntegrationInfo {
  pluginsEnabled: boolean;
  remoteApiEnabled: boolean;
  allowUnsignedPlugins: boolean;
  pluginsDir: string;
  integrationsDir: string;
  installedPluginCount: number;
  status: RuntimeDesktopKernelCapabilityStatus;
  availableAdapters: RuntimeDesktopIntegrationAdapterInfo[];
}

export interface RuntimeDesktopSupervisorServiceInfo {
  id: string;
  displayName: string;
  lifecycle: string;
  pid?: number;
  lastExitCode?: number;
  restartCount: number;
  lastError?: string;
}

export interface RuntimeDesktopSupervisorInfo {
  lifecycle: string;
  shutdownRequested: boolean;
  serviceCount: number;
  managedServiceIds: string[];
  services: RuntimeDesktopSupervisorServiceInfo[];
}

export interface RuntimeDesktopBundledComponentInfo {
  id: string;
  displayName: string;
  kind: string;
  bundledVersion: string;
  startupMode: string;
  installSubdir: string;
}

export interface RuntimeDesktopBundledComponentsInfo {
  componentCount: number;
  defaultStartupComponentIds: string[];
  autoUpgradeEnabled: boolean;
  approvalMode: string;
  components: RuntimeDesktopBundledComponentInfo[];
}

export interface RuntimeDesktopKernelInfo {
  directories: RuntimeDesktopKernelDirectories;
  capabilities: RuntimeDesktopKernelCapability[];
  filesystem: RuntimeDesktopFilesystemInfo;
  security: RuntimeDesktopSecurityInfo;
  process: RuntimeDesktopProcessInfo;
  permissions: RuntimeDesktopPermissionsInfo;
  notifications: RuntimeDesktopNotificationInfo;
  payments: RuntimeDesktopPaymentInfo;
  integrations: RuntimeDesktopIntegrationInfo;
  supervisor: RuntimeDesktopSupervisorInfo;
  bundledComponents: RuntimeDesktopBundledComponentsInfo;
  storage: RuntimeStorageInfo;
}

export type RuntimeEventUnsubscribe = () => void | Promise<void>;

export interface RuntimeInfo {
  platform: 'web' | 'desktop';
  app?: RuntimeAppInfo | null;
  paths?: RuntimePathsInfo | null;
  config?: RuntimeConfigInfo | null;
  system?: RuntimeSystemInfo | null;
}

export interface RuntimePlatformAPI {
  getRuntimeInfo(): Promise<RuntimeInfo>;
  getApiRouterRuntimeStatus(): Promise<RuntimeApiRouterRuntimeStatus | null>;
  ensureApiRouterRuntimeStarted?(): Promise<RuntimeApiRouterRuntimeStatus | null>;
  getApiRouterAdminBootstrapSession(): Promise<RuntimeApiRouterAdminBootstrapSession | null>;
  setAppLanguage(language: RuntimeLanguagePreference): Promise<void>;
  submitProcessJob(profileId: string): Promise<string>;
  getJob(id: string): Promise<RuntimeJobRecord>;
  listJobs(): Promise<RuntimeJobRecord[]>;
  cancelJob(id: string): Promise<RuntimeJobRecord>;
  subscribeJobUpdates(listener: (event: RuntimeJobUpdateEvent) => void): Promise<RuntimeEventUnsubscribe>;
  subscribeProcessOutput(listener: (event: RuntimeProcessOutputEvent) => void): Promise<RuntimeEventUnsubscribe>;
}
