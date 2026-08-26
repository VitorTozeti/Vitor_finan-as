// Small color-math helpers used to derive a full theme token set from a
// user-picked background/primary/accent (see buildCustomPalette in
// src/data/themes.ts). Pure functions, no DOM/React dependency.

export interface Rgb {
  r: number
  g: number
  b: number
}

export function hexToRgb(hex: string): Rgb {
  const clean = hex.replace('#', '')
  const full = clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean
  const num = parseInt(full, 16)
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 }
}

/** "R G B" — the space-separated channel format every theme token uses (see
 * src/index.css), so Tailwind can apply opacity modifiers. */
export function rgbToToken({ r, g, b }: Rgb): string {
  return `${r} ${g} ${b}`
}

/** WCAG relative luminance (0 = black, 1 = white). Used to decide whether
 * text/hairlines should be light or dark against a chosen background. */
export function relativeLuminance({ r, g, b }: Rgb): number {
  const [rs, gs, bs] = [r, g, b].map(c => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
}

export function isLight(rgb: Rgb): boolean {
  return relativeLuminance(rgb) > 0.5
}

function clamp(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)))
}

/** Moves a color toward white (positive amount) or black (negative amount),
 * amount in [-1, 1]. Simple linear blend — good enough for deriving
 * surface/card tones from a base background. */
export function shift(rgb: Rgb, amount: number): Rgb {
  const target = amount >= 0 ? 255 : 0
  const t = Math.abs(amount)
  return {
    r: clamp(rgb.r + (target - rgb.r) * t),
    g: clamp(rgb.g + (target - rgb.g) * t),
    b: clamp(rgb.b + (target - rgb.b) * t)
  }
}

/** Blends two colors, `t` in [0, 1] (0 = a, 1 = b). */
export function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return {
    r: clamp(a.r + (b.r - a.r) * t),
    g: clamp(a.g + (b.g - a.g) * t),
    b: clamp(a.b + (b.b - a.b) * t)
  }
}

export function darken(rgb: Rgb, amount: number): Rgb {
  return shift(rgb, -Math.abs(amount))
}
