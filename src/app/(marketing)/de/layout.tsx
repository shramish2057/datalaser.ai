import { NextIntlClientProvider } from 'next-intl'
import type { Metadata } from 'next'

import deMessages from '../../../messages/de.json'

export const metadata: Metadata = {
  title: 'DataLaser — KI-gestützte Geschäftsanalyse',
  description: 'Verbinden Sie Ihre Datenquellen und erhalten Sie sofort KI-gestützte Erkenntnisse',
  alternates: {
    languages: { de: '/de', en: '/en', 'x-default': '/en' },
  },
}

export default function DeLayout({ children }: { children: React.ReactNode }) {
  return (
    <NextIntlClientProvider locale="de" messages={deMessages}>
      <div className="min-h-screen bg-dl-bg-light font-sans">
        {children}
      </div>
    </NextIntlClientProvider>
  )
}
