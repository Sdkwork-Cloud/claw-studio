import {
  WebPlatform,
  WebStoragePlatform,
  configurePlatformBridge,
} from '@sdkwork/claw-infrastructure';
import type {
  ApiRouterClientInstallRequest,
  ApiRouterClientInstallResult,
  HubInstallProgressEvent,
  HubInstallRequest,
  HubInstallResult,
  PlatformFileEntry,
  PlatformPathInfo,
  PlatformSaveFileOptions,
  PlatformSelectFileOptions,
  RuntimeAppInfo,
  RuntimeConfigInfo,
  RuntimeDesktopKernelInfo,
  RuntimeEventUnsubscribe,
  RuntimeInfo,
  RuntimeJobUpdateEvent,
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

  if (await currentWindow.isFullscreen()) {
    await currentWindow.setFullscreen(false);
  }

  if (await currentWindow.isMaximized()) {
    await currentWindow.unmaximize();
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

  await currentWindow.close();
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
    runHubInstall,
    subscribeHubInstallProgress,
    installApiRouterClientSetup,
  },
  runtime: {
    getInfo: getRuntimeInfo,
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
      runHubInstall: (request) => runHubInstall(request),
      subscribeHubInstallProgress: (listener) => subscribeHubInstallProgress(listener),
      installApiRouterClientSetup: (request) => installApiRouterClientSetup(request),
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
      submitProcessJob: (profileId) => submitProcessJob(profileId),
      getJob: (id) => getJob(id),
      listJobs: () => listJobs(),
      cancelJob: (id) => cancelJob(id),
      subscribeJobUpdates: (listener) => subscribeJobUpdates(listener),
      subscribeProcessOutput: (listener) => subscribeProcessOutput(listener),
    },
  });
}
