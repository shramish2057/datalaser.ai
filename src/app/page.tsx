import { redirect } from 'next/navigation'
import { cookies, headers } from 'next/headers'

export default async function RootRedirect() {
  // Detect locale: cookie > Accept-Language > default 'en'
  const cookieStore = await cookies()
  const cookieLocale = cookieStore.get('dl_locale')?.value

  let locale = cookieLocale
  if (!locale) {
    const headerStore = await headers()
    const acceptLang = headerStore.get('accept-language') || ''
    locale = acceptLang.includes('de') ? 'de' : 'en'
  }

  const safeLocale = ['de', 'en'].includes(locale || '') ? locale : 'en'
  redirect(`/${safeLocale}`)
}
