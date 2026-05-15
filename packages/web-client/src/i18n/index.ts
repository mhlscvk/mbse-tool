import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import tr from './tr.json';
import en from './en.json';

export const SUPPORTED_LANGUAGES = ['tr', 'en'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];
export const DEFAULT_LANGUAGE: SupportedLanguage = 'tr';

const STORE_KEY = 'systemodel-i18n';

const detector = new LanguageDetector();
detector.addDetector({
  name: 'systemodelStore',
  lookup() {
    try {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORE_KEY) : null;
      if (!raw) return undefined;
      const parsed = JSON.parse(raw) as { state?: { language?: string } };
      const lang = parsed?.state?.language;
      return (SUPPORTED_LANGUAGES as readonly string[]).includes(lang ?? '') ? lang : undefined;
    } catch {
      return undefined;
    }
  },
  cacheUserLanguage() {
    // Persisted by the Zustand i18n store; no-op here.
  },
});

void i18n
  .use(detector)
  .use(initReactI18next)
  .init({
    resources: {
      tr: { translation: tr },
      en: { translation: en },
    },
    supportedLngs: [...SUPPORTED_LANGUAGES],
    fallbackLng: DEFAULT_LANGUAGE,
    nonExplicitSupportedLngs: true,
    detection: {
      order: ['systemodelStore', 'navigator'],
      caches: [],
    },
    interpolation: { escapeValue: false },
    returnNull: false,
  });

const syncHtmlLang = (lng: string) => {
  if (typeof document !== 'undefined') {
    const short = lng.split('-')[0];
    document.documentElement.setAttribute('lang', short);
  }
};

syncHtmlLang(i18n.language || DEFAULT_LANGUAGE);
i18n.on('languageChanged', syncHtmlLang);

export default i18n;
