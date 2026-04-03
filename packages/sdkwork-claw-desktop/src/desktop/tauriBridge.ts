import {
  WebPlatform,
  configurePlatformBridge,
} from '@sdkwork/claw-infrastructure';
import type {
  HostPlatformStatusRecord,
  HubInstallCatalogEntry,
  HubInstallCatalogQuery,
  HubInstallDependencyRequest,
  HubInstallDependencyResult,
  InternalNodeSessionRecord,
  LocalAiProxyMessageCaptureSettings,
  LocalAiProxyMessageLogRecord,
  LocalAiProxyMessageLogsQuery,
  LocalAiProxyRequestLogRecord,
  LocalAiProxyRequestLogsQuery,
  LocalAiProxyRouteTestRecord,
  ManageRolloutListResult,
  ManageRolloutPreview,
  ManageRolloutRecord,
  PaginatedResult,
  PreviewRolloutRequest,
  HubInstallAssessmentResult,
  HubInstallProgressEvent,
  HubInstallRequest,
  HubInstallResult,
  HubUninstallRequest,
  HubUninstallResult,
  PlatformCapturedScreenshot,
  PlatformFetchedRemoteUrl,
  PlatformFileEntry,
  PlatformPathInfo,
  PlatformSaveFileOptions,
  PlatformSelectFileOptions,
  RuntimeAppInfo,
  RuntimeConfigInfo,
  RuntimeDesktopKernelHostInfo,
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
  StudioConversationRecord,
  StudioCreateInstanceInput,
  StudioInstanceDetailRecord,
  StudioInstanceConfig,
  StudioInstanceRecord,
  StudioInstanceTaskMutationPayload,
  StudioOpenClawGatewayInvokeOptions,
  StudioOpenClawGatewayInvokeRequest,
  StudioUpdateInstanceLlmProviderConfigInput,
  StudioWorkbenchTaskExecutionRecord,
  StudioUpdateInstanceInput,
} from '@sdkwork/claw-infrastructure';
import { DESKTOP_COMMANDS, DESKTOP_EVENTS } from './catalog';
import {
  controlDesktopComponent,
  desktopComponentsApi,
  listDesktopComponents,
  restartDesktopComponent,
  startDesktopComponent,
  stopDesktopComponent,
} from './componentsBridge';
import {
  getDesktopWindow,
  invokeDesktopCommand,
  isTauriRuntime,
  listenDesktopEvent,
  runDesktopOnly,
  runDesktopOrFallback,
} from './runtime';

export {
  controlDesktopComponent,
  listDesktopComponents,
  restartDesktopComponent,
  startDesktopComponent,
  stopDesktopComponent,
} from './componentsBridge';

const webPlatform = new WebPlatform();

export interface DesktopAppInfo extends RuntimeAppInfo {}
export interface DesktopAppPaths extends RuntimePathsInfo {}
export interface DesktopAppConfig extends RuntimeConfigInfo {}
export interface DesktopSystemInfo extends RuntimeSystemInfo {}
export interface DesktopFileEntry extends PlatformFileEntry {}
export interface DesktopPathInfo extends PlatformPathInfo {}
interface DesktopCapturedScreenshotPayload
  extends Omit<PlatformCapturedScreenshot, 'bytes'> {
  bytes: number[];
}
interface DesktopFetchedRemoteUrlPayload
  extends Omit<PlatformFetchedRemoteUrl, 'bytes'> {
  bytes: number[];
}
export interface DesktopJobUpdateEvent extends RuntimeJobUpdateEvent {}
export interface DesktopProcessOutputEvent extends RuntimeProcessOutputEvent {}
export interface DesktopKernelInfo extends RuntimeDesktopKernelInfo {}
export interface DesktopKernelStatus extends RuntimeDesktopKernelHostInfo {}
export interface DesktopStorageInfo extends RuntimeStorageInfo {}

const noopUnsubscribe: RuntimeEventUnsubscribe = () => {};

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
  return runDesktopOnly(
    'kernel.getInfo',
    () =>
      invokeDesktopCommand<DesktopKernelInfo>(DESKTOP_COMMANDS.desktopKernelInfo, undefined, {
        operation: 'kernel.getInfo',
      }),
  );
}

export async function getDesktopKernelStatus(): Promise<DesktopKernelStatus | null> {
  return runDesktopOnly(
    'kernel.getStatus',
    () =>
      invokeDesktopCommand<DesktopKernelStatus>(
        DESKTOP_COMMANDS.desktopKernelStatus,
        undefined,
        {
          operation: 'kernel.getStatus',
        },
      ),
  );
}

export async function ensureDesktopKernelRunning(): Promise<DesktopKernelStatus | null> {
  return runDesktopOnly(
    'kernel.ensureRunning',
    () =>
      invokeDesktopCommand<DesktopKernelStatus>(
        DESKTOP_COMMANDS.ensureDesktopKernelRunning,
        undefined,
        {
          operation: 'kernel.ensureRunning',
        },
      ),
  );
}

export async function restartDesktopKernel(): Promise<DesktopKernelStatus | null> {
  return runDesktopOnly(
    'kernel.restart',
    () =>
      invokeDesktopCommand<DesktopKernelStatus>(
        DESKTOP_COMMANDS.restartDesktopKernel,
        undefined,
        {
          operation: 'kernel.restart',
        },
      ),
  );
}

export async function testLocalAiProxyRoute(
  routeId: string,
): Promise<LocalAiProxyRouteTestRecord | null> {
  return runDesktopOnly(
    'kernel.testLocalAiProxyRoute',
    () =>
      invokeDesktopCommand<LocalAiProxyRouteTestRecord | null>(
        DESKTOP_COMMANDS.testLocalAiProxyRoute,
        { routeId },
        {
          operation: 'kernel.testLocalAiProxyRoute',
        },
      ),
  );
}

export async function listLocalAiProxyRequestLogs(
  query: LocalAiProxyRequestLogsQuery,
): Promise<PaginatedResult<LocalAiProxyRequestLogRecord>> {
  return runDesktopOnly(
    'kernel.listLocalAiProxyRequestLogs',
    () =>
      invokeDesktopCommand<PaginatedResult<LocalAiProxyRequestLogRecord>>(
        DESKTOP_COMMANDS.listLocalAiProxyRequestLogs,
        { query },
        {
          operation: 'kernel.listLocalAiProxyRequestLogs',
        },
      ),
  );
}

export async function listLocalAiProxyMessageLogs(
  query: LocalAiProxyMessageLogsQuery,
): Promise<PaginatedResult<LocalAiProxyMessageLogRecord>> {
  return runDesktopOnly(
    'kernel.listLocalAiProxyMessageLogs',
    () =>
      invokeDesktopCommand<PaginatedResult<LocalAiProxyMessageLogRecord>>(
        DESKTOP_COMMANDS.listLocalAiProxyMessageLogs,
        { query },
        {
          operation: 'kernel.listLocalAiProxyMessageLogs',
        },
      ),
  );
}

export async function updateLocalAiProxyMessageCapture(
  enabled: boolean,
): Promise<LocalAiProxyMessageCaptureSettings> {
  return runDesktopOnly(
    'kernel.updateLocalAiProxyMessageCapture',
    () =>
      invokeDesktopCommand<LocalAiProxyMessageCaptureSettings>(
        DESKTOP_COMMANDS.updateLocalAiProxyMessageCapture,
        { enabled },
        {
          operation: 'kernel.updateLocalAiProxyMessageCapture',
        },
      ),
  );
}

export async function getDesktopStorageInfo(): Promise<DesktopStorageInfo | null> {
  return runDesktopOnly(
    'storage.getInfo',
    () =>
      invokeDesktopCommand<DesktopStorageInfo>(DESKTOP_COMMANDS.desktopStorageInfo, undefined, {
        operation: 'storage.getInfo',
      }),
  );
}

export async function studioListInstances(): Promise<StudioInstanceRecord[]> {
  return runDesktopOnly(
    'studio.listInstances',
    () =>
      invokeDesktopCommand<StudioInstanceRecord[]>(
        DESKTOP_COMMANDS.studioListInstances,
        undefined,
        { operation: 'studio.listInstances' },
      ),
  );
}

export async function studioGetInstance(id: string): Promise<StudioInstanceRecord | null> {
  return runDesktopOnly(
    'studio.getInstance',
    () =>
      invokeDesktopCommand<StudioInstanceRecord | null>(
        DESKTOP_COMMANDS.studioGetInstance,
        { id },
        { operation: 'studio.getInstance' },
      ),
  );
}

export async function studioGetInstanceDetail(
  id: string,
): Promise<StudioInstanceDetailRecord | null> {
  return runDesktopOnly(
    'studio.getInstanceDetail',
    () =>
      invokeDesktopCommand<StudioInstanceDetailRecord | null>(
        DESKTOP_COMMANDS.studioGetInstanceDetail,
        { id },
        { operation: 'studio.getInstanceDetail' },
      ),
  );
}

export async function invokeOpenClawGateway(
  instanceId: string,
  request: StudioOpenClawGatewayInvokeRequest,
  options: StudioOpenClawGatewayInvokeOptions = {},
): Promise<unknown> {
  return invokeDesktopCommand<unknown>(
    DESKTOP_COMMANDS.studioInvokeOpenClawGateway,
    { instanceId, request, options },
    { operation: 'studio.invokeOpenClawGateway' },
  );
}

export async function studioCreateInstance(
  input: StudioCreateInstanceInput,
): Promise<StudioInstanceRecord> {
  return runDesktopOnly(
    'studio.createInstance',
    () =>
      invokeDesktopCommand<StudioInstanceRecord>(
        DESKTOP_COMMANDS.studioCreateInstance,
        { input },
        { operation: 'studio.createInstance' },
      ),
  );
}

export async function studioUpdateInstance(
  id: string,
  input: StudioUpdateInstanceInput,
): Promise<StudioInstanceRecord> {
  return runDesktopOnly(
    'studio.updateInstance',
    () =>
      invokeDesktopCommand<StudioInstanceRecord>(
        DESKTOP_COMMANDS.studioUpdateInstance,
        { id, input },
        { operation: 'studio.updateInstance' },
      ),
  );
}

export async function studioDeleteInstance(id: string): Promise<boolean> {
  return runDesktopOnly(
    'studio.deleteInstance',
    () =>
      invokeDesktopCommand<boolean>(DESKTOP_COMMANDS.studioDeleteInstance, { id }, {
        operation: 'studio.deleteInstance',
      }),
  );
}

export async function studioStartInstance(
  id: string,
): Promise<StudioInstanceRecord | null> {
  return runDesktopOnly(
    'studio.startInstance',
    () =>
      invokeDesktopCommand<StudioInstanceRecord | null>(
        DESKTOP_COMMANDS.studioStartInstance,
        { id },
        { operation: 'studio.startInstance' },
      ),
  );
}

export async function studioStopInstance(
  id: string,
): Promise<StudioInstanceRecord | null> {
  return runDesktopOnly(
    'studio.stopInstance',
    () =>
      invokeDesktopCommand<StudioInstanceRecord | null>(
        DESKTOP_COMMANDS.studioStopInstance,
        { id },
        { operation: 'studio.stopInstance' },
      ),
  );
}

export async function studioRestartInstance(
  id: string,
): Promise<StudioInstanceRecord | null> {
  return runDesktopOnly(
    'studio.restartInstance',
    () =>
      invokeDesktopCommand<StudioInstanceRecord | null>(
        DESKTOP_COMMANDS.studioRestartInstance,
        { id },
        { operation: 'studio.restartInstance' },
      ),
  );
}

export async function studioGetInstanceConfig(
  id: string,
): Promise<StudioInstanceConfig | null> {
  return runDesktopOnly(
    'studio.getInstanceConfig',
    () =>
      invokeDesktopCommand<StudioInstanceConfig | null>(
        DESKTOP_COMMANDS.studioGetInstanceConfig,
        { id },
        { operation: 'studio.getInstanceConfig' },
      ),
  );
}

export async function studioUpdateInstanceConfig(
  id: string,
  config: StudioInstanceConfig,
): Promise<StudioInstanceConfig | null> {
  return runDesktopOnly(
    'studio.updateInstanceConfig',
    () =>
      invokeDesktopCommand<StudioInstanceConfig | null>(
        DESKTOP_COMMANDS.studioUpdateInstanceConfig,
        { id, config },
        { operation: 'studio.updateInstanceConfig' },
      ),
  );
}

export async function studioGetInstanceLogs(id: string): Promise<string> {
  return runDesktopOnly(
    'studio.getInstanceLogs',
    () =>
      invokeDesktopCommand<string>(DESKTOP_COMMANDS.studioGetInstanceLogs, { id }, {
        operation: 'studio.getInstanceLogs',
      }),
  );
}

export async function studioCreateInstanceTask(
  instanceId: string,
  payload: StudioInstanceTaskMutationPayload,
): Promise<void> {
  await runDesktopOnly(
    'studio.createInstanceTask',
    () =>
      invokeDesktopCommand<void>(
        DESKTOP_COMMANDS.studioCreateInstanceTask,
        { instanceId, payload },
        { operation: 'studio.createInstanceTask' },
      ),
  );
}

export async function studioUpdateInstanceTask(
  instanceId: string,
  taskId: string,
  payload: StudioInstanceTaskMutationPayload,
): Promise<void> {
  await runDesktopOnly(
    'studio.updateInstanceTask',
    () =>
      invokeDesktopCommand<void>(
        DESKTOP_COMMANDS.studioUpdateInstanceTask,
        { instanceId, taskId, payload },
        { operation: 'studio.updateInstanceTask' },
      ),
  );
}

export async function studioUpdateInstanceFileContent(
  instanceId: string,
  fileId: string,
  content: string,
): Promise<boolean> {
  return runDesktopOnly(
    'studio.updateInstanceFileContent',
    () =>
      invokeDesktopCommand<boolean>(
        DESKTOP_COMMANDS.studioUpdateInstanceFileContent,
        { instanceId, fileId, content },
        { operation: 'studio.updateInstanceFileContent' },
      ),
  );
}

export async function studioUpdateInstanceLlmProviderConfig(
  instanceId: string,
  providerId: string,
  update: StudioUpdateInstanceLlmProviderConfigInput,
): Promise<boolean> {
  return runDesktopOnly(
    'studio.updateInstanceLlmProviderConfig',
    () =>
      invokeDesktopCommand<boolean>(
        DESKTOP_COMMANDS.studioUpdateInstanceLlmProviderConfig,
        { instanceId, providerId, update },
        { operation: 'studio.updateInstanceLlmProviderConfig' },
      ),
  );
}

export async function studioCloneInstanceTask(
  instanceId: string,
  taskId: string,
  name?: string,
): Promise<void> {
  await runDesktopOnly(
    'studio.cloneInstanceTask',
    () =>
      invokeDesktopCommand<void>(
        DESKTOP_COMMANDS.studioCloneInstanceTask,
        { instanceId, taskId, name },
        { operation: 'studio.cloneInstanceTask' },
      ),
  );
}

export async function studioRunInstanceTaskNow(
  instanceId: string,
  taskId: string,
): Promise<StudioWorkbenchTaskExecutionRecord> {
  return runDesktopOnly(
    'studio.runInstanceTaskNow',
    () =>
      invokeDesktopCommand<StudioWorkbenchTaskExecutionRecord>(
        DESKTOP_COMMANDS.studioRunInstanceTaskNow,
        { instanceId, taskId },
        { operation: 'studio.runInstanceTaskNow' },
      ),
  );
}

export async function studioListInstanceTaskExecutions(
  instanceId: string,
  taskId: string,
): Promise<StudioWorkbenchTaskExecutionRecord[]> {
  return runDesktopOnly(
    'studio.listInstanceTaskExecutions',
    () =>
      invokeDesktopCommand<StudioWorkbenchTaskExecutionRecord[]>(
        DESKTOP_COMMANDS.studioListInstanceTaskExecutions,
        { instanceId, taskId },
        { operation: 'studio.listInstanceTaskExecutions' },
      ),
  );
}

export async function studioUpdateInstanceTaskStatus(
  instanceId: string,
  taskId: string,
  status: 'active' | 'paused',
): Promise<void> {
  await runDesktopOnly(
    'studio.updateInstanceTaskStatus',
    () =>
      invokeDesktopCommand<void>(
        DESKTOP_COMMANDS.studioUpdateInstanceTaskStatus,
        { instanceId, taskId, status },
        { operation: 'studio.updateInstanceTaskStatus' },
      ),
  );
}

export async function studioDeleteInstanceTask(
  instanceId: string,
  taskId: string,
): Promise<boolean> {
  return runDesktopOnly(
    'studio.deleteInstanceTask',
    () =>
      invokeDesktopCommand<boolean>(
        DESKTOP_COMMANDS.studioDeleteInstanceTask,
        { instanceId, taskId },
        { operation: 'studio.deleteInstanceTask' },
      ),
  );
}

export async function studioListConversations(
  instanceId: string,
): Promise<StudioConversationRecord[]> {
  return runDesktopOnly(
    'studio.listConversations',
    () =>
      invokeDesktopCommand<StudioConversationRecord[]>(
        DESKTOP_COMMANDS.studioListConversations,
        { instanceId },
        { operation: 'studio.listConversations' },
      ),
  );
}

export async function studioPutConversation(
  record: StudioConversationRecord,
): Promise<StudioConversationRecord> {
  return runDesktopOnly(
    'studio.putConversation',
    () =>
      invokeDesktopCommand<StudioConversationRecord>(
        DESKTOP_COMMANDS.studioPutConversation,
        { record },
        { operation: 'studio.putConversation' },
      ),
  );
}

export async function studioDeleteConversation(id: string): Promise<boolean> {
  return runDesktopOnly(
    'studio.deleteConversation',
    () =>
      invokeDesktopCommand<boolean>(DESKTOP_COMMANDS.studioDeleteConversation, { id }, {
        operation: 'studio.deleteConversation',
      }),
  );
}

export async function listRollouts(): Promise<ManageRolloutListResult> {
  return runDesktopOnly(
    'manage.listRollouts',
    () =>
      invokeDesktopCommand<ManageRolloutListResult>(
        DESKTOP_COMMANDS.listRollouts,
        undefined,
        { operation: 'manage.listRollouts' },
      ),
  );
}

export async function previewRollout(
  input: PreviewRolloutRequest,
): Promise<ManageRolloutPreview> {
  return runDesktopOnly(
    'manage.previewRollout',
    () =>
      invokeDesktopCommand<ManageRolloutPreview>(
        DESKTOP_COMMANDS.previewRollout,
        { input },
        { operation: 'manage.previewRollout' },
      ),
  );
}

export async function startRollout(rolloutId: string): Promise<ManageRolloutRecord> {
  return runDesktopOnly(
    'manage.startRollout',
    () =>
      invokeDesktopCommand<ManageRolloutRecord>(
        DESKTOP_COMMANDS.startRollout,
        { rolloutId },
        { operation: 'manage.startRollout' },
      ),
  );
}

export async function getHostPlatformStatus(): Promise<HostPlatformStatusRecord> {
  return runDesktopOnly(
    'internal.getHostPlatformStatus',
    () =>
      invokeDesktopCommand<HostPlatformStatusRecord>(
        DESKTOP_COMMANDS.getHostPlatformStatus,
        undefined,
        { operation: 'internal.getHostPlatformStatus' },
      ),
  );
}

export async function listNodeSessions(): Promise<InternalNodeSessionRecord[]> {
  return runDesktopOnly(
    'internal.listNodeSessions',
    () =>
      invokeDesktopCommand<InternalNodeSessionRecord[]>(
        DESKTOP_COMMANDS.listNodeSessions,
        undefined,
        { operation: 'internal.listNodeSessions' },
      ),
  );
}

export async function storageGetText(
  request: StorageGetTextRequest,
): Promise<StorageGetTextResult> {
  return runDesktopOnly(
    'storage.getText',
    () =>
      invokeDesktopCommand<StorageGetTextResult>(
        DESKTOP_COMMANDS.storageGetText,
        { request },
        { operation: 'storage.getText' },
      ),
  );
}

export async function storagePutText(
  request: StoragePutTextRequest,
): Promise<StoragePutTextResult> {
  return runDesktopOnly(
    'storage.putText',
    () =>
      invokeDesktopCommand<StoragePutTextResult>(
        DESKTOP_COMMANDS.storagePutText,
        { request },
        { operation: 'storage.putText' },
      ),
  );
}

export async function storageDelete(
  request: StorageDeleteRequest,
): Promise<StorageDeleteResult> {
  return runDesktopOnly(
    'storage.delete',
    () =>
      invokeDesktopCommand<StorageDeleteResult>(
        DESKTOP_COMMANDS.storageDelete,
        { request },
        { operation: 'storage.delete' },
      ),
  );
}

export async function storageListKeys(
  request: StorageListKeysRequest = {},
): Promise<StorageListKeysResult> {
  return runDesktopOnly(
    'storage.listKeys',
    () =>
      invokeDesktopCommand<StorageListKeysResult>(
        DESKTOP_COMMANDS.storageListKeys,
        { request },
        { operation: 'storage.listKeys' },
      ),
  );
}

export async function listDirectory(path = ''): Promise<DesktopFileEntry[]> {
  return runDesktopOnly(
    'filesystem.listDirectory',
    () =>
      invokeDesktopCommand<DesktopFileEntry[]>(
        DESKTOP_COMMANDS.listDirectory,
        { path },
        { operation: 'filesystem.listDirectory' },
      ),
  );
}

export async function pathExists(path: string): Promise<boolean> {
  return runDesktopOnly(
    'filesystem.pathExists',
    () =>
      invokeDesktopCommand<boolean>(DESKTOP_COMMANDS.pathExists, { path }, {
        operation: 'filesystem.pathExists',
      }),
  );
}

export async function pathExistsForUserTooling(path: string): Promise<boolean> {
  return runDesktopOnly(
    'filesystem.pathExistsForUserTooling',
    () =>
      invokeDesktopCommand<boolean>(DESKTOP_COMMANDS.pathExistsForUserTooling, { path }, {
        operation: 'filesystem.pathExistsForUserTooling',
      }),
  );
}

export async function getPathInfo(path: string): Promise<DesktopPathInfo> {
  return runDesktopOnly(
    'filesystem.getPathInfo',
    () =>
      invokeDesktopCommand<DesktopPathInfo>(DESKTOP_COMMANDS.getPathInfo, { path }, {
        operation: 'filesystem.getPathInfo',
      }),
  );
}

export async function createDirectory(path: string): Promise<void> {
  await runDesktopOnly(
    'filesystem.createDirectory',
    () =>
      invokeDesktopCommand<void>(DESKTOP_COMMANDS.createDirectory, { path }, {
        operation: 'filesystem.createDirectory',
      }),
  );
}

export async function removePath(path: string): Promise<void> {
  await runDesktopOnly(
    'filesystem.removePath',
    () =>
      invokeDesktopCommand<void>(DESKTOP_COMMANDS.removePath, { path }, {
        operation: 'filesystem.removePath',
      }),
  );
}

export async function copyPath(
  sourcePath: string,
  destinationPath: string,
): Promise<void> {
  await runDesktopOnly(
    'filesystem.copyPath',
    () =>
      invokeDesktopCommand<void>(
        DESKTOP_COMMANDS.copyPath,
        { sourcePath, destinationPath },
        { operation: 'filesystem.copyPath' },
      ),
  );
}

export async function movePath(
  sourcePath: string,
  destinationPath: string,
): Promise<void> {
  await runDesktopOnly(
    'filesystem.movePath',
    () =>
      invokeDesktopCommand<void>(
        DESKTOP_COMMANDS.movePath,
        { sourcePath, destinationPath },
        { operation: 'filesystem.movePath' },
      ),
  );
}

export async function readBinaryFile(path: string): Promise<Uint8Array> {
  return runDesktopOnly(
    'filesystem.readBinaryFile',
    async () => {
      const bytes = await invokeDesktopCommand<number[]>(
        DESKTOP_COMMANDS.readBinaryFile,
        { path },
        { operation: 'filesystem.readBinaryFile' },
      );
      return Uint8Array.from(bytes);
    },
  );
}

export async function writeBinaryFile(
  path: string,
  content: Uint8Array | number[],
): Promise<void> {
  const bytes = content instanceof Uint8Array ? Array.from(content) : content;
  await runDesktopOnly(
    'filesystem.writeBinaryFile',
    () =>
      invokeDesktopCommand<void>(
        DESKTOP_COMMANDS.writeBinaryFile,
        { path, content: bytes },
        { operation: 'filesystem.writeBinaryFile' },
      ),
  );
}

export async function readTextFile(path: string): Promise<string> {
  return runDesktopOnly(
    'filesystem.readTextFile',
    () =>
      invokeDesktopCommand<string>(DESKTOP_COMMANDS.readTextFile, { path }, {
        operation: 'filesystem.readTextFile',
      }),
  );
}

export async function readTextFileForUserTooling(path: string): Promise<string> {
  return runDesktopOnly(
    'filesystem.readTextFileForUserTooling',
    () =>
      invokeDesktopCommand<string>(DESKTOP_COMMANDS.readTextFileForUserTooling, { path }, {
        operation: 'filesystem.readTextFileForUserTooling',
      }),
  );
}

export async function writeTextFile(path: string, content: string): Promise<void> {
  await runDesktopOnly(
    'filesystem.writeTextFile',
    () =>
      invokeDesktopCommand<void>(DESKTOP_COMMANDS.writeTextFile, { path, content }, {
        operation: 'filesystem.writeTextFile',
      }),
  );
}

export async function getDeviceId(): Promise<string> {
  return runDesktopOnly(
    'app.getDeviceId',
    () =>
      invokeDesktopCommand<string>(DESKTOP_COMMANDS.getDeviceId, undefined, {
        operation: 'app.getDeviceId',
      }),
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

export function supportsNativeScreenshot(): boolean {
  return isTauriRuntime();
}

export async function captureScreenshot(): Promise<PlatformCapturedScreenshot | null> {
  return runDesktopOrFallback(
    'shell.captureScreenshot',
    async () => {
      const payload = await invokeDesktopCommand<DesktopCapturedScreenshotPayload>(
        DESKTOP_COMMANDS.captureScreenshot,
        undefined,
        {
          operation: 'shell.captureScreenshot',
        },
      );

      return {
        ...payload,
        bytes: Uint8Array.from(payload.bytes ?? []),
      };
    },
    async () => null,
  );
}

export async function fetchRemoteUrl(url: string): Promise<PlatformFetchedRemoteUrl> {
  return runDesktopOrFallback(
    'shell.fetchRemoteUrl',
    async () => {
      const payload = await invokeDesktopCommand<DesktopFetchedRemoteUrlPayload>(
        DESKTOP_COMMANDS.fetchRemoteUrl,
        { url },
        {
          operation: 'shell.fetchRemoteUrl',
        },
      );

      return {
        ...payload,
        bytes: Uint8Array.from(payload.bytes ?? []),
      };
    },
    () => webPlatform.fetchRemoteUrl(url),
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

export async function listHubInstallCatalog(
  query?: HubInstallCatalogQuery,
): Promise<HubInstallCatalogEntry[]> {
  return invokeDesktopCommand<HubInstallCatalogEntry[]>(
    DESKTOP_COMMANDS.listHubInstallCatalog,
    { query },
    { operation: 'installer.listHubInstallCatalog' },
  );
}

export async function runHubDependencyInstall(
  request: HubInstallDependencyRequest,
): Promise<HubInstallDependencyResult> {
  return invokeDesktopCommand<HubInstallDependencyResult>(
    DESKTOP_COMMANDS.runHubDependencyInstall,
    { request },
    { operation: 'installer.runHubDependencyInstall' },
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
    getStatus: getDesktopKernelStatus,
    ensureRunning: ensureDesktopKernelRunning,
    restart: restartDesktopKernel,
    testLocalAiProxyRoute,
    listLocalAiProxyRequestLogs,
    listLocalAiProxyMessageLogs,
    updateLocalAiProxyMessageCapture,
    getStorageInfo: getDesktopStorageInfo,
  },
  storage: {
    getInfo: getDesktopStorageInfo,
    getText: storageGetText,
    putText: storagePutText,
    delete: storageDelete,
    listKeys: storageListKeys,
  },
  studio: {
    listInstances: studioListInstances,
    getInstance: studioGetInstance,
    getInstanceDetail: studioGetInstanceDetail,
    createInstance: studioCreateInstance,
    updateInstance: studioUpdateInstance,
    deleteInstance: studioDeleteInstance,
    startInstance: studioStartInstance,
    stopInstance: studioStopInstance,
    restartInstance: studioRestartInstance,
    getInstanceConfig: studioGetInstanceConfig,
    updateInstanceConfig: studioUpdateInstanceConfig,
    getInstanceLogs: studioGetInstanceLogs,
    createInstanceTask: studioCreateInstanceTask,
    updateInstanceTask: studioUpdateInstanceTask,
    updateInstanceFileContent: studioUpdateInstanceFileContent,
    updateInstanceLlmProviderConfig: studioUpdateInstanceLlmProviderConfig,
    cloneInstanceTask: studioCloneInstanceTask,
    runInstanceTaskNow: studioRunInstanceTaskNow,
    listInstanceTaskExecutions: studioListInstanceTaskExecutions,
    updateInstanceTaskStatus: studioUpdateInstanceTaskStatus,
    deleteInstanceTask: studioDeleteInstanceTask,
    listConversations: studioListConversations,
    putConversation: studioPutConversation,
    deleteConversation: studioDeleteConversation,
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
    fetchRemoteUrl,
    captureScreenshot,
    supportsNativeScreenshot,
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
    listHubInstallCatalog,
    inspectHubInstall,
    runHubDependencyInstall,
    runHubInstall,
    runHubUninstall,
    subscribeHubInstallProgress,
  },
  manage: {
    listRollouts: () => listRollouts(),
    previewRollout: (input) => previewRollout(input),
    startRollout: (rolloutId) => startRollout(rolloutId),
  },
  internal: {
    getHostPlatformStatus: () => getHostPlatformStatus(),
    listNodeSessions: () => listNodeSessions(),
  },
  runtime: {
    getInfo: getRuntimeInfo,
    setAppLanguage,
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
      supportsNativeScreenshot: () => supportsNativeScreenshot(),
      captureScreenshot: () => captureScreenshot(),
      fetchRemoteUrl: (url) => fetchRemoteUrl(url),
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
      pathExistsForUserTooling: (path) => pathExistsForUserTooling(path),
      getPathInfo: (path) => getPathInfo(path),
      createDirectory: (path) => createDirectory(path),
      removePath: (path) => removePath(path),
      copyPath: (sourcePath, destinationPath) => copyPath(sourcePath, destinationPath),
      movePath: (sourcePath, destinationPath) => movePath(sourcePath, destinationPath),
      readBinaryFile: (path) => readBinaryFile(path),
      writeBinaryFile: (path, content) => writeBinaryFile(path, content),
      readFile: (path) => readTextFile(path),
      readFileForUserTooling: (path) => readTextFileForUserTooling(path),
      writeFile: (path, content) => writeTextFile(path, content),
    },
    kernel: {
      getInfo: () => getDesktopKernelInfo(),
      getStorageInfo: () => getDesktopStorageInfo(),
      getStatus: () => getDesktopKernelStatus(),
      ensureRunning: () => ensureDesktopKernelRunning(),
      restart: () => restartDesktopKernel(),
      testLocalAiProxyRoute: (routeId) => testLocalAiProxyRoute(routeId),
      listLocalAiProxyRequestLogs: (query) => listLocalAiProxyRequestLogs(query),
      listLocalAiProxyMessageLogs: (query) => listLocalAiProxyMessageLogs(query),
      updateLocalAiProxyMessageCapture: (enabled) => updateLocalAiProxyMessageCapture(enabled),
    },
    installer: {
      listHubInstallCatalog: (query) => listHubInstallCatalog(query),
      inspectHubInstall: (request) => inspectHubInstall(request),
      runHubDependencyInstall: (request) => runHubDependencyInstall(request),
      runHubInstall: (request) => runHubInstall(request),
      runHubUninstall: (request) => runHubUninstall(request),
      subscribeHubInstallProgress: (listener) => subscribeHubInstallProgress(listener),
    },
    manage: {
      listRollouts: () => listRollouts(),
      previewRollout: (input) => previewRollout(input),
      startRollout: (rolloutId) => startRollout(rolloutId),
    },
    internal: {
      getHostPlatformStatus: () => getHostPlatformStatus(),
      listNodeSessions: () => listNodeSessions(),
    },
    components: {
      listComponents: () => desktopComponentsApi.list(),
      controlComponent: (request) => desktopComponentsApi.control(request.componentId, request.action),
    },
    storage: {
      getStorageInfo: () => getDesktopStorageInfo(),
      getText: (request) => storageGetText(request),
      putText: (request) => storagePutText(request),
      delete: (request) => storageDelete(request),
      listKeys: (request) => storageListKeys(request),
    },
    studio: {
      listInstances: () => studioListInstances(),
      getInstance: (id) => studioGetInstance(id),
      getInstanceDetail: (id) => studioGetInstanceDetail(id),
      invokeOpenClawGateway: (instanceId, request, options) =>
        invokeOpenClawGateway(instanceId, request, options),
      createInstance: (input) => studioCreateInstance(input),
      updateInstance: (id, input) => studioUpdateInstance(id, input),
      deleteInstance: (id) => studioDeleteInstance(id),
      startInstance: (id) => studioStartInstance(id),
      stopInstance: (id) => studioStopInstance(id),
      restartInstance: (id) => studioRestartInstance(id),
      setInstanceStatus: async (id, status) => {
        if (status === 'online') {
          return studioStartInstance(id);
        }

        if (status === 'offline') {
          return studioStopInstance(id);
        }

        return studioUpdateInstance(id, { status });
      },
      getInstanceConfig: (id) => studioGetInstanceConfig(id),
      updateInstanceConfig: (id, config) => studioUpdateInstanceConfig(id, config),
      getInstanceLogs: (id) => studioGetInstanceLogs(id),
      createInstanceTask: (instanceId, payload) =>
        studioCreateInstanceTask(instanceId, payload),
      updateInstanceTask: (instanceId, taskId, payload) =>
        studioUpdateInstanceTask(instanceId, taskId, payload),
      updateInstanceFileContent: (instanceId, fileId, content) =>
        studioUpdateInstanceFileContent(instanceId, fileId, content),
      updateInstanceLlmProviderConfig: (instanceId, providerId, update) =>
        studioUpdateInstanceLlmProviderConfig(instanceId, providerId, update),
      cloneInstanceTask: (instanceId, taskId, name) =>
        studioCloneInstanceTask(instanceId, taskId, name),
      runInstanceTaskNow: (instanceId, taskId) =>
        studioRunInstanceTaskNow(instanceId, taskId),
      listInstanceTaskExecutions: (instanceId, taskId) =>
        studioListInstanceTaskExecutions(instanceId, taskId),
      updateInstanceTaskStatus: (instanceId, taskId, status) =>
        studioUpdateInstanceTaskStatus(instanceId, taskId, status),
      deleteInstanceTask: (instanceId, taskId) =>
        studioDeleteInstanceTask(instanceId, taskId),
      listConversations: (instanceId) => studioListConversations(instanceId),
      putConversation: (record) => studioPutConversation(record),
      deleteConversation: (id) => studioDeleteConversation(id),
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
