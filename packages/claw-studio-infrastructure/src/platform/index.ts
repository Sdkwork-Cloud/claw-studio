export type {
  PlatformAPI,
  PlatformDialogFilter,
  PlatformFileEntry,
  PlatformPathInfo,
  PlatformSaveFileOptions,
  PlatformSelectFileOptions,
} from './types';
export type { InstallScriptRequest, InstallerPlatformAPI } from './contracts/installer';
export type {
  RuntimeAppInfo,
  RuntimeConfigInfo,
  RuntimeInfo,
  RuntimePathsInfo,
  RuntimePlatformAPI,
  RuntimeSystemInfo,
} from './contracts/runtime';
export { configurePlatformBridge, getInstallerPlatform, getPlatformBridge, getRuntimePlatform, platform } from './registry';
export { WebPlatform } from './web';
