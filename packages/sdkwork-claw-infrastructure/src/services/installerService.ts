import type {
  ApiRouterClientInstallRequest,
  ApiRouterClientInstallResult,
} from '../platform/index.ts';
import { getInstallerPlatform } from '../platform/index.ts';

export const installerService = {
  executeInstallScript: async (command: string): Promise<string> => {
    return getInstallerPlatform().executeInstallScript({ command });
  },
  installApiRouterClientSetup: async (
    request: ApiRouterClientInstallRequest,
  ): Promise<ApiRouterClientInstallResult> => {
    return getInstallerPlatform().installApiRouterClientSetup(request);
  },
};
