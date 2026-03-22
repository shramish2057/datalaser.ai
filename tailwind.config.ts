import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Metabase exact colors
        'mb-bg':           '#FFFFFF',
        'mb-bg-light':     '#F8FAFB',
        'mb-bg-medium':    '#EBF1F4',
        'mb-bg-hover':     '#F8FAFB',
        'mb-border':       '#E8ECEE',
        'mb-border-dark':  '#D4D9DD',
        'mb-brand':        '#4A9EDA',
        'mb-brand-hover':  '#DAEDF8',
        'mb-brand-dark':   '#2F84C4',
        'mb-text-dark':    '#2E353B',
        'mb-text-medium':  '#74838F',
        'mb-text-light':   '#949AAB',
        'mb-success':      '#84BB4C',
        'mb-error':        '#ED6E6E',
        'mb-warning':      '#F9CF48',
        'mb-accent1':      '#9CC177',
        'mb-accent2':      '#A989C5',
        'mb-shadow':       'rgba(0,0,0,0.08)',
      },
      fontFamily: {
        sans: ['Lato', 'sans-serif'],
        mono: ['Monaco', 'monospace'],
      },
      fontSize: {
        'mb-xs':   ['11px', '14px'],
        'mb-sm':   ['12px', '16px'],
        'mb-base': ['14px', '20px'],
        'mb-lg':   ['16px', '24px'],
        'mb-xl':   ['18px', '28px'],
        'mb-2xl':  ['21px', '28px'],
        'mb-3xl':  ['24px', '32px'],
      },
      borderRadius: {
        'mb-sm':  '4px',
        'mb-md':  '6px',
        'mb-lg':  '8px',
      },
      boxShadow: {
        'mb-sm':  '0 1px 3px rgba(0,0,0,0.08)',
        'mb-md':  '0 2px 8px rgba(0,0,0,0.08)',
        'mb-lg':  '0 4px 20px rgba(0,0,0,0.10)',
      },
    },
  },
  plugins: [],
}
export default config
