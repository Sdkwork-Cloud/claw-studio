import {
  WebApiRouterPlatform,
  WebPlatform,
  WebStoragePlatform,
  configurePlatformBridge,
} from '@sdkwork/claw-infrastructure';
import type {
  ApiRouterChannel,
  ApiRouterModelMappingQuery,
  ApiRouterProviderQuery,
  ApiRouterRuntimeStatus,
  ApiRouterUnifiedApiKeyQuery,
  ApiRouterClientInstallRequest,
  ApiRouterClientInstallResult,
  ApiRouterUsageRecordApiKeyOption,
  ApiRouterUsageRecordSummary,
  ApiRouterUsageRecordsQuery,
  ApiRouterUsageRecordsResult,
  HubInstallAssessmentResult,
  HubInstallProgressEvent,
  HubInstallRequest,
  HubInstallResult,
  HubUninstallRequest,
  HubUninstallResult,
  ModelMapping,
  ModelMappingCatalogChannel,
  ModelMappingCreate,
  ModelMappingStatus,
  ModelMappingUpdate,
  PlatformFileEntry,
  PlatformPathInfo,
  PlatformSaveFileOptions,
  PlatformSelectFileOptions,
  ProxyProvider,
  ProxyProviderCreate,
  ProxyProviderGroup,
  ProxyProviderStatus,
  ProxyProviderUpdate,
  RuntimeAppInfo,
  RuntimeConfigInfo,
  RuntimeDesktopKernelInfo,
  RuntimeEventUnsubscribe,
  RuntimeInfo,
  RuntimeJobUpdateEvent,
  RuntimeLanguagePreference,
  RuntimePathsInfo,
  RuntimeProcessOutputEvent,
  RuntimeStorageInfo,
  RuntimeSystemInfo,
  StorageDeleteRequest,
  StorageDeleteResult,
  StorageGetTextRequest,
  StorageGetTextResult,
  StorageListKeysRequest,
  StorageListKeysResult,
  StoragePutTextRequest,
  StoragePutTextResult,
  UnifiedApiKey,
  UnifiedApiKeyCreate,
  UnifiedApiKeyUpdate,
} from '@sdkwork/claw-infrastructure';
import { DESKTOP_COMMANDS, DESKTOP_EVENTS } from './catalog';
import {
  DesktopBridgeError,
  getDesktopWindow,
  invokeDesktopCommand,
  isTauriRuntime,
  listenDesktopEvent,
  runDesktopOrFallback,
} from './runtime';

const webPlatform = new WebPlatform();
const webApiRouterPlatform = new WebApiRouterPlatform();
const webStoragePlatform = new WebStoragePlatform();

export interface DesktopAppInfo extends RuntimeAppInfo {}
export interface DesktopAppPaths extends RuntimePathsInfo {}
export interface DesktopAppConfig extends RuntimeConfigInfo {}
export interface DesktopSystemInfo extends RuntimeSystemInfo {}
export interface DesktopFileEntry extends PlatformFileEntry {}
export interface DesktopPathInfo extends PlatformPathInfo {}
export interface DesktopJobUpdateEvent extends RuntimeJobUpdateEvent {}
export interface DesktopProcessOutputEvent extends RuntimeProcessOutputEvent {}
export interface DesktopKernelInfo extends RuntimeDesktopKernelInfo {}
export interface DesktopStorageInfo extends RuntimeStorageInfo {}
export interface DesktopAuthSessionPayload {
  userId: string;
  email: string;
  displayName: string;
}
export interface DesktopApiRouterAdminToken {
  token: string;
  subject: string;
  expiresAtEpochSeconds: number;
}

const noopUnsubscribe: RuntimeEventUnsubscribe = () => {};

export async function syncDesktopAuthSession(
  session: DesktopAuthSessionPayload,
): Promise<void> {
  await runDesktopOrFallback(
    'auth.syncDesktopSession',
    () =>
      invokeDesktopCommand<void>(
        DESKTOP_COMMANDS.syncAuthSession,
        { session },
        { operation: 'auth.syncDesktopSession' },
      ),
    async () => {},
  );
}

export async function clearDesktopAuthSession(): Promise<void> {
  await runDesktopOrFallback(
    'auth.clearDesktopSession',
    () =>
      invokeDesktopCommand<void>(DESKTOP_COMMANDS.clearAuthSession, undefined, {
        operation: 'auth.clearDesktopSession',
      }),
    async () => {},
  );
}

export async function getApiRouterAdminToken(): Promise<DesktopApiRouterAdminToken | null> {
  return runDesktopOrFallback(
    'auth.getApiRouterAdminToken',
    () =>
      invokeDesktopCommand<DesktopApiRouterAdminToken>(
        DESKTOP_COMMANDS.getApiRouterAdminToken,
        undefined,
        { operation: 'auth.getApiRouterAdminToken' },
      ),
    async () => null,
  );
}

export async function getApiRouterRuntimeStatus(): Promise<ApiRouterRuntimeStatus> {
  return runDesktopOrFallback(
    'apiRouter.getRuntimeStatus',
    () =>
      invokeDesktopCommand<ApiRouterRuntimeStatus>(
        DESKTOP_COMMANDS.getApiRouterRuntimeStatus,
        undefined,
        { operation: 'apiRouter.getRuntimeStatus' },
      ),
    () => webApiRouterPlatform.getRuntimeStatus(),
  );
}

export async function getApiRouterChannels(): Promise<ApiRouterChannel[]> {
  return runDesktopOrFallback(
    'apiRouter.getChannels',
    () =>
      invokeDesktopCommand<ApiRouterChannel[]>(
        DESKTOP_COMMANDS.getApiRouterChannels,
        undefined,
        { operation: 'apiRouter.getChannels' },
      ),
    () => webApiRouterPlatform.getChannels(),
  );
}

export async function getApiRouterGroups(): Promise<ProxyProviderGroup[]> {
  return runDesktopOrFallback(
    'apiRouter.getGroups',
    () =>
      invokeDesktopCommand<ProxyProviderGroup[]>(
        DESKTOP_COMMANDS.getApiRouterGroups,
        undefined,
        { operation: 'apiRouter.getGroups' },
      ),
    () => webApiRouterPlatform.getGroups(),
  );
}

export async function getApiRouterProxyProviders(
  query: ApiRouterProviderQuery = {},
): Promise<ProxyProvider[]> {
  return runDesktopOrFallback(
    'apiRouter.getProxyProviders',
    () =>
      invokeDesktopCommand<ProxyProvider[]>(
        DESKTOP_COMMANDS.getApiRouterProxyProviders,
        { query },
        { operation: 'apiRouter.getProxyProviders' },
      ),
    () => webApiRouterPlatform.getProxyProviders(query),
  );
}

export async function createApiRouterProxyProvider(
  input: ProxyProviderCreate,
): Promise<ProxyProvider> {
  return runDesktopOrFallback(
    'apiRouter.createProxyProvider',
    () =>
      invokeDesktopCommand<ProxyProvider>(
        DESKTOP_COMMANDS.createApiRouterProxyProvider,
        { input },
        { operation: 'apiRouter.createProxyProvider' },
      ),
    () => webApiRouterPlatform.createProxyProvider(input),
  );
}

export async function updateApiRouterProxyProviderGroup(
  id: string,
  groupId: string,
): Promise<ProxyProvider> {
  return runDesktopOrFallback(
    'apiRouter.updateProxyProviderGroup',
    () =>
      invokeDesktopCommand<ProxyProvider>(
        DESKTOP_COMMANDS.updateApiRouterProxyProviderGroup,
        { id, groupId },
        { operation: 'apiRouter.updateProxyProviderGroup' },
      ),
    () => webApiRouterPlatform.updateProxyProviderGroup(id, groupId),
  );
}

export async function updateApiRouterProxyProviderStatus(
  id: string,
  status: ProxyProviderStatus,
): Promise<ProxyProvider> {
  return runDesktopOrFallback(
    'apiRouter.updateProxyProviderStatus',
    () =>
      invokeDesktopCommand<ProxyProvider>(
        DESKTOP_COMMANDS.updateApiRouterProxyProviderStatus,
        { id, status },
        { operation: 'apiRouter.updateProxyProviderStatus' },
      ),
    () => webApiRouterPlatform.updateProxyProviderStatus(id, status),
  );
}

export async function updateApiRouterProxyProvider(
  id: string,
  update: ProxyProviderUpdate,
): Promise<ProxyProvider> {
  return runDesktopOrFallback(
    'apiRouter.updateProxyProvider',
    () =>
      invokeDesktopCommand<ProxyProvider>(
        DESKTOP_COMMANDS.updateApiRouterProxyProvider,
        { id, update },
        { operation: 'apiRouter.updateProxyProvider' },
      ),
    () => webApiRouterPlatform.updateProxyProvider(id, update),
  );
}

export async function deleteApiRouterProxyProvider(id: string): Promise<boolean> {
  return runDesktopOrFallback(
    'apiRouter.deleteProxyProvider',
    () =>
      invokeDesktopCommand<boolean>(
        DESKTOP_COMMANDS.deleteApiRouterProxyProvider,
        { id },
        { operation: 'apiRouter.deleteProxyProvider' },
      ),
    () => webApiRouterPlatform.deleteProxyProvider(id),
  );
}

export async function getApiRouterUsageRecordApiKeys(): Promise<
  ApiRouterUsageRecordApiKeyOption[]
> {
  return runDesktopOrFallback(
    'apiRouter.getUsageRecordApiKeys',
    () =>
      invokeDesktopCommand<ApiRouterUsageRecordApiKeyOption[]>(
        DESKTOP_COMMANDS.getApiRouterUsageRecordApiKeys,
        undefined,
        { operation: 'apiRouter.getUsageRecordApiKeys' },
      ),
    () => webApiRouterPlatform.getUsageRecordApiKeys(),
  );
}

export async function getApiRouterUsageRecordSummary(
  query: ApiRouterUsageRecordsQuery = {},
): Promise<ApiRouterUsageRecordSummary> {
  return runDesktopOrFallback(
    'apiRouter.getUsageRecordSummary',
    () =>
      invokeDesktopCommand<ApiRouterUsageRecordSummary>(
        DESKTOP_COMMANDS.getApiRouterUsageRecordSummary,
        { query },
        { operation: 'apiRouter.getUsageRecordSummary' },
      ),
    () => webApiRouterPlatform.getUsageRecordSummary(query),
  );
}

export async function getApiRouterUsageRecords(
  query: ApiRouterUsageRecordsQuery = {},
): Promise<ApiRouterUsageRecordsResult> {
  return runDesktopOrFallback(
    'apiRouter.getUsageRecords',
    () =>
      invokeDesktopCommand<ApiRouterUsageRecordsResult>(
        DESKTOP_COMMANDS.getApiRouterUsageRecords,
        { query },
        { operation: 'apiRouter.getUsageRecords' },
      ),
    () => webApiRouterPlatform.getUsageRecords(query),
  );
}

export async function getApiRouterUnifiedApiKeys(
  query: ApiRouterUnifiedApiKeyQuery = {},
): Promise<UnifiedApiKey[]> {
  return runDesktopOrFallback(
    'apiRouter.getUnifiedApiKeys',
    () =>
      invokeDesktopCommand<UnifiedApiKey[]>(
        DESKTOP_COMMANDS.getApiRouterUnifiedApiKeys,
        { query },
        { operation: 'apiRouter.getUnifiedApiKeys' },
      ),
    () => webApiRouterPlatform.getUnifiedApiKeys(query),
  );
}

export async function createApiRouterUnifiedApiKey(
  input: UnifiedApiKeyCreate,
): Promise<UnifiedApiKey> {
  return runDesktopOrFallback(
    'apiRouter.createUnifiedApiKey',
    () =>
      invokeDesktopCommand<UnifiedApiKey>(
        DESKTOP_COMMANDS.createApiRouterUnifiedApiKey,
        { input },
        { operation: 'apiRouter.createUnifiedApiKey' },
      ),
    () => webApiRouterPlatform.createUnifiedApiKey(input),
  );
}

export async function updateApiRouterUnifiedApiKeyGroup(
  id: string,
  groupId: string,
): Promise<UnifiedApiKey> {
  return runDesktopOrFallback(
    'apiRouter.updateUnifiedApiKeyGroup',
    () =>
      invokeDesktopCommand<UnifiedApiKey>(
        DESKTOP_COMMANDS.updateApiRouterUnifiedApiKeyGroup,
        { id, groupId },
        { operation: 'apiRouter.updateUnifiedApiKeyGroup' },
      ),
    () => webApiRouterPlatform.updateUnifiedApiKeyGroup(id, groupId),
  );
}

export async function updateApiRouterUnifiedApiKeyStatus(
  id: string,
  status: ProxyProviderStatus,
): Promise<UnifiedApiKey> {
  return runDesktopOrFallback(
    'apiRouter.updateUnifiedApiKeyStatus',
    () =>
      invokeDesktopCommand<UnifiedApiKey>(
        DESKTOP_COMMANDS.updateApiRouterUnifiedApiKeyStatus,
        { id, status },
        { operation: 'apiRouter.updateUnifiedApiKeyStatus' },
      ),
    () => webApiRouterPlatform.updateUnifiedApiKeyStatus(id, status),
  );
}

export async function assignApiRouterUnifiedApiKeyModelMapping(
  id: string,
  modelMappingId: string | null,
): Promise<UnifiedApiKey> {
  return runDesktopOrFallback(
    'apiRouter.assignUnifiedApiKeyModelMapping',
    () =>
      invokeDesktopCommand<UnifiedApiKey>(
        DESKTOP_COMMANDS.assignApiRouterUnifiedApiKeyModelMapping,
        { id, modelMappingId },
        { operation: 'apiRouter.assignUnifiedApiKeyModelMapping' },
      ),
    () => webApiRouterPlatform.assignUnifiedApiKeyModelMapping(id, modelMappingId),
  );
}

export async function updateApiRouterUnifiedApiKey(
  id: string,
  update: UnifiedApiKeyUpdate,
): Promise<UnifiedApiKey> {
  return runDesktopOrFallback(
    'apiRouter.updateUnifiedApiKey',
    () =>
      invokeDesktopCommand<UnifiedApiKey>(
        DESKTOP_COMMANDS.updateApiRouterUnifiedApiKey,
        { id, update },
        { operation: 'apiRouter.updateUnifiedApiKey' },
      ),
    () => webApiRouterPlatform.updateUnifiedApiKey(id, update),
  );
}

export async function deleteApiRouterUnifiedApiKey(id: string): Promise<boolean> {
  return runDesktopOrFallback(
    'apiRouter.deleteUnifiedApiKey',
    () =>
      invokeDesktopCommand<boolean>(
        DESKTOP_COMMANDS.deleteApiRouterUnifiedApiKey,
        { id },
        { operation: 'apiRouter.deleteUnifiedApiKey' },
      ),
    () => webApiRouterPlatform.deleteUnifiedApiKey(id),
  );
}

export async function getApiRouterModelCatalog(): Promise<ModelMappingCatalogChannel[]> {
  return runDesktopOrFallback(
    'apiRouter.getModelCatalog',
    () =>
      invokeDesktopCommand<ModelMappingCatalogChannel[]>(
        DESKTOP_COMMANDS.getApiRouterModelCatalog,
        undefined,
        { operation: 'apiRouter.getModelCatalog' },
      ),
    () => webApiRouterPlatform.getModelCatalog(),
  );
}

export async function getApiRouterModelMappings(
  query: ApiRouterModelMappingQuery = {},
): Promise<ModelMapping[]> {
  return runDesktopOrFallback(
    'apiRouter.getModelMappings',
    () =>
      invokeDesktopCommand<ModelMapping[]>(
        DESKTOP_COMMANDS.getApiRouterModelMappings,
        { query },
        { operation: 'apiRouter.getModelMappings' },
      ),
    () => webApiRouterPlatform.getModelMappings(query),
  );
}

export async function createApiRouterModelMapping(
  input: ModelMappingCreate,
): Promise<ModelMapping> {
  return runDesktopOrFallback(
    'apiRouter.createModelMapping',
    () =>
      invokeDesktopCommand<ModelMapping>(
        DESKTOP_COMMANDS.createApiRouterModelMapping,
        { input },
        { operation: 'apiRouter.createModelMapping' },
      ),
    () => webApiRouterPlatform.createModelMapping(input),
  );
}

export async function updateApiRouterModelMapping(
  id: string,
  update: ModelMappingUpdate,
): Promise<ModelMapping> {
  return runDesktopOrFallback(
    'apiRouter.updateModelMapping',
    () =>
      invokeDesktopCommand<ModelMapping>(
        DESKTOP_COMMANDS.updateApiRouterModelMapping,
        { id, update },
        { operation: 'apiRouter.updateModelMapping' },
      ),
    () => webApiRouterPlatform.updateModelMapping(id, update),
  );
}

export async function updateApiRouterModelMappingStatus(
  id: string,
  status: ModelMappingStatus,
): Promise<ModelMapping> {
  return runDesktopOrFallback(
    'apiRouter.updateModelMappingStatus',
    () =>
      invokeDesktopCommand<ModelMapping>(
        DESKTOP_COMMANDS.updateApiRouterModelMappingStatus,
        { id, status },
        { operation: 'apiRouter.updateModelMappingStatus' },
      ),
    () => webApiRouterPlatform.updateModelMappingStatus(id, status),
  );
}

export async function deleteApiRouterModelMapping(id: string): Promise<boolean> {
  return runDesktopOrFallback(
    'apiRouter.deleteModelMapping',
    () =>
      invokeDesktopCommand<boolean>(
        DESKTOP_COMMANDS.deleteApiRouterModelMapping,
        { id },
        { operation: 'apiRouter.deleteModelMapping' },
      ),
    () => webApiRouterPlatform.deleteModelMapping(id),
  );
}

export async function getAppInfo(): Promise<DesktopAppInfo | null> {
  return runDesktopOrFallback(
    'app.getInfo',
    () =>
      invokeDesktopCommand<DesktopAppInfo>(DESKTOP_COMMANDS.appInfo, undefined, {
        operation: 'app.getInfo',
      }),
    async () => null,
  );
}

export async function getAppPaths(): Promise<DesktopAppPaths | null> {
  return runDesktopOrFallback(
    'app.getPaths',
    () =>
      invokeDesktopCommand<DesktopAppPaths>(DESKTOP_COMMANDS.appPaths, undefined, {
        operation: 'app.getPaths',
      }),
    async () => null,
  );
}

export async function getAppConfig(): Promise<DesktopAppConfig | null> {
  return runDesktopOrFallback(
    'app.getConfig',
    () =>
      invokeDesktopCommand<DesktopAppConfig>(DESKTOP_COMMANDS.appConfig, undefined, {
        operation: 'app.getConfig',
      }),
    async () => null,
  );
}

export async function setAppLanguage(language: RuntimeLanguagePreference): Promise<void> {
  await runDesktopOrFallback(
    'app.setLanguage',
    () =>
      invokeDesktopCommand<void>(
        DESKTOP_COMMANDS.setAppLanguage,
        { language },
        { operation: 'app.setLanguage' },
      ),
    async () => {},
  );
}

export async function getSystemInfo(): Promise<DesktopSystemInfo | null> {
  return runDesktopOrFallback(
    'app.getSystemInfo',
    () =>
      invokeDesktopCommand<DesktopSystemInfo>(DESKTOP_COMMANDS.systemInfo, undefined, {
        operation: 'app.getSystemInfo',
      }),
    async () => null,
  );
}

export async function getDesktopKernelInfo(): Promise<DesktopKernelInfo | null> {
  return runDesktopOrFallback(
    'kernel.getInfo',
    () =>
      invokeDesktopCommand<DesktopKernelInfo>(DESKTOP_COMMANDS.desktopKernelInfo, undefined, {
        operation: 'kernel.getInfo',
      }),
    async () => null,
  );
}

export async function getDesktopStorageInfo(): Promise<DesktopStorageInfo | null> {
  return runDesktopOrFallback(
    'storage.getInfo',
    () =>
      invokeDesktopCommand<DesktopStorageInfo>(DESKTOP_COMMANDS.desktopStorageInfo, undefined, {
        operation: 'storage.getInfo',
      }),
    async () => null,
  );
}

export async function storageGetText(
  request: StorageGetTextRequest,
): Promise<StorageGetTextResult> {
  return runDesktopOrFallback(
    'storage.getText',
    () =>
      invokeDesktopCommand<StorageGetTextResult>(
        DESKTOP_COMMANDS.storageGetText,
        { request },
        { operation: 'storage.getText' },
      ),
    () => webStoragePlatform.getText(request),
  );
}

export async function storagePutText(
  request: StoragePutTextRequest,
): Promise<StoragePutTextResult> {
  return runDesktopOrFallback(
    'storage.putText',
    () =>
      invokeDesktopCommand<StoragePutTextResult>(
        DESKTOP_COMMANDS.storagePutText,
        { request },
        { operation: 'storage.putText' },
      ),
    () => webStoragePlatform.putText(request),
  );
}

export async function storageDelete(
  request: StorageDeleteRequest,
): Promise<StorageDeleteResult> {
  return runDesktopOrFallback(
    'storage.delete',
    () =>
      invokeDesktopCommand<StorageDeleteResult>(
        DESKTOP_COMMANDS.storageDelete,
        { request },
        { operation: 'storage.delete' },
      ),
    () => webStoragePlatform.delete(request),
  );
}

export async function storageListKeys(
  request: StorageListKeysRequest = {},
): Promise<StorageListKeysResult> {
  return runDesktopOrFallback(
    'storage.listKeys',
    () =>
      invokeDesktopCommand<StorageListKeysResult>(
        DESKTOP_COMMANDS.storageListKeys,
        { request },
        { operation: 'storage.listKeys' },
      ),
    () => webStoragePlatform.listKeys(request),
  );
}

export async function listDirectory(path = ''): Promise<DesktopFileEntry[]> {
  return runDesktopOrFallback(
    'filesystem.listDirectory',
    () =>
      invokeDesktopCommand<DesktopFileEntry[]>(
        DESKTOP_COMMANDS.listDirectory,
        { path },
        { operation: 'filesystem.listDirectory' },
      ),
    () => webPlatform.listDirectory(path),
  );
}

export async function pathExists(path: string): Promise<boolean> {
  return runDesktopOrFallback(
    'filesystem.pathExists',
    () =>
      invokeDesktopCommand<boolean>(DESKTOP_COMMANDS.pathExists, { path }, {
        operation: 'filesystem.pathExists',
      }),
    () => webPlatform.pathExists(path),
  );
}

export async function getPathInfo(path: string): Promise<DesktopPathInfo> {
  return runDesktopOrFallback(
    'filesystem.getPathInfo',
    () =>
      invokeDesktopCommand<DesktopPathInfo>(DESKTOP_COMMANDS.getPathInfo, { path }, {
        operation: 'filesystem.getPathInfo',
      }),
    () => webPlatform.getPathInfo(path),
  );
}

export async function createDirectory(path: string): Promise<void> {
  await runDesktopOrFallback(
    'filesystem.createDirectory',
    () =>
      invokeDesktopCommand<void>(DESKTOP_COMMANDS.createDirectory, { path }, {
        operation: 'filesystem.createDirectory',
      }),
    () => webPlatform.createDirectory(path),
  );
}

export async function removePath(path: string): Promise<void> {
  await runDesktopOrFallback(
    'filesystem.removePath',
    () =>
      invokeDesktopCommand<void>(DESKTOP_COMMANDS.removePath, { path }, {
        operation: 'filesystem.removePath',
      }),
    () => webPlatform.removePath(path),
  );
}

export async function copyPath(
  sourcePath: string,
  destinationPath: string,
): Promise<void> {
  await runDesktopOrFallback(
    'filesystem.copyPath',
    () =>
      invokeDesktopCommand<void>(
        DESKTOP_COMMANDS.copyPath,
        { sourcePath, destinationPath },
        { operation: 'filesystem.copyPath' },
      ),
    () => webPlatform.copyPath(sourcePath, destinationPath),
  );
}

export async function movePath(
  sourcePath: string,
  destinationPath: string,
): Promise<void> {
  await runDesktopOrFallback(
    'filesystem.movePath',
    () =>
      invokeDesktopCommand<void>(
        DESKTOP_COMMANDS.movePath,
        { sourcePath, destinationPath },
        { operation: 'filesystem.movePath' },
      ),
    () => webPlatform.movePath(sourcePath, destinationPath),
  );
}

export async function readBinaryFile(path: string): Promise<Uint8Array> {
  return runDesktopOrFallback(
    'filesystem.readBinaryFile',
    async () => {
      const bytes = await invokeDesktopCommand<number[]>(
        DESKTOP_COMMANDS.readBinaryFile,
        { path },
        { operation: 'filesystem.readBinaryFile' },
      );
      return Uint8Array.from(bytes);
    },
    () => webPlatform.readBinaryFile(path),
  );
}

export async function writeBinaryFile(
  path: string,
  content: Uint8Array | number[],
): Promise<void> {
  const bytes = content instanceof Uint8Array ? Array.from(content) : content;
  await runDesktopOrFallback(
    'filesystem.writeBinaryFile',
    () =>
      invokeDesktopCommand<void>(
        DESKTOP_COMMANDS.writeBinaryFile,
        { path, content: bytes },
        { operation: 'filesystem.writeBinaryFile' },
      ),
    () => webPlatform.writeBinaryFile(path, content),
  );
}

export async function readTextFile(path: string): Promise<string> {
  return runDesktopOrFallback(
    'filesystem.readTextFile',
    () =>
      invokeDesktopCommand<string>(DESKTOP_COMMANDS.readTextFile, { path }, {
        operation: 'filesystem.readTextFile',
      }),
    () => webPlatform.readFile(path),
  );
}

export async function writeTextFile(path: string, content: string): Promise<void> {
  await runDesktopOrFallback(
    'filesystem.writeTextFile',
    () =>
      invokeDesktopCommand<void>(DESKTOP_COMMANDS.writeTextFile, { path, content }, {
        operation: 'filesystem.writeTextFile',
      }),
    () => webPlatform.writeFile(path, content),
  );
}

export async function getDeviceId(): Promise<string> {
  return runDesktopOrFallback(
    'app.getDeviceId',
    () =>
      invokeDesktopCommand<string>(DESKTOP_COMMANDS.getDeviceId, undefined, {
        operation: 'app.getDeviceId',
      }),
    () => webPlatform.getDeviceId(),
  );
}

export async function submitJob(kind: string): Promise<string> {
  return invokeDesktopCommand<string>(DESKTOP_COMMANDS.jobSubmit, { kind }, {
    operation: 'jobs.submit',
  });
}

export async function submitProcessJob(profileId: string): Promise<string> {
  return invokeDesktopCommand<string>(DESKTOP_COMMANDS.jobSubmitProcess, { profileId }, {
    operation: 'jobs.submitProcess',
  });
}

export async function getJob(id: string): Promise<DesktopJobUpdateEvent['record']> {
  return invokeDesktopCommand<DesktopJobUpdateEvent['record']>(DESKTOP_COMMANDS.jobGet, { id }, {
    operation: 'jobs.get',
  });
}

export async function listJobs(): Promise<DesktopJobUpdateEvent['record'][]> {
  return invokeDesktopCommand<DesktopJobUpdateEvent['record'][]>(DESKTOP_COMMANDS.jobList, undefined, {
    operation: 'jobs.list',
  });
}

export async function cancelJob(id: string): Promise<DesktopJobUpdateEvent['record']> {
  return invokeDesktopCommand<DesktopJobUpdateEvent['record']>(DESKTOP_COMMANDS.jobCancel, { id }, {
    operation: 'jobs.cancel',
  });
}

export async function subscribeJobUpdates(
  listener: (event: DesktopJobUpdateEvent) => void,
): Promise<RuntimeEventUnsubscribe> {
  if (!isTauriRuntime()) {
    return noopUnsubscribe;
  }

  return listenDesktopEvent<DesktopJobUpdateEvent>(DESKTOP_EVENTS.jobUpdated, listener, {
    operation: 'jobs.subscribeUpdates',
  });
}

export async function subscribeProcessOutput(
  listener: (event: DesktopProcessOutputEvent) => void,
): Promise<RuntimeEventUnsubscribe> {
  if (!isTauriRuntime()) {
    return noopUnsubscribe;
  }

  return listenDesktopEvent<DesktopProcessOutputEvent>(
    DESKTOP_EVENTS.processOutput,
    listener,
    {
      operation: 'jobs.subscribeProcessOutput',
    },
  );
}

export async function subscribeHubInstallProgress(
  listener: (event: HubInstallProgressEvent) => void,
): Promise<RuntimeEventUnsubscribe> {
  if (!isTauriRuntime()) {
    return noopUnsubscribe;
  }

  return listenDesktopEvent<HubInstallProgressEvent>(
    DESKTOP_EVENTS.hubInstallProgress,
    listener,
    {
      operation: 'installer.subscribeHubInstallProgress',
    },
  );
}

export async function openExternal(url: string): Promise<void> {
  await runDesktopOrFallback(
    'shell.openExternal',
    () =>
      invokeDesktopCommand<void>(DESKTOP_COMMANDS.openExternal, { url }, {
        operation: 'shell.openExternal',
      }),
    () => webPlatform.openExternal(url),
  );
}

export async function selectFiles(
  options?: PlatformSelectFileOptions,
): Promise<string[]> {
  return runDesktopOrFallback(
    'shell.selectFiles',
    () =>
      invokeDesktopCommand<string[]>(DESKTOP_COMMANDS.selectFiles, { options }, {
        operation: 'shell.selectFiles',
      }),
    () => webPlatform.selectFile(options),
  );
}

export async function saveFile(
  data: Blob,
  filename: string,
  options?: PlatformSaveFileOptions,
): Promise<void> {
  await runDesktopOrFallback(
    'shell.saveFile',
    async () => {
      const bytes = Array.from(new Uint8Array(await data.arrayBuffer()));
      await invokeDesktopCommand<void>(
        DESKTOP_COMMANDS.saveBlobFile,
        { filename, content: bytes, options },
        { operation: 'shell.saveFile' },
      );
    },
    () => webPlatform.saveFile(data, filename, options),
  );
}

export async function minimizeWindow(): Promise<void> {
  const currentWindow = getDesktopWindow();
  if (!currentWindow) {
    return webPlatform.minimizeWindow();
  }

  await currentWindow.minimize();
}

export async function maximizeWindow(): Promise<void> {
  const currentWindow = getDesktopWindow();
  if (!currentWindow) {
    return webPlatform.maximizeWindow();
  }

  if (await currentWindow.isFullscreen()) {
    await currentWindow.setFullscreen(false);
  }

  await currentWindow.maximize();
}

export async function restoreWindow(): Promise<void> {
  const currentWindow = getDesktopWindow();
  if (!currentWindow) {
    return webPlatform.restoreWindow();
  }

  const [
    isFullscreenWindow,
    isMaximizedWindow,
    isMinimizedWindow,
    isHiddenWindow,
  ] = await Promise.all([
    currentWindow.isFullscreen(),
    currentWindow.isMaximized(),
    currentWindow.isMinimized(),
    currentWindow.isVisible().then((isVisibleWindow) => !isVisibleWindow),
  ]);

  if (isHiddenWindow) {
    await currentWindow.show();
  }

  if (isFullscreenWindow) {
    await currentWindow.setFullscreen(false);
  }

  if (isMinimizedWindow) {
    await currentWindow.unminimize();
  }

  if (isMaximizedWindow) {
    await currentWindow.unmaximize();
  }

  if (isFullscreenWindow || isMinimizedWindow || isHiddenWindow) {
    await currentWindow.setFocus().catch(() => {
      // Focus is best-effort after restoring window visibility.
    });
  }
}

export async function isWindowMaximized(): Promise<boolean> {
  const currentWindow = getDesktopWindow();
  if (!currentWindow) {
    return webPlatform.isWindowMaximized();
  }

  const [isFullscreenWindow, isMaximizedWindow] = await Promise.all([
    currentWindow.isFullscreen(),
    currentWindow.isMaximized(),
  ]);

  return isFullscreenWindow || isMaximizedWindow;
}

export async function subscribeWindowMaximized(
  listener: (isMaximized: boolean) => void,
): Promise<RuntimeEventUnsubscribe> {
  if (!isTauriRuntime()) {
    return webPlatform.subscribeWindowMaximized(listener);
  }

  const currentWindow = getDesktopWindow();
  if (!currentWindow) {
    return noopUnsubscribe;
  }

  let active = true;

  const emitWindowState = async () => {
    if (!active) {
      return;
    }

    listener(await isWindowMaximized());
  };

  await emitWindowState();

  const unlistenResize = await currentWindow.onResized(() => {
    void emitWindowState();
  });

  const unlistenMove = await currentWindow.onMoved(() => {
    void emitWindowState();
  });

  return async () => {
    active = false;
    await Promise.all([unlistenResize(), unlistenMove()]);
  };
}

export async function closeWindow(): Promise<void> {
  const currentWindow = getDesktopWindow();
  if (!currentWindow) {
    return webPlatform.closeWindow();
  }

  await currentWindow.hide();
}

export async function runHubInstall(
  request: HubInstallRequest,
): Promise<HubInstallResult> {
  return invokeDesktopCommand<HubInstallResult>(
    DESKTOP_COMMANDS.runHubInstall,
    { request },
    { operation: 'installer.runHubInstall' },
  );
}

export async function inspectHubInstall(
  request: HubInstallRequest,
): Promise<HubInstallAssessmentResult> {
  return invokeDesktopCommand<HubInstallAssessmentResult>(
    DESKTOP_COMMANDS.inspectHubInstall,
    { request },
    { operation: 'installer.inspectHubInstall' },
  );
}

export async function runHubUninstall(
  request: HubUninstallRequest,
): Promise<HubUninstallResult> {
  return invokeDesktopCommand<HubUninstallResult>(
    DESKTOP_COMMANDS.runHubUninstall,
    { request },
    { operation: 'installer.runHubUninstall' },
  );
}

export async function installApiRouterClientSetup(
  request: ApiRouterClientInstallRequest,
): Promise<ApiRouterClientInstallResult> {
  return invokeDesktopCommand<ApiRouterClientInstallResult>(
    DESKTOP_COMMANDS.installApiRouterClientSetup,
    { request },
    { operation: 'installer.installApiRouterClientSetup' },
  );
}

export async function getRuntimeInfo(): Promise<RuntimeInfo> {
  const [app, paths, config, system] = await Promise.all([
    getAppInfo(),
    getAppPaths(),
    getAppConfig(),
    getSystemInfo(),
  ]);

  return {
    platform: 'desktop' as const,
    app,
    paths,
    config,
    system,
  };
}

export const desktopTemplateApi = {
  catalog: {
    commands: DESKTOP_COMMANDS,
    events: DESKTOP_EVENTS,
  },
  meta: {
    isTauriRuntime,
    getDesktopWindow,
  },
  app: {
    getInfo: getAppInfo,
    getPaths: getAppPaths,
    getConfig: getAppConfig,
    setLanguage: setAppLanguage,
    getSystemInfo,
    getDeviceId,
  },
  kernel: {
    getInfo: getDesktopKernelInfo,
    getStorageInfo: getDesktopStorageInfo,
  },
  storage: {
    getInfo: getDesktopStorageInfo,
    getText: storageGetText,
    putText: storagePutText,
    delete: storageDelete,
    listKeys: storageListKeys,
  },
  filesystem: {
    listDirectory,
    pathExists,
    getPathInfo,
    createDirectory,
    removePath,
    copyPath,
    movePath,
    readBinaryFile,
    writeBinaryFile,
    readTextFile,
    writeTextFile,
  },
  jobs: {
    submit: submitJob,
    submitProcess: submitProcessJob,
    get: getJob,
    list: listJobs,
    cancel: cancelJob,
    subscribeUpdates: subscribeJobUpdates,
    subscribeProcessOutput,
  },
  shell: {
    openExternal,
    selectFiles,
    saveFile,
    minimizeWindow,
    maximizeWindow,
    restoreWindow,
    isWindowMaximized,
    subscribeWindowMaximized,
    closeWindow,
  },
  installer: {
    inspectHubInstall,
    runHubInstall,
    runHubUninstall,
    subscribeHubInstallProgress,
    installApiRouterClientSetup,
  },
  apiRouter: {
    getRuntimeStatus: getApiRouterRuntimeStatus,
    getChannels: getApiRouterChannels,
    getGroups: getApiRouterGroups,
    getProxyProviders: getApiRouterProxyProviders,
    createProxyProvider: createApiRouterProxyProvider,
    updateProxyProviderGroup: updateApiRouterProxyProviderGroup,
    updateProxyProviderStatus: updateApiRouterProxyProviderStatus,
    updateProxyProvider: updateApiRouterProxyProvider,
    deleteProxyProvider: deleteApiRouterProxyProvider,
    getUsageRecordApiKeys: getApiRouterUsageRecordApiKeys,
    getUsageRecordSummary: getApiRouterUsageRecordSummary,
    getUsageRecords: getApiRouterUsageRecords,
    getUnifiedApiKeys: getApiRouterUnifiedApiKeys,
    createUnifiedApiKey: createApiRouterUnifiedApiKey,
    updateUnifiedApiKeyGroup: updateApiRouterUnifiedApiKeyGroup,
    updateUnifiedApiKeyStatus: updateApiRouterUnifiedApiKeyStatus,
    assignUnifiedApiKeyModelMapping: assignApiRouterUnifiedApiKeyModelMapping,
    updateUnifiedApiKey: updateApiRouterUnifiedApiKey,
    deleteUnifiedApiKey: deleteApiRouterUnifiedApiKey,
    getModelCatalog: getApiRouterModelCatalog,
    getModelMappings: getApiRouterModelMappings,
    createModelMapping: createApiRouterModelMapping,
    updateModelMapping: updateApiRouterModelMapping,
    updateModelMappingStatus: updateApiRouterModelMappingStatus,
    deleteModelMapping: deleteApiRouterModelMapping,
  },
  runtime: {
    getInfo: getRuntimeInfo,
    setAppLanguage,
  },
  auth: {
    syncDesktopSession: syncDesktopAuthSession,
    clearDesktopSession: clearDesktopAuthSession,
    getApiRouterAdminToken,
  },
};

export type DesktopTemplateApi = typeof desktopTemplateApi;

export function configureDesktopPlatformBridge() {
  configurePlatformBridge({
    platform: {
      getPlatform: () => 'desktop',
      getDeviceId: () => getDeviceId(),
      setStorage: (key, value) => webPlatform.setStorage(key, value),
      getStorage: (key) => webPlatform.getStorage(key),
      copy: (text) => webPlatform.copy(text),
      openExternal: (url) => openExternal(url),
      selectFile: (options) => selectFiles(options),
      saveFile: (data, filename, options) => saveFile(data, filename, options),
      minimizeWindow: () => minimizeWindow(),
      maximizeWindow: () => maximizeWindow(),
      restoreWindow: () => restoreWindow(),
      isWindowMaximized: () => isWindowMaximized(),
      subscribeWindowMaximized: (listener) => subscribeWindowMaximized(listener),
      closeWindow: () => closeWindow(),
      listDirectory: (path) => listDirectory(path),
      pathExists: (path) => pathExists(path),
      getPathInfo: (path) => getPathInfo(path),
      createDirectory: (path) => createDirectory(path),
      removePath: (path) => removePath(path),
      copyPath: (sourcePath, destinationPath) => copyPath(sourcePath, destinationPath),
      movePath: (sourcePath, destinationPath) => movePath(sourcePath, destinationPath),
      readBinaryFile: (path) => readBinaryFile(path),
      writeBinaryFile: (path, content) => writeBinaryFile(path, content),
      readFile: (path) => readTextFile(path),
      writeFile: (path, content) => writeTextFile(path, content),
    },
    installer: {
      inspectHubInstall: (request) => inspectHubInstall(request),
      runHubInstall: (request) => runHubInstall(request),
      runHubUninstall: (request) => runHubUninstall(request),
      subscribeHubInstallProgress: (listener) => subscribeHubInstallProgress(listener),
      installApiRouterClientSetup: (request) => installApiRouterClientSetup(request),
    },
    apiRouter: {
      getRuntimeStatus: () => getApiRouterRuntimeStatus(),
      getChannels: () => getApiRouterChannels(),
      getGroups: () => getApiRouterGroups(),
      getProxyProviders: (query) => getApiRouterProxyProviders(query),
      createProxyProvider: (input) => createApiRouterProxyProvider(input),
      updateProxyProviderGroup: (id, groupId) =>
        updateApiRouterProxyProviderGroup(id, groupId),
      updateProxyProviderStatus: (id, status) =>
        updateApiRouterProxyProviderStatus(id, status),
      updateProxyProvider: (id, update) => updateApiRouterProxyProvider(id, update),
      deleteProxyProvider: (id) => deleteApiRouterProxyProvider(id),
      getUsageRecordApiKeys: () => getApiRouterUsageRecordApiKeys(),
      getUsageRecordSummary: (query) => getApiRouterUsageRecordSummary(query),
      getUsageRecords: (query) => getApiRouterUsageRecords(query),
      getUnifiedApiKeys: (query) => getApiRouterUnifiedApiKeys(query),
      createUnifiedApiKey: (input) => createApiRouterUnifiedApiKey(input),
      updateUnifiedApiKeyGroup: (id, groupId) =>
        updateApiRouterUnifiedApiKeyGroup(id, groupId),
      updateUnifiedApiKeyStatus: (id, status) =>
        updateApiRouterUnifiedApiKeyStatus(id, status),
      assignUnifiedApiKeyModelMapping: (id, modelMappingId) =>
        assignApiRouterUnifiedApiKeyModelMapping(id, modelMappingId),
      updateUnifiedApiKey: (id, update) => updateApiRouterUnifiedApiKey(id, update),
      deleteUnifiedApiKey: (id) => deleteApiRouterUnifiedApiKey(id),
      getModelCatalog: () => getApiRouterModelCatalog(),
      getModelMappings: (query) => getApiRouterModelMappings(query),
      createModelMapping: (input) => createApiRouterModelMapping(input),
      updateModelMapping: (id, update) => updateApiRouterModelMapping(id, update),
      updateModelMappingStatus: (id, status) =>
        updateApiRouterModelMappingStatus(id, status),
      deleteModelMapping: (id) => deleteApiRouterModelMapping(id),
    },
    storage: {
      async getStorageInfo() {
        const info = await getDesktopStorageInfo();
        return info ?? webStoragePlatform.getStorageInfo();
      },
      getText: (request) => storageGetText(request),
      putText: (request) => storagePutText(request),
      delete: (request) => storageDelete(request),
      listKeys: (request) => storageListKeys(request),
    },
    runtime: {
      getRuntimeInfo: () => getRuntimeInfo(),
      setAppLanguage: (language) => setAppLanguage(language),
      submitProcessJob: (profileId) => submitProcessJob(profileId),
      getJob: (id) => getJob(id),
      listJobs: () => listJobs(),
      cancelJob: (id) => cancelJob(id),
      subscribeJobUpdates: (listener) => subscribeJobUpdates(listener),
      subscribeProcessOutput: (listener) => subscribeProcessOutput(listener),
    },
  });
}
