'use client'

import React from 'react'
import Link from 'next/link'
import { ArrowRight, ChevronRight, Zap } from 'lucide-react'
import { AnimatedGroup } from '@/components/ui/animated-group'
import { GLSLHills } from '@/components/ui/glsl-hills'
import { useTranslations, useLocale } from 'next-intl'
import { cn } from '@/lib/utils'

const transitionVariants = {
  item: {
    hidden: { opacity: 0, filter: 'blur(12px)', y: 12 },
    visible: { opacity: 1, filter: 'blur(0px)', y: 0, transition: { type: 'spring', bounce: 0.3, duration: 1.5 } },
  },
}

export function HeroSection() {
  const t = useTranslations()
  const locale = useLocale()

  return (
    <section className="relative overflow-hidden">
      {/* 3D GLSL Hills background — more visible */}
      <div className="absolute inset-0 z-0 opacity-40">
        <GLSLHills width="100%" height="100%" cameraZ={110} speed={0.35} />
      </div>
      <div className="absolute inset-0 z-0 bg-gradient-to-b from-white/40 via-white/20 to-white pointer-events-none" />

      {/* Decorative radial gradients */}
      <div aria-hidden className="z-[2] absolute inset-0 pointer-events-none isolate opacity-50 contain-strict hidden lg:block">
        <div className="w-[35rem] h-[80rem] -translate-y-[350px] absolute left-0 top-0 -rotate-45 rounded-full bg-[radial-gradient(68.54%_68.72%_at_55.02%_31.46%,hsla(270,70%,85%,.08)_0,hsla(270,50%,55%,.02)_50%,hsla(270,50%,45%,0)_80%)]" />
        <div className="h-[80rem] absolute left-0 top-0 w-56 -rotate-45 rounded-full bg-[radial-gradient(50%_50%_at_50%_50%,hsla(270,70%,85%,.06)_0,hsla(270,50%,45%,.02)_80%,transparent_100%)] [translate:5%_-50%]" />
      </div>

      <div className="relative pt-28 md:pt-40 z-10">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center sm:mx-auto">
            <AnimatedGroup variants={transitionVariants}>
              {/* Badge */}
              <Link
                href={`/${locale}/signup`}
                className="hover:bg-white bg-violet-50 group mx-auto flex w-fit items-center gap-4 rounded-full border border-violet-200 p-1 pl-4 shadow-md shadow-violet-500/5 transition-all duration-300">
                <span className="text-violet-700 text-sm font-medium">{t('landing.badge')}</span>
                <span className="block h-4 w-0.5 bg-violet-200"></span>
                <div className="bg-white group-hover:bg-violet-50 size-6 overflow-hidden rounded-full duration-500">
                  <div className="flex w-12 -translate-x-1/2 duration-500 ease-in-out group-hover:translate-x-0">
                    <span className="flex size-6"><ArrowRight className="m-auto size-3 text-violet-600" /></span>
                    <span className="flex size-6"><ArrowRight className="m-auto size-3 text-violet-600" /></span>
                  </div>
                </div>
              </Link>

              {/* Heading */}
              <h1 className="mt-8 max-w-4xl mx-auto text-balance text-5xl sm:text-6xl md:text-7xl lg:mt-16 xl:text-[5.25rem] font-extrabold tracking-tight text-gray-900">
                {locale === 'de' ? (
                  <>Ihre Daten. <span className="text-violet-600">Durchleuchtet.</span></>
                ) : (
                  <>Your data. <span className="text-violet-600">Interrogated.</span></>
                )}
              </h1>

              {/* Subtitle */}
              <p className="mx-auto mt-8 max-w-2xl text-balance text-lg text-gray-500">
                {t('landing.heroDesc')}
              </p>
            </AnimatedGroup>

            {/* CTAs */}
            <AnimatedGroup
              variants={{
                container: { visible: { transition: { staggerChildren: 0.05, delayChildren: 0.75 } } },
                ...transitionVariants,
              }}
              className="mt-12 flex flex-col items-center justify-center gap-3 md:flex-row">
              <div className="bg-violet-600/10 rounded-[14px] border border-violet-200 p-0.5">
                <Link href={`/${locale}/signup`}
                  className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-6 py-3 rounded-xl font-medium transition-colors text-sm shadow-lg shadow-violet-600/25">
                  {t('landing.cta')}
                  <ArrowRight size={16} />
                </Link>
              </div>
              <Link href="#features"
                className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-900 px-6 py-3 rounded-xl text-sm transition-colors">
                {t('landing.ctaDemo')}
              </Link>
            </AnimatedGroup>

            <p className="text-sm text-gray-400 mt-4">{t('landing.ctaFooter')}</p>
          </div>
        </div>

        {/* Dashboard preview */}
        <AnimatedGroup
          variants={{
            container: { visible: { transition: { staggerChildren: 0.05, delayChildren: 0.75 } } },
            ...transitionVariants,
          }}>
          <div className="relative -mr-56 mt-8 overflow-hidden px-2 sm:mr-0 sm:mt-12 md:mt-20">
            <div aria-hidden className="bg-gradient-to-b to-white absolute inset-0 z-10 from-transparent from-35%" />
            <div className="bg-white relative mx-auto max-w-6xl overflow-hidden rounded-2xl border border-gray-200 p-4 shadow-xl shadow-gray-200/50">
              {/* Dashboard mockup */}
              <div className="rounded-xl border border-gray-100 overflow-hidden">
                <div className="flex items-center gap-1.5 px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                    <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
                  </div>
                  <div className="flex-1 mx-6">
                    <div className="bg-gray-100 rounded-md px-3 py-1 text-[10px] text-gray-400 text-center max-w-[200px] mx-auto">
                      app.datalaser.ai/insights
                    </div>
                  </div>
                </div>
                <div className="p-5">
                  <div className="grid grid-cols-4 gap-3 mb-4">
                    {[
                      { label: 'Revenue', value: '€284,920', delta: '+18.4%', up: true },
                      { label: 'Orders', value: '2,640', delta: '+12.1%', up: true },
                      { label: 'CAC', value: '€109', delta: '+12.0%', up: false },
                      { label: 'Churn', value: '2.3%', delta: '-0.1%', up: true },
                    ].map(kpi => (
                      <div key={kpi.label} className="bg-gray-50/80 rounded-xl p-3 border border-gray-100">
                        <p className="text-[9px] text-gray-400 uppercase tracking-wider font-medium">{kpi.label}</p>
                        <p className="text-lg font-bold text-gray-900 mt-0.5">{kpi.value}</p>
                        <span className={`text-[10px] font-semibold ${kpi.up ? 'text-emerald-500' : 'text-red-500'}`}>{kpi.delta}</span>
                      </div>
                    ))}
                  </div>
                  <div className="bg-gray-50/50 rounded-xl border border-gray-100 p-4 h-36 flex items-end gap-[3px]">
                    {Array.from({ length: 36 }, (_, i) => (
                      <div key={i} className="flex-1 bg-gradient-to-t from-violet-500 to-violet-300 rounded-[2px] opacity-75"
                        style={{ height: `${25 + Math.sin(i * 0.4) * 18 + Math.random() * 25}%` }} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </AnimatedGroup>

        {/* Logo bar */}
        <div className="bg-white pb-16 pt-16 md:pb-24">
          <div className="group relative m-auto max-w-5xl px-6">
            <div className="absolute inset-0 z-10 flex scale-95 items-center justify-center opacity-0 duration-500 group-hover:scale-100 group-hover:opacity-100">
              <span className="text-sm text-gray-500">{locale === 'de' ? 'Vertraut von führenden Unternehmen' : 'Trusted by leading companies'}</span>
            </div>
            <div className="group-hover:blur-xs mx-auto mt-4 grid max-w-2xl grid-cols-4 gap-x-12 gap-y-8 transition-all duration-500 group-hover:opacity-50 sm:gap-x-16 sm:gap-y-14 items-center">
              {['🐘 PostgreSQL', '❄️ Snowflake', '🛍️ Shopify', '💳 Stripe', '☁️ BigQuery', '📢 Google Ads', '🧡 HubSpot', '💚 QuickBooks'].map(name => (
                <div key={name} className="flex justify-center">
                  <span className="text-sm text-gray-400 font-medium">{name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
