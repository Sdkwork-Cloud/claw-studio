import type {
  ApiRouterClientInstallRequest,
  ApiRouterClientInstallResult,
  HubInstallProgressEvent,
  HubInstallRequest,
  HubInstallResult,
  RuntimeEventUnsubscribe,
} from '../platform/index.ts';
import { getInstallerPlatform } from '../platform/index.ts';

export const installerService = {
  runHubInstall: async (request: HubInstallRequest): Promise<HubInstallResult> => {
    return getInstallerPlatform().runHubInstall(request);
  },
  subscribeHubInstallProgress: async (
    listener: (event: HubInstallProgressEvent) => void,
  ): Promise<RuntimeEventUnsubscribe> => {
    return getInstallerPlatform().subscribeHubInstallProgress(listener);
  },
  installApiRouterClientSetup: async (
    request: ApiRouterClientInstallRequest,
  ): Promise<ApiRouterClientInstallResult> => {
    return getInstallerPlatform().installApiRouterClientSetup(request);
  },
};
