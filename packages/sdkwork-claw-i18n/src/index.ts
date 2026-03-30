import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json' with { type: 'json' };
import zh from './locales/zh.json' with { type: 'json' };
import {
  DEFAULT_LANGUAGE,
  I18N_STORAGE_KEY,
  LANGUAGE_COOKIE_KEY,
  LANGUAGE_QUERY_PARAMETER,
  SUPPORTED_LANGUAGES,
  getIntlLocale,
  normalizeLanguage,
} from './config.ts';
import {
  detectBrowserLanguage,
  detectRequestLanguage,
  getLanguageFromCookieString,
  parseCookieValue,
} from './detectLanguage.ts';

export * from './config.ts';
export * from './detectLanguage.ts';
export * from './format.ts';
export * from './localize.ts';

export const supportedLanguages = SUPPORTED_LANGUAGES;
export type SupportedLanguage = (typeof supportedLanguages)[number];
export const defaultLanguage = DEFAULT_LANGUAGE;
export const languageCookieName = LANGUAGE_COOKIE_KEY;
export const languageStorageKey = I18N_STORAGE_KEY;
export const languageQueryParameter = LANGUAGE_QUERY_PARAMETER;
export const resolveRequestLanguage = detectRequestLanguage;
export { normalizeLanguage, parseCookieValue, getLanguageFromCookieString };

export const translationResources = {
  en: { translation: en },
  zh: { translation: zh },
} as const;

let initialization: Promise<typeof i18n> | null = null;

function getLanguageFromQuery() {
  if (typeof window === 'undefined') {
    return null;
  }

  const value = new URLSearchParams(window.location.search).get(languageQueryParameter);
  return value ? normalizeLanguage(value) : null;
}

export function resolveInitialLanguage(): SupportedLanguage {
  if (typeof window === 'undefined') {
    return defaultLanguage;
  }

  return (
    getLanguageFromQuery() ||
    detectBrowserLanguage() ||
    defaultLanguage
  );
}

function persistLanguage(language: SupportedLanguage) {
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('lang', language);
    document.cookie = `${languageCookieName}=${encodeURIComponent(language)}; Path=/; SameSite=Lax`;
  }

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(languageStorageKey, language);
  }
}

export async function ensureI18n(initialLanguage = resolveInitialLanguage()) {
  if (!initialization) {
    initialization = (async () => {
      if (!i18n.isInitialized) {
        if (typeof window !== 'undefined') {
          i18n.use(LanguageDetector);
        }

        i18n.use(initReactI18next);
        await i18n.init({
          resources: translationResources,
          lng: normalizeLanguage(initialLanguage),
          fallbackLng: defaultLanguage,
          supportedLngs: [...supportedLanguages],
          load: 'languageOnly',
          interpolation: {
            escapeValue: false,
            format: (value, format, language) => {
              if (format === 'number' && (typeof value === 'number' || typeof value === 'bigint')) {
                return new Intl.NumberFormat(getIntlLocale(language)).format(value);
              }

              return String(value);
            },
          },
          detection: {
            order: ['querystring', 'cookie', 'localStorage', 'navigator', 'htmlTag'],
            lookupQuerystring: languageQueryParameter,
            lookupCookie: languageCookieName,
            lookupLocalStorage: languageStorageKey,
            caches: ['localStorage', 'cookie'],
          },
        });

        i18n.on('languageChanged', (language) => {
          persistLanguage(normalizeLanguage(language));
        });
      }

      persistLanguage(normalizeLanguage(i18n.resolvedLanguage ?? i18n.language));
      return i18n;
    })();
  }

  const instance = await initialization;
  const nextLanguage = normalizeLanguage(initialLanguage);
  if (normalizeLanguage(instance.resolvedLanguage ?? instance.language) !== nextLanguage) {
    await instance.changeLanguage(nextLanguage);
  }

  persistLanguage(nextLanguage);
  return instance;
}

export async function changeAppLanguage(language: SupportedLanguage) {
  const instance = await ensureI18n(language);
  await instance.changeLanguage(normalizeLanguage(language));
}

export { i18n };
export default i18n;
