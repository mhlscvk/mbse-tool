import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import i18n, {
  DEFAULT_LANGUAGE,
  SUPPORTED_LANGUAGES,
  type SupportedLanguage,
} from '../i18n/index.js';

interface I18nState {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
}

function resolveInitialLanguage(): SupportedLanguage {
  const detected = (i18n.language || DEFAULT_LANGUAGE).split('-')[0];
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(detected)
    ? (detected as SupportedLanguage)
    : DEFAULT_LANGUAGE;
}

export const useI18nStore = create<I18nState>()(
  persist(
    (set) => ({
      language: resolveInitialLanguage(),
      setLanguage: (lang) => {
        set({ language: lang });
        void i18n.changeLanguage(lang);
      },
    }),
    {
      name: 'systemodel-i18n',
      onRehydrateStorage: () => (state) => {
        if (state?.language && state.language !== i18n.language) {
          void i18n.changeLanguage(state.language);
        }
      },
    },
  ),
);
