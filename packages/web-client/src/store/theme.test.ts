// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { useTheme } from './theme.js';

describe('Theme', () => {
  it('useTheme returns light theme colors', () => {
    const t = useTheme();
    expect(t.bg).toBe('#ffffff');
    expect(t.text).toBe('#1e1e1e');
  });

  it('uses systemodel-light Monaco theme', () => {
    expect(useTheme().monacoTheme).toBe('systemodel-light');
  });

  it('uses outline Google button', () => {
    expect(useTheme().googleBtnTheme).toBe('outline');
  });

  it('has all required color keys', () => {
    const t = useTheme();
    const requiredKeys = [
      'bg', 'bgSecondary', 'bgTertiary', 'border', 'text', 'textSecondary',
      'accent', 'error', 'success', 'info', 'statusBar', 'monacoTheme',
    ];
    for (const key of requiredKeys) {
      expect(t).toHaveProperty(key);
    }
  });
});
