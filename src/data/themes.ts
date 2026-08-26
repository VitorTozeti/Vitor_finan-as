// Theme catalog. Each entry maps to a [data-theme="id"] block in src/index.css.
// `swatch` holds a few representative hex colors purely for the settings picker
// preview (bg, green, accent, txt) — the real colors live in the CSS tokens.

import { hexToRgb, rgbToToken, isLight, shift, darken } from '../utils/color'

export interface ThemeDef {
  id: string
  label: string
  description: string
  swatch: { bg: string; green: string; accent: string; txt: string }
  /** Whether this is a light theme (affects the picker preview text). */
  light?: boolean
}

export const THEMES: ThemeDef[] = [
  {
    id: 'verde-noturno',
    label: 'Verde Noturno',
    description: 'Preto profundo com verde vivo. O clássico da casa.',
    swatch: { bg: '#0A0E0C', green: '#22D68A', accent: '#FFB454', txt: '#F3F6F4' }
  },
  {
    id: 'esmeralda-grafite',
    label: 'Esmeralda Grafite',
    description: 'Cinza-grafite frio com esmeralda e azul sereno.',
    swatch: { bg: '#0F1215', green: '#10D19E', accent: '#78BEFF', txt: '#EEF2F5' }
  },
  {
    id: 'roxo-meia-noite',
    label: 'Roxo Meia-noite',
    description: 'Violeta profundo com acento âmbar aconchegante.',
    swatch: { bg: '#0F0C16', green: '#847AFF', accent: '#FFB076', txt: '#F2F0FA' }
  },
  {
    id: 'azul-oceano',
    label: 'Azul Oceano',
    description: 'Marinho com azul-céu e turquesa.',
    swatch: { bg: '#080F18', green: '#38BDF8', accent: '#5EEAD4', txt: '#ECF3FA' }
  },
  {
    id: 'claro-menta',
    label: 'Claro Menta',
    description: 'Tema claro, branco suave com verde menta.',
    light: true,
    swatch: { bg: '#F4F7F5', green: '#11A86F', accent: '#D67C14', txt: '#141E19' }
  },
  {
    id: 'vinho-ouro',
    label: 'Vinho & Ouro',
    description: 'Bordô profundo com dourado e um toque rosé.',
    swatch: { bg: '#1A0E12', green: '#D4A72C', accent: '#E8829A', txt: '#F5EDE9' }
  },
  {
    id: 'grafite-mono',
    label: 'Grafite Mono',
    description: 'Quase preto neutro, visual minimalista de alto contraste.',
    swatch: { bg: '#0C0D0E', green: '#6FBF95', accent: '#C9CDD1', txt: '#F0F1F2' }
  },
  {
    id: 'coral-poente',
    label: 'Coral Poente',
    description: 'Grafite azulado com coral vivo e âmbar queimado.',
    swatch: { bg: '#12181F', green: '#FF7A5C', accent: '#F2B440', txt: '#F1F4F8' }
  },
  {
    id: 'claro-areia',
    label: 'Claro Areia',
    description: 'Tema claro quente, areia com oliva e terracota.',
    light: true,
    swatch: { bg: '#F6F1E7', green: '#7A8B4F', accent: '#C1653A', txt: '#241E14' }
  }
]

export const DEFAULT_THEME = 'verde-noturno'

/** Sentinel theme id for a user-built palette (see buildCustomPalette below).
 * Not part of THEMES — it has no static CSS block, its tokens are applied
 * inline instead. */
export const CUSTOM_THEME_ID = 'custom'

export function isValidTheme(id: string | undefined): id is string {
  return !!id && THEMES.some(t => t.id === id)
}

/** Applies a theme to the document root. Safe to call before React mounts.
 * Does nothing for the 'custom' sentinel — callers must follow up with
 * applyCustomPalette using the persisted customPalette tokens. */
export function applyTheme(id: string | undefined): void {
  if (typeof document === 'undefined') return
  if (id === CUSTOM_THEME_ID) {
    document.documentElement.dataset.theme = CUSTOM_THEME_ID
    return
  }
  const theme = isValidTheme(id) ? id : DEFAULT_THEME
  document.documentElement.dataset.theme = theme
}

/** The three colors a user picks to build a custom palette (hex strings). */
export interface CustomPaletteInput {
  bg: string
  primary: string
  accent: string
}

/** Derives a full 16-token theme (same shape as the static CSS blocks) from
 * just 3 user-picked colors. Card/surface tones step away from the
 * background toward white or black depending on whether the background is
 * light or dark, so both light and dark custom palettes stay readable. */
export function buildCustomPalette(input: CustomPaletteInput): Record<string, string> {
  const bg = hexToRgb(input.bg)
  const primary = hexToRgb(input.primary)
  const accent = hexToRgb(input.accent)
  const light = isLight(bg)
  const step = light ? -1 : 1 // dark themes step lighter, light themes step darker
  const txt = light ? { r: 25, g: 22, b: 18 } : { r: 245, g: 247, b: 245 }
  const muted = light ? shift(txt, 0.55) : shift(txt, -0.4)
  const danger = light ? { r: 196, g: 66, b: 60 } : { r: 255, g: 90, b: 102 }
  const warn = light ? { r: 181, g: 134, b: 15 } : { r: 255, g: 200, b: 87 }
  const line = light ? { r: 20, g: 20, b: 16 } : { r: 255, g: 255, b: 255 }

  return {
    '--c-bg': rgbToToken(bg),
    '--c-bg2': rgbToToken(shift(bg, step * 0.05)),
    '--c-card': rgbToToken(light ? { r: 255, g: 255, b: 255 } : shift(bg, step * 0.09)),
    '--c-surface': rgbToToken(shift(bg, step * 0.14)),
    '--c-green': rgbToToken(primary),
    '--c-green-dark': rgbToToken(darken(primary, 0.15)),
    '--c-accent': rgbToToken(accent),
    '--c-accent-dark': rgbToToken(darken(accent, 0.15)),
    '--c-txt': rgbToToken(txt),
    '--c-muted': rgbToToken(muted),
    '--c-danger': rgbToToken(danger),
    '--c-warn': rgbToToken(warn),
    '--c-line': rgbToToken(line),
    '--c-sheen': rgbToToken(line),
    '--grad-a': rgbToToken(primary),
    '--grad-b': rgbToToken(accent)
  }
}

/** Applies a set of "R G B" token strings as inline CSS custom properties on
 * <html>, overriding whatever [data-theme] block is active (inline style
 * wins the cascade regardless of the attribute selector). */
export function applyCustomPalette(tokens: Record<string, string>): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  for (const [key, value] of Object.entries(tokens)) {
    root.style.setProperty(key, value)
  }
}

/** Clears any inline custom-palette overrides, letting the active
 * [data-theme] CSS block take over again. */
export function clearCustomPalette(): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  for (const key of [
    '--c-bg',
    '--c-bg2',
    '--c-card',
    '--c-surface',
    '--c-green',
    '--c-green-dark',
    '--c-accent',
    '--c-accent-dark',
    '--c-txt',
    '--c-muted',
    '--c-danger',
    '--c-warn',
    '--c-line',
    '--c-sheen',
    '--grad-a',
    '--grad-b'
  ]) {
    root.style.removeProperty(key)
  }
}
