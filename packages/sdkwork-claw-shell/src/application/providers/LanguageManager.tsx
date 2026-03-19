import { useEffect } from 'react';
import { useAppStore } from '@sdkwork/claw-core';
import { i18n, normalizeLanguage } from '@sdkwork/claw-i18n';

export function LanguageManager() {
  const language = useAppStore((state) => state.language);

  useEffect(() => {
    const nextLanguage = normalizeLanguage(language);

    document.documentElement.setAttribute('lang', nextLanguage);

    if (normalizeLanguage(i18n.resolvedLanguage ?? i18n.language) !== nextLanguage) {
      void i18n.changeLanguage(nextLanguage);
    }
  }, [language]);

  return null;
}
