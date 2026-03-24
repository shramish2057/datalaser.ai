'use client'

import React from 'react'
import Link from 'next/link'
import { ArrowRight, Zap } from 'lucide-react'
import { AnimatedGroup } from '@/components/ui/animated-group'
import { GLSLHills } from '@/components/ui/glsl-hills'
import { useTranslations, useLocale } from 'next-intl'

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
      {/* 3D GLSL Hills background — shifted up */}
      <div className="absolute z-0 opacity-85 left-0 right-0" style={{ top: '-350px', bottom: '-500px' }}>                                                      
        <GLSLHills width="100%" height="190px" cameraZ={110} speed={0.35} /> 
        <GLSLHills width="100%" height="190px" cameraZ={110} speed={0.35} /> 
      </div>
      <div className="absolute inset-0 z-0 bg-gradient-to-b from-white/40 via-white/20 to-white pointer-events-none" />

      {/* Decorative radial gradients */}
      <div aria-hidden className="z-[2] absolute inset-0 pointer-events-none isolate opacity-50 hidden lg:block">
        <div className="w-[35rem] h-[80rem] -translate-y-[350px] absolute left-0 top-0 -rotate-45 rounded-full bg-[radial-gradient(68.54%_68.72%_at_55.02%_31.46%,hsla(270,70%,85%,.08)_0,hsla(270,50%,55%,.02)_50%,hsla(270,50%,45%,0)_80%)]" />
      </div>

      <div className="relative pt-28 md:pt-36 pb-4 z-10">
        <div className="mx-auto max-w-7xl px-6">
          {/* ── SIDE-BY-SIDE LAYOUT: Text Left + Dashboard Right ── */}
          <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16">

            {/* LEFT — Text content */}
            <div className="flex-1 lg:text-left text-center">
              <AnimatedGroup variants={transitionVariants}>
                {/* Badge */}
                <Link
                  href={`/${locale}/signup`}
                  className="hover:bg-white bg-gray-50 group inline-flex items-center gap-4 rounded-full border border-gray-200 p-1 pl-4 shadow-md shadow-gray-900/5 transition-all duration-300">
                  <span className="text-gray-900 text-sm font-medium">{t('landing.badge')}</span>
                  <span className="block h-4 w-0.5 bg-gray-200"></span>
                  <div className="bg-white group-hover:bg-gray-50 size-6 overflow-hidden rounded-full duration-500">
                    <div className="flex w-12 -translate-x-1/2 duration-500 ease-in-out group-hover:translate-x-0">
                      <span className="flex size-6"><ArrowRight className="m-auto size-3 text-gray-900" /></span>
                      <span className="flex size-6"><ArrowRight className="m-auto size-3 text-gray-900" /></span>
                    </div>
                  </div>
                </Link>

                {/* Heading */}
                <h1 className="mt-8 text-5xl sm:text-6xl xl:text-7xl font-extrabold tracking-tight text-gray-900 leading-[1.05]">
                  {locale === 'de' ? (
                    <>Ihre Daten.<br /><span className="text-gray-900">Durchleuchtet.</span></>
                  ) : (
                    <>Your data.<br /><span className="text-gray-900">Interrogated.</span></>
                  )}
                </h1>

                {/* Subtitle */}
                <p className="mt-6 text-lg text-gray-500 max-w-lg leading-relaxed">
                  {t('landing.heroDesc')}
                </p>
              </AnimatedGroup>

              {/* CTAs */}
              <AnimatedGroup
                variants={{
                  container: { visible: { transition: { staggerChildren: 0.05, delayChildren: 0.75 } } },
                  ...transitionVariants,
                }}
                className="mt-10 flex flex-col sm:flex-row items-center lg:items-start gap-3">
                <div className="bg-gray-900/10 rounded-[14px] border border-gray-200 p-0.5">
                  <Link href={`/${locale}/signup`}
                    className="inline-flex items-center gap-2 bg-gray-900 hover:bg-gray-800 text-white px-7 py-3.5 rounded-xl font-medium transition-colors text-sm shadow-lg shadow-gray-900/15">
                    {t('landing.cta')}
                    <ArrowRight size={16} />
                  </Link>
                </div>
                <Link href="#features"
                  className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-900 px-6 py-3.5 rounded-xl text-sm transition-colors">
                  {t('landing.ctaDemo')}
                </Link>
              </AnimatedGroup>

              <p className="text-sm text-gray-400 mt-4 mb-8 lg:text-left text-center">{t('landing.ctaFooter')}</p>
            </div>

            {/* RIGHT — Dashboard preview (compact, tilted) */}
            <AnimatedGroup
              variants={{
                container: { visible: { transition: { staggerChildren: 0.05, delayChildren: 0.5 } } },
                ...transitionVariants,
              }}
              className="flex-1 w-full max-w-xl lg:max-w-none">
              <div className="relative">
                {/* Glow behind dashboard */}
                <div className="absolute -inset-8 bg-gradient-to-br from-gray-200/30 to-gray-200/20 rounded-3xl blur-2xl" />

                {/* Dashboard card — tilted */}
                <div className="relative bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-2xl shadow-gray-300/40 lg:rotate-2 lg:hover:rotate-0 transition-transform duration-700">
                  {/* Browser chrome */}
                  <div className="flex items-center gap-1.5 px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                    <div className="flex gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                      <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                      <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
                    </div>
                    <div className="flex-1 mx-4">
                      <div className="bg-gray-100 rounded-md px-3 py-1 text-[10px] text-gray-400 text-center max-w-[180px] mx-auto">
                        app.datalaser.ai/insights
                      </div>
                    </div>
                  </div>

                  {/* KPI row */}
                  <div className="p-4">
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      {[
                        { label: 'Revenue', value: '€284K', delta: '+18.4%', up: true },
                        { label: 'Orders', value: '2,640', delta: '+12.1%', up: true },
                        { label: 'CAC', value: '€109', delta: '+12.0%', up: false },
                        { label: 'Churn', value: '2.3%', delta: '-0.1%', up: true },
                      ].map(kpi => (
                        <div key={kpi.label} className="bg-gray-50/80 rounded-lg p-2.5 border border-gray-100">
                          <p className="text-[8px] text-gray-400 uppercase tracking-wider font-medium">{kpi.label}</p>
                          <p className="text-base font-bold text-gray-900">{kpi.value}</p>
                          <span className={`text-[9px] font-semibold ${kpi.up ? 'text-emerald-500' : 'text-red-500'}`}>{kpi.delta}</span>
                        </div>
                      ))}
                    </div>

                    {/* Chart */}
                    <div className="bg-gray-50/50 rounded-lg border border-gray-100 p-3 h-28 flex items-end gap-[2px]">
                      {Array.from({ length: 28 }, (_, i) => (
                        <div key={i} className="flex-1 bg-gradient-to-t from-gray-700 to-gray-400 rounded-[1px] opacity-75"
                          style={{ height: `${25 + Math.sin(i * 0.45) * 18 + Math.random() * 25}%` }} />
                      ))}
                    </div>

                    {/* AI insight bar */}
                    <div className="mt-3 bg-gray-50 border border-gray-200 rounded-lg p-2.5 flex items-start gap-2">
                      <Zap size={14} className="text-gray-900 mt-0.5 flex-shrink-0" />
                      <p className="text-[10px] text-gray-800 leading-relaxed">
                        {locale === 'de'
                          ? 'Umsatz stieg 18,4% MoM, Elektronik-Segment treibt das Wachstum. CAC-Anstieg von 12% erfordert Marketing-Review.'
                          : 'Revenue grew 18.4% MoM driven by Electronics. CAC increased 12%, flag for marketing review. Churn held at 2.3%.'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </AnimatedGroup>
          </div>
        </div>

        {/* Trusted by bar */}
        <div className="bg-white pb-0 pt-20">
          <p className="text-center text-xs text-gray-400 uppercase tracking-[0.2em] font-semibold mb-8">
            {locale === 'de' ? 'Vertraut von innovativen Unternehmen' : 'Trusted by forward-thinking companies'}
          </p>
          <div className="m-auto max-w-3xl px-6">
            <div className="mx-auto flex flex-wrap justify-center items-center gap-x-12 gap-y-6 sm:gap-x-16 opacity-60 hover:opacity-100 transition-opacity duration-500">
              {[
                { name: 'TEI Group', src: '/logos/tei.svg' },
                { name: 'Globalfokus', src: '/logos/globalfokus.svg' },
                { name: 'Brandfluenz', src: '/logos/brandfluenz.svg' },
                { name: 'Nordkraft', src: '/logos/nordkraft.svg' },
                { name: 'Velonova', src: '/logos/velonova.svg' },
              ].map(logo => (
                <div key={logo.name} className="flex items-center gap-2.5">
                  <img src={logo.src} alt={logo.name} className="h-9 w-9 object-contain rounded-lg" />
                  <span className="text-sm text-gray-500 font-semibold tracking-tight">{logo.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
