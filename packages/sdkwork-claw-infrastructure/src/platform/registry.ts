import type { InstallerPlatformAPI } from './contracts/installer.ts';
import type { StoragePlatformAPI } from './contracts/storage.ts';
import type { RuntimePlatformAPI } from './contracts/runtime.ts';
import type { PlatformAPI } from './types.ts';
import { WebInstallerPlatform } from './webInstaller.ts';
import { WebPlatform } from './web.ts';
import { WebRuntimePlatform } from './webRuntime.ts';
import { WebStoragePlatform } from './webStorage.ts';

export interface PlatformBridge {
  platform: PlatformAPI;
  installer: InstallerPlatformAPI;
  runtime: RuntimePlatformAPI;
  storage: StoragePlatformAPI;
}

let platformBridge: PlatformBridge = {
  platform: new WebPlatform(),
  installer: new WebInstallerPlatform(),
  runtime: new WebRuntimePlatform(),
  storage: new WebStoragePlatform(),
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

export function getStoragePlatform(): StoragePlatformAPI {
  return platformBridge.storage;
}

export const platform: PlatformAPI = {
  getPlatform: () => platformBridge.platform.getPlatform(),
  getDeviceId: () => platformBridge.platform.getDeviceId(),
  setStorage: (key, value) => platformBridge.platform.setStorage(key, value),
  getStorage: (key) => platformBridge.platform.getStorage(key),
  copy: (text) => platformBridge.platform.copy(text),
  openExternal: (url) => platformBridge.platform.openExternal(url),
  selectFile: (options) => platformBridge.platform.selectFile(options),
  saveFile: (data, filename, options) => platformBridge.platform.saveFile(data, filename, options),
  minimizeWindow: () => platformBridge.platform.minimizeWindow(),
  maximizeWindow: () => platformBridge.platform.maximizeWindow(),
  closeWindow: () => platformBridge.platform.closeWindow(),
  listDirectory: (path) => platformBridge.platform.listDirectory(path),
  pathExists: (path) => platformBridge.platform.pathExists(path),
  getPathInfo: (path) => platformBridge.platform.getPathInfo(path),
  createDirectory: (path) => platformBridge.platform.createDirectory(path),
  removePath: (path) => platformBridge.platform.removePath(path),
  copyPath: (sourcePath, destinationPath) => platformBridge.platform.copyPath(sourcePath, destinationPath),
  movePath: (sourcePath, destinationPath) => platformBridge.platform.movePath(sourcePath, destinationPath),
  readBinaryFile: (path) => platformBridge.platform.readBinaryFile(path),
  writeBinaryFile: (path, content) => platformBridge.platform.writeBinaryFile(path, content),
  readFile: (path) => platformBridge.platform.readFile(path),
  writeFile: (path, content) => platformBridge.platform.writeFile(path, content),
};

export const storage: StoragePlatformAPI = {
  getStorageInfo: () => platformBridge.storage.getStorageInfo(),
  getText: (request) => platformBridge.storage.getText(request),
  putText: (request) => platformBridge.storage.putText(request),
  delete: (request) => platformBridge.storage.delete(request),
  listKeys: (request) => platformBridge.storage.listKeys(request),
};
