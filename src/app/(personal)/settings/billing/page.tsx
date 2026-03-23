'use client'
import { useTranslations } from 'next-intl'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/auth-helpers-nextjs'
import { Check, Zap } from 'lucide-react'
import { SettingsShell } from '@/components/settings/SettingsShell'

export default function BillingPage() {
  const t = useTranslations()
  const [plan, setPlan] = useState('free')
  const [projectCount, setProjectCount] = useState(0)
  const [sourceCount, setSourceCount] = useState(0)
  const [totalRows, setTotalRows] = useState(0)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(false)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Plan
      const { data: membership } = await supabase
        .from('org_members')
        .select('organizations(plan)')
        .eq('user_id', user.id)
        .limit(1)
        .single()
      if (membership) {
        const org = membership.organizations as unknown as { plan: string }
        setPlan(org?.plan ?? 'free')
      }

      // Get workspace
      const { data: wsMembership } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', user.id)
        .limit(1)
        .single()
      const wsId = wsMembership?.workspace_id

      if (wsId) {
        const { count: pc } = await supabase
          .from('projects')
          .select('*', { count: 'exact', head: true })
          .eq('workspace_id', wsId)
        setProjectCount(pc ?? 0)

        const { data: sources } = await supabase
          .from('data_sources')
          .select('row_count')
          .eq('workspace_id', user.id)
        setSourceCount(sources?.length ?? 0)
        setTotalRows(sources?.reduce((sum, s) => sum + (s.row_count ?? 0), 0) ?? 0)
      }

      setLoading(false)
    }
    load()
  }, [])

  const showUpgradeToast = () => {
    setToast(true)
    setTimeout(() => setToast(false), 4000)
  }

  const plans = [
    {
      name: 'Free',
      price: '$0',
      sub: 'forever',
      features: ['1 workspace', '2 data sources', '100K rows', 'Insights + Ask Data', 'Community support'],
      current: plan === 'free',
    },
    {
      name: 'Pro',
      price: '$49',
      sub: 'per month',
      features: ['3 users', '10 data sources', '10M rows', 'All 3 interfaces', 'Proactive alerts', 'Email support'],
      current: plan === 'pro',
      highlight: true,
    },
    {
      name: 'Enterprise',
      price: 'Custom',
      sub: 'contact us',
      features: ['Unlimited users', 'Unlimited sources', '100M+ rows', 'SSO & audit logs', 'Dedicated support', 'Custom integrations'],
      current: plan === 'enterprise',
    },
  ]

  if (loading) {
    return (
      <SettingsShell>
        <div className="space-y-4">
          <div className="h-10 rounded-dl-md dl-shimmer" />
          <div className="h-32 rounded-dl-md dl-shimmer" />
          <div className="h-48 rounded-dl-md dl-shimmer" />
        </div>
      </SettingsShell>
    )
  }

  return (
    <SettingsShell>
      <h1 className="text-dl-2xl font-black text-dl-text-dark mb-6">{t("settings.billing")}</h1>

      {/* Usage stats */}
      <div className="mb-8">
        <p className="dl-section-header mb-3">Current usage</p>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Projects', value: projectCount },
            { label: 'Data sources', value: sourceCount },
            { label: 'Rows analyzed', value: totalRows.toLocaleString() },
          ].map(stat => (
            <div key={stat.label} className="dl-card p-4">
              <p className="text-dl-xs font-bold text-dl-text-light uppercase tracking-wider mb-1">{stat.label}</p>
              <p className="text-dl-2xl font-black text-dl-text-dark font-mono">{stat.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Plan cards */}
      <p className="dl-section-header mb-3">Plans</p>
      <div className="grid grid-cols-3 gap-4">
        {plans.map(p => (
          <div
            key={p.name}
            className={`rounded-dl-lg p-5 border ${
              p.current
                ? 'border-dl-brand bg-dl-brand-hover'
                : 'border-dl-border bg-dl-bg'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-dl-sm font-black text-dl-text-dark">{p.name}</span>
              {p.current && <span className="dl-badge-info">Current</span>}
            </div>
            <div className="mb-3">
              <span className="text-dl-2xl font-black text-dl-text-dark">{p.price}</span>
              <span className="text-dl-xs text-dl-text-light ml-1">{p.sub}</span>
            </div>
            <ul className="space-y-1.5 mb-4">
              {p.features.map(f => (
                <li key={f} className="flex items-center gap-2 text-dl-xs text-dl-text-medium">
                  <Check size={12} className="text-dl-brand flex-shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            {!p.current && (
              <button onClick={showUpgradeToast} className="dl-btn-primary w-full text-dl-xs py-1.5 justify-center">
                <Zap size={12} />
                {p.name === 'Enterprise' ? 'Contact sales' : 'Upgrade'}
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 bg-dl-bg border border-dl-border shadow-dl-lg rounded-dl-lg px-4 py-3 flex items-center gap-2 z-50">
          <Zap size={14} className="text-dl-brand" />
          <span className="text-dl-sm text-dl-text-dark font-bold">Coming soon — contact us at hello@datalaser.io</span>
        </div>
      )}
    </SettingsShell>
  )
}
