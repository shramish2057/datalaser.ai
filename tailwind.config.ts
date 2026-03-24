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
        'dl-xs':   ['12px', '16px'],
        'dl-sm':   ['13px', '18px'],
        'dl-base': ['14px', '20px'],
        'dl-lg':   ['16px', '24px'],
        'dl-xl':   ['18px', '28px'],
        'dl-2xl':  ['21px', '28px'],
        'dl-3xl':  ['24px', '32px'],
      },
      borderRadius: {
        'dl-sm':  '6px',
        'dl-md':  '8px',
        'dl-lg':  '10px',
      },
      boxShadow: {
        'dl-sm':  '0 1px 4px rgba(0,0,0,0.09)',
        'dl-md':  '0 2px 10px rgba(0,0,0,0.09)',
        'dl-lg':  '0 4px 24px rgba(0,0,0,0.11)',
      },
    },
  },
  plugins: [],
}
export default config
