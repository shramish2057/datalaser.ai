import { NextIntlClientProvider } from 'next-intl'
import type { Metadata } from 'next'

import enMessages from '../../../messages/en.json'

export const metadata: Metadata = {
  title: 'DataLaser — AI-Native Business Analytics',
  description: 'Connect your data sources and get instant AI-powered insights',
  alternates: {
    languages: { de: '/de', en: '/en', 'x-default': '/en' },
  },
}

export default function EnLayout({ children }: { children: React.ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <div className="min-h-screen bg-dl-bg-light font-sans">
        {children}
      </div>
    </NextIntlClientProvider>
  )
}
