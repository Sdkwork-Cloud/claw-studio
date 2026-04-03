export {
  configurePlatformBridge,
  getInternalPlatform,
  getKernelPlatform,
  getInstallerPlatform,
  getManagePlatform,
  getPlatformBridge,
  getRuntimePlatform,
  getStoragePlatform,
  getStudioPlatform,
  internal,
  installer,
  kernel,
  manage,
  platform,
  runtime,
  storage,
  studio,
} from './platform/registry.ts';
export { openExternalUrl } from './platform/openExternalUrl.ts';
export { WebComponentPlatform } from './platform/webComponents.ts';
export {
  configureServerBrowserPlatformBridge,
  createServerBrowserPlatformBridge,
  readServerBrowserPlatformBridgeConfig,
  SERVER_HOST_MODE_META_NAME,
  SERVER_INTERNAL_BASE_PATH_META_NAME,
  SERVER_MANAGE_BASE_PATH_META_NAME,
} from './platform/serverBrowserBridge.ts';
export { WebInternalPlatform, DEFAULT_INTERNAL_BASE_PATH } from './platform/webInternal.ts';
export { WebKernelPlatform } from './platform/webKernel.ts';
export { WebManagePlatform, DEFAULT_MANAGE_BASE_PATH } from './platform/webManage.ts';
export { WebPlatform } from './platform/web.ts';
export { WebStoragePlatform } from './platform/webStorage.ts';
export { WebStudioPlatform } from './platform/webStudio.ts';
export * from './config/env.ts';
export * from './auth/authSession.ts';
export * from './i18n/index.ts';
export * from './services/fileDialogService.ts';
export * from './services/installerService.ts';
export * from './services/openClawGatewayClient.ts';
export * from './updates/contracts.ts';
export * from './updates/updateClient.ts';
export type * from './platform/index.ts';
