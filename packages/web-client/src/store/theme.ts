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

export function useTheme(): ThemeColors {
  return lightTheme;
}
