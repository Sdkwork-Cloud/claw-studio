import { fileDialogService } from '@sdkwork/claw-studio-infrastructure';

export const installPathService = {
  async selectInstallDirectory(defaultPath?: string): Promise<string | null> {
    return fileDialogService.selectDirectory({
      title: 'Select Install Directory',
      defaultPath,
    });
  },

  async selectWorkspaceDirectory(defaultPath?: string): Promise<string | null> {
    return fileDialogService.selectDirectory({
      title: 'Select Workspace Directory',
      defaultPath,
    });
  },
};
