import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ThemeColors {
  // Backgrounds
  bg: string;
  bgSecondary: string;
  bgTertiary: string;
  bgHover: string;
  bgInput: string;
  bgSelected: string;
  bgOverlay: string;

  // Borders
  border: string;
  borderLight: string;
  borderFocus: string;

  // Text
  text: string;
  textSecondary: string;
  textMuted: string;
  textDim: string;

  // Accent (shared)
  accent: string;
  accentHover: string;
  accentBg: string;

  // Buttons
  btnBg: string;
  btnBgHover: string;
  btnBorder: string;
  btnDisabled: string;

  // Status
  error: string;
  errorBg: string;
  success: string;
  successBg: string;
  info: string;
  warning: string;

  // Status bar
  statusBar: string;

  // Editor/Monaco
  monacoTheme: string;

  // Google Sign-In button theme
  googleBtnTheme: 'filled_black' | 'outline';

  // Scrollbar & misc
  divider: string;
  shadow: string;
  codeBg: string;
  codeText: string;
}

const darkTheme: ThemeColors = {
  bg: '#1e1e1e',
  bgSecondary: '#2d2d30',
  bgTertiary: '#252526',
  bgHover: '#2a3a4a',
  bgInput: '#1e1e1e',
  bgSelected: '#2d2d30',
  bgOverlay: 'rgba(0,0,0,0.5)',

  border: '#3c3c3c',
  borderLight: '#222',
  borderFocus: '#007acc',

  text: '#d4d4d4',
  textSecondary: '#888',
  textMuted: '#666',
  textDim: '#555',

  accent: '#0e639c',
  accentHover: '#1177bb',
  accentBg: '#094771',

  btnBg: '#3c3c3c',
  btnBgHover: '#4a4a4a',
  btnBorder: '#555',
  btnDisabled: '#3c3c3c',

  error: '#f48771',
  errorBg: '#3c1e1e',
  success: '#4ec9b0',
  successBg: '#1a3a1a',
  info: '#569cd6',
  warning: '#cca700',

  statusBar: '#007acc',

  monacoTheme: 'systemodel-dark',
  googleBtnTheme: 'filled_black',

  divider: '#3c3c3c',
  shadow: '0 4px 12px rgba(0,0,0,0.5)',
  codeBg: '#2d2d2d',
  codeText: '#ce9178',
};

const lightTheme: ThemeColors = {
  bg: '#ffffff',
  bgSecondary: '#f3f3f3',
  bgTertiary: '#e8e8e8',
  bgHover: '#d6ebff',
  bgInput: '#ffffff',
  bgSelected: '#e8e8e8',
  bgOverlay: 'rgba(0,0,0,0.2)',

  border: '#d4d4d4',
  borderLight: '#e0e0e0',
  borderFocus: '#007acc',

  text: '#1e1e1e',
  textSecondary: '#666666',
  textMuted: '#888888',
  textDim: '#aaaaaa',

  accent: '#0e639c',
  accentHover: '#1177bb',
  accentBg: '#c4e1f6',

  btnBg: '#e0e0e0',
  btnBgHover: '#d0d0d0',
  btnBorder: '#c0c0c0',
  btnDisabled: '#e8e8e8',

  error: '#d32f2f',
  errorBg: '#fdecea',
  success: '#0d7d6c',
  successBg: '#e8f5e9',
  info: '#1976d2',
  warning: '#e65100',

  statusBar: '#007acc',

  monacoTheme: 'systemodel-light',
  googleBtnTheme: 'outline',

  divider: '#d4d4d4',
  shadow: '0 4px 12px rgba(0,0,0,0.12)',
  codeBg: '#f0f0f0',
  codeText: '#a31515',
};

export const themes = { dark: darkTheme, light: lightTheme } as const;
export type ThemeMode = keyof typeof themes;

interface ThemeState {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  toggle: () => void;
}

const VALID_MODES: ThemeMode[] = ['dark', 'light'];

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      mode: 'dark',
      setMode: (mode) => set({ mode: VALID_MODES.includes(mode) ? mode : 'dark' }),
      toggle: () => set((s) => ({ mode: s.mode === 'dark' ? 'light' : 'dark' })),
    }),
    {
      name: 'systemodel-theme',
      merge: (persisted, current) => {
        const p = persisted as Partial<ThemeState> | undefined;
        const mode = p?.mode && VALID_MODES.includes(p.mode) ? p.mode : current.mode;
        return { ...current, mode };
      },
    },
  ),
);

export function useTheme(): ThemeColors & { mode: ThemeMode; toggle: () => void } {
  const { mode, toggle } = useThemeStore();
  return { ...themes[mode], mode, toggle };
}
