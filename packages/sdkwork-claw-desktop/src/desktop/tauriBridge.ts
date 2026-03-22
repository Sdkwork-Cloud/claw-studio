import {
  WebPlatform,
  WebStoragePlatform,
  WebStudioPlatform,
  configurePlatformBridge,
} from '@sdkwork/claw-infrastructure';
import type {
  ApiRouterClientInstallRequest,
  ApiRouterClientInstallResult,
  HubInstallCatalogEntry,
  HubInstallCatalogQuery,
  HubInstallDependencyRequest,
  HubInstallDependencyResult,
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
  RuntimeApiRouterAdminBootstrapSession,
  RuntimeApiRouterRuntimeStatus,
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
  StudioConversationRecord,
  StudioCreateInstanceInput,
  StudioInstanceDetailRecord,
  StudioInstanceConfig,
  StudioInstanceRecord,
  StudioInstanceTaskMutationPayload,
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
const webStoragePlatform = new WebStoragePlatform();
const webStudioPlatform = new WebStudioPlatform();

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
export interface DesktopStorageInfo extends RuntimeStorageInfo {}
export interface DesktopApiRouterAdminBootstrapSession
  extends RuntimeApiRouterAdminBootstrapSession {}
export interface DesktopApiRouterRuntimeStatus extends RuntimeApiRouterRuntimeStatus {}

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

export async function studioListInstances(): Promise<StudioInstanceRecord[]> {
  return runDesktopOrFallback(
    'studio.listInstances',
    () =>
      invokeDesktopCommand<StudioInstanceRecord[]>(
        DESKTOP_COMMANDS.studioListInstances,
        undefined,
        { operation: 'studio.listInstances' },
      ),
    () => webStudioPlatform.listInstances(),
  );
}

export async function studioGetInstance(id: string): Promise<StudioInstanceRecord | null> {
  return runDesktopOrFallback(
    'studio.getInstance',
    () =>
      invokeDesktopCommand<StudioInstanceRecord | null>(
        DESKTOP_COMMANDS.studioGetInstance,
        { id },
        { operation: 'studio.getInstance' },
      ),
    () => webStudioPlatform.getInstance(id),
  );
}

export async function studioGetInstanceDetail(
  id: string,
): Promise<StudioInstanceDetailRecord | null> {
  return runDesktopOrFallback(
    'studio.getInstanceDetail',
    () =>
      invokeDesktopCommand<StudioInstanceDetailRecord | null>(
        DESKTOP_COMMANDS.studioGetInstanceDetail,
        { id },
        { operation: 'studio.getInstanceDetail' },
      ),
    () => webStudioPlatform.getInstanceDetail(id),
  );
}

export async function studioCreateInstance(
  input: StudioCreateInstanceInput,
): Promise<StudioInstanceRecord> {
  return runDesktopOrFallback(
    'studio.createInstance',
    () =>
      invokeDesktopCommand<StudioInstanceRecord>(
        DESKTOP_COMMANDS.studioCreateInstance,
        { input },
        { operation: 'studio.createInstance' },
      ),
    () => webStudioPlatform.createInstance(input),
  );
}

export async function studioUpdateInstance(
  id: string,
  input: StudioUpdateInstanceInput,
): Promise<StudioInstanceRecord> {
  return runDesktopOrFallback(
    'studio.updateInstance',
    () =>
      invokeDesktopCommand<StudioInstanceRecord>(
        DESKTOP_COMMANDS.studioUpdateInstance,
        { id, input },
        { operation: 'studio.updateInstance' },
      ),
    () => webStudioPlatform.updateInstance(id, input),
  );
}

export async function studioDeleteInstance(id: string): Promise<boolean> {
  return runDesktopOrFallback(
    'studio.deleteInstance',
    () =>
      invokeDesktopCommand<boolean>(DESKTOP_COMMANDS.studioDeleteInstance, { id }, {
        operation: 'studio.deleteInstance',
      }),
    () => webStudioPlatform.deleteInstance(id),
  );
}

export async function studioStartInstance(
  id: string,
): Promise<StudioInstanceRecord | null> {
  return runDesktopOrFallback(
    'studio.startInstance',
    () =>
      invokeDesktopCommand<StudioInstanceRecord | null>(
        DESKTOP_COMMANDS.studioStartInstance,
        { id },
        { operation: 'studio.startInstance' },
      ),
    () => webStudioPlatform.startInstance(id),
  );
}

export async function studioStopInstance(
  id: string,
): Promise<StudioInstanceRecord | null> {
  return runDesktopOrFallback(
    'studio.stopInstance',
    () =>
      invokeDesktopCommand<StudioInstanceRecord | null>(
        DESKTOP_COMMANDS.studioStopInstance,
        { id },
        { operation: 'studio.stopInstance' },
      ),
    () => webStudioPlatform.stopInstance(id),
  );
}

export async function studioRestartInstance(
  id: string,
): Promise<StudioInstanceRecord | null> {
  return runDesktopOrFallback(
    'studio.restartInstance',
    () =>
      invokeDesktopCommand<StudioInstanceRecord | null>(
        DESKTOP_COMMANDS.studioRestartInstance,
        { id },
        { operation: 'studio.restartInstance' },
      ),
    () => webStudioPlatform.restartInstance(id),
  );
}

export async function studioGetInstanceConfig(
  id: string,
): Promise<StudioInstanceConfig | null> {
  return runDesktopOrFallback(
    'studio.getInstanceConfig',
    () =>
      invokeDesktopCommand<StudioInstanceConfig | null>(
        DESKTOP_COMMANDS.studioGetInstanceConfig,
        { id },
        { operation: 'studio.getInstanceConfig' },
      ),
    () => webStudioPlatform.getInstanceConfig(id),
  );
}

export async function studioUpdateInstanceConfig(
  id: string,
  config: StudioInstanceConfig,
): Promise<StudioInstanceConfig | null> {
  return runDesktopOrFallback(
    'studio.updateInstanceConfig',
    () =>
      invokeDesktopCommand<StudioInstanceConfig | null>(
        DESKTOP_COMMANDS.studioUpdateInstanceConfig,
        { id, config },
        { operation: 'studio.updateInstanceConfig' },
      ),
    () => webStudioPlatform.updateInstanceConfig(id, config),
  );
}

export async function studioGetInstanceLogs(id: string): Promise<string> {
  return runDesktopOrFallback(
    'studio.getInstanceLogs',
    () =>
      invokeDesktopCommand<string>(DESKTOP_COMMANDS.studioGetInstanceLogs, { id }, {
        operation: 'studio.getInstanceLogs',
      }),
    () => webStudioPlatform.getInstanceLogs(id),
  );
}

export async function studioCreateInstanceTask(
  instanceId: string,
  payload: StudioInstanceTaskMutationPayload,
): Promise<void> {
  await runDesktopOrFallback(
    'studio.createInstanceTask',
    () =>
      invokeDesktopCommand<void>(
        DESKTOP_COMMANDS.studioCreateInstanceTask,
        { instanceId, payload },
        { operation: 'studio.createInstanceTask' },
      ),
    () => webStudioPlatform.createInstanceTask(instanceId, payload),
  );
}

export async function studioUpdateInstanceTask(
  instanceId: string,
  taskId: string,
  payload: StudioInstanceTaskMutationPayload,
): Promise<void> {
  await runDesktopOrFallback(
    'studio.updateInstanceTask',
    () =>
      invokeDesktopCommand<void>(
        DESKTOP_COMMANDS.studioUpdateInstanceTask,
        { instanceId, taskId, payload },
        { operation: 'studio.updateInstanceTask' },
      ),
    () => webStudioPlatform.updateInstanceTask(instanceId, taskId, payload),
  );
}

export async function studioCloneInstanceTask(
  instanceId: string,
  taskId: string,
  name?: string,
): Promise<void> {
  await runDesktopOrFallback(
    'studio.cloneInstanceTask',
    () =>
      invokeDesktopCommand<void>(
        DESKTOP_COMMANDS.studioCloneInstanceTask,
        { instanceId, taskId, name },
        { operation: 'studio.cloneInstanceTask' },
      ),
    () => webStudioPlatform.cloneInstanceTask(instanceId, taskId, name),
  );
}

export async function studioRunInstanceTaskNow(
  instanceId: string,
  taskId: string,
): Promise<StudioWorkbenchTaskExecutionRecord> {
  return runDesktopOrFallback(
    'studio.runInstanceTaskNow',
    () =>
      invokeDesktopCommand<StudioWorkbenchTaskExecutionRecord>(
        DESKTOP_COMMANDS.studioRunInstanceTaskNow,
        { instanceId, taskId },
        { operation: 'studio.runInstanceTaskNow' },
      ),
    () => webStudioPlatform.runInstanceTaskNow(instanceId, taskId),
  );
}

export async function studioListInstanceTaskExecutions(
  instanceId: string,
  taskId: string,
): Promise<StudioWorkbenchTaskExecutionRecord[]> {
  return runDesktopOrFallback(
    'studio.listInstanceTaskExecutions',
    () =>
      invokeDesktopCommand<StudioWorkbenchTaskExecutionRecord[]>(
        DESKTOP_COMMANDS.studioListInstanceTaskExecutions,
        { instanceId, taskId },
        { operation: 'studio.listInstanceTaskExecutions' },
      ),
    () => webStudioPlatform.listInstanceTaskExecutions(instanceId, taskId),
  );
}

export async function studioUpdateInstanceTaskStatus(
  instanceId: string,
  taskId: string,
  status: 'active' | 'paused',
): Promise<void> {
  await runDesktopOrFallback(
    'studio.updateInstanceTaskStatus',
    () =>
      invokeDesktopCommand<void>(
        DESKTOP_COMMANDS.studioUpdateInstanceTaskStatus,
        { instanceId, taskId, status },
        { operation: 'studio.updateInstanceTaskStatus' },
      ),
    () => webStudioPlatform.updateInstanceTaskStatus(instanceId, taskId, status),
  );
}

export async function studioDeleteInstanceTask(
  instanceId: string,
  taskId: string,
): Promise<boolean> {
  return runDesktopOrFallback(
    'studio.deleteInstanceTask',
    () =>
      invokeDesktopCommand<boolean>(
        DESKTOP_COMMANDS.studioDeleteInstanceTask,
        { instanceId, taskId },
        { operation: 'studio.deleteInstanceTask' },
      ),
    () => webStudioPlatform.deleteInstanceTask(instanceId, taskId),
  );
}

export async function studioListConversations(
  instanceId: string,
): Promise<StudioConversationRecord[]> {
  return runDesktopOrFallback(
    'studio.listConversations',
    () =>
      invokeDesktopCommand<StudioConversationRecord[]>(
        DESKTOP_COMMANDS.studioListConversations,
        { instanceId },
        { operation: 'studio.listConversations' },
      ),
    () => webStudioPlatform.listConversations(instanceId),
  );
}

export async function studioPutConversation(
  record: StudioConversationRecord,
): Promise<StudioConversationRecord> {
  return runDesktopOrFallback(
    'studio.putConversation',
    () =>
      invokeDesktopCommand<StudioConversationRecord>(
        DESKTOP_COMMANDS.studioPutConversation,
        { record },
        { operation: 'studio.putConversation' },
      ),
    () => webStudioPlatform.putConversation(record),
  );
}

export async function studioDeleteConversation(id: string): Promise<boolean> {
  return runDesktopOrFallback(
    'studio.deleteConversation',
    () =>
      invokeDesktopCommand<boolean>(DESKTOP_COMMANDS.studioDeleteConversation, { id }, {
        operation: 'studio.deleteConversation',
      }),
    () => webStudioPlatform.deleteConversation(id),
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

export async function installApiRouterClientSetup(
  request: ApiRouterClientInstallRequest,
): Promise<ApiRouterClientInstallResult> {
  return invokeDesktopCommand<ApiRouterClientInstallResult>(
    DESKTOP_COMMANDS.installApiRouterClientSetup,
    { request },
    { operation: 'installer.installApiRouterClientSetup' },
  );
}

export async function getApiRouterRuntimeStatus(): Promise<DesktopApiRouterRuntimeStatus | null> {
  return runDesktopOrFallback(
    'runtime.getApiRouterRuntimeStatus',
    () =>
      invokeDesktopCommand<DesktopApiRouterRuntimeStatus>(
        DESKTOP_COMMANDS.getApiRouterRuntimeStatus,
        undefined,
        { operation: 'runtime.getApiRouterRuntimeStatus' },
      ),
    async () => null,
  );
}

export async function getApiRouterAdminBootstrapSession(): Promise<DesktopApiRouterAdminBootstrapSession | null> {
  return runDesktopOrFallback(
    'runtime.getApiRouterAdminBootstrapSession',
    () =>
      invokeDesktopCommand<DesktopApiRouterAdminBootstrapSession>(
        DESKTOP_COMMANDS.getApiRouterAdminBootstrapSession,
        undefined,
        { operation: 'runtime.getApiRouterAdminBootstrapSession' },
      ),
    async () => null,
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
    installApiRouterClientSetup,
  },
  runtime: {
    getInfo: getRuntimeInfo,
    getApiRouterAdminBootstrapSession,
    getApiRouterRuntimeStatus,
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
      listHubInstallCatalog: (query) => listHubInstallCatalog(query),
      inspectHubInstall: (request) => inspectHubInstall(request),
      runHubDependencyInstall: (request) => runHubDependencyInstall(request),
      runHubInstall: (request) => runHubInstall(request),
      runHubUninstall: (request) => runHubUninstall(request),
      subscribeHubInstallProgress: (listener) => subscribeHubInstallProgress(listener),
      installApiRouterClientSetup: (request) => installApiRouterClientSetup(request),
    },
    components: {
      listComponents: () => desktopComponentsApi.list(),
      controlComponent: (request) => desktopComponentsApi.control(request.componentId, request.action),
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
    studio: {
      listInstances: () => studioListInstances(),
      getInstance: (id) => studioGetInstance(id),
      getInstanceDetail: (id) => studioGetInstanceDetail(id),
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
      getApiRouterAdminBootstrapSession: () => getApiRouterAdminBootstrapSession(),
      getApiRouterRuntimeStatus: () => getApiRouterRuntimeStatus(),
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
