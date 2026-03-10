import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import type {
  InstallScriptRequest,
  PlatformSaveFileOptions,
  PlatformSelectFileOptions,
  PlatformFileEntry,
  PlatformPathInfo,
  RuntimeAppInfo,
  RuntimeConfigInfo,
  RuntimeInfo,
  RuntimePathsInfo,
  RuntimeSystemInfo,
} from '@sdkwork/claw-studio-infrastructure';
import { configurePlatformBridge } from '@sdkwork/claw-studio-infrastructure';
import { WebPlatform } from '@sdkwork/claw-studio-infrastructure/platform/web';

const desktopPlatform = new WebPlatform();

type TauriWindow = Window & {
  __TAURI_INTERNALS__?: unknown;
};

export interface DesktopAppInfo extends RuntimeAppInfo {}
export interface DesktopAppPaths extends RuntimePathsInfo {}
export interface DesktopAppConfig extends RuntimeConfigInfo {}
export interface DesktopSystemInfo extends RuntimeSystemInfo {}
export interface DesktopFileEntry extends PlatformFileEntry {}
export interface DesktopPathInfo extends PlatformPathInfo {}

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
        void command;
        throw new Error('Desktop installer runtime is not enabled in the base Tauri foundation.');
      },
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
    },
  });
}
