import type { ComponentPlatformAPI } from './contracts/components.ts';
import type { InstallerPlatformAPI } from './contracts/installer.ts';
import type { StoragePlatformAPI } from './contracts/storage.ts';
import type { StudioPlatformAPI } from './contracts/studio.ts';
import type { RuntimePlatformAPI } from './contracts/runtime.ts';
import type { PlatformAPI } from './types.ts';
import { WebComponentPlatform } from './webComponents.ts';
import { WebInstallerPlatform } from './webInstaller.ts';
import { WebPlatform } from './web.ts';
import { WebRuntimePlatform } from './webRuntime.ts';
import { WebStoragePlatform } from './webStorage.ts';
import { WebStudioPlatform } from './webStudio.ts';

export interface PlatformBridge {
  platform: PlatformAPI;
  components: ComponentPlatformAPI;
  installer: InstallerPlatformAPI;
  runtime: RuntimePlatformAPI;
  storage: StoragePlatformAPI;
  studio: StudioPlatformAPI;
}

const PLATFORM_BRIDGE_GLOBAL_KEY = Symbol.for('sdkwork.claw.platformBridge');

type GlobalPlatformBridgeState = typeof globalThis & {
  [PLATFORM_BRIDGE_GLOBAL_KEY]?: PlatformBridge;
};

function createDefaultPlatformBridge(): PlatformBridge {
  return {
    platform: new WebPlatform(),
    components: new WebComponentPlatform(),
    installer: new WebInstallerPlatform(),
    runtime: new WebRuntimePlatform(),
    storage: new WebStoragePlatform(),
    studio: new WebStudioPlatform(),
  };
}

function readGlobalPlatformBridge() {
  const globalState = globalThis as GlobalPlatformBridgeState;
  return globalState[PLATFORM_BRIDGE_GLOBAL_KEY] ?? null;
}

function writeGlobalPlatformBridge(nextBridge: PlatformBridge) {
  const globalState = globalThis as GlobalPlatformBridgeState;
  globalState[PLATFORM_BRIDGE_GLOBAL_KEY] = nextBridge;
  return nextBridge;
}

function syncPlatformBridge() {
  const globalBridge = readGlobalPlatformBridge();

  if (globalBridge) {
    platformBridge = globalBridge;
    return globalBridge;
  }

  return writeGlobalPlatformBridge(platformBridge);
}

let platformBridge: PlatformBridge =
  readGlobalPlatformBridge() ?? writeGlobalPlatformBridge(createDefaultPlatformBridge());

export function configurePlatformBridge(nextBridge: Partial<PlatformBridge>) {
  platformBridge = writeGlobalPlatformBridge({
    ...syncPlatformBridge(),
    ...nextBridge,
  });
}

export function getPlatformBridge(): PlatformBridge {
  return syncPlatformBridge();
}

export function getInstallerPlatform(): InstallerPlatformAPI {
  return getPlatformBridge().installer;
}

export function getComponentPlatform(): ComponentPlatformAPI {
  return getPlatformBridge().components;
}

export function getRuntimePlatform(): RuntimePlatformAPI {
  return getPlatformBridge().runtime;
}

export function getStoragePlatform(): StoragePlatformAPI {
  return getPlatformBridge().storage;
}

export function getStudioPlatform(): StudioPlatformAPI {
  return getPlatformBridge().studio;
}

export const platform: PlatformAPI = {
  getPlatform: () => getPlatformBridge().platform.getPlatform(),
  getDeviceId: () => getPlatformBridge().platform.getDeviceId(),
  setStorage: (key, value) => getPlatformBridge().platform.setStorage(key, value),
  getStorage: (key) => getPlatformBridge().platform.getStorage(key),
  copy: (text) => getPlatformBridge().platform.copy(text),
  openExternal: (url) => getPlatformBridge().platform.openExternal(url),
  supportsNativeScreenshot: () => getPlatformBridge().platform.supportsNativeScreenshot(),
  captureScreenshot: () => getPlatformBridge().platform.captureScreenshot(),
  fetchRemoteUrl: (url) => getPlatformBridge().platform.fetchRemoteUrl(url),
  selectFile: (options) => getPlatformBridge().platform.selectFile(options),
  saveFile: (data, filename, options) => getPlatformBridge().platform.saveFile(data, filename, options),
  minimizeWindow: () => getPlatformBridge().platform.minimizeWindow(),
  maximizeWindow: () => getPlatformBridge().platform.maximizeWindow(),
  restoreWindow: () => getPlatformBridge().platform.restoreWindow(),
  isWindowMaximized: () => getPlatformBridge().platform.isWindowMaximized(),
  subscribeWindowMaximized: (listener) =>
    getPlatformBridge().platform.subscribeWindowMaximized(listener),
  closeWindow: () => getPlatformBridge().platform.closeWindow(),
  listDirectory: (path) => getPlatformBridge().platform.listDirectory(path),
  pathExists: (path) => getPlatformBridge().platform.pathExists(path),
  getPathInfo: (path) => getPlatformBridge().platform.getPathInfo(path),
  createDirectory: (path) => getPlatformBridge().platform.createDirectory(path),
  removePath: (path) => getPlatformBridge().platform.removePath(path),
  copyPath: (sourcePath, destinationPath) => getPlatformBridge().platform.copyPath(sourcePath, destinationPath),
  movePath: (sourcePath, destinationPath) => getPlatformBridge().platform.movePath(sourcePath, destinationPath),
  readBinaryFile: (path) => getPlatformBridge().platform.readBinaryFile(path),
  writeBinaryFile: (path, content) => getPlatformBridge().platform.writeBinaryFile(path, content),
  readFile: (path) => getPlatformBridge().platform.readFile(path),
  writeFile: (path, content) => getPlatformBridge().platform.writeFile(path, content),
};

export const storage: StoragePlatformAPI = {
  getStorageInfo: () => getPlatformBridge().storage.getStorageInfo(),
  getText: (request) => getPlatformBridge().storage.getText(request),
  putText: (request) => getPlatformBridge().storage.putText(request),
  delete: (request) => getPlatformBridge().storage.delete(request),
  listKeys: (request) => getPlatformBridge().storage.listKeys(request),
};

export const studio: StudioPlatformAPI = {
  listInstances: () => getPlatformBridge().studio.listInstances(),
  getInstance: (id) => getPlatformBridge().studio.getInstance(id),
  getInstanceDetail: (id) => getPlatformBridge().studio.getInstanceDetail(id),
  createInstance: (input) => getPlatformBridge().studio.createInstance(input),
  updateInstance: (id, input) => getPlatformBridge().studio.updateInstance(id, input),
  deleteInstance: (id) => getPlatformBridge().studio.deleteInstance(id),
  startInstance: (id) => getPlatformBridge().studio.startInstance(id),
  stopInstance: (id) => getPlatformBridge().studio.stopInstance(id),
  restartInstance: (id) => getPlatformBridge().studio.restartInstance(id),
  setInstanceStatus: (id, status) => getPlatformBridge().studio.setInstanceStatus(id, status),
  getInstanceConfig: (id) => getPlatformBridge().studio.getInstanceConfig(id),
  updateInstanceConfig: (id, config) => getPlatformBridge().studio.updateInstanceConfig(id, config),
  getInstanceLogs: (id) => getPlatformBridge().studio.getInstanceLogs(id),
  createInstanceTask: (instanceId, payload) =>
    getPlatformBridge().studio.createInstanceTask(instanceId, payload),
  updateInstanceTask: (instanceId, taskId, payload) =>
    getPlatformBridge().studio.updateInstanceTask(instanceId, taskId, payload),
  updateInstanceFileContent: (instanceId, fileId, content) =>
    getPlatformBridge().studio.updateInstanceFileContent(instanceId, fileId, content),
  updateInstanceLlmProviderConfig: (instanceId, providerId, update) =>
    getPlatformBridge().studio.updateInstanceLlmProviderConfig(instanceId, providerId, update),
  cloneInstanceTask: (instanceId, taskId, name) =>
    getPlatformBridge().studio.cloneInstanceTask(instanceId, taskId, name),
  runInstanceTaskNow: (instanceId, taskId) =>
    getPlatformBridge().studio.runInstanceTaskNow(instanceId, taskId),
  listInstanceTaskExecutions: (instanceId, taskId) =>
    getPlatformBridge().studio.listInstanceTaskExecutions(instanceId, taskId),
  updateInstanceTaskStatus: (instanceId, taskId, status) =>
    getPlatformBridge().studio.updateInstanceTaskStatus(instanceId, taskId, status),
  deleteInstanceTask: (instanceId, taskId) =>
    getPlatformBridge().studio.deleteInstanceTask(instanceId, taskId),
  listConversations: (instanceId) => getPlatformBridge().studio.listConversations(instanceId),
  putConversation: (record) => getPlatformBridge().studio.putConversation(record),
  deleteConversation: (id) => getPlatformBridge().studio.deleteConversation(id),
};

export const components: ComponentPlatformAPI = {
  listComponents: () => getPlatformBridge().components.listComponents(),
  controlComponent: (request) => getPlatformBridge().components.controlComponent(request),
};
