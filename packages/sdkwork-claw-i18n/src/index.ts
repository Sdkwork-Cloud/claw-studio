import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json' with { type: 'json' };
import zh from './locales/zh.json' with { type: 'json' };

export const translationResources = {
  en: { translation: en },
  zh: { translation: zh },
} as const;

let initialization: Promise<typeof i18n> | null = null;

export function ensureI18n() {
  if (!initialization) {
    initialization = (async () => {
      if (!i18n.isInitialized) {
        if (typeof window !== 'undefined') {
          i18n.use(LanguageDetector);
        }

        i18n.use(initReactI18next);
        await i18n.init({
          resources: translationResources,
          fallbackLng: 'en',
          interpolation: {
            escapeValue: false,
          },
        });
      }

      return i18n;
    })();
  }

  return initialization;
}

void ensureI18n();

export { i18n };
export default i18n;
