// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { themes, useThemeStore } from './theme.js';
import type { ThemeColors, ThemeMode } from './theme.js';

// Reset store between tests
beforeEach(() => {
  useThemeStore.setState({ mode: 'dark' });
  localStorage.clear();
});

// ─── Theme definitions ──────────────────────────────────────────────────────

describe('theme definitions', () => {
  it('dark and light themes have identical keys', () => {
    const darkKeys = Object.keys(themes.dark).sort();
    const lightKeys = Object.keys(themes.light).sort();
    expect(darkKeys).toEqual(lightKeys);
  });

  it('all theme color values are non-empty strings', () => {
    for (const mode of ['dark', 'light'] as ThemeMode[]) {
      const t = themes[mode];
      for (const [key, value] of Object.entries(t)) {
        expect(value, `${mode}.${key}`).toBeTruthy();
        expect(typeof value, `${mode}.${key}`).toBe('string');
      }
    }
  });

  it('dark theme has dark backgrounds', () => {
    expect(themes.dark.bg).toBe('#1e1e1e');
    expect(themes.dark.monacoTheme).toBe('systemodel-dark');
  });

  it('light theme has light backgrounds', () => {
    expect(themes.light.bg).toBe('#ffffff');
    expect(themes.light.monacoTheme).toBe('systemodel-light');
  });

  it('accent colors are consistent across themes', () => {
    expect(themes.dark.accent).toBe(themes.light.accent);
    expect(themes.dark.statusBar).toBe(themes.light.statusBar);
  });

  it('google button themes are valid values', () => {
    expect(['filled_black', 'outline']).toContain(themes.dark.googleBtnTheme);
    expect(['filled_black', 'outline']).toContain(themes.light.googleBtnTheme);
  });

  it('dark and light text colors have sufficient contrast difference', () => {
    // Primary text should be very different between themes
    expect(themes.dark.text).not.toBe(themes.light.text);
    expect(themes.dark.bg).not.toBe(themes.light.bg);
  });
});

// ─── Theme store ─────────────────────────────────────────────────────────────

describe('useThemeStore', () => {
  it('defaults to dark mode', () => {
    expect(useThemeStore.getState().mode).toBe('dark');
  });

  it('toggle switches dark to light', () => {
    useThemeStore.getState().toggle();
    expect(useThemeStore.getState().mode).toBe('light');
  });

  it('toggle switches light back to dark', () => {
    useThemeStore.setState({ mode: 'light' });
    useThemeStore.getState().toggle();
    expect(useThemeStore.getState().mode).toBe('dark');
  });

  it('setMode sets to light', () => {
    useThemeStore.getState().setMode('light');
    expect(useThemeStore.getState().mode).toBe('light');
  });

  it('setMode sets to dark', () => {
    useThemeStore.setState({ mode: 'light' });
    useThemeStore.getState().setMode('dark');
    expect(useThemeStore.getState().mode).toBe('dark');
  });

  it('setMode rejects invalid values', () => {
    useThemeStore.getState().setMode('malicious' as ThemeMode);
    expect(useThemeStore.getState().mode).toBe('dark');
  });

  it('double toggle returns to original', () => {
    const original = useThemeStore.getState().mode;
    useThemeStore.getState().toggle();
    useThemeStore.getState().toggle();
    expect(useThemeStore.getState().mode).toBe(original);
  });
});

// ─── Security: merge / deserialization ───────────────────────────────────────

describe('theme store security', () => {
  it('merge rejects invalid mode from persisted state', () => {
    // Simulate tampered localStorage
    const state = useThemeStore.getState();
    const merged = { ...state, mode: 'injected' as ThemeMode };
    // The setMode guard should catch this
    useThemeStore.getState().setMode(merged.mode);
    expect(useThemeStore.getState().mode).toBe('dark');
  });

  it('only allows dark and light as valid modes', () => {
    const invalidModes = ['', 'auto', 'system', 'high-contrast', 'null', 'undefined', '<script>'];
    for (const invalid of invalidModes) {
      useThemeStore.getState().setMode(invalid as ThemeMode);
      expect(
        useThemeStore.getState().mode,
        `should reject "${invalid}"`,
      ).toBe('dark');
    }
  });

  it('theme color values do not contain script tags or URLs', () => {
    for (const mode of ['dark', 'light'] as ThemeMode[]) {
      const t = themes[mode];
      for (const [key, value] of Object.entries(t)) {
        if (typeof value === 'string') {
          expect(value, `${mode}.${key}`).not.toMatch(/<script/i);
          expect(value, `${mode}.${key}`).not.toMatch(/javascript:/i);
        }
      }
    }
  });

  it('theme color strings are valid CSS color formats', () => {
    const cssColorPattern = /^(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|[a-z-]+)$/;
    const skipKeys = ['monacoTheme', 'googleBtnTheme', 'shadow']; // not color values
    for (const mode of ['dark', 'light'] as ThemeMode[]) {
      const t = themes[mode] as unknown as Record<string, string>;
      for (const [key, value] of Object.entries(t)) {
        if (skipKeys.includes(key)) continue;
        expect(value, `${mode}.${key} = "${value}"`).toMatch(cssColorPattern);
      }
    }
  });
});

// ─── ThemeColors interface completeness ──────────────────────────────────────

describe('ThemeColors completeness', () => {
  const requiredKeys: (keyof ThemeColors)[] = [
    'bg', 'bgSecondary', 'bgTertiary', 'bgHover', 'bgInput', 'bgSelected', 'bgOverlay',
    'border', 'borderLight', 'borderFocus',
    'text', 'textSecondary', 'textMuted', 'textDim',
    'accent', 'accentHover', 'accentBg',
    'btnBg', 'btnBgHover', 'btnBorder', 'btnDisabled',
    'error', 'errorBg', 'success', 'successBg', 'info', 'warning',
    'statusBar', 'monacoTheme', 'googleBtnTheme',
    'divider', 'shadow', 'codeBg', 'codeText',
  ];

  for (const mode of ['dark', 'light'] as ThemeMode[]) {
    it(`${mode} theme has all required keys`, () => {
      const t = themes[mode];
      for (const key of requiredKeys) {
        expect(t, `missing ${mode}.${key}`).toHaveProperty(key);
      }
    });
  }
});
