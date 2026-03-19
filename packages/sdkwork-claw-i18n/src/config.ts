export const SUPPORTED_LANGUAGES = ['en', 'zh'] as const;

export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const DEFAULT_LANGUAGE: AppLanguage = 'en';
export const APP_STORE_STORAGE_KEY = 'claw-studio-app-storage';
export const LANGUAGE_COOKIE_KEY = 'claw_lang';
export const I18N_STORAGE_KEY = 'claw-language';
export const LANGUAGE_QUERY_PARAMETER = 'lang';

export const LANGUAGE_LABELS: Record<AppLanguage, string> = {
  en: 'English',
  zh: 'Simplified Chinese',
};

export const INTL_LOCALES: Record<AppLanguage, string> = {
  en: 'en-US',
  zh: 'zh-CN',
};

export function isSupportedLanguage(value: string | null | undefined): value is AppLanguage {
  return SUPPORTED_LANGUAGES.includes(value as AppLanguage);
}

export function normalizeLanguage(value?: string | null): AppLanguage {
  if (!value) {
    return DEFAULT_LANGUAGE;
  }

  const normalized = value.trim().toLowerCase().replaceAll('_', '-');

  if (normalized.startsWith('zh')) {
    return 'zh';
  }

  if (normalized.startsWith('en')) {
    return 'en';
  }

  if (isSupportedLanguage(normalized)) {
    return normalized;
  }

  return DEFAULT_LANGUAGE;
}

export function getIntlLocale(language?: string | null) {
  return INTL_LOCALES[normalizeLanguage(language)];
}
