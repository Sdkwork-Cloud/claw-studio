import { getInstallerPlatform } from '../platform/index.ts';

export const installerService = {
  executeInstallScript: async (command: string): Promise<string> => {
    return getInstallerPlatform().executeInstallScript({ command });
  },
};
