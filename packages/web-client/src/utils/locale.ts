import { useI18nStore } from '../store/i18n.js';
import type { SupportedLanguage } from '../i18n/index.js';

const LOCALE_MAP: Record<SupportedLanguage, string> = {
  tr: 'tr-TR',
  en: 'en-US',
};

export function currentLanguage(): SupportedLanguage {
  return useI18nStore.getState().language;
}

export function currentLocale(): string {
  return LOCALE_MAP[currentLanguage()];
}

// Locale-aware casing — falls back to active UI locale.
export function localeLowerCase(s: string, locale?: string): string {
  return s.toLocaleLowerCase(locale ?? currentLocale());
}

export function localeUpperCase(s: string, locale?: string): string {
  return s.toLocaleUpperCase(locale ?? currentLocale());
}

// Email comparisons must stay language-independent (RFC 5321 ASCII fold).
export function emailLowerCase(email: string): string {
  return email.toLowerCase();
}

export function formatDate(
  date: Date | string | number,
  options?: Intl.DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat(currentLocale(), options).format(new Date(date));
}

export function formatDateTime(date: Date | string | number): string {
  return formatDate(date, { dateStyle: 'medium', timeStyle: 'short' });
}

export function formatNumber(n: number, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(currentLocale(), options).format(n);
}

export function formatRelative(timestamp: number, now: number = Date.now()): string {
  const rtf = new Intl.RelativeTimeFormat(currentLocale(), { numeric: 'auto' });
  const diffSec = (timestamp - now) / 1000;
  const abs = Math.abs(diffSec);
  if (abs < 60) return rtf.format(Math.round(diffSec), 'second');
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), 'hour');
  return rtf.format(Math.round(diffSec / 86400), 'day');
}
