'use client'

import { useTranslations, useLocale } from 'next-intl'
import Link from 'next/link'
import { useState, useEffect, useRef } from 'react'
import { motion, useInView } from 'motion/react'
import {
  ArrowRight, Check, ChevronDown, Database, Zap, BarChart3,
  Globe, Sparkles, TrendingUp, Search,
  Menu, X, Play, Shield, Clock, LineChart, PieChart, Layers,
} from 'lucide-react'

/* ── scroll-triggered reveal ── */
function Reveal({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })
  return (
    <motion.div ref={ref} className={className}
      initial={{ opacity: 0, y: 28 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.55, delay, ease: [0.25, 1, 0.5, 1] }}>
      {children}
    </motion.div>
  )
}

const CONNECTORS = [
  { name: 'PostgreSQL', icon: '🐘' }, { name: 'Snowflake', icon: '❄️' },
  { name: 'BigQuery', icon: '☁️' }, { name: 'Shopify', icon: '🛍️' },
  { name: 'Stripe', icon: '💳' }, { name: 'Google Ads', icon: '📢' },
  { name: 'HubSpot', icon: '🧡' }, { name: 'QuickBooks', icon: '💚' },
  { name: 'MongoDB', icon: '🍃' }, { name: 'MySQL', icon: '🐬' },
  { name: 'Meta Ads', icon: '👤' }, { name: 'Redshift', icon: '🔴' },
]

export default function LandingPage() {
  const t = useTranslations()
  const locale = useLocale()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [annual, setAnnual] = useState(true)
  const [faqOpen, setFaqOpen] = useState<number | null>(null)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', h, { passive: true })
    return () => window.removeEventListener('scroll', h)
  }, [])

  const links = [
    { label: t('landing.nav.features'), href: '#features' },
    { label: t('landing.nav.pricing'), href: '#pricing' },
    { label: t('landing.nav.connectors'), href: '#connectors' },
  ]

  const faqs = locale === 'de' ? [
    { q: 'Wie schnell kann ich starten?', a: 'In unter 2 Minuten. CSV hochladen oder Datenbank verbinden — erste Erkenntnisse in 10 Sekunden.' },
    { q: 'Brauche ich technische Kenntnisse?', a: 'Nein. Kein SQL, kein Code, kein Data Engineering. DataLaser analysiert Ihre Daten automatisch.' },
    { q: 'Wo werden meine Daten gespeichert?', a: 'Auf deutschen Servern. Vollständig DSGVO-konform.' },
    { q: 'Kann ich DataLaser kostenlos testen?', a: 'Ja. Der Starter-Plan ist dauerhaft kostenlos — keine Kreditkarte erforderlich.' },
    { q: 'Welche Datenquellen werden unterstützt?', a: 'CSV, Excel, JSON, PostgreSQL, MySQL, MongoDB, Snowflake, BigQuery, Redshift, Shopify, Stripe, Google Ads, Meta Ads, HubSpot, QuickBooks und mehr.' },
  ] : [
    { q: 'How fast can I get started?', a: 'Under 2 minutes. Upload a CSV or connect a database — first insights in 10 seconds.' },
    { q: 'Do I need technical skills?', a: 'No. No SQL, no code, no data engineering. DataLaser analyzes your data automatically.' },
    { q: 'Where is my data stored?', a: 'On secure, SOC2-compliant infrastructure. Fully GDPR compliant.' },
    { q: 'Can I try DataLaser for free?', a: 'Yes. The Starter plan is free forever — no credit card required.' },
    { q: 'What data sources are supported?', a: 'CSV, Excel, JSON, PostgreSQL, MySQL, MongoDB, Snowflake, BigQuery, Redshift, Shopify, Stripe, Google Ads, Meta Ads, HubSpot, QuickBooks and more.' },
  ]

  return (
    <div className="min-h-screen bg-white text-gray-900">

      {/* ━━ NAV ━━ */}
      <nav className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-white/80 backdrop-blur-xl shadow-sm' : 'bg-transparent'
      }`}>
        <div className="max-w-7xl mx-auto px-6 lg:px-8 h-[72px] flex items-center justify-between">
          <Link href={`/${locale}`} className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-violet-700 flex items-center justify-center shadow-lg shadow-violet-600/25">
              <Zap size={18} className="text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight text-gray-900">DataLaser</span>
          </Link>

          <div className="hidden lg:flex items-center gap-10">
            {links.map(l => (
              <a key={l.label} href={l.href} className="text-[15px] text-gray-500 hover:text-gray-900 transition-colors">{l.label}</a>
            ))}
          </div>

          <div className="hidden lg:flex items-center gap-4">
            <Link href={`/${locale}/login`} className="text-[15px] text-gray-500 hover:text-gray-900 transition-colors px-4 py-2">
              {t('landing.login')}
            </Link>
            <Link href={`/${locale}/signup`}
              className="text-[15px] font-medium bg-violet-600 hover:bg-violet-700 text-white px-6 py-2.5 rounded-xl transition-colors shadow-lg shadow-violet-600/25">
              {t('landing.getStarted')}
            </Link>
          </div>

          <button className="lg:hidden" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {mobileOpen && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
            className="lg:hidden bg-white border-t border-gray-100 px-6 py-6 space-y-4 shadow-lg">
            {links.map(l => <a key={l.label} href={l.href} className="block text-gray-600" onClick={() => setMobileOpen(false)}>{l.label}</a>)}
            <Link href={`/${locale}/signup`} className="block bg-violet-600 text-white text-center py-3 rounded-xl font-medium">
              {t('landing.getStarted')}
            </Link>
          </motion.div>
        )}
      </nav>

      {/* ━━ HERO ━━ */}
      <section className="relative pt-36 pb-24 px-6 overflow-hidden">
        {/* Ambient glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[700px] pointer-events-none opacity-40">
          <div className="absolute top-16 left-[30%] w-[400px] h-[400px] bg-violet-200 rounded-full blur-[140px]" />
          <div className="absolute top-32 right-[25%] w-[300px] h-[300px] bg-indigo-200 rounded-full blur-[120px]" />
        </div>

        <div className="max-w-4xl mx-auto text-center relative z-10">
          <Reveal>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-50 border border-violet-200 text-sm text-violet-700 font-medium mb-8">
              <Sparkles size={14} />
              {t('landing.badge')}
            </div>
          </Reveal>

          <Reveal delay={0.08}>
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.08] text-gray-900 mb-6">
              {locale === 'de' ? (
                <>Ihre Daten.<br /><span className="text-violet-600">Durchleuchtet.</span></>
              ) : (
                <>Your data.<br /><span className="text-violet-600">Interrogated.</span></>
              )}
            </h1>
          </Reveal>

          <Reveal delay={0.16}>
            <p className="text-xl text-gray-500 max-w-2xl mx-auto mb-10 leading-relaxed">
              {t('landing.heroDesc')}
            </p>
          </Reveal>

          <Reveal delay={0.24}>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-4">
              <Link href={`/${locale}/signup`}
                className="group flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-8 py-4 rounded-xl font-medium transition-all shadow-xl shadow-violet-600/25 text-base w-full sm:w-auto justify-center">
                {t('landing.cta')}
                <ArrowRight size={18} className="group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <a href="#features"
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900 px-8 py-4 rounded-xl border border-gray-200 hover:border-gray-300 transition-all text-base w-full sm:w-auto justify-center bg-white">
                <Play size={15} />
                {t('landing.ctaDemo')}
              </a>
            </div>
            <p className="text-sm text-gray-400">{t('landing.ctaFooter')}</p>
          </Reveal>

          {/* Dashboard preview */}
          <Reveal delay={0.4}>
            <div className="mt-20 relative">
              <div className="absolute -inset-6 bg-gradient-to-b from-violet-100/50 to-transparent rounded-3xl blur-2xl" />
              <div className="relative bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-2xl shadow-gray-200/60">
                <div className="flex items-center gap-2 px-5 py-3.5 bg-gray-50 border-b border-gray-100">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-400" />
                    <div className="w-3 h-3 rounded-full bg-yellow-400" />
                    <div className="w-3 h-3 rounded-full bg-green-400" />
                  </div>
                  <div className="flex-1 mx-8">
                    <div className="bg-gray-100 rounded-lg px-4 py-1.5 text-xs text-gray-400 text-center max-w-xs mx-auto">
                      app.datalaser.ai/insights
                    </div>
                  </div>
                </div>

                <div className="p-6">
                  {/* KPI row */}
                  <div className="grid grid-cols-4 gap-4 mb-6">
                    {[
                      { label: 'Revenue', value: '€284,920', delta: '+18.4%', up: true },
                      { label: 'Orders', value: '2,640', delta: '+12.1%', up: true },
                      { label: 'CAC', value: '€109', delta: '+12.0%', up: false },
                      { label: 'Churn', value: '2.3%', delta: '-0.1%', up: true },
                    ].map((kpi, i) => (
                      <motion.div key={kpi.label}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.8 + i * 0.08, duration: 0.4 }}
                        className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                        <p className="text-[10px] text-gray-400 uppercase tracking-wider font-medium mb-1">{kpi.label}</p>
                        <p className="text-xl font-bold text-gray-900">{kpi.value}</p>
                        <span className={`text-xs font-semibold ${kpi.up ? 'text-emerald-500' : 'text-red-500'}`}>{kpi.delta}</span>
                      </motion.div>
                    ))}
                  </div>
                  {/* Chart */}
                  <div className="bg-gray-50 rounded-xl border border-gray-100 p-5 h-44 flex items-end gap-[3px]">
                    {Array.from({ length: 32 }, (_, i) => (
                      <motion.div key={i}
                        initial={{ height: 0 }}
                        animate={{ height: `${25 + Math.sin(i * 0.4) * 18 + Math.random() * 28}%` }}
                        transition={{ delay: 1 + i * 0.025, duration: 0.45 }}
                        className="flex-1 bg-gradient-to-t from-violet-500 to-violet-300 rounded-[2px] opacity-80" />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ━━ CONNECTORS ━━ */}
      <section id="connectors" className="py-16 border-y border-gray-100 bg-gray-50/50">
        <Reveal>
          <p className="text-center text-xs text-gray-400 uppercase tracking-[0.2em] font-semibold mb-8">
            {t('landing.stack')}
          </p>
        </Reveal>
        <div className="overflow-hidden">
          <motion.div className="flex gap-6 whitespace-nowrap"
            animate={{ x: [0, -580] }}
            transition={{ duration: 22, repeat: Infinity, ease: 'linear' }}>
            {[...CONNECTORS, ...CONNECTORS].map((c, i) => (
              <div key={i} className="flex items-center gap-2.5 px-5 py-3 rounded-xl bg-white border border-gray-100 shadow-sm flex-shrink-0">
                <span className="text-xl">{c.icon}</span>
                <span className="text-sm font-medium text-gray-600">{c.name}</span>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ━━ FEATURES ━━ */}
      <section id="features" className="py-28 px-6">
        <div className="max-w-6xl mx-auto">
          <Reveal>
            <div className="text-center mb-20">
              <p className="text-violet-600 text-sm font-semibold tracking-wide uppercase mb-4">{t('landing.nav.features')}</p>
              <h2 className="text-4xl lg:text-5xl font-extrabold tracking-tight text-gray-900 mb-5">{t('landing.everythingTitle')}</h2>
              <p className="text-gray-500 text-lg max-w-xl mx-auto">{t('landing.everythingSubtitle')}</p>
            </div>
          </Reveal>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: Database, title: t('landing.feat1Title'), desc: t('landing.feat1Desc'), color: 'bg-violet-50 text-violet-600 border-violet-100' },
              { icon: Sparkles, title: t('landing.feat2Title'), desc: t('landing.feat2Desc'), color: 'bg-indigo-50 text-indigo-600 border-indigo-100' },
              { icon: Shield, title: t('landing.feat3Title'), desc: t('landing.feat3Desc'), color: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
            ].map((f, i) => (
              <Reveal key={f.title} delay={i * 0.08}>
                <div className="group bg-white border border-gray-100 rounded-2xl p-8 hover:shadow-xl hover:shadow-gray-100/80 hover:border-gray-200 transition-all duration-400">
                  <div className={`w-14 h-14 rounded-2xl ${f.color} border flex items-center justify-center mb-7`}>
                    <f.icon size={24} />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-3">{f.title}</h3>
                  <p className="text-gray-500 text-[15px] leading-relaxed">{f.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ━━ HOW IT WORKS ━━ */}
      <section className="py-28 px-6 bg-gray-50/70">
        <div className="max-w-5xl mx-auto">
          <Reveal>
            <div className="text-center mb-20">
              <h2 className="text-4xl lg:text-5xl font-extrabold tracking-tight text-gray-900 mb-5">{t('landing.platformTitle')}</h2>
              <p className="text-gray-500 text-lg max-w-xl mx-auto">{t('landing.platformSubtitle')}</p>
            </div>
          </Reveal>

          <div className="grid gap-5">
            {[
              { num: '01', icon: BarChart3, title: t('landing.prod1Title'), desc: t('landing.prod1Desc') },
              { num: '02', icon: Search, title: t('landing.prod2Title'), desc: t('landing.prod2Desc') },
              { num: '03', icon: TrendingUp, title: t('landing.prod3Title'), desc: t('landing.prod3Desc') },
            ].map((s, i) => (
              <Reveal key={s.num} delay={i * 0.08}>
                <div className="group flex items-start gap-6 bg-white border border-gray-100 rounded-2xl p-8 hover:shadow-lg hover:shadow-gray-100/60 transition-all">
                  <div className="flex-shrink-0 w-14 h-14 rounded-2xl bg-violet-50 border border-violet-100 flex items-center justify-center">
                    <span className="text-violet-600 font-bold text-lg">{s.num}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-violet-600 transition-colors">{s.title}</h3>
                    <p className="text-gray-500 text-[15px] leading-relaxed">{s.desc}</p>
                  </div>
                  <ArrowRight size={20} className="text-gray-200 group-hover:text-violet-400 transition-colors flex-shrink-0 mt-2 hidden md:block" />
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ━━ PRICING ━━ */}
      <section id="pricing" className="py-28 px-6">
        <div className="max-w-5xl mx-auto">
          <Reveal>
            <div className="text-center mb-14">
              <h2 className="text-4xl lg:text-5xl font-extrabold tracking-tight text-gray-900 mb-5">{t('landing.pricingTitle')}</h2>
              <p className="text-gray-500 text-lg mb-8">{t('landing.pricingSubtitle')}</p>
              <div className="inline-flex items-center bg-gray-100 rounded-full p-1">
                <button onClick={() => setAnnual(false)}
                  className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${!annual ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}>
                  {locale === 'de' ? 'Monatlich' : 'Monthly'}
                </button>
                <button onClick={() => setAnnual(true)}
                  className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${annual ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}>
                  {locale === 'de' ? 'Jährlich' : 'Annual'}
                  <span className="ml-1.5 text-xs text-emerald-600 font-semibold">-20%</span>
                </button>
              </div>
            </div>
          </Reveal>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              { name: t('landing.starter'), price: '€0', sub: locale === 'de' ? 'kostenlos für immer' : 'free forever', features: t('landing.plan1Features').split(','), pop: false },
              { name: t('landing.pro'), price: annual ? '€39' : '€49', sub: t('landing.perMonth'), features: t('landing.plan2Features').split(','), pop: true },
              { name: t('landing.business'), price: annual ? '€159' : '€199', sub: t('landing.perMonth'), features: t('landing.plan3Features').split(','), pop: false },
            ].map((p, i) => (
              <Reveal key={p.name} delay={i * 0.08}>
                <div className={`relative rounded-2xl p-8 border transition-all ${
                  p.pop ? 'bg-violet-600 text-white border-violet-600 shadow-xl shadow-violet-600/25' : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-lg'
                }`}>
                  {p.pop && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-white text-violet-600 text-xs font-bold shadow">
                      {locale === 'de' ? 'Am beliebtesten' : 'Most Popular'}
                    </div>
                  )}
                  <h3 className={`text-lg font-semibold mb-2 ${p.pop ? '' : 'text-gray-900'}`}>{p.name}</h3>
                  <div className="flex items-baseline gap-1 mb-1">
                    <span className="text-5xl font-extrabold tracking-tight">{p.price}</span>
                  </div>
                  <p className={`text-sm mb-8 ${p.pop ? 'text-white/60' : 'text-gray-400'}`}>{p.sub}</p>
                  <Link href={`/${locale}/signup`}
                    className={`block text-center py-3 rounded-xl text-sm font-semibold transition-colors mb-8 ${
                      p.pop ? 'bg-white text-violet-600 hover:bg-violet-50' : 'bg-violet-600 text-white hover:bg-violet-700 shadow-lg shadow-violet-600/20'
                    }`}>
                    {t('landing.getStarted')}
                  </Link>
                  <ul className="space-y-3.5">
                    {p.features.map(f => (
                      <li key={f} className={`flex items-start gap-3 text-sm ${p.pop ? 'text-white/80' : 'text-gray-600'}`}>
                        <Check size={16} className={`mt-0.5 flex-shrink-0 ${p.pop ? 'text-white/60' : 'text-violet-500'}`} />
                        {f.trim()}
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ━━ FAQ ━━ */}
      <section className="py-28 px-6 bg-gray-50/70">
        <div className="max-w-2xl mx-auto">
          <Reveal>
            <h2 className="text-3xl lg:text-4xl font-extrabold text-center text-gray-900 mb-14">
              {locale === 'de' ? 'Häufige Fragen' : 'Frequently Asked Questions'}
            </h2>
          </Reveal>
          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <Reveal key={i} delay={i * 0.04}>
                <button onClick={() => setFaqOpen(faqOpen === i ? null : i)}
                  className="w-full text-left bg-white border border-gray-100 rounded-2xl p-6 hover:border-gray-200 hover:shadow-sm transition-all">
                  <div className="flex items-center justify-between gap-4">
                    <span className="font-semibold text-gray-900">{faq.q}</span>
                    <ChevronDown size={18} className={`text-gray-300 transition-transform flex-shrink-0 ${faqOpen === i ? 'rotate-180' : ''}`} />
                  </div>
                  {faqOpen === i && (
                    <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      className="text-gray-500 text-sm mt-4 leading-relaxed">
                      {faq.a}
                    </motion.p>
                  )}
                </button>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ━━ CTA ━━ */}
      <section className="py-28 px-6 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-violet-100/40 rounded-full blur-[150px]" />
        </div>
        <div className="max-w-2xl mx-auto text-center relative">
          <Reveal>
            <h2 className="text-4xl lg:text-5xl font-extrabold tracking-tight text-gray-900 mb-5">{t('landing.readyTitle')}</h2>
            <p className="text-gray-500 text-lg mb-10">{t('landing.readySubtitle')}</p>
            <Link href={`/${locale}/signup`}
              className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-10 py-4 rounded-xl font-semibold transition-all shadow-xl shadow-violet-600/25 text-base">
              {t('landing.cta')}
              <ArrowRight size={18} />
            </Link>
            <p className="text-gray-400 text-sm mt-5">{t('landing.noCreditCard')}</p>
          </Reveal>
        </div>
      </section>

      {/* ━━ FOOTER ━━ */}
      <footer className="border-t border-gray-100 py-14 px-6 bg-gray-50/50">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-600 to-violet-700 flex items-center justify-center">
              <Zap size={13} className="text-white" />
            </div>
            <span className="font-bold text-gray-900">DataLaser</span>
          </div>
          <div className="flex items-center gap-8 text-sm text-gray-400">
            <a href="#" className="hover:text-gray-600 transition-colors">{t('landing.privacy')}</a>
            <a href="#" className="hover:text-gray-600 transition-colors">{t('landing.terms')}</a>
            <a href="#" className="hover:text-gray-600 transition-colors">{t('landing.status')}</a>
          </div>
          <div className="flex items-center gap-5">
            <Link href={`/${locale === 'de' ? 'en' : 'de'}`}
              className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors">
              <Globe size={14} />
              {locale === 'de' ? 'English' : 'Deutsch'}
            </Link>
            <span className="text-xs text-gray-300">{t('landing.copyright')}</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
