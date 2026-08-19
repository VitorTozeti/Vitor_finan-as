// Theme catalog. Each entry maps to a [data-theme="id"] block in src/index.css.
// `swatch` holds a few representative hex colors purely for the settings picker
// preview (bg, green, accent, txt) — the real colors live in the CSS tokens.

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
  }
]

export const DEFAULT_THEME = 'verde-noturno'

export function isValidTheme(id: string | undefined): id is string {
  return !!id && THEMES.some(t => t.id === id)
}

/** Applies a theme to the document root. Safe to call before React mounts. */
export function applyTheme(id: string | undefined): void {
  const theme = isValidTheme(id) ? id : DEFAULT_THEME
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = theme
  }
}
