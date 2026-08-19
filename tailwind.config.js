/** @type {import('tailwindcss').Config} */

// Color tokens are driven by CSS custom properties (see src/index.css) so the
// whole palette can be swapped at runtime by setting `data-theme` on <html>.
// Each token is exposed as `rgb(var(--c-x) / <alpha-value>)` so Tailwind's
// opacity modifiers (e.g. bg-card/60, text-green/80) keep working.
const withVar = (name) => `rgb(var(${name}) / <alpha-value>)`

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: withVar('--c-bg'),
        bg2: withVar('--c-bg2'),
        card: withVar('--c-card'),
        surface: withVar('--c-surface'),
        green: {
          DEFAULT: withVar('--c-green'),
          dark: withVar('--c-green-dark')
        },
        accent: {
          DEFAULT: withVar('--c-accent'),
          dark: withVar('--c-accent-dark')
        },
        txt: withVar('--c-txt'),
        muted: withVar('--c-muted'),
        danger: withVar('--c-danger'),
        warn: withVar('--c-warn'),
        // Hairline border tint that adapts to light/dark themes.
        line: 'rgb(var(--c-line) / <alpha-value>)'
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['"Space Grotesk"', 'Inter', 'system-ui', 'sans-serif']
      },
      borderRadius: {
        xl: '1.1rem',
        '2xl': '1.5rem',
        '3xl': '1.9rem'
      },
      boxShadow: {
        soft: '0 8px 24px rgba(0,0,0,0.35)',
        glow: '0 0 0 1px rgb(var(--c-green) / 0.25), 0 8px 30px rgb(var(--c-green) / 0.18)',
        'glow-accent': '0 0 0 1px rgb(var(--c-accent) / 0.25), 0 8px 30px rgb(var(--c-accent) / 0.16)'
      },
      backgroundImage: {
        'brand-fade': 'linear-gradient(135deg, rgb(var(--c-green) / 0.16), rgb(var(--c-accent) / 0.08))',
        'card-sheen': 'linear-gradient(160deg, rgb(var(--c-sheen) / 0.05), rgb(var(--c-sheen) / 0) 60%)'
      }
    }
  },
  plugins: []
}
