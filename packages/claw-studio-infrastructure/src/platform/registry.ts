import type { InstallerPlatformAPI } from './contracts/installer';
import type { RuntimePlatformAPI } from './contracts/runtime';
import type { PlatformAPI } from './types';
import { WebInstallerPlatform } from './webInstaller';
import { WebPlatform } from './web';
import { WebRuntimePlatform } from './webRuntime';

export interface PlatformBridge {
  platform: PlatformAPI;
  installer: InstallerPlatformAPI;
  runtime: RuntimePlatformAPI;
}

let platformBridge: PlatformBridge = {
  platform: new WebPlatform(),
  installer: new WebInstallerPlatform(),
  runtime: new WebRuntimePlatform(),
};

export function configurePlatformBridge(nextBridge: Partial<PlatformBridge>) {
  platformBridge = {
    ...platformBridge,
    ...nextBridge,
  };
}

export function getPlatformBridge(): PlatformBridge {
  return platformBridge;
}

export function getInstallerPlatform(): InstallerPlatformAPI {
  return platformBridge.installer;
}

export function getRuntimePlatform(): RuntimePlatformAPI {
  return platformBridge.runtime;
}

export const platform: PlatformAPI = {
  getPlatform: () => platformBridge.platform.getPlatform(),
  getDeviceId: () => platformBridge.platform.getDeviceId(),
  setStorage: (key, value) => platformBridge.platform.setStorage(key, value),
  getStorage: (key) => platformBridge.platform.getStorage(key),
  copy: (text) => platformBridge.platform.copy(text),
  openExternal: (url) => platformBridge.platform.openExternal(url),
  selectFile: (options) => platformBridge.platform.selectFile(options),
  saveFile: (data, filename) => platformBridge.platform.saveFile(data, filename),
  minimizeWindow: () => platformBridge.platform.minimizeWindow(),
  maximizeWindow: () => platformBridge.platform.maximizeWindow(),
  closeWindow: () => platformBridge.platform.closeWindow(),
  readFile: (path) => platformBridge.platform.readFile(path),
  writeFile: (path, content) => platformBridge.platform.writeFile(path, content),
};
