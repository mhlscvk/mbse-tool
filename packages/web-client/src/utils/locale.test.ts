// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { useI18nStore } from '../store/i18n.js';
import {
  localeLowerCase,
  localeUpperCase,
  emailLowerCase,
  currentLanguage,
  currentLocale,
  formatDate,
  formatNumber,
  formatRelative,
} from './locale.js';

beforeEach(() => {
  useI18nStore.setState({ language: 'tr' });
  localStorage.clear();
});

describe('Türkçe character casing', () => {
  it('lowercases I to ı in Turkish locale', () => {
    useI18nStore.setState({ language: 'tr' });
    expect(localeLowerCase('I')).toBe('ı');
    expect(localeLowerCase('İSTANBUL')).toBe('istanbul');
  });

  it('uppercases i to İ in Turkish locale', () => {
    useI18nStore.setState({ language: 'tr' });
    expect(localeUpperCase('i')).toBe('İ');
    expect(localeUpperCase('istanbul')).toBe('İSTANBUL');
  });

  it('lowercases I to i in English locale', () => {
    useI18nStore.setState({ language: 'en' });
    expect(localeLowerCase('I')).toBe('i');
  });

  it('uppercases i to I in English locale', () => {
    useI18nStore.setState({ language: 'en' });
    expect(localeUpperCase('i')).toBe('I');
  });

  it('emailLowerCase is locale-independent', () => {
    // Even with Turkish active, email casing must follow ASCII rules so that
    // 'ALI@x.com' and 'ali@x.com' compare equal for the auth layer.
    useI18nStore.setState({ language: 'tr' });
    expect(emailLowerCase('ALI@example.com')).toBe('ali@example.com');
    expect(emailLowerCase('İSTANBUL@x.com')).toBe('i̇stanbul@x.com');
  });

  it('explicit locale override ignores store state', () => {
    useI18nStore.setState({ language: 'tr' });
    expect(localeLowerCase('I', 'en-US')).toBe('i');
    expect(localeUpperCase('i', 'en-US')).toBe('I');
  });
});

describe('locale resolution', () => {
  it('currentLanguage reflects store state', () => {
    useI18nStore.setState({ language: 'tr' });
    expect(currentLanguage()).toBe('tr');
    useI18nStore.setState({ language: 'en' });
    expect(currentLanguage()).toBe('en');
  });

  it('currentLocale maps language to BCP-47 tag', () => {
    useI18nStore.setState({ language: 'tr' });
    expect(currentLocale()).toBe('tr-TR');
    useI18nStore.setState({ language: 'en' });
    expect(currentLocale()).toBe('en-US');
  });
});

describe('formatDate', () => {
  const epochMid2024 = new Date('2024-05-10T12:00:00Z').getTime();

  it('Turkish locale uses dd.MM.yyyy ordering', () => {
    useI18nStore.setState({ language: 'tr' });
    const result = formatDate(epochMid2024);
    // tr-TR default short date is "10.05.2024" — verify components and separator
    expect(result).toMatch(/^\d{1,2}\.\d{1,2}\.\d{4}$/);
  });

  it('English locale uses M/d/yyyy ordering', () => {
    useI18nStore.setState({ language: 'en' });
    const result = formatDate(epochMid2024);
    // en-US default short date is "5/10/2024"
    expect(result).toMatch(/^\d{1,2}\/\d{1,2}\/\d{4}$/);
  });
});

describe('formatNumber', () => {
  it('Turkish locale uses dot for thousands and comma for decimal', () => {
    useI18nStore.setState({ language: 'tr' });
    expect(formatNumber(1234.5)).toBe('1.234,5');
  });

  it('English locale uses comma for thousands and dot for decimal', () => {
    useI18nStore.setState({ language: 'en' });
    expect(formatNumber(1234.5)).toBe('1,234.5');
  });
});

describe('formatRelative', () => {
  it('returns a Turkish phrase in Turkish locale', () => {
    useI18nStore.setState({ language: 'tr' });
    const now = Date.now();
    const out = formatRelative(now - 5 * 60_000, now); // 5 minutes ago
    // Turkish output should contain "dakika" — verifies the locale flowed through
    expect(out.toLowerCase()).toContain('dakika');
  });

  it('returns an English phrase in English locale', () => {
    useI18nStore.setState({ language: 'en' });
    const now = Date.now();
    const out = formatRelative(now - 5 * 60_000, now);
    expect(out.toLowerCase()).toContain('minute');
  });
});
