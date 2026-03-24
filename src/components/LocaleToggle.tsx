'use client'

import { useLocale } from 'next-intl'
import { useRouter } from 'next/navigation'

export function LocaleToggle() {
  const locale = useLocale()
  const router = useRouter()

  const switchLocale = (newLocale: string) => {
    if (newLocale === locale) return
    // Set cookie and refresh
    document.cookie = `dl_locale=${newLocale};path=/;max-age=${365 * 24 * 3600}`
    router.refresh()
  }

  return (
    <div className="flex items-center bg-dl-bg-medium rounded-full p-0.5">
      <button
        onClick={() => switchLocale('de')}
        className={`text-dl-xs font-bold px-2 py-0.5 rounded-full transition-colors ${
          locale === 'de'
            ? 'bg-white text-dl-text-dark shadow-sm'
            : 'text-dl-text-light hover:text-dl-text-medium'
        }`}
      >
        DE
      </button>
      <button
        onClick={() => switchLocale('en')}
        className={`text-dl-xs font-bold px-2 py-0.5 rounded-full transition-colors ${
          locale === 'en'
            ? 'bg-white text-dl-text-dark shadow-sm'
            : 'text-dl-text-light hover:text-dl-text-medium'
        }`}
      >
        EN
      </button>
    </div>
  )
}
