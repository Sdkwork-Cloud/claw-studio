export type { PlatformAPI } from './types';
export type { InstallScriptRequest, InstallerPlatformAPI } from './contracts/installer';
export type { RuntimeInfo, RuntimePlatformAPI } from './contracts/runtime';
export { configurePlatformBridge, getInstallerPlatform, getPlatformBridge, getRuntimePlatform, platform } from './registry';
export { WebPlatform } from './web';
