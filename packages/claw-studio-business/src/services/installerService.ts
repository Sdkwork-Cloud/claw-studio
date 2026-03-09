import { getInstallerPlatform } from '@sdkwork/claw-studio-infrastructure';

export const installerService = {
  executeInstallScript: async (command: string): Promise<string> => {
    return getInstallerPlatform().executeInstallScript({ command });
  },
};
