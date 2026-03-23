'use client'
import { useTranslations } from 'next-intl'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { createBrowserClient } from '@supabase/auth-helpers-nextjs'
import { Check, Zap } from 'lucide-react'
import { OrgSettingsShell } from '@/components/settings/OrgSettingsShell'

export default function OrgBillingPage() {
  const t = useTranslations()
  const params = useParams()
  const orgSlug = params.orgSlug as string
  const [plan, setPlan] = useState('free')
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(false)
  const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('organizations').select('plan').eq('slug', orgSlug).single()
      if (data) setPlan(data.plan)
      setLoading(false)
    }
    load()
  }, [orgSlug])

  const showToast = () => { setToast(true); setTimeout(() => setToast(false), 4000) }

  const plans = [
    { name: 'Free', price: '$0', sub: 'forever', features: ['1 workspace', '2 data sources', '100K rows', 'Insights + Ask Data', 'Community support'], current: plan === 'free' },
    { name: 'Pro', price: '$49', sub: 'per month', features: ['3 users', '10 data sources', '10M rows', 'All 3 interfaces', 'Proactive alerts', 'Email support'], current: plan === 'pro', highlight: true },
    { name: 'Enterprise', price: 'Custom', sub: 'contact us', features: ['Unlimited users', 'Unlimited sources', '100M+ rows', 'SSO & audit logs', 'Dedicated support', 'Custom integrations'], current: plan === 'enterprise' },
  ]

  return (
    <OrgSettingsShell orgSlug={orgSlug}>
      {loading ? <div className="h-48 rounded-dl-md dl-shimmer" /> : <>
        <h1 className="text-dl-2xl font-black text-dl-text-dark mb-6">{t("settings.billing")}</h1>
        <div className="grid grid-cols-3 gap-4">
          {plans.map(p => (
            <div key={p.name} className={`rounded-dl-lg p-5 border ${p.current ? 'border-dl-brand bg-dl-brand-hover' : 'border-dl-border bg-dl-bg'}`}>
              <div className="flex items-center justify-between mb-3"><span className="text-dl-sm font-black text-dl-text-dark">{p.name}</span>{p.current && <span className="dl-badge-info">Current</span>}</div>
              <div className="mb-3"><span className="text-dl-2xl font-black text-dl-text-dark">{p.price}</span><span className="text-dl-xs text-dl-text-light ml-1">{p.sub}</span></div>
              <ul className="space-y-1.5 mb-4">{p.features.map(f => <li key={f} className="flex items-center gap-2 text-dl-xs text-dl-text-medium"><Check size={12} className="text-dl-brand flex-shrink-0" />{f}</li>)}</ul>
              {!p.current && <button onClick={showToast} className="dl-btn-primary w-full text-dl-xs py-1.5 justify-center"><Zap size={12} />{p.name === 'Enterprise' ? 'Contact sales' : 'Upgrade'}</button>}
            </div>
          ))}
        </div>
        {toast && <div className="fixed bottom-6 right-6 bg-dl-bg border border-dl-border shadow-dl-lg rounded-dl-lg px-4 py-3 flex items-center gap-2 z-50"><Zap size={14} className="text-dl-brand" /><span className="text-dl-sm text-dl-text-dark font-bold">Coming soon — contact us at hello@datalaser.io</span></div>}
      </>}
    </OrgSettingsShell>
  )
}
