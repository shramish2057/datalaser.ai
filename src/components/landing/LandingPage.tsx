'use client'

import { useTranslations, useLocale } from 'next-intl'
import Link from 'next/link'
import { useState, useEffect, useRef } from 'react'
import { motion, useInView } from 'motion/react'
import {
  ArrowRight, Check, Database, Zap, BarChart3,
  Globe, Sparkles, TrendingUp, Search,
  Menu, X, Play, Shield,
} from 'lucide-react'
// GLSLHills used inside HeroSection
import { Features } from '@/components/blocks/features-8'
import { Testimonials } from '@/components/blocks/testimonials'
import { FeaturesHow } from '@/components/blocks/features-10'
import { HeroSection } from '@/components/blocks/hero-section'
import { Faq5 } from '@/components/ui/faq-5'

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
    { q: 'Wie schnell kann ich starten?', a: 'In unter 2 Minuten. CSV hochladen oder Datenbank verbinden, erste Erkenntnisse in 10 Sekunden.' },
    { q: 'Brauche ich technische Kenntnisse?', a: 'Nein. Kein SQL, kein Code, kein Data Engineering. DataLaser analysiert Ihre Daten automatisch.' },
    { q: 'Wo werden meine Daten gespeichert?', a: 'Auf deutschen Servern. Vollständig DSGVO-konform.' },
    { q: 'Kann ich DataLaser kostenlos testen?', a: 'Ja. Der Starter-Plan ist dauerhaft kostenlos, keine Kreditkarte erforderlich.' },
    { q: 'Welche Datenquellen werden unterstützt?', a: 'CSV, Excel, JSON, PostgreSQL, MySQL, MongoDB, Snowflake, BigQuery, Redshift, Shopify, Stripe, Google Ads, Meta Ads, HubSpot, QuickBooks und mehr.' },
  ] : [
    { q: 'How fast can I get started?', a: 'Under 2 minutes. Upload a CSV or connect a database. First insights in 10 seconds.' },
    { q: 'Do I need technical skills?', a: 'No. No SQL, no code, no data engineering. DataLaser analyzes your data automatically.' },
    { q: 'Where is my data stored?', a: 'On secure, SOC2-compliant infrastructure. Fully GDPR compliant.' },
    { q: 'Can I try DataLaser for free?', a: 'Yes. The Starter plan is free forever. No credit card required.' },
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
            <div className="w-9 h-9 rounded-xl bg-gray-900 flex items-center justify-center shadow-lg shadow-gray-900/15">
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
              className="text-[15px] font-medium bg-gray-900 hover:bg-gray-800 text-white px-6 py-2.5 rounded-xl transition-colors shadow-lg shadow-gray-900/15">
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
            <Link href={`/${locale}/signup`} className="block bg-gray-900 text-white text-center py-3 rounded-xl font-medium">
              {t('landing.getStarted')}
            </Link>
          </motion.div>
        )}
      </nav>


      {/* ━━ HERO ━━ */}
      <HeroSection />

      {/* ━━ FEATURES ━━ */}
      <div id="features">
        <Features />
      </div>

      {/* ━━ CONNECTORS ━━ */}
      <section id="connectors" className="py-28 px-6">
        <div className="max-w-4xl mx-auto">
          <Reveal>
            <div className="text-center mb-14">
              <h2 className="text-3xl lg:text-4xl font-extrabold tracking-tight text-gray-900 mb-5">
                {locale === 'de' ? 'Alle Ihre Datenquellen, ein Klick entfernt' : 'All your data sources, one click away'}
              </h2>
              <p className="text-gray-500 text-lg max-w-xl mx-auto">
                {locale === 'de'
                  ? 'Verbinden Sie Datenbanken, Data Warehouses, E-Commerce-Plattformen, Marketing-Tools und Finanzsysteme in Sekunden.'
                  : 'Connect databases, data warehouses, e-commerce platforms, marketing tools, and finance systems in seconds.'}
              </p>
            </div>
          </Reveal>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {[
              { name: 'PostgreSQL', src: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/postgresql/postgresql-original.svg', cat: locale === 'de' ? 'Datenbank' : 'Database' },
              { name: 'MySQL', src: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/mysql/mysql-original.svg', cat: locale === 'de' ? 'Datenbank' : 'Database' },
              { name: 'MongoDB', src: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/mongodb/mongodb-original.svg', cat: 'NoSQL' },
              { name: 'SQL Server', src: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/microsoftsqlserver/microsoftsqlserver-original.svg', cat: locale === 'de' ? 'Datenbank' : 'Database' },
              { name: 'Snowflake', src: 'https://cdn.simpleicons.org/snowflake/29B5E8', cat: 'Warehouse' },
              { name: 'BigQuery', src: 'https://cdn.simpleicons.org/googlebigquery/669DF6', cat: 'Warehouse' },
              { name: 'Redshift', src: 'https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/amazonredshift.svg', cat: 'Warehouse' },
              { name: 'Databricks', src: 'https://cdn.simpleicons.org/databricks/FF3621', cat: 'Lakehouse' },
              { name: 'Shopify', src: 'https://cdn.simpleicons.org/shopify/7AB55C', cat: 'E-Commerce' },
              { name: 'Stripe', src: 'https://cdn.simpleicons.org/stripe/635BFF', cat: locale === 'de' ? 'Zahlungen' : 'Payments' },
              { name: 'Square', src: 'https://cdn.simpleicons.org/square/006AFF', cat: locale === 'de' ? 'Zahlungen' : 'Payments' },
              { name: 'Google Ads', src: 'https://cdn.simpleicons.org/googleads/4285F4', cat: locale === 'de' ? 'Werbung' : 'Ads' },
              { name: 'Meta Ads', src: 'https://cdn.simpleicons.org/meta/0081FB', cat: locale === 'de' ? 'Werbung' : 'Ads' },
              { name: 'Google Analytics', src: 'https://cdn.simpleicons.org/googleanalytics/E37400', cat: 'Analytics' },
              { name: 'QuickBooks', src: 'https://cdn.simpleicons.org/quickbooks/2CA01C', cat: locale === 'de' ? 'Buchhaltung' : 'Accounting' },
              { name: 'Xero', src: 'https://cdn.simpleicons.org/xero/13B5EA', cat: locale === 'de' ? 'Buchhaltung' : 'Accounting' },
              { name: 'Plaid', src: 'https://cdn.simpleicons.org/plaid/000000', cat: locale === 'de' ? 'Bankwesen' : 'Banking' },
            ].map(c => (
              <Reveal key={c.name} delay={0.02}>
                <Link href={`/${locale}/signup`}
                  className="flex flex-col items-center gap-2.5 p-5 rounded-2xl border border-gray-100 bg-white hover:border-gray-300 hover:shadow-md transition-all group cursor-pointer">
                  <img src={c.src} alt={c.name} className="h-10 w-10 object-contain group-hover:scale-110 transition-transform" />
                  <span className="text-sm font-semibold text-gray-900">{c.name}</span>
                  <span className="text-[11px] text-gray-400">{c.cat}</span>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ━━ HOW IT WORKS ━━ */}
      <FeaturesHow />

      {/* ━━ TESTIMONIALS ━━ */}
      <Testimonials />

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
                  p.pop ? 'bg-gray-900 text-white border-gray-900 shadow-xl shadow-gray-900/15' : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-lg'
                }`}>
                  {p.pop && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-white text-gray-900 text-xs font-bold shadow">
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
                      p.pop ? 'bg-white text-gray-900 hover:bg-gray-50' : 'bg-gray-900 text-white hover:bg-gray-800 shadow-lg shadow-gray-900/10'
                    }`}>
                    {t('landing.getStarted')}
                  </Link>
                  <ul className="space-y-3.5">
                    {p.features.map(f => (
                      <li key={f} className={`flex items-start gap-3 text-sm ${p.pop ? 'text-white/80' : 'text-gray-600'}`}>
                        <Check size={16} className={`mt-0.5 flex-shrink-0 ${p.pop ? 'text-white/60' : 'text-gray-700'}`} />
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
      <Faq5
        badge={locale === 'de' ? 'FAQ' : 'FAQ'}
        heading={locale === 'de' ? 'Häufige Fragen' : 'Frequently Asked Questions'}
        description={locale === 'de'
          ? 'Erfahren Sie alles Wichtige über DataLaser und wie es Ihrem Unternehmen helfen kann.'
          : 'Find out all the essential details about DataLaser and how it can serve your business.'}
        faqs={faqs.map(f => ({ question: f.q, answer: f.a }))}
      />

      {/* ━━ CTA ━━ */}
      <section className="py-28 px-6 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-gray-100/40 rounded-full blur-[150px]" />
        </div>
        <div className="max-w-2xl mx-auto text-center relative">
          <Reveal>
            <h2 className="text-4xl lg:text-5xl font-extrabold tracking-tight text-gray-900 mb-5">{t('landing.readyTitle')}</h2>
            <p className="text-gray-500 text-lg mb-10">{t('landing.readySubtitle')}</p>
            <Link href={`/${locale}/signup`}
              className="inline-flex items-center gap-2 bg-gray-900 hover:bg-gray-800 text-white px-10 py-4 rounded-xl font-semibold transition-all shadow-xl shadow-gray-900/15 text-base">
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
            <div className="w-7 h-7 rounded-lg bg-gray-900 flex items-center justify-center">
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
            <span className="text-xs text-gray-300">© 2025{new Date().getFullYear() > 2025 ? `–${new Date().getFullYear()}` : ''} DataLaser. {locale === 'de' ? 'Alle Rechte vorbehalten.' : 'All rights reserved.'}</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
