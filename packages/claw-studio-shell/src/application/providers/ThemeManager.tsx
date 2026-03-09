import { useEffect } from 'react';
import { useAppStore } from '@sdkwork/claw-studio-business/stores/useAppStore';

export function ThemeManager() {
  const { themeMode, themeColor, language } = useAppStore();

  useEffect(() => {
    const root = document.documentElement;

    root.setAttribute('data-theme', themeColor);

    if (
      themeMode === 'dark' ||
      (themeMode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
    ) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    root.setAttribute('lang', language);
  }, [themeMode, themeColor, language]);

  return null;
}
