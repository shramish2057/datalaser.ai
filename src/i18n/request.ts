import { getRequestConfig } from 'next-intl/server'
import { cookies, headers } from 'next/headers'

export default getRequestConfig(async () => {
  // 1. Check cookie
  const cookieStore = await cookies()
  const cookieLocale = cookieStore.get('dl_locale')?.value

  // 2. Check Accept-Language header
  let headerLocale: string | undefined
  if (!cookieLocale) {
    const headerStore = await headers()
    const acceptLang = headerStore.get('accept-language') || ''
    if (acceptLang.includes('de')) headerLocale = 'de'
  }

  // 3. Resolve: cookie > header > default 'en'
  const locale = cookieLocale || headerLocale || 'en'
  const safeLocale = ['de', 'en'].includes(locale) ? locale : 'en'

  return {
    locale: safeLocale,
    messages: (await import(`../messages/${safeLocale}.json`)).default,
  }
})
