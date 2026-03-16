import { useEffect } from 'react';
import { useAppStore } from '@sdkwork/claw-core';
import { i18n } from '@sdkwork/claw-i18n';

export function ThemeManager() {
  const { themeMode, themeColor, language } = useAppStore();

  useEffect(() => {
    const root = document.documentElement;

    const applyTheme = () => {
      root.setAttribute('data-theme', themeColor);
      root.setAttribute('lang', language);
      void i18n.changeLanguage(language);

      if (
        themeMode === 'dark' ||
        (themeMode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
      ) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    };

    applyTheme();

    if (themeMode === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => applyTheme();
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [language, themeColor, themeMode]);

  return null;
}
