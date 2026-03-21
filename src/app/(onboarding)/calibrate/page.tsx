'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/auth-helpers-nextjs'
import { BarChart3, Clock, Zap, Calendar } from 'lucide-react'
import StepIndicator from '@/components/onboarding/StepIndicator'

const METRICS = [
  'Revenue', 'MRR', 'Churn Rate', 'CAC', 'LTV', 'Conversion Rate',
  'Ad Spend', 'ROAS', 'Avg Order Value', 'Gross Margin', 'Burn Rate', 'NPS',
]

const FREQUENCIES = [
  { id: 'realtime', icon: Zap, label: 'Real-time', desc: 'Continuous sync' },
  { id: 'daily', icon: Calendar, label: 'Daily', desc: 'Once per day' },
  { id: 'hourly', icon: Clock, label: 'Hourly', desc: 'Every hour' },
  { id: 'weekly', icon: BarChart3, label: 'Weekly', desc: 'Once per week' },
]

export default function CalibratePage() {
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([])
  const [frequency, setFrequency] = useState<string | null>('daily')
  const [loading, setLoading] = useState(false)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const router = useRouter()

  const toggleMetric = (m: string) => {
    setSelectedMetrics(prev =>
      prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]
    )
  }

  const handleLaunch = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('profiles').update({
        primary_metrics: selectedMetrics,
        data_update_frequency: frequency,
      }).eq('id', user.id)
    }
    router.push('/app/insights')
  }

  return (
    <div className="max-w-lg mx-auto pt-16 px-6">
      <StepIndicator current={3} labels={['Workspace', 'Connect', 'Calibrate']} />

      <h1 className="text-mb-2xl font-black text-mb-text-dark mb-1">Almost there</h1>
      <p className="text-mb-text-medium text-mb-base mb-8">
        Help the AI understand what matters most to you.
      </p>

      {/* Metrics */}
      <div className="mb-6">
        <label className="mb-label">Key metrics you track</label>
        <div className="flex flex-wrap gap-2 mt-1">
          {METRICS.map(m => (
            <button
              key={m}
              onClick={() => toggleMetric(m)}
              className={`
                border rounded-mb-md px-4 py-2.5
                text-mb-sm font-bold cursor-pointer transition-all
                ${selectedMetrics.includes(m)
                  ? 'border-mb-brand text-mb-brand bg-mb-brand-hover'
                  : 'border-mb-border-dark text-mb-text-medium hover:border-mb-brand hover:text-mb-brand hover:bg-mb-brand-hover'}
              `}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Frequency */}
      <div className="mt-6">
        <label className="mb-label">How often should data sync?</label>
        <div className="grid grid-cols-2 gap-3 mt-1">
          {FREQUENCIES.map(f => (
            <button
              key={f.id}
              onClick={() => setFrequency(f.id)}
              className={`
                border rounded-mb-md p-4 text-left cursor-pointer transition-all
                ${frequency === f.id
                  ? 'border-mb-brand bg-mb-brand-hover'
                  : 'border-mb-border-dark hover:border-mb-brand'}
              `}
            >
              <f.icon
                className={`w-5 h-5 mb-2 ${frequency === f.id ? 'text-mb-brand' : 'text-mb-text-light'}`}
              />
              <div className={`text-mb-sm font-black ${frequency === f.id ? 'text-mb-brand' : 'text-mb-text-dark'}`}>
                {f.label}
              </div>
              <div className="text-mb-xs text-mb-text-light">{f.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Launch */}
      <button
        onClick={handleLaunch}
        disabled={loading}
        className={`mb-btn-primary w-full py-2.5 text-mb-base mt-8 font-black justify-center ${loading ? 'opacity-60 cursor-not-allowed' : ''}`}
      >
        {loading ? 'Launching...' : 'Launch DataLaser'}
      </button>
    </div>
  )
}
