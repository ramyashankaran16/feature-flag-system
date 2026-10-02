import { createTheme } from '@mui/material/styles';

export const tokens = {
  ink: '#17212B',
  inkSoft: '#22303D',
  paper: '#F3F5F4',
  surface: '#FFFFFF',
  line: '#DCE1E4',
  muted: '#5B6875',
  signal: '#12805C',
  signalSoft: '#E3F2EC',
  off: '#B9C2C9',
  danger: '#C2362B',
};

export const monoFont = '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

const ENV_COLORS: Record<string, string> = {
  development: '#2F6FB2',
  testing: '#B26B00',
  production: '#C2362B',
};
const EXTRA_COLORS = ['#6B4FA0', '#1F7A8C', '#8A5A44', '#4A6B2A'];

/** Stable colour per environment key: dev blue, testing amber, production red. */
export function envColor(key: string): string {
  if (ENV_COLORS[key]) return ENV_COLORS[key];
  let h = 0;
  for (const c of key) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return EXTRA_COLORS[h % EXTRA_COLORS.length];
}

export const theme = createTheme({
  palette: {
    primary: { main: tokens.signal, contrastText: '#FFFFFF' },
    secondary: { main: tokens.ink },
    error: { main: tokens.danger },
    background: { default: tokens.paper, paper: tokens.surface },
    text: { primary: tokens.ink, secondary: tokens.muted },
    divider: tokens.line,
  },
  shape: { borderRadius: 6 },
  typography: {
    fontFamily: '"Public Sans", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    h4: { fontWeight: 700, fontSize: '1.7rem', letterSpacing: '-0.015em', lineHeight: 1.2 },
    h5: { fontWeight: 700, fontSize: '1.3rem', letterSpacing: '-0.01em' },
    h6: { fontWeight: 600, fontSize: '1.02rem' },
    subtitle2: { fontWeight: 600 },
    button: { textTransform: 'none', fontWeight: 600 },
  },
  components: {
    MuiButton: { defaultProps: { disableElevation: true } },
    MuiPaper: { defaultProps: { elevation: 0 } },
    MuiTooltip: { defaultProps: { arrow: true } },
    MuiDialog: { defaultProps: { fullWidth: true, maxWidth: 'sm' } },
    MuiTableCell: {
      styleOverrides: {
        head: { fontWeight: 600, color: tokens.muted, fontSize: '0.78rem', whiteSpace: 'nowrap' },
      },
    },
    MuiChip: { styleOverrides: { root: { fontWeight: 500 } } },
    MuiTab: { styleOverrides: { root: { textTransform: 'none', fontWeight: 600, minHeight: 44 } } },
    MuiCssBaseline: {
      styleOverrides: {
        '@media (prefers-reduced-motion: reduce)': {
          '*': { transition: 'none !important', animation: 'none !important' },
        },
      },
    },
  },
});
