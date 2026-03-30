export type * from './platform/index.ts';
export {
  configurePlatformBridge,
  getKernelPlatform,
  getInstallerPlatform,
  getPlatformBridge,
  getRuntimePlatform,
  getStoragePlatform,
  getStudioPlatform,
  kernel,
  platform,
  storage,
  studio,
} from './platform/registry.ts';
export { openExternalUrl } from './platform/openExternalUrl.ts';
export { WebComponentPlatform } from './platform/webComponents.ts';
export { WebKernelPlatform } from './platform/webKernel.ts';
export { WebPlatform } from './platform/web.ts';
export { WebStoragePlatform } from './platform/webStorage.ts';
export { WebStudioPlatform } from './platform/webStudio.ts';
export * from './http/httpClient.ts';
export * from './http/apiClient.ts';
export * from './config/env.ts';
export * from './auth/authSession.ts';
export * from './auth/apiRouterAdminSession.ts';
export * from './i18n/index.ts';
export * from './services/fileDialogService.ts';
export * from './services/apiRouterBootstrapWarmup.ts';
export * from './services/installerService.ts';
export * from './services/authClient.ts';
export * from './services/userClient.ts';
export * from './services/accountClient.ts';
export * from './services/notificationClient.ts';
export * from './services/sdkworkApiRouterAccess.ts';
export * from './services/sdkworkApiRouterAdminClient.ts';
export * from './services/studioMockServiceProxy.ts';
export * from './services/openClawGatewayClient.ts';
export * from './updates/contracts.ts';
export * from './updates/updateClient.ts';
