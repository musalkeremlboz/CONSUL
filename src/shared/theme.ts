/** CONSUL görsel kimliği — arayüz teması ve terminal renk şemaları.
 *
 *  İki kavram BİLEREK ayrılmıştır (talimat §18):
 *   - **Arayüz teması** (`UI_THEMES`): pencere, başlık çubuğu, paneller.
 *     İki görünüm: koyu ve açık.
 *   - **Terminal şeması** (`TERMINAL_SCHEMES`): xterm'in 20 renkli paleti.
 *     Arayüz temasından bağımsız seçilir; ileride kullanıcı şemaları eklemek
 *     için tek yapılması gereken bu listeye kayıt eklemektir.
 *
 *  Bu dosya hem main süreçten (pencere arka plan rengi) hem renderer'dan
 *  (CSS değişkenleri) okunur; React/DOM bağımlılığı YOKTUR. */

export type Appearance = 'dark' | 'light'

/** xterm'in ITheme'i ile yapısal uyumlu palet (xterm'e bağımlılık eklemeden). */
export interface TerminalPalette {
  background: string
  foreground: string
  cursor: string
  cursorAccent: string
  selectionBackground: string
  black: string
  red: string
  green: string
  yellow: string
  blue: string
  magenta: string
  cyan: string
  white: string
  brightBlack: string
  brightRed: string
  brightGreen: string
  brightYellow: string
  brightBlue: string
  brightMagenta: string
  brightCyan: string
  brightWhite: string
}

export interface TerminalScheme {
  id: string
  label: string
  appearance: Appearance
  palette: TerminalPalette
}

/** Arayüz token'ları — tümü her temada TANIMLI olmak zorundadır. */
export interface UiTokens {
  '--c-bg': string
  '--c-surface': string
  '--c-surface-2': string
  '--c-border': string
  '--c-border-strong': string
  '--c-text': string
  '--c-text-dim': string
  '--c-accent': string
  '--c-accent-text': string
  '--c-ok': string
  '--c-warn': string
  '--c-danger': string
  '--c-focus': string
  '--c-shadow': string
  /** Pencere arka planı (FOUC önleme — main süreç bunu kullanır). */
  '--c-window-bg': string
}

export interface UiTheme {
  id: Appearance
  label: string
  tokens: UiTokens
}

/* ── Arayüz temaları ───────────────────────────────────────────── */

export const UI_THEMES: Record<Appearance, UiTheme> = {
  dark: {
    id: 'dark',
    label: 'Koyu',
    tokens: {
      '--c-bg': '#0D0D0D',
      '--c-surface': '#141414',
      '--c-surface-2': '#1C1C1C',
      '--c-border': '#2A2A2A',
      '--c-border-strong': '#F2F2F2',
      '--c-text': '#F2F2F2',
      '--c-text-dim': '#8A8A8A',
      '--c-accent': '#E63946',
      '--c-accent-text': '#FFFFFF',
      '--c-ok': '#3FB950',
      '--c-warn': '#D4A72C',
      '--c-danger': '#E63946',
      '--c-focus': '#E63946',
      '--c-shadow': 'rgba(0, 0, 0, 0.6)',
      '--c-window-bg': '#0D0D0D',
    },
  },
  light: {
    id: 'light',
    label: 'Açık',
    tokens: {
      '--c-bg': '#F4F2ED',
      '--c-surface': '#FFFFFF',
      '--c-surface-2': '#E9E6DF',
      '--c-border': '#CFCAC0',
      '--c-border-strong': '#0D0D0D',
      '--c-text': '#141414',
      '--c-text-dim': '#5C5852',
      '--c-accent': '#C1121F',
      '--c-accent-text': '#FFFFFF',
      '--c-ok': '#1A7F37',
      '--c-warn': '#9A6700',
      '--c-danger': '#C1121F',
      '--c-focus': '#C1121F',
      '--c-shadow': 'rgba(20, 20, 20, 0.18)',
      '--c-window-bg': '#F4F2ED',
    },
  },
}

/* ── Terminal şemaları ─────────────────────────────────────────── */

export const TERMINAL_SCHEMES: TerminalScheme[] = [
  {
    id: 'consul-dark',
    label: 'CONSUL Koyu',
    appearance: 'dark',
    palette: {
      background: '#0D0D0D',
      foreground: '#F2F2F2',
      cursor: '#E63946',
      cursorAccent: '#0D0D0D',
      selectionBackground: 'rgba(230, 57, 70, 0.35)',
      black: '#1C1C1C',
      red: '#E63946',
      green: '#3FB950',
      yellow: '#D4A72C',
      blue: '#7C8BA6',
      magenta: '#C97B84',
      cyan: '#8FA3BF',
      white: '#F2F2F2',
      brightBlack: '#6E7681',
      brightRed: '#FF6B76',
      brightGreen: '#56D364',
      brightYellow: '#E3B341',
      brightBlue: '#9DB0CC',
      brightMagenta: '#E0A5AC',
      brightCyan: '#A9BCD4',
      brightWhite: '#FFFFFF',
    },
  },
  {
    id: 'consul-light',
    label: 'CONSUL Açık',
    appearance: 'light',
    palette: {
      background: '#F4F2ED',
      foreground: '#1A1A1A',
      cursor: '#C1121F',
      cursorAccent: '#F4F2ED',
      selectionBackground: 'rgba(193, 18, 31, 0.22)',
      black: '#1A1A1A',
      red: '#C1121F',
      green: '#1A7F37',
      yellow: '#9A6700',
      blue: '#31538F',
      magenta: '#8E3A54',
      cyan: '#1B6B72',
      white: '#5C5852',
      brightBlack: '#6E6A63',
      brightRed: '#E63946',
      brightGreen: '#2DA44E',
      brightYellow: '#BF8700',
      brightBlue: '#4169B2',
      brightMagenta: '#B04A6C',
      brightCyan: '#2A8A92',
      brightWhite: '#141414',
    },
  },
  {
    id: 'midnight',
    label: 'Gece Mavisi',
    appearance: 'dark',
    palette: {
      background: '#0B1220',
      foreground: '#D5DEEF',
      cursor: '#5AA9E6',
      cursorAccent: '#0B1220',
      selectionBackground: 'rgba(90, 169, 230, 0.30)',
      black: '#16203A',
      red: '#F26D78',
      green: '#5FD3A0',
      yellow: '#E6C86E',
      blue: '#5AA9E6',
      magenta: '#B48EEA',
      cyan: '#63D2D8',
      white: '#D5DEEF',
      brightBlack: '#4A5878',
      brightRed: '#FF8E97',
      brightGreen: '#7FE7BC',
      brightYellow: '#F5DC90',
      brightBlue: '#82C1F5',
      brightMagenta: '#CBAAF6',
      brightCyan: '#8AE6EB',
      brightWhite: '#FFFFFF',
    },
  },
  {
    id: 'paper',
    label: 'Kâğıt',
    appearance: 'light',
    palette: {
      background: '#FBFBF8',
      foreground: '#2B2B2B',
      cursor: '#2B2B2B',
      cursorAccent: '#FBFBF8',
      selectionBackground: 'rgba(43, 43, 43, 0.16)',
      black: '#2B2B2B',
      red: '#A33A31',
      green: '#3F6E3F',
      yellow: '#8A6A1F',
      blue: '#37567F',
      magenta: '#77436B',
      cyan: '#2F6B6B',
      white: '#6B6B66',
      brightBlack: '#8A8A85',
      brightRed: '#C4544A',
      brightGreen: '#548A54',
      brightYellow: '#A98A33',
      brightBlue: '#4F7099',
      brightMagenta: '#8F5A83',
      brightCyan: '#438585',
      brightWhite: '#1A1A1A',
    },
  },
  {
    id: 'phosphor',
    label: 'Fosfor Yeşili',
    appearance: 'dark',
    palette: {
      background: '#020D06',
      foreground: '#4CE07A',
      cursor: '#7CFFA6',
      cursorAccent: '#020D06',
      selectionBackground: 'rgba(76, 224, 122, 0.28)',
      black: '#0A1A0F',
      red: '#E05A5A',
      green: '#4CE07A',
      yellow: '#C8E04C',
      blue: '#4CC9E0',
      magenta: '#9FE04C',
      cyan: '#4CE0C0',
      white: '#B8F5C9',
      brightBlack: '#2E6B41',
      brightRed: '#FF7B7B',
      brightGreen: '#7CFFA6',
      brightYellow: '#E4FF7C',
      brightBlue: '#7CE9FF',
      brightMagenta: '#C4FF7C',
      brightCyan: '#7CFFE4',
      brightWhite: '#E6FFEE',
    },
  },
]

export const DEFAULT_TERMINAL_SCHEME = 'consul-dark'

export function getTerminalScheme(id: string): TerminalScheme {
  return TERMINAL_SCHEMES.find((s) => s.id === id) ?? TERMINAL_SCHEMES[0]
}

export function isTerminalSchemeId(id: string): boolean {
  return TERMINAL_SCHEMES.some((s) => s.id === id)
}

/** Pencere arka plan rengi — main süreç FOUC'u önlemek için kullanır. */
export function windowBackgroundFor(appearance: Appearance): string {
  return UI_THEMES[appearance].tokens['--c-window-bg']
}
