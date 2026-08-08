/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#080A09',
        bg2: '#101412',
        card: '#151A17',
        green: {
          DEFAULT: '#00D26A',
          dark: '#00A854'
        },
        txt: '#F5F7F6',
        muted: '#8B9690',
        danger: '#FF4D5A',
        warn: '#FFC857'
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif']
      },
      borderRadius: {
        xl: '1.1rem',
        '2xl': '1.5rem'
      },
      boxShadow: {
        soft: '0 8px 24px rgba(0,0,0,0.35)'
      }
    }
  },
  plugins: []
}
