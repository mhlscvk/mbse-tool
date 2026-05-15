// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import i18n, { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } from '../i18n/index.js';
import { useI18nStore } from './i18n.js';

beforeEach(() => {
  localStorage.clear();
  useI18nStore.setState({ language: DEFAULT_LANGUAGE });
});

describe('i18n config', () => {
  it('Turkish is the default language', () => {
    expect(DEFAULT_LANGUAGE).toBe('tr');
  });

  it('supports exactly Turkish and English', () => {
    expect(SUPPORTED_LANGUAGES).toEqual(['tr', 'en']);
  });

  it('i18n instance is initialized with both resource bundles', () => {
    expect(i18n.hasResourceBundle('tr', 'translation')).toBe(true);
    expect(i18n.hasResourceBundle('en', 'translation')).toBe(true);
  });

  it('every key in en bundle exists in tr bundle', () => {
    const enBundle = i18n.getResourceBundle('en', 'translation');
    const trBundle = i18n.getResourceBundle('tr', 'translation');
    const flatten = (obj: Record<string, unknown>, prefix = ''): string[] => {
      const keys: string[] = [];
      for (const [k, v] of Object.entries(obj)) {
        const full = prefix ? `${prefix}.${k}` : k;
        if (v && typeof v === 'object') keys.push(...flatten(v as Record<string, unknown>, full));
        else keys.push(full);
      }
      return keys;
    };
    const enKeys = flatten(enBundle);
    const trKeys = new Set(flatten(trBundle));
    const missing = enKeys.filter((k) => !trKeys.has(k));
    expect(missing).toEqual([]);
  });
});

describe('i18n store', () => {
  it('starts with the default language', () => {
    expect(useI18nStore.getState().language).toBe(DEFAULT_LANGUAGE);
  });

  it('setLanguage updates the store state', () => {
    useI18nStore.getState().setLanguage('en');
    expect(useI18nStore.getState().language).toBe('en');
  });

  it('setLanguage forwards to i18next', async () => {
    useI18nStore.getState().setLanguage('en');
    // i18n.changeLanguage is async; wait a tick for it to settle
    await new Promise((r) => setTimeout(r, 0));
    expect(i18n.language).toBe('en');
  });

  it('persists language to localStorage under systemodel-i18n', () => {
    useI18nStore.getState().setLanguage('en');
    const raw = localStorage.getItem('systemodel-i18n');
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.state.language).toBe('en');
  });
});
