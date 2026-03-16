import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import {
  WebPlatform,
  WebStoragePlatform,
  configurePlatformBridge,
} from '@sdkwork/claw-infrastructure';
import type {
  InstallScriptRequest,
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

const desktopPlatform = new WebPlatform();
const webStoragePlatform = new WebStoragePlatform();

type TauriWindow = Window & {
  __TAURI_INTERNALS__?: unknown;
};

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

function isTauriRuntime() {
  return typeof window !== 'undefined' && typeof (window as TauriWindow).__TAURI_INTERNALS__ !== 'undefined';
}

function getDesktopWindow() {
  if (!isTauriRuntime()) {
    return null;
  }

  return getCurrentWindow();
}

export async function getAppInfo(): Promise<DesktopAppInfo | null> {
  if (!isTauriRuntime()) {
    return null;
  }

  return invoke<DesktopAppInfo>('app_info');
}

export async function getAppPaths(): Promise<DesktopAppPaths | null> {
  if (!isTauriRuntime()) {
    return null;
  }

  return invoke<DesktopAppPaths>('get_app_paths');
}

export async function getAppConfig(): Promise<DesktopAppConfig | null> {
  if (!isTauriRuntime()) {
    return null;
  }

  return invoke<DesktopAppConfig>('get_app_config');
}

export async function getSystemInfo(): Promise<DesktopSystemInfo | null> {
  if (!isTauriRuntime()) {
    return null;
  }

  return invoke<DesktopSystemInfo>('get_system_info');
}

export async function getDesktopKernelInfo(): Promise<DesktopKernelInfo | null> {
  if (!isTauriRuntime()) {
    return null;
  }

  return invoke<DesktopKernelInfo>('desktop_kernel_info');
}

export async function getDesktopStorageInfo(): Promise<DesktopStorageInfo | null> {
  if (!isTauriRuntime()) {
    return null;
  }

  return invoke<DesktopStorageInfo>('desktop_storage_info');
}

export async function storageGetText(request: StorageGetTextRequest): Promise<StorageGetTextResult> {
  if (!isTauriRuntime()) {
    return webStoragePlatform.getText(request);
  }

  return invoke<StorageGetTextResult>('storage_get_text', { request });
}

export async function storagePutText(request: StoragePutTextRequest): Promise<StoragePutTextResult> {
  if (!isTauriRuntime()) {
    return webStoragePlatform.putText(request);
  }

  return invoke<StoragePutTextResult>('storage_put_text', { request });
}

export async function storageDelete(request: StorageDeleteRequest): Promise<StorageDeleteResult> {
  if (!isTauriRuntime()) {
    return webStoragePlatform.delete(request);
  }

  return invoke<StorageDeleteResult>('storage_delete', { request });
}

export async function storageListKeys(
  request: StorageListKeysRequest = {},
): Promise<StorageListKeysResult> {
  if (!isTauriRuntime()) {
    return webStoragePlatform.listKeys(request);
  }

  return invoke<StorageListKeysResult>('storage_list_keys', { request });
}

export async function listDirectory(path = ''): Promise<DesktopFileEntry[]> {
  if (!isTauriRuntime()) {
    return desktopPlatform.listDirectory(path);
  }

  return invoke<DesktopFileEntry[]>('list_directory', { path });
}

export async function pathExists(path: string): Promise<boolean> {
  if (!isTauriRuntime()) {
    return desktopPlatform.pathExists(path);
  }

  return invoke<boolean>('path_exists', { path });
}

export async function getPathInfo(path: string): Promise<DesktopPathInfo> {
  if (!isTauriRuntime()) {
    return desktopPlatform.getPathInfo(path);
  }

  return invoke<DesktopPathInfo>('get_path_info', { path });
}

export async function createDirectory(path: string): Promise<void> {
  if (!isTauriRuntime()) {
    return desktopPlatform.createDirectory(path);
  }

  await invoke('create_directory', { path });
}

export async function removePath(path: string): Promise<void> {
  if (!isTauriRuntime()) {
    return desktopPlatform.removePath(path);
  }

  await invoke('remove_path', { path });
}

export async function copyPath(sourcePath: string, destinationPath: string): Promise<void> {
  if (!isTauriRuntime()) {
    return desktopPlatform.copyPath(sourcePath, destinationPath);
  }

  await invoke('copy_path', { sourcePath, destinationPath });
}

export async function movePath(sourcePath: string, destinationPath: string): Promise<void> {
  if (!isTauriRuntime()) {
    return desktopPlatform.movePath(sourcePath, destinationPath);
  }

  await invoke('move_path', { sourcePath, destinationPath });
}

export async function readBinaryFile(path: string): Promise<Uint8Array> {
  if (!isTauriRuntime()) {
    return desktopPlatform.readBinaryFile(path);
  }

  const bytes = await invoke<number[]>('read_binary_file', { path });
  return Uint8Array.from(bytes);
}

export async function writeBinaryFile(path: string, content: Uint8Array | number[]): Promise<void> {
  if (!isTauriRuntime()) {
    return desktopPlatform.writeBinaryFile(path, content);
  }

  const bytes = content instanceof Uint8Array ? Array.from(content) : content;
  await invoke('write_binary_file', { path, content: bytes });
}

export async function readTextFile(path: string): Promise<string> {
  if (!isTauriRuntime()) {
    return desktopPlatform.readFile(path);
  }

  return invoke<string>('read_text_file', { path });
}

export async function writeTextFile(path: string, content: string): Promise<void> {
  if (!isTauriRuntime()) {
    return desktopPlatform.writeFile(path, content);
  }

  await invoke('write_text_file', { path, content });
}

export async function getDeviceId(): Promise<string> {
  if (!isTauriRuntime()) {
    return desktopPlatform.getDeviceId();
  }

  return invoke<string>('get_device_id');
}

export async function submitProcessJob(profileId: string): Promise<string> {
  if (!isTauriRuntime()) {
    throw new Error('Desktop runtime process jobs are unavailable outside Tauri.');
  }

  return invoke<string>('job_submit_process', { profileId });
}

export async function getJob(id: string): Promise<DesktopJobUpdateEvent['record']> {
  if (!isTauriRuntime()) {
    throw new Error('Desktop runtime jobs are unavailable outside Tauri.');
  }

  return invoke<DesktopJobUpdateEvent['record']>('job_get', { id });
}

export async function listJobs(): Promise<DesktopJobUpdateEvent['record'][]> {
  if (!isTauriRuntime()) {
    throw new Error('Desktop runtime jobs are unavailable outside Tauri.');
  }

  return invoke<DesktopJobUpdateEvent['record'][]>('job_list');
}

export async function cancelJob(id: string): Promise<DesktopJobUpdateEvent['record']> {
  if (!isTauriRuntime()) {
    throw new Error('Desktop runtime jobs are unavailable outside Tauri.');
  }

  return invoke<DesktopJobUpdateEvent['record']>('job_cancel', { id });
}

export async function subscribeJobUpdates(
  listener: (event: DesktopJobUpdateEvent) => void,
): Promise<RuntimeEventUnsubscribe> {
  if (!isTauriRuntime()) {
    return noopUnsubscribe;
  }

  return listen<DesktopJobUpdateEvent>('job://updated', (event) => {
    listener(event.payload);
  });
}

export async function subscribeProcessOutput(
  listener: (event: DesktopProcessOutputEvent) => void,
): Promise<RuntimeEventUnsubscribe> {
  if (!isTauriRuntime()) {
    return noopUnsubscribe;
  }

  return listen<DesktopProcessOutputEvent>('process://output', (event) => {
    listener(event.payload);
  });
}

export function configureDesktopPlatformBridge() {
  configurePlatformBridge({
    platform: {
      getPlatform: () => 'desktop',
      getDeviceId: () => getDeviceId(),
      setStorage: (key, value) => desktopPlatform.setStorage(key, value),
      getStorage: (key) => desktopPlatform.getStorage(key),
      copy: (text) => desktopPlatform.copy(text),
      openExternal: async (url) => {
        if (!isTauriRuntime()) {
          return desktopPlatform.openExternal(url);
        }

        await invoke<void>('open_external', { url });
      },
      selectFile: async (options?: PlatformSelectFileOptions) => {
        if (!isTauriRuntime()) {
          return desktopPlatform.selectFile(options);
        }

        return invoke<string[]>('select_files', {
          options,
        });
      },
      saveFile: async (data, filename, options?: PlatformSaveFileOptions) => {
        if (!isTauriRuntime()) {
          return desktopPlatform.saveFile(data, filename, options);
        }

        const bytes = Array.from(new Uint8Array(await data.arrayBuffer()));
        await invoke('save_blob_file', {
          filename,
          content: bytes,
          options,
        });
      },
      minimizeWindow: async () => {
        const currentWindow = getDesktopWindow();
        if (!currentWindow) {
          return desktopPlatform.minimizeWindow();
        }

        await currentWindow.minimize();
      },
      maximizeWindow: async () => {
        const currentWindow = getDesktopWindow();
        if (!currentWindow) {
          return desktopPlatform.maximizeWindow();
        }

        if (await currentWindow.isMaximized()) {
          await currentWindow.unmaximize();
          return;
        }

        await currentWindow.maximize();
      },
      closeWindow: async () => {
        const currentWindow = getDesktopWindow();
        if (!currentWindow) {
          return desktopPlatform.closeWindow();
        }

        await currentWindow.close();
      },
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
      executeInstallScript: async ({ command }: InstallScriptRequest) => {
        if (!isTauriRuntime()) {
          throw new Error('Tauri desktop installer execution is unavailable outside the desktop runtime.');
        }

        return invoke<string>('execute_install_script', { command });
      },
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
      async getRuntimeInfo(): Promise<RuntimeInfo> {
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
      },
      submitProcessJob: (profileId) => submitProcessJob(profileId),
      getJob: (id) => getJob(id),
      listJobs: () => listJobs(),
      cancelJob: (id) => cancelJob(id),
      subscribeJobUpdates: (listener) => subscribeJobUpdates(listener),
      subscribeProcessOutput: (listener) => subscribeProcessOutput(listener),
    },
  });
}
