import { invoke } from '@tauri-apps/api/core';
import type { InstallScriptRequest } from '@sdkwork/claw-studio-infrastructure';
import { configurePlatformBridge } from '@sdkwork/claw-studio-infrastructure';
import { WebPlatform } from '@sdkwork/claw-studio-infrastructure/platform/web';

const desktopPlatform = new WebPlatform();

type TauriWindow = Window & {
  __TAURI_INTERNALS__?: unknown;
};

export interface DesktopAppInfo {
  name: string;
  version: string;
  target: string;
}

function isTauriRuntime() {
  return typeof window !== 'undefined' && typeof (window as TauriWindow).__TAURI_INTERNALS__ !== 'undefined';
}

export async function getAppInfo(): Promise<DesktopAppInfo | null> {
  if (!isTauriRuntime()) {
    return null;
  }

  return invoke<DesktopAppInfo>('app_info');
}

export function configureDesktopPlatformBridge() {
  configurePlatformBridge({
    platform: {
      getPlatform: () => 'desktop',
      getDeviceId: () => desktopPlatform.getDeviceId(),
      setStorage: (key, value) => desktopPlatform.setStorage(key, value),
      getStorage: (key) => desktopPlatform.getStorage(key),
      copy: (text) => desktopPlatform.copy(text),
      openExternal: (url) => desktopPlatform.openExternal(url),
      selectFile: (options) => desktopPlatform.selectFile(options),
      saveFile: (data, filename) => desktopPlatform.saveFile(data, filename),
      minimizeWindow: () => desktopPlatform.minimizeWindow(),
      maximizeWindow: () => desktopPlatform.maximizeWindow(),
      closeWindow: () => desktopPlatform.closeWindow(),
      readFile: (path) => desktopPlatform.readFile(path),
      writeFile: (path, content) => desktopPlatform.writeFile(path, content),
    },
    installer: {
      executeInstallScript: async ({ command }: InstallScriptRequest) => {
        return invoke<string>('execute_install_script', { command });
      },
    },
    runtime: {
      async getRuntimeInfo() {
        return { platform: 'desktop' as const };
      },
    },
  });
}
