'use client'

import { useTranslations, useLocale } from 'next-intl'
import Link from 'next/link'
import { useState, useEffect, useRef } from 'react'
import { motion, useInView } from 'motion/react'
import {
  ArrowRight, Check, ChevronDown, Database, Zap, BarChart3,
  Shield, Globe, Clock, Sparkles, TrendingUp, Search,
  Menu, X, Play,
} from 'lucide-react'

// ── Scroll-triggered animation wrapper ──
function Reveal({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-60px' })
  return (
    <motion.div ref={ref} className={className}
      initial={{ opacity: 0, y: 24 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
      transition={{ duration: 0.5, delay, ease: [0.25, 1, 0.5, 1] }}>
      {children}
    </motion.div>
  )
}

// ── Connector logos (simplified SVG badges) ──
const CONNECTORS = [
  { name: 'PostgreSQL', icon: '🐘' }, { name: 'Snowflake', icon: '❄️' },
  { name: 'BigQuery', icon: '☁️' }, { name: 'Shopify', icon: '🛍️' },
  { name: 'Stripe', icon: '💳' }, { name: 'Google Ads', icon: '📢' },
  { name: 'Meta Ads', icon: '👤' }, { name: 'HubSpot', icon: '🧡' },
  { name: 'QuickBooks', icon: '💚' }, { name: 'MongoDB', icon: '🍃' },
  { name: 'MySQL', icon: '🐬' }, { name: 'Redshift', icon: '🔴' },
]

export default function LandingPage() {
  const t = useTranslations()
  const locale = useLocale()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [billingAnnual, setBillingAnnual] = useState(true)
  const [faqOpen, setFaqOpen] = useState<number | null>(null)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  const navLinks = [
    { label: t('landing.nav.features'), href: '#features' },
    { label: t('landing.nav.connectors'), href: '#connectors' },
    { label: t('landing.nav.pricing'), href: '#pricing' },
  ]

  const faqs = locale === 'de' ? [
    { q: 'Wie schnell kann ich starten?', a: 'In unter 2 Minuten. CSV hochladen oder Datenbank verbinden — erste Erkenntnisse in 10 Sekunden.' },
    { q: 'Brauche ich technische Kenntnisse?', a: 'Nein. Kein SQL, kein Code, kein Data Engineering. DataLaser analysiert Ihre Daten automatisch.' },
    { q: 'Wo werden meine Daten gespeichert?', a: 'Auf deutschen Servern. Vollständig DSGVO-konform.' },
    { q: 'Kann ich DataLaser kostenlos testen?', a: 'Ja. Der Starter-Plan ist dauerhaft kostenlos — keine Kreditkarte erforderlich.' },
  ] : [
    { q: 'How fast can I get started?', a: 'Under 2 minutes. Upload a CSV or connect a database — first insights in 10 seconds.' },
    { q: 'Do I need technical skills?', a: 'No. No SQL, no code, no data engineering. DataLaser analyzes your data automatically.' },
    { q: 'Where is my data stored?', a: 'On secure servers with SOC2-compliant infrastructure. GDPR compliant.' },
    { q: 'Can I try DataLaser for free?', a: 'Yes. The Starter plan is free forever — no credit card required.' },
  ]

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white overflow-hidden">

      {/* ── NAVBAR ── */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-[#0A0A0F]/90 backdrop-blur-xl border-b border-white/5' : ''
      }`}>
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href={`/${locale}`} className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center">
              <Zap size={16} className="text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight">DataLaser</span>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            {navLinks.map(link => (
              <a key={link.label} href={link.href}
                className="text-sm text-white/60 hover:text-white transition-colors">
                {link.label}
              </a>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-3">
            <Link href={`/${locale}/login`}
              className="text-sm text-white/60 hover:text-white px-4 py-2 transition-colors">
              {t('landing.login')}
            </Link>
            <Link href={`/${locale}/signup`}
              className="text-sm bg-violet-600 hover:bg-violet-500 text-white px-5 py-2 rounded-full transition-colors font-medium">
              {t('landing.getStarted')}
            </Link>
          </div>

          <button className="md:hidden text-white/60" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {mobileMenuOpen && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            className="md:hidden bg-[#0A0A0F] border-t border-white/5 px-6 py-6 flex flex-col gap-4">
            {navLinks.map(link => (
              <a key={link.label} href={link.href} className="text-white/60 text-sm"
                onClick={() => setMobileMenuOpen(false)}>{link.label}</a>
            ))}
            <Link href={`/${locale}/signup`}
              className="bg-violet-600 text-white text-center py-2.5 rounded-full text-sm font-medium">
              {t('landing.getStarted')}
            </Link>
          </motion.div>
        )}
      </nav>

      {/* ── HERO ── */}
      <section className="relative pt-32 pb-20 px-6">
        {/* Glow effects */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] pointer-events-none">
          <div className="absolute top-20 left-1/4 w-72 h-72 bg-violet-600/20 rounded-full blur-[120px]" />
          <div className="absolute top-40 right-1/4 w-64 h-64 bg-indigo-500/15 rounded-full blur-[100px]" />
          <div className="absolute top-60 left-1/2 w-48 h-48 bg-violet-400/10 rounded-full blur-[80px]" />
        </div>

        <div className="max-w-4xl mx-auto text-center relative">
          <Reveal>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-white/70 mb-8">
              <Sparkles size={12} className="text-violet-400" />
              {t('landing.badge')}
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-[1.05] mb-6">
              {locale === 'de' ? (
                <>Ihre Daten.<br /><span className="bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">Durchleuchtet.</span></>
              ) : (
                <>Your data.<br /><span className="bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">Interrogated.</span></>
              )}
            </h1>
          </Reveal>

          <Reveal delay={0.2}>
            <p className="text-lg md:text-xl text-white/50 max-w-2xl mx-auto mb-10 leading-relaxed">
              {t('landing.heroDesc')}
            </p>
          </Reveal>

          <Reveal delay={0.3}>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-6">
              <Link href={`/${locale}/signup`}
                className="group flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white px-7 py-3.5 rounded-full font-medium transition-all text-sm w-full sm:w-auto justify-center">
                {t('landing.cta')}
                <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <a href="#features"
                className="flex items-center gap-2 text-white/50 hover:text-white px-7 py-3.5 rounded-full border border-white/10 hover:border-white/20 transition-all text-sm w-full sm:w-auto justify-center">
                <Play size={14} />
                {t('landing.ctaDemo')}
              </a>
            </div>
            <p className="text-xs text-white/30">{t('landing.ctaFooter')}</p>
          </Reveal>

          {/* Dashboard preview */}
          <Reveal delay={0.5}>
            <div className="mt-16 relative">
              <div className="absolute -inset-4 bg-gradient-to-t from-violet-600/10 to-transparent rounded-2xl blur-2xl" />
              <div className="relative bg-[#12121A] border border-white/10 rounded-2xl overflow-hidden shadow-2xl shadow-violet-900/20">
                {/* Fake browser chrome */}
                <div className="flex items-center gap-2 px-4 py-3 bg-[#0E0E16] border-b border-white/5">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
                    <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
                    <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
                  </div>
                  <div className="flex-1 mx-4">
                    <div className="bg-white/5 rounded-md px-3 py-1 text-[10px] text-white/30 text-center">
                      app.datalaser.ai/insights
                    </div>
                  </div>
                </div>
                {/* Dashboard mockup content */}
                <div className="p-6 grid grid-cols-4 gap-3">
                  {[
                    { label: 'Revenue', value: '€284,920', delta: '+18.4%', up: true },
                    { label: 'Orders', value: '2,640', delta: '+12.1%', up: true },
                    { label: 'CAC', value: '€109', delta: '+12.0%', up: false },
                    { label: 'Churn', value: '2.3%', delta: '-0.1%', up: true },
                  ].map((kpi, i) => (
                    <motion.div key={kpi.label}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.8 + i * 0.1, duration: 0.4 }}
                      className="bg-white/[0.03] rounded-xl p-4 border border-white/5">
                      <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">{kpi.label}</p>
                      <p className="text-xl font-bold text-white">{kpi.value}</p>
                      <span className={`text-xs font-medium ${kpi.up ? 'text-emerald-400' : 'text-red-400'}`}>
                        {kpi.delta}
                      </span>
                    </motion.div>
                  ))}
                </div>
                {/* Chart placeholder */}
                <div className="px-6 pb-6">
                  <div className="bg-white/[0.02] rounded-xl border border-white/5 p-4 h-40 flex items-end gap-1">
                    {Array.from({ length: 24 }, (_, i) => (
                      <motion.div key={i}
                        initial={{ height: 0 }}
                        animate={{ height: `${30 + Math.sin(i * 0.5) * 20 + Math.random() * 30}%` }}
                        transition={{ delay: 1.2 + i * 0.03, duration: 0.5 }}
                        className="flex-1 bg-gradient-to-t from-violet-600/60 to-violet-400/30 rounded-sm" />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── CONNECTORS MARQUEE ── */}
      <section id="connectors" className="py-16 border-y border-white/5">
        <Reveal>
          <p className="text-center text-xs text-white/30 uppercase tracking-[0.2em] mb-8">
            {t('landing.stack')}
          </p>
        </Reveal>
        <div className="overflow-hidden">
          <motion.div className="flex gap-8 whitespace-nowrap"
            animate={{ x: [0, -600] }}
            transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}>
            {[...CONNECTORS, ...CONNECTORS].map((c, i) => (
              <div key={i} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/[0.03] border border-white/5 flex-shrink-0">
                <span className="text-lg">{c.icon}</span>
                <span className="text-sm text-white/50">{c.name}</span>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <Reveal>
            <div className="text-center mb-16">
              <p className="text-violet-400 text-sm font-medium tracking-wide uppercase mb-3">{t('landing.nav.features')}</p>
              <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">{t('landing.everythingTitle')}</h2>
              <p className="text-white/40 text-lg max-w-xl mx-auto">{t('landing.everythingSubtitle')}</p>
            </div>
          </Reveal>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: Database, title: t('landing.feat1Title'), desc: t('landing.feat1Desc'), gradient: 'from-violet-500/20 to-transparent' },
              { icon: Sparkles, title: t('landing.feat2Title'), desc: t('landing.feat2Desc'), gradient: 'from-indigo-500/20 to-transparent' },
              { icon: Shield, title: t('landing.feat3Title'), desc: t('landing.feat3Desc'), gradient: 'from-violet-600/20 to-transparent' },
            ].map((feat, i) => (
              <Reveal key={feat.title} delay={i * 0.1}>
                <div className="group relative bg-white/[0.02] border border-white/5 rounded-2xl p-8 hover:border-violet-500/30 transition-all duration-500">
                  <div className={`absolute inset-0 rounded-2xl bg-gradient-to-b ${feat.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                  <div className="relative">
                    <div className="w-12 h-12 rounded-xl bg-violet-600/10 border border-violet-500/20 flex items-center justify-center mb-6">
                      <feat.icon size={22} className="text-violet-400" />
                    </div>
                    <h3 className="text-xl font-semibold mb-3">{feat.title}</h3>
                    <p className="text-white/40 text-sm leading-relaxed">{feat.desc}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="py-24 px-6 bg-gradient-to-b from-transparent via-violet-950/10 to-transparent">
        <div className="max-w-5xl mx-auto">
          <Reveal>
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">{t('landing.platformTitle')}</h2>
              <p className="text-white/40 text-lg max-w-xl mx-auto">{t('landing.platformSubtitle')}</p>
            </div>
          </Reveal>

          <div className="space-y-6">
            {[
              { num: '01', icon: BarChart3, title: t('landing.prod1Title'), desc: t('landing.prod1Desc') },
              { num: '02', icon: Search, title: t('landing.prod2Title'), desc: t('landing.prod2Desc') },
              { num: '03', icon: TrendingUp, title: t('landing.prod3Title'), desc: t('landing.prod3Desc') },
            ].map((step, i) => (
              <Reveal key={step.num} delay={i * 0.1}>
                <div className="group flex gap-6 bg-white/[0.02] border border-white/5 rounded-2xl p-8 hover:border-violet-500/20 transition-all">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 rounded-full bg-violet-600/10 border border-violet-500/20 flex items-center justify-center text-violet-400 font-bold text-sm">
                      {step.num}
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold mb-2 group-hover:text-violet-300 transition-colors">{step.title}</h3>
                    <p className="text-white/40 text-sm leading-relaxed max-w-2xl">{step.desc}</p>
                  </div>
                  <div className="ml-auto flex-shrink-0 hidden md:flex items-center">
                    <ArrowRight size={18} className="text-white/10 group-hover:text-violet-400 transition-colors" />
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <Reveal>
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">{t('landing.pricingTitle')}</h2>
              <p className="text-white/40 text-lg mb-8">{t('landing.pricingSubtitle')}</p>
              {/* Billing toggle */}
              <div className="inline-flex items-center gap-3 bg-white/5 rounded-full p-1">
                <button onClick={() => setBillingAnnual(false)}
                  className={`px-4 py-1.5 rounded-full text-sm transition-all ${!billingAnnual ? 'bg-violet-600 text-white' : 'text-white/40'}`}>
                  {locale === 'de' ? 'Monatlich' : 'Monthly'}
                </button>
                <button onClick={() => setBillingAnnual(true)}
                  className={`px-4 py-1.5 rounded-full text-sm transition-all ${billingAnnual ? 'bg-violet-600 text-white' : 'text-white/40'}`}>
                  {locale === 'de' ? 'Jährlich' : 'Annual'}
                  <span className="ml-1 text-[10px] text-emerald-400">-20%</span>
                </button>
              </div>
            </div>
          </Reveal>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                name: t('landing.starter'), price: locale === 'de' ? '€0' : '$0',
                sub: locale === 'de' ? 'kostenlos für immer' : 'free forever',
                features: t('landing.plan1Features').split(','),
                highlight: false,
              },
              {
                name: t('landing.pro'),
                price: locale === 'de' ? (billingAnnual ? '€39' : '€49') : (billingAnnual ? '$39' : '$49'),
                sub: t('landing.perMonth'),
                features: t('landing.plan2Features').split(','),
                highlight: true,
              },
              {
                name: t('landing.business'),
                price: locale === 'de' ? (billingAnnual ? '€159' : '€199') : (billingAnnual ? '$159' : '$199'),
                sub: t('landing.perMonth'),
                features: t('landing.plan3Features').split(','),
                highlight: false,
              },
            ].map((plan, i) => (
              <Reveal key={plan.name} delay={i * 0.1}>
                <div className={`relative rounded-2xl p-8 border transition-all ${
                  plan.highlight
                    ? 'bg-gradient-to-b from-violet-600/10 to-violet-900/5 border-violet-500/30'
                    : 'bg-white/[0.02] border-white/5 hover:border-white/10'
                }`}>
                  {plan.highlight && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-violet-600 text-[10px] font-bold uppercase tracking-wider">
                      {locale === 'de' ? 'Beliebtester' : 'Most Popular'}
                    </div>
                  )}
                  <h3 className="text-lg font-semibold mb-1">{plan.name}</h3>
                  <div className="flex items-baseline gap-1 mb-1">
                    <span className="text-4xl font-bold">{plan.price}</span>
                  </div>
                  <p className="text-white/30 text-sm mb-6">{plan.sub}</p>
                  <Link href={`/${locale}/signup`}
                    className={`block text-center py-2.5 rounded-full text-sm font-medium transition-colors mb-6 ${
                      plan.highlight
                        ? 'bg-violet-600 hover:bg-violet-500 text-white'
                        : 'bg-white/5 hover:bg-white/10 text-white'
                    }`}>
                    {t('landing.getStarted')}
                  </Link>
                  <ul className="space-y-3">
                    {plan.features.map(f => (
                      <li key={f} className="flex items-start gap-2.5 text-sm text-white/50">
                        <Check size={14} className="text-violet-400 mt-0.5 flex-shrink-0" />
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

      {/* ── FAQ ── */}
      <section className="py-24 px-6 border-t border-white/5">
        <div className="max-w-2xl mx-auto">
          <Reveal>
            <h2 className="text-3xl font-bold text-center mb-12">
              {locale === 'de' ? 'Häufige Fragen' : 'Frequently Asked Questions'}
            </h2>
          </Reveal>
          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <Reveal key={i} delay={i * 0.05}>
                <button onClick={() => setFaqOpen(faqOpen === i ? null : i)}
                  className="w-full text-left bg-white/[0.02] border border-white/5 rounded-xl p-5 hover:border-white/10 transition-all">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{faq.q}</span>
                    <ChevronDown size={16} className={`text-white/30 transition-transform ${faqOpen === i ? 'rotate-180' : ''}`} />
                  </div>
                  {faqOpen === i && (
                    <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                      className="text-white/40 text-sm mt-3 leading-relaxed">
                      {faq.a}
                    </motion.p>
                  )}
                </button>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-24 px-6 relative">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-violet-600/10 rounded-full blur-[150px]" />
        </div>
        <div className="max-w-2xl mx-auto text-center relative">
          <Reveal>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">{t('landing.readyTitle')}</h2>
            <p className="text-white/40 text-lg mb-8">{t('landing.readySubtitle')}</p>
            <Link href={`/${locale}/signup`}
              className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white px-8 py-4 rounded-full font-medium transition-all text-sm">
              {t('landing.cta')}
              <ArrowRight size={16} />
            </Link>
            <p className="text-white/20 text-xs mt-4">{t('landing.noCreditCard')}</p>
          </Reveal>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-white/5 py-12 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center">
              <Zap size={12} className="text-white" />
            </div>
            <span className="font-bold text-sm">DataLaser</span>
          </div>
          <div className="flex items-center gap-6 text-xs text-white/30">
            <a href="#" className="hover:text-white/60 transition-colors">{t('landing.privacy')}</a>
            <a href="#" className="hover:text-white/60 transition-colors">{t('landing.terms')}</a>
            <a href="#" className="hover:text-white/60 transition-colors">{t('landing.status')}</a>
          </div>
          <div className="flex items-center gap-4">
            <Link href={`/${locale === 'de' ? 'en' : 'de'}`}
              className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition-colors">
              <Globe size={12} />
              {locale === 'de' ? 'English' : 'Deutsch'}
            </Link>
            <span className="text-xs text-white/20">{t('landing.copyright')}</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
