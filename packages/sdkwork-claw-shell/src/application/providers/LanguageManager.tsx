import { useEffect } from 'react';
import { useAppStore, type LanguagePreference } from '@sdkwork/claw-core';
import { i18n, normalizeLanguage } from '@sdkwork/claw-i18n';

interface LanguageManagerProps {
  onLanguagePreferenceChange?: (languagePreference: LanguagePreference) => void;
}

export function LanguageManager({ onLanguagePreferenceChange }: LanguageManagerProps) {
  const language = useAppStore((state) => state.language);
  const languagePreference = useAppStore((state) => state.languagePreference);

  useEffect(() => {
    const nextLanguage = normalizeLanguage(language);

    document.documentElement.setAttribute('lang', nextLanguage);

    if (normalizeLanguage(i18n.resolvedLanguage ?? i18n.language) !== nextLanguage) {
      void i18n.changeLanguage(nextLanguage);
    }
  }, [language]);

  useEffect(() => {
    onLanguagePreferenceChange?.(languagePreference);
  }, [languagePreference, onLanguagePreferenceChange]);

  return null;
}
