/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Base surfaces — a softer, warmer near-black with a faint green undertone
        // (less harsh than the old pure #080A09).
        bg: '#0B0F0D',
        bg2: '#111815',
        card: '#161D19',
        // Elevated surface for accents / highlighted cards.
        surface: '#1B231E',
        // Brand: a more organic, slightly less neon green + a warm amber accent
        // that carries the "human" warmth across CTAs and positive highlights.
        green: {
          DEFAULT: '#1FD98A',
          dark: '#13B571'
        },
        accent: {
          DEFAULT: '#FFB454',
          dark: '#F59E2E'
        },
        txt: '#F3F6F4',
        muted: '#889389',
        danger: '#FF5A66',
        warn: '#FFC857'
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        // Space Grotesk (already loaded) as the display face for numbers / big titles.
        display: ['"Space Grotesk"', 'Inter', 'system-ui', 'sans-serif']
      },
      borderRadius: {
        xl: '1.1rem',
        '2xl': '1.5rem',
        '3xl': '1.9rem'
      },
      boxShadow: {
        soft: '0 8px 24px rgba(0,0,0,0.35)',
        glow: '0 0 0 1px rgba(31,217,138,0.25), 0 8px 30px rgba(31,217,138,0.18)',
        'glow-accent': '0 0 0 1px rgba(255,180,84,0.25), 0 8px 30px rgba(255,180,84,0.16)'
      },
      backgroundImage: {
        'brand-fade': 'linear-gradient(135deg, rgba(31,217,138,0.16), rgba(255,180,84,0.08))',
        'card-sheen': 'linear-gradient(160deg, rgba(255,255,255,0.04), rgba(255,255,255,0) 60%)'
      }
    }
  },
  plugins: []
}
