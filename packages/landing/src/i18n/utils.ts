import tr from './tr.json';
import en from './en.json';

export const languages = {
  tr: 'Türkçe',
  en: 'English',
} as const;

export const defaultLang: Lang = 'tr';

export type Lang = keyof typeof languages;

const ui: Record<Lang, Record<string, string>> = { tr, en };

/**
 * Maps a logical page to its localized path in each language. This is the
 * single source of truth for navigation links, the language switcher's
 * "smart link resolution", and hreflang alternates.
 */
export const routeMap = {
  home: { tr: '/', en: '/en/' },
  vision: { tr: '/vizyon', en: '/en/vision' },
  systemodel: { tr: '/systemodel', en: '/en/systemodel' },
  platform: { tr: '/platform', en: '/en/platform' },
  services: { tr: '/danismanlik', en: '/en/services' },
  contact: { tr: '/iletisim', en: '/en/contact' },
  privacy: { tr: '/gizlilik', en: '/en/privacy' },
  terms: { tr: '/kosullar', en: '/en/terms' },
  blog: { tr: '/blog', en: '/en/blog' },
} as const satisfies Record<string, Record<Lang, string>>;

export type PageKey = keyof typeof routeMap;

/** Detect the active language from a URL pathname (`/en/...` → en, else tr). */
export function getLangFromUrl(url: URL): Lang {
  const [, maybeLang] = url.pathname.split('/');
  if (maybeLang === 'en') return 'en';
  return defaultLang;
}

/** Returns a translation lookup function bound to the given language. */
export function useTranslations(lang: Lang) {
  return function t(key: string): string {
    return ui[lang][key] ?? ui[defaultLang][key] ?? key;
  };
}

/** The path for a logical page in a given language. */
export function localizedPath(key: PageKey, lang: Lang): string {
  return routeMap[key][lang];
}
