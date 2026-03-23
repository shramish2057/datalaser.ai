'use client'
import { useTranslations, useLocale } from 'next-intl'

import Link from 'next/link'
import { useState } from 'react'
import {
  Database, Zap, BarChart3, ArrowRight, Check,
  ChevronRight, Star, Menu, X
} from 'lucide-react'

export default function LandingPage() {
  const t = useTranslations()
  const locale = useLocale()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <div className="bg-dl-bg-light text-dl-text-dark font-body">

      {/* NAV */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-dl-border">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-dl-brand font-bold text-xl">▲</span>
              <span className="font-display font-bold text-dl-text-dark text-lg">DataLaser</span>
            </Link>
            <div className="hidden md:flex items-center gap-6">
              {[t('landing.nav.features'), t('landing.nav.connectors'), t('landing.nav.pricing'), t('landing.nav.docs')].map(link => (
                <Link key={link} href="#" className="text-sm text-dl-text-medium hover:text-dl-text-dark transition-colors">
                  {link}
                </Link>
              ))}
            </div>
          </div>
          <div className="hidden md:flex items-center gap-3">
            <Link href="/en/login" className="text-sm text-dl-text-medium hover:text-dl-text-dark px-4 py-2 transition-colors">
              Sign in
            </Link>
            <Link href="/en/signup" className="text-sm bg-dl-brand text-white px-4 py-2 rounded-lg hover:bg-dl-brand-dark transition-colors font-medium">
              {t('landing.getStarted')} free
            </Link>
          </div>
          <button className="md:hidden" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-dl-border bg-white px-6 py-4 flex flex-col gap-4">
            {['Features', 'Connectors', 'Pricing', 'Docs'].map(link => (
              <Link key={link} href="#" className="text-sm text-dl-text-medium">{link}</Link>
            ))}
            <Link href="/en/signup" className="text-sm bg-dl-brand text-white px-4 py-2 rounded-lg text-center font-medium">
              Get started free
            </Link>
          </div>
        )}
      </nav>

      {/* HERO */}
      <section className="pt-40 pb-24 px-6 text-center max-w-4xl mx-auto">
        <div className="inline-flex items-center gap-2 bg-dl-brand-hover text-dl-brand text-xs font-semibold px-3 py-1.5 rounded-full mb-8 border border-dl-brand/20">
          <span className="w-1.5 h-1.5 bg-dl-brand rounded-full" />
          {t('landing.badge')}
        </div>

        <h1 className="font-display font-bold text-5xl md:text-7xl text-dl-text-dark leading-[1.05] tracking-tight mb-6">
          {t('landing.tagline')}
          <br />
          <span className="text-dl-brand"></span>
        </h1>

        <p className="text-dl-text-medium text-lg md:text-xl leading-relaxed max-w-2xl mx-auto mb-10">
          DataLaser connects every data source in your business and surfaces
          insights, anomalies, and answers — before you even ask.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-6">
          <Link
            href="/en/signup"
            className="flex items-center gap-2 bg-dl-brand text-white px-6 py-3 rounded-lg font-medium hover:bg-dl-brand-dark transition-colors text-sm w-full sm:w-auto justify-center"
          >
            {t('landing.cta')}
            <ArrowRight size={16} />
          </Link>
          <Link
            href="#"
            className="flex items-center gap-2 border border-dl-border-dark text-dl-text-medium px-6 py-3 rounded-lg font-medium hover:border-dl-brand hover:text-dl-brand transition-colors text-sm w-full sm:w-auto justify-center"
          >
            {t('landing.ctaDemo')}
          </Link>
        </div>

        <p className="text-dl-text-light text-xs">
          {t('landing.ctaFooter')}
        </p>
      </section>

      {/* PRODUCT SCREENSHOT PLACEHOLDER */}
      <section className="px-6 max-w-6xl mx-auto mb-24">
        <div className="rounded-xl border border-dl-border overflow-hidden shadow-2xl shadow-dl-bg-medium">
          {/* window chrome */}
          <div className="bg-dl-bg-medium border-b border-dl-border px-4 py-3 flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-400" />
            <div className="w-3 h-3 rounded-full bg-yellow-400" />
            <div className="w-3 h-3 rounded-full bg-green-400" />
            <div className="flex-1 flex justify-center">
              <div className="bg-white border border-dl-border rounded-md px-3 py-1 text-xs text-dl-text-light font-mono">
                app.datalaser.io/insights
              </div>
            </div>
          </div>
          {/* fake dashboard */}
          <div className="bg-[#080D17] p-6">
            {/* top bar */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <div className="text-[#5A7294] text-xs font-mono mb-1">Insights / AI Report</div>
                <div className="text-[#E8EDF5] font-semibold text-sm">Business Performance Analysis — March 2025</div>
              </div>
              <div className="flex gap-2">
                <div className="bg-[#0F1623] border border-[#1A2540] rounded-lg px-3 py-1.5 text-[#5A7294] text-xs">↻ Regenerate</div>
                <div className="bg-[#0F1623] border border-[#1A2540] rounded-lg px-3 py-1.5 text-[#5A7294] text-xs">⬇ Export PDF</div>
              </div>
            </div>
            {/* executive summary */}
            <div className="bg-[#0F1623] border border-dl-brand/30 border-l-4 border-l-dl-brand rounded-lg p-4 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-dl-success animate-pulse" />
                <span className="text-dl-brand text-xs font-semibold uppercase tracking-widest">AI Executive Summary</span>
              </div>
              <p className="text-[#A8B8D0] text-sm leading-relaxed">
                Revenue grew 18.4% MoM driven by strong Electronics performance. Customer acquisition cost increased 12% — flag for marketing review. Churn held steady at 2.3%. Two anomalies detected in ad spend efficiency.
              </p>
              <div className="flex gap-2 mt-3">
                <span className="bg-green-900/30 text-green-400 border border-green-800/30 rounded-full px-2.5 py-0.5 text-xs font-semibold">↑ Revenue Growing</span>
                <span className="bg-amber-900/30 text-amber-400 border border-amber-800/30 rounded-full px-2.5 py-0.5 text-xs font-semibold">⚠ CAC Increasing</span>
                <span className="bg-blue-900/30 text-blue-400 border border-blue-800/30 rounded-full px-2.5 py-0.5 text-xs font-semibold">✓ Churn Stable</span>
              </div>
            </div>
            {/* kpi row */}
            <div className="grid grid-cols-4 gap-3 mb-4">
              {[
                { label: 'REVENUE', value: '$284,920', change: '↑ 18.4%', up: true },
                { label: 'ORDERS', value: '2,640', change: '↑ 12.1%', up: true },
                { label: 'CAC', value: '$109', change: '↑ 12.0%', up: false },
                { label: 'CHURN', value: '2.3%', change: '↓ 0.1%', up: true },
              ].map(kpi => (
                <div key={kpi.label} className="bg-[#0F1623] border border-[#1A2540] rounded-lg p-3">
                  <div className="text-[#5A7294] text-[10px] uppercase tracking-wider mb-1 font-mono">{kpi.label}</div>
                  <div className="text-[#E8EDF5] font-mono font-bold text-lg">{kpi.value}</div>
                  <div className={`text-xs font-mono ${kpi.up ? 'text-dl-success' : 'text-dl-error'}`}>{kpi.change}</div>
                </div>
              ))}
            </div>
            {/* fake chart */}
            <div className="bg-[#0F1623] border border-[#1A2540] rounded-lg p-4">
              <div className="text-[#E8EDF5] text-xs font-medium mb-3">Revenue Trend</div>
              <svg viewBox="0 0 600 80" className="w-full h-16">
                <defs>
                  <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#4A9EDA" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#4A9EDA" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {[0,1,2,3].map(i => (
                  <line key={i} x1="0" y1={i * 20 + 10} x2="600" y2={i * 20 + 10} stroke="#1A2540" strokeWidth="1" />
                ))}
                <path d="M0,65 C40,60 80,55 130,45 C180,35 210,50 260,35 C310,20 360,25 420,12 C460,5 520,8 600,3"
                  stroke="#4A9EDA" strokeWidth="2" fill="none" />
                <path d="M0,65 C40,60 80,55 130,45 C180,35 210,50 260,35 C310,20 360,25 420,12 C460,5 520,8 600,3 L600,80 L0,80 Z"
                  fill="url(#g)" />
              </svg>
            </div>
          </div>
        </div>
      </section>

      {/* INTEGRATION STRIP */}
      <section className="border-y border-dl-border py-8 overflow-hidden bg-white">
        <p className="text-center text-dl-text-light text-xs font-medium uppercase tracking-widest mb-6">
          {t('landing.stack')}
        </p>
        <div className="flex gap-3 animate-marquee whitespace-nowrap">
          {[...Array(2)].map((_, di) => (
            <div key={di} className="flex gap-3 flex-shrink-0">
              {[
                '🐘 PostgreSQL', '❄️ Snowflake', '☁️ BigQuery', '🛍️ Shopify',
                '💳 Stripe', '📢 Google Ads', '👤 Meta Ads', '🧡 HubSpot',
                '💚 QuickBooks', '📊 Google Analytics', '🍃 MongoDB', '🔴 Redshift',
                '🐬 MySQL', '🧱 Databricks', '⬛ Square', '💚 Xero',
              ].map(item => (
                <span key={item} className="bg-dl-bg-light border border-dl-border rounded-full px-4 py-2 text-dl-text-medium text-xs font-medium flex-shrink-0">
                  {item}
                </span>
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* THREE FEATURES */}
      <section className="py-24 px-6 max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="font-display font-bold text-3xl md:text-4xl text-dl-text-dark mb-4">
            {t('landing.everythingTitle')}
          </h2>
          <p className="text-dl-text-medium text-lg max-w-xl mx-auto">
            {t('landing.everythingSubtitle')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              icon: <Database size={22} className="text-dl-brand" />,
              iconBg: 'bg-dl-brand-hover',
              title: t('landing.feat1Title'),
              body: t('landing.feat1Desc'),
              chips: ['PostgreSQL', 'Snowflake', 'Shopify', 'Google Ads'],
            },
            {
              icon: <Zap size={22} className="text-dl-brand" />,
              iconBg: 'bg-dl-brand-hover',
              title: t('landing.feat2Title'),
              body: t('landing.feat2Desc'),
              chips: ['Insights', 'Anomalies', 'KPIs', 'Forecasts'],
            },
            {
              icon: <BarChart3 size={22} className="text-dl-brand" />,
              iconBg: 'bg-dl-brand-hover',
              title: t('landing.feat3Title'),
              body: t('landing.feat3Desc'),
              chips: ['Live sync', 'Alerts', 'Trends', 'Real-time'],
            },
          ].map(f => (
            <div key={f.title} className="bg-white border border-dl-border rounded-xl p-6 hover:border-dl-brand/40 hover:shadow-sm transition-all">
              <div className={`${f.iconBg} w-10 h-10 rounded-lg flex items-center justify-center mb-4`}>
                {f.icon}
              </div>
              <h3 className="font-display font-semibold text-dl-text-dark text-lg mb-2">{f.title}</h3>
              <p className="text-dl-text-medium text-sm leading-relaxed mb-4">{f.body}</p>
              <div className="flex flex-wrap gap-2">
                {f.chips.map(c => (
                  <span key={c} className="bg-dl-bg-medium text-dl-text-medium text-xs px-2.5 py-1 rounded-full font-medium">{c}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* THREE INTERFACES */}
      <section className="py-24 px-6 bg-dl-bg-medium/50 border-y border-dl-border">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-display font-bold text-3xl md:text-4xl text-dl-text-dark mb-4">
              {t('landing.platformTitle')}
            </h2>
            <p className="text-dl-text-medium text-lg">
              {t('landing.platformSubtitle')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                num: '01',
                title: t('landing.prod1Title'),
                body: t('landing.prod1Desc'),
              },
              {
                num: '02',
                title: 'Ask Data',
                body: t('landing.prod2Desc'),
              },
              {
                num: '03',
                title: t('landing.prod3Title'),
                body: t('landing.prod3Desc'),
              },
            ].map(s => (
              <div key={s.num} className="bg-white border border-dl-border rounded-xl p-6 relative hover:shadow-sm hover:border-dl-brand/40 transition-all">
                <div className="bg-dl-brand-hover border border-dl-brand/20 w-8 h-8 rounded-lg flex items-center justify-center mb-4">
                  <span className="text-dl-brand font-mono font-bold text-xs">{s.num}</span>
                </div>
                <h3 className="font-display font-semibold text-dl-text-dark text-lg mb-2">{s.title}</h3>
                <p className="text-dl-text-medium text-sm leading-relaxed">{s.body}</p>
                <div className="flex items-center gap-1 mt-4 text-dl-brand text-xs font-medium">
                  {t('landing.learnMore')} <ChevronRight size={14} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SOCIAL PROOF */}
      <section className="py-24 px-6 max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <div className="flex justify-center gap-1 mb-3">
            {[...Array(5)].map((_, i) => <Star key={i} size={16} className="fill-dl-warning text-dl-warning" />)}
          </div>
          <p className="text-dl-text-light text-sm">{t('landing.testimonialTitle')}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              quote: "DataLaser replaced our entire data analyst workflow. I get a better briefing every morning than I used to get after paying $8k/month for a consultant.",
              name: 'Sarah K.',
              role: 'Head of Growth, Flink',
            },
            {
              quote: "Connected our Postgres DB and Shopify store in 3 minutes. The AI found a revenue leak we'd been missing for 6 months. That alone paid for 3 years of the product.",
              name: 'Marcus T.',
              role: 'Founder, Polymath Labs',
            },
            {
              quote: "I ask it questions every morning like I'm talking to a CFO. It knows our numbers, our seasonality, and it remembers context. Nothing else does this.",
              name: 'Priya N.',
              role: 'CEO, Bloom Commerce',
            },
          ].map(t => (
            <div key={t.name} className="bg-white border border-dl-border rounded-xl p-6">
              <p className="text-dl-text-medium text-sm leading-relaxed mb-4">"{t.quote}"</p>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-dl-brand-hover flex items-center justify-center text-xs font-bold text-dl-brand">
                  {t.name[0]}
                </div>
                <div>
                  <div className="text-dl-text-dark text-sm font-semibold">{t.name}</div>
                  <div className="text-dl-text-light text-xs">{t.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* PRICING */}
      <section className="py-24 px-6 bg-dl-bg-medium/50 border-y border-dl-border">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="font-display font-bold text-3xl md:text-4xl text-dl-text-dark mb-4">
              {t('landing.pricingTitle')}
            </h2>
            <p className="text-dl-text-medium">{t('landing.pricingSubtitle')}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                name: 'Starter',
                price: 'Free',
                sub: 'forever',
                features: ['1 workspace', '2 data sources', '100K rows', 'Insights + Ask Data', 'Community support'],
                cta: 'Start for free',
                highlight: false,
              },
              {
                name: 'Pro',
                price: '$49',
                sub: t('landing.proPrice').split(' ').slice(1).join(' '),
                features: ['3 users', '10 data sources', '10M rows', 'All 3 interfaces', 'Proactive alerts', 'Email support'],
                cta: 'Get started',
                highlight: true,
              },
              {
                name: 'Business',
                price: '$199',
                sub: 'per month',
                features: ['15 users', 'Unlimited sources', '100M rows', 'Anomaly monitoring', 'Team collaboration', 'Priority support'],
                cta: 'Get started',
                highlight: false,
              },
            ].map(p => (
              <div key={p.name} className={`rounded-xl p-6 border ${p.highlight ? 'bg-dl-brand border-dl-brand text-white' : 'bg-white border-dl-border'}`}>
                <div className={`text-sm font-semibold mb-4 ${p.highlight ? 'text-white/70' : 'text-dl-text-medium'}`}>{p.name}</div>
                <div className="mb-1">
                  <span className={`font-display font-bold text-4xl ${p.highlight ? 'text-white' : 'text-dl-text-dark'}`}>{p.price}</span>
                  <span className={`text-sm ml-1 ${p.highlight ? 'text-white/60' : 'text-dl-text-light'}`}>{p.sub}</span>
                </div>
                <div className={`h-px my-4 ${p.highlight ? 'bg-white/20' : 'bg-dl-border'}`} />
                <ul className="space-y-2.5 mb-6">
                  {p.features.map(f => (
                    <li key={f} className="flex items-center gap-2 text-sm">
                      <Check size={14} className={p.highlight ? 'text-white/80' : 'text-dl-brand'} />
                      <span className={p.highlight ? 'text-white/90' : 'text-dl-text-medium'}>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/en/signup"
                  className={`block text-center py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    p.highlight
                      ? 'bg-white text-dl-brand hover:bg-dl-bg-light'
                      : 'bg-dl-brand text-white hover:bg-dl-brand-dark'
                  }`}
                >
                  {p.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="py-24 px-6 text-center max-w-2xl mx-auto">
        <h2 className="font-display font-bold text-4xl md:text-5xl text-dl-text-dark mb-4">
          {t('landing.readyTitle')}
        </h2>
        <p className="text-dl-text-medium text-lg mb-8">
          {t('landing.readySubtitle')}
        </p>
        <Link
          href="/en/signup"
          className="inline-flex items-center gap-2 bg-dl-brand text-white px-8 py-4 rounded-lg font-medium hover:bg-dl-brand-dark transition-colors text-base"
        >
          Start for free
          <ArrowRight size={18} />
        </Link>
        <p className="text-dl-text-light text-xs mt-4">{t('landing.noCreditCard')}</p>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-dl-border py-8 px-6 bg-white">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-dl-brand font-bold">▲</span>
            <span className="font-display font-bold text-dl-text-dark text-sm">DataLaser</span>
            <span className="text-dl-text-light text-xs ml-2">{t('landing.copyright')}</span>
          </div>
          <div className="flex items-center gap-6">
            {['Privacy', 'Terms', 'Docs', 'Status', 'GitHub'].map(link => (
              <Link key={link} href="#" className="text-dl-text-light text-xs hover:text-dl-text-medium transition-colors">
                {link}
              </Link>
            ))}
          </div>
        </div>
      </footer>

    </div>
  )
}
