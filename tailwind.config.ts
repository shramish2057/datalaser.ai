import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // DataLaser brand colors
        'dl-bg':           '#FFFFFF',
        'dl-bg-light':     '#F8FAFB',
        'dl-bg-medium':    '#EBF1F4',
        'dl-bg-hover':     '#F8FAFB',
        'dl-border':       '#E8ECEE',
        'dl-border-dark':  '#D4D9DD',
        'dl-brand':        '#191919',
        'dl-brand-hover':  '#F5F5F5',
        'dl-brand-dark':   '#000000',
        'dl-text-dark':    '#2E353B',
        'dl-text-medium':  '#74838F',
        'dl-text-light':   '#949AAB',
        'dl-success':      '#84BB4C',
        'dl-error':        '#ED6E6E',
        'dl-warning':      '#F9CF48',
        'dl-accent1':      '#9CC177',
        'dl-accent2':      '#A989C5',
        'dl-shadow':       'rgba(0,0,0,0.08)',
      },
      fontFamily: {
        sans: ['Lato', 'sans-serif'],
        mono: ['Monaco', 'monospace'],
      },
      fontSize: {
        'dl-xs':   ['11px', '14px'],
        'dl-sm':   ['12px', '16px'],
        'dl-base': ['14px', '20px'],
        'dl-lg':   ['16px', '24px'],
        'dl-xl':   ['18px', '28px'],
        'dl-2xl':  ['21px', '28px'],
        'dl-3xl':  ['24px', '32px'],
      },
      borderRadius: {
        'dl-sm':  '4px',
        'dl-md':  '6px',
        'dl-lg':  '8px',
      },
      boxShadow: {
        'dl-sm':  '0 1px 3px rgba(0,0,0,0.08)',
        'dl-md':  '0 2px 8px rgba(0,0,0,0.08)',
        'dl-lg':  '0 4px 20px rgba(0,0,0,0.10)',
      },
    },
  },
  plugins: [],
}
export default config
