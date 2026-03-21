'use client'

import Link from 'next/link'
import { useState } from 'react'
import {
  Database, Zap, BarChart3, ArrowRight, Check,
  ChevronRight, Star, Menu, X
} from 'lucide-react'

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <div className="bg-white text-gray-900 font-body">

      {/* NAV */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-blue-600 font-bold text-xl">▲</span>
              <span className="font-display font-bold text-gray-900 text-lg">DataLaser</span>
            </Link>
            <div className="hidden md:flex items-center gap-6">
              {['Features', 'Connectors', 'Pricing', 'Docs'].map(link => (
                <Link key={link} href="#" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
                  {link}
                </Link>
              ))}
            </div>
          </div>
          <div className="hidden md:flex items-center gap-3">
            <Link href="/login" className="text-sm text-gray-600 hover:text-gray-900 px-4 py-2 transition-colors">
              Sign in
            </Link>
            <Link href="/signup" className="text-sm bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors font-medium">
              Get started free
            </Link>
          </div>
          <button className="md:hidden" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-100 bg-white px-6 py-4 flex flex-col gap-4">
            {['Features', 'Connectors', 'Pricing', 'Docs'].map(link => (
              <Link key={link} href="#" className="text-sm text-gray-600">{link}</Link>
            ))}
            <Link href="/signup" className="text-sm bg-gray-900 text-white px-4 py-2 rounded-lg text-center font-medium">
              Get started free
            </Link>
          </div>
        )}
      </nav>

      {/* HERO */}
      <section className="pt-40 pb-24 px-6 text-center max-w-4xl mx-auto">
        <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-8 border border-blue-100">
          <span className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
          Now with proactive anomaly detection
        </div>

        <h1 className="font-display font-bold text-5xl md:text-7xl text-gray-900 leading-[1.05] tracking-tight mb-6">
          Your data.
          <br />
          <span className="text-blue-600">Interrogated.</span>
        </h1>

        <p className="text-gray-500 text-lg md:text-xl leading-relaxed max-w-2xl mx-auto mb-10">
          DataLaser connects every data source in your business and surfaces
          insights, anomalies, and answers — before you even ask.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-6">
          <Link
            href="/signup"
            className="flex items-center gap-2 bg-gray-900 text-white px-6 py-3 rounded-lg font-medium hover:bg-gray-700 transition-colors text-sm w-full sm:w-auto justify-center"
          >
            Start for free
            <ArrowRight size={16} />
          </Link>
          <Link
            href="#"
            className="flex items-center gap-2 border border-gray-200 text-gray-700 px-6 py-3 rounded-lg font-medium hover:border-gray-400 transition-colors text-sm w-full sm:w-auto justify-center"
          >
            See a demo
          </Link>
        </div>

        <p className="text-gray-400 text-xs">
          No credit card · Setup in 2 minutes · First insight in 5 minutes
        </p>
      </section>

      {/* PRODUCT SCREENSHOT PLACEHOLDER */}
      <section className="px-6 max-w-6xl mx-auto mb-24">
        <div className="rounded-xl border border-gray-200 overflow-hidden shadow-2xl shadow-gray-100">
          {/* window chrome */}
          <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-400" />
            <div className="w-3 h-3 rounded-full bg-yellow-400" />
            <div className="w-3 h-3 rounded-full bg-green-400" />
            <div className="flex-1 flex justify-center">
              <div className="bg-white border border-gray-200 rounded-md px-3 py-1 text-xs text-gray-400 font-mono">
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
            <div className="bg-[#0F1623] border border-[#1A56DB]/30 border-l-4 border-l-[#1A56DB] rounded-lg p-4 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-[#1A56DB] text-xs font-semibold uppercase tracking-widest">AI Executive Summary</span>
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
                  <div className={`text-xs font-mono ${kpi.up ? 'text-green-400' : 'text-red-400'}`}>{kpi.change}</div>
                </div>
              ))}
            </div>
            {/* fake chart */}
            <div className="bg-[#0F1623] border border-[#1A2540] rounded-lg p-4">
              <div className="text-[#E8EDF5] text-xs font-medium mb-3">Revenue Trend</div>
              <svg viewBox="0 0 600 80" className="w-full h-16">
                <defs>
                  <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#1A56DB" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#1A56DB" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {[0,1,2,3].map(i => (
                  <line key={i} x1="0" y1={i * 20 + 10} x2="600" y2={i * 20 + 10} stroke="#1A2540" strokeWidth="1" />
                ))}
                <path d="M0,65 C40,60 80,55 130,45 C180,35 210,50 260,35 C310,20 360,25 420,12 C460,5 520,8 600,3"
                  stroke="#1A56DB" strokeWidth="2" fill="none" />
                <path d="M0,65 C40,60 80,55 130,45 C180,35 210,50 260,35 C310,20 360,25 420,12 C460,5 520,8 600,3 L600,80 L0,80 Z"
                  fill="url(#g)" />
              </svg>
            </div>
          </div>
        </div>
      </section>

      {/* INTEGRATION STRIP */}
      <section className="border-y border-gray-100 py-8 overflow-hidden">
        <p className="text-center text-gray-400 text-xs font-medium uppercase tracking-widest mb-6">
          Works with your entire stack
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
                <span key={item} className="bg-gray-50 border border-gray-200 rounded-full px-4 py-2 text-gray-600 text-xs font-medium flex-shrink-0">
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
          <h2 className="font-display font-bold text-3xl md:text-4xl text-gray-900 mb-4">
            Everything you need to understand your business
          </h2>
          <p className="text-gray-500 text-lg max-w-xl mx-auto">
            No analysts. No dashboards to build. No SQL. Just answers.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              icon: <Database size={22} className="text-blue-600" />,
              iconBg: 'bg-blue-50',
              title: 'Connect Everything',
              body: '40+ native connectors. Databases, warehouses, SaaS tools, ad platforms. Live sync. Zero configuration.',
              chips: ['PostgreSQL', 'Snowflake', 'Shopify', 'Google Ads'],
            },
            {
              icon: <Zap size={22} className="text-violet-600" />,
              iconBg: 'bg-violet-50',
              title: 'AI Reads Your Business',
              body: 'Auto-generated insight reports, anomaly detection, and plain-English answers. No analyst needed.',
              chips: ['Insights', 'Anomalies', 'KPIs', 'Forecasts'],
            },
            {
              icon: <BarChart3 size={22} className="text-green-600" />,
              iconBg: 'bg-green-50',
              title: 'Monitor Continuously',
              body: 'DataLaser watches every metric 24/7 and alerts you the moment something changes — before it costs you.',
              chips: ['Live sync', 'Alerts', 'Trends', 'Real-time'],
            },
          ].map(f => (
            <div key={f.title} className="border border-gray-200 rounded-xl p-6 hover:border-gray-300 hover:shadow-sm transition-all">
              <div className={`${f.iconBg} w-10 h-10 rounded-lg flex items-center justify-center mb-4`}>
                {f.icon}
              </div>
              <h3 className="font-display font-semibold text-gray-900 text-lg mb-2">{f.title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed mb-4">{f.body}</p>
              <div className="flex flex-wrap gap-2">
                {f.chips.map(c => (
                  <span key={c} className="bg-gray-100 text-gray-600 text-xs px-2.5 py-1 rounded-full font-medium">{c}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* THREE INTERFACES */}
      <section className="py-24 px-6 bg-gray-50 border-y border-gray-100">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-display font-bold text-3xl md:text-4xl text-gray-900 mb-4">
              One platform. Three ways to understand your data.
            </h2>
            <p className="text-gray-500 text-lg">
              From AI-written reports to live dashboards — all powered by your real data.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                num: '01',
                title: 'Insights Document',
                body: 'AI generates a full analyst report from your data every morning. Key findings, anomalies, and recommendations — in plain English.',
                color: 'text-blue-600',
                border: 'border-blue-100',
                bg: 'bg-blue-50',
              },
              {
                num: '02',
                title: 'Ask Data',
                body: 'Ask any business question in plain English. Get charts, tables, and narrative answers instantly — no SQL required.',
                color: 'text-violet-600',
                border: 'border-violet-100',
                bg: 'bg-violet-50',
              },
              {
                num: '03',
                title: 'Live Dashboard',
                body: 'Build a live monitoring dashboard in seconds. Describe what you want — AI builds the widgets and wires them to your data.',
                color: 'text-green-600',
                border: 'border-green-100',
                bg: 'bg-green-50',
              },
            ].map(s => (
              <div key={s.num} className="bg-white border border-gray-200 rounded-xl p-6 relative hover:shadow-sm transition-all">
                <div className={`${s.bg} ${s.border} border w-8 h-8 rounded-lg flex items-center justify-center mb-4`}>
                  <span className={`${s.color} font-mono font-bold text-xs`}>{s.num}</span>
                </div>
                <h3 className="font-display font-semibold text-gray-900 text-lg mb-2">{s.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{s.body}</p>
                <div className={`flex items-center gap-1 mt-4 ${s.color} text-xs font-medium`}>
                  Learn more <ChevronRight size={14} />
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
            {[...Array(5)].map((_, i) => <Star key={i} size={16} className="fill-yellow-400 text-yellow-400" />)}
          </div>
          <p className="text-gray-400 text-sm">Loved by operators, founders, and analysts</p>
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
            <div key={t.name} className="border border-gray-200 rounded-xl p-6">
              <p className="text-gray-600 text-sm leading-relaxed mb-4">"{t.quote}"</p>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600">
                  {t.name[0]}
                </div>
                <div>
                  <div className="text-gray-900 text-sm font-semibold">{t.name}</div>
                  <div className="text-gray-400 text-xs">{t.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* PRICING */}
      <section className="py-24 px-6 bg-gray-50 border-y border-gray-100">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="font-display font-bold text-3xl md:text-4xl text-gray-900 mb-4">
              Simple, transparent pricing
            </h2>
            <p className="text-gray-500">Start free. Scale when you need to.</p>
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
                sub: 'per month',
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
              <div key={p.name} className={`rounded-xl p-6 border ${p.highlight ? 'bg-gray-900 border-gray-900 text-white' : 'bg-white border-gray-200'}`}>
                <div className={`text-sm font-semibold mb-4 ${p.highlight ? 'text-gray-400' : 'text-gray-500'}`}>{p.name}</div>
                <div className="mb-1">
                  <span className={`font-display font-bold text-4xl ${p.highlight ? 'text-white' : 'text-gray-900'}`}>{p.price}</span>
                  <span className={`text-sm ml-1 ${p.highlight ? 'text-gray-400' : 'text-gray-400'}`}>{p.sub}</span>
                </div>
                <div className={`h-px my-4 ${p.highlight ? 'bg-gray-700' : 'bg-gray-100'}`} />
                <ul className="space-y-2.5 mb-6">
                  {p.features.map(f => (
                    <li key={f} className="flex items-center gap-2 text-sm">
                      <Check size={14} className={p.highlight ? 'text-blue-400' : 'text-green-500'} />
                      <span className={p.highlight ? 'text-gray-300' : 'text-gray-600'}>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/signup"
                  className={`block text-center py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    p.highlight
                      ? 'bg-white text-gray-900 hover:bg-gray-100'
                      : 'bg-gray-900 text-white hover:bg-gray-700'
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
        <h2 className="font-display font-bold text-4xl md:text-5xl text-gray-900 mb-4">
          Ready to interrogate your data?
        </h2>
        <p className="text-gray-500 text-lg mb-8">
          Connect in 2 minutes. First insight in 5.
        </p>
        <Link
          href="/signup"
          className="inline-flex items-center gap-2 bg-gray-900 text-white px-8 py-4 rounded-lg font-medium hover:bg-gray-700 transition-colors text-base"
        >
          Start for free
          <ArrowRight size={18} />
        </Link>
        <p className="text-gray-400 text-xs mt-4">No credit card required</p>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-gray-100 py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-blue-600 font-bold">▲</span>
            <span className="font-display font-bold text-gray-900 text-sm">DataLaser</span>
            <span className="text-gray-400 text-xs ml-2">© 2025 DataLaser. All rights reserved.</span>
          </div>
          <div className="flex items-center gap-6">
            {['Privacy', 'Terms', 'Docs', 'Status', 'GitHub'].map(link => (
              <Link key={link} href="#" className="text-gray-400 text-xs hover:text-gray-600 transition-colors">
                {link}
              </Link>
            ))}
          </div>
        </div>
      </footer>

    </div>
  )
}