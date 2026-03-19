import { getI18n } from 'react-i18next';
import { fileDialogService } from '@sdkwork/claw-infrastructure';
import { localizedText, resolveLocalizedText } from '@sdkwork/claw-i18n';

function localizeTitle(en: string, zh: string) {
  return resolveLocalizedText(localizedText(en, zh), getI18n()?.resolvedLanguage ?? getI18n()?.language);
}

export const installPathService = {
  async selectInstallDirectory(defaultPath?: string): Promise<string | null> {
    return fileDialogService.selectDirectory({
      title: localizeTitle('Select Install Directory', '\u9009\u62e9\u5b89\u88c5\u76ee\u5f55'),
      defaultPath,
    });
  },

  async selectWorkspaceDirectory(defaultPath?: string): Promise<string | null> {
    return fileDialogService.selectDirectory({
      title: localizeTitle('Select Workspace Directory', '\u9009\u62e9\u5de5\u4f5c\u533a\u76ee\u5f55'),
      defaultPath,
    });
  },
};
