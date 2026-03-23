'use client'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import StepIndicator from '@/components/onboarding/StepIndicator'
import { Users, User } from 'lucide-react'

export default function SetupPage() {
  const t = useTranslations()
  const [name, setName] = useState('')
  const [mode, setMode] = useState<'personal' | 'team' | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleContinue = async () => {
    if (!name.trim() || !mode) return
    setLoading(true)

    // Store in localStorage for next steps to use
    localStorage.setItem('datalaser_onboarding', JSON.stringify({
      name: name.trim(),
      mode,
    }))

    if (mode === 'personal') {
      router.push('/onboarding/project')
    } else {
      router.push('/onboarding/org')
    }
  }

  return (
    <div className="max-w-lg mx-auto pt-16 px-6">
      <StepIndicator current={1} labels={['You', 'Project', 'Data']} />

      <h1 className="text-dl-2xl font-black text-dl-text-dark mb-1">
        Welcome to DataLaser
      </h1>
      <p className="text-dl-text-medium text-dl-base mb-10">
        Let&apos;s get you set up in under 2 minutes.
      </p>

      <div className="mb-6">
        <label className="dl-label">Your name</label>
        <input
          className="dl-input"
          placeholder={t("onboarding.fullName")}
          value={name}
          onChange={e => setName(e.target.value)}
          autoFocus
        />
      </div>

      <div className="mb-10">
        <label className="dl-label">How are you using DataLaser?</label>
        <div className="grid grid-cols-2 gap-3 mt-2">
          <button
            onClick={() => setMode('personal')}
            className={`
              p-4 rounded-dl-lg border text-left transition-all
              ${mode === 'personal'
                ? 'border-dl-brand bg-dl-brand-hover'
                : 'border-dl-border-dark hover:border-dl-brand'}
            `}
          >
            <User size={20} className={`mb-2 ${mode === 'personal' ? 'text-dl-brand' : 'text-dl-text-light'}`} />
            <div className="text-dl-sm font-black text-dl-text-dark">Just me</div>
            <div className="text-dl-xs text-dl-text-light mt-0.5">
              Personal projects and analysis
            </div>
          </button>

          <button
            onClick={() => setMode('team')}
            className={`
              p-4 rounded-dl-lg border text-left transition-all
              ${mode === 'team'
                ? 'border-dl-brand bg-dl-brand-hover'
                : 'border-dl-border-dark hover:border-dl-brand'}
            `}
          >
            <Users size={20} className={`mb-2 ${mode === 'team' ? 'text-dl-brand' : 'text-dl-text-light'}`} />
            <div className="text-dl-sm font-black text-dl-text-dark">My team</div>
            <div className="text-dl-xs text-dl-text-light mt-0.5">
              Collaborate with your organization
            </div>
          </button>
        </div>
      </div>

      <button
        onClick={handleContinue}
        disabled={!name.trim() || !mode || loading}
        className={`dl-btn-primary w-full py-2.5 text-dl-base font-black justify-center
          ${(!name.trim() || !mode || loading) ? 'opacity-40 cursor-not-allowed' : ''}`}
      >
        {loading ? 'Setting up...' : 'Continue →'}
      </button>
    </div>
  )
}
