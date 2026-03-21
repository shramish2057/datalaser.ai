import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'bg-base': '#080D17',
        'surface-01': '#0F1623',
        'surface-02': '#141D2E',
        'border-base': '#1A2540',
        'accent-blue': '#1A56DB',
        'accent-violet': '#6C3FC8',
        'positive': '#0D7A4E',
        'warning-color': '#92400E',
        'critical': '#B91C1C',
        'text-primary': '#E8EDF5',
        'text-muted': '#5A7294',
        'text-mono': '#A8C0E0',
      },
      fontFamily: {
        display: ['Syne', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
        mono: ['Geist Mono', 'monospace'],
      },
      borderRadius: {
        card: '10px',
        btn: '8px',
        chip: '6px',
      },
      boxShadow: {
        card: '0 4px 24px rgba(0,0,0,0.4)',
        glow: '0 0 40px rgba(26,86,219,0.15)',
      },
    },
  },
  plugins: [],
}
export default config
