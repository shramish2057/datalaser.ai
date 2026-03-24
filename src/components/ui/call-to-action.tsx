'use client'

import { MoveRight, PhoneCall } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { useTranslations, useLocale } from "next-intl"

function CTA() {
  const t = useTranslations()
  const locale = useLocale()

  return (
    <div className="w-full py-20 lg:py-40">
      <div className="container mx-auto px-6">
        <div className="flex flex-col text-center bg-muted rounded-md p-4 lg:p-14 gap-8 items-center">
          <div>
            <Badge>{locale === 'de' ? 'Jetzt starten' : 'Get started'}</Badge>
          </div>
          <div className="flex flex-col gap-2">
            <h3 className="text-3xl md:text-5xl tracking-tighter max-w-xl font-regular">
              {t('landing.readyTitle')}
            </h3>
            <p className="text-lg leading-relaxed tracking-tight text-muted-foreground max-w-xl">
              {t('landing.readySubtitle')}
            </p>
          </div>
          <div className="flex flex-row gap-4">
            <Link href={`/${locale}/login`}
              className="inline-flex items-center justify-center gap-4 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2">
              {locale === 'de' ? 'Einloggen' : 'Sign in'} <PhoneCall className="w-4 h-4" />
            </Link>
            <Link href={`/${locale}/signup`}
              className="inline-flex items-center justify-center gap-4 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2">
              {t('landing.cta')} <MoveRight className="w-4 h-4" />
            </Link>
          </div>
          <p className="text-sm text-muted-foreground">{t('landing.noCreditCard')}</p>
        </div>
      </div>
    </div>
  )
}

export { CTA }
