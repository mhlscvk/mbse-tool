import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useI18nStore } from '../store/i18n.js';
import { useAuthStore } from '../store/auth.js';
import { useTheme } from '../store/theme.js';
import { api } from '../services/api-client.js';
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '../i18n/index.js';

const LANGUAGE_LABEL_KEYS: Record<SupportedLanguage, string> = {
  tr: 'nav.language_tr',
  en: 'nav.language_en',
};

export default function LanguageSwitcher() {
  const { t } = useTranslation();
  const t_ = useTheme();
  const language = useI18nStore((s) => s.language);
  const setLanguage = useI18nStore((s) => s.setLanguage);
  const token = useAuthStore((s) => s.token);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleMouse = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleMouse);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleMouse);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  const choose = useCallback(
    (lang: SupportedLanguage) => {
      setLanguage(lang);
      setOpen(false);
      if (token) {
        api.users.updatePreferences(lang).catch(() => {
          // Silent: localStorage still persists; surfaced only if user retries
        });
      }
    },
    [setLanguage, token],
  );

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t('nav.language_switcher_label')}
        title={t('nav.language_switcher_label')}
        style={{
          background: open ? t_.accent : 'transparent',
          color: open ? '#fff' : t_.textSecondary,
          border: `1px solid ${open ? t_.accent : t_.border}`,
          borderRadius: 4,
          padding: '3px 10px',
          cursor: 'pointer',
          fontSize: 12,
          minWidth: 48,
        }}
      >
        {language.toUpperCase()} ▾
      </button>
      {open && (
        <div
          role="listbox"
          aria-label={t('nav.language_switcher_label')}
          style={{
            position: 'absolute',
            top: 36,
            right: 0,
            zIndex: 9999,
            background: t_.bgSecondary,
            border: `1px solid ${t_.border}`,
            borderRadius: 6,
            boxShadow: t_.shadow,
            minWidth: 140,
            padding: '4px 0',
          }}
        >
          {SUPPORTED_LANGUAGES.map((lang) => {
            const active = lang === language;
            return (
              <button
                key={lang}
                role="option"
                aria-selected={active}
                onClick={() => choose(lang)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  color: t_.text,
                  fontSize: 13,
                  padding: '8px 12px',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = t_.bgHover;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <span>{t(LANGUAGE_LABEL_KEYS[lang])}</span>
                {active && <span style={{ color: t_.success, fontSize: 12 }}>✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
